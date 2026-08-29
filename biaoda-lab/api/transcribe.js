const crypto = require('crypto');

const XUNFEI_HOST = 'https://office-api-ist-dx.iflyaisol.com';
const POLL_INTERVAL_MS = 2500;
const MAX_WAIT_MS = 50000;

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

/** 对齐 Java URLEncoder.encode(value, UTF-8) */
function javaUrlEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/%20/g, '+')
    .replace(/%2A/g, '*');
}

function buildSignedQuery(params, secret) {
  const keys = Object.keys(params)
    .filter((key) => key !== 'signature' && params[key] !== undefined && params[key] !== null && params[key] !== '')
    .sort();
  const query = keys.map((key) => `${key}=${javaUrlEncode(params[key])}`).join('&');
  const signature = crypto.createHmac('sha1', secret).update(query, 'utf8').digest('base64');
  return { query, signature };
}

function formatDateTime() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`;
}

function randomId(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseMultipartAudio(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('error', reject);
    req.on('end', () => {
      try {
        resolve(extractAudioPart(Buffer.concat(chunks), req.headers['content-type'] || ''));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function extractAudioPart(buffer, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!match) throw new Error('无效的上传格式');

  const delim = Buffer.from(`--${(match[1] || match[2]).trim()}`);
  const indices = [];
  let cursor = 0;
  while (cursor < buffer.length) {
    const idx = buffer.indexOf(delim, cursor);
    if (idx === -1) break;
    indices.push(idx);
    cursor = idx + delim.length;
  }

  for (let i = 0; i < indices.length - 1; i++) {
    let slice = buffer.subarray(indices[i] + delim.length, indices[i + 1]);
    if (slice[0] === 13 && slice[1] === 10) slice = slice.subarray(2);
    if (slice.length >= 2 && slice[slice.length - 2] === 13 && slice[slice.length - 1] === 10) {
      slice = slice.subarray(0, slice.length - 2);
    }
    if (!slice.length || (slice[0] === 45 && slice[1] === 45)) continue;

    const headerEnd = slice.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) continue;
    const headers = slice.subarray(0, headerEnd).toString('utf8');
    if (!/name="audio"/i.test(headers)) continue;

    const filenameMatch = /filename="([^"]*)"/i.exec(headers);
    const typeMatch = /Content-Type:\s*([^\r\n]+)/i.exec(headers);
    return {
      buffer: slice.subarray(headerEnd + 4),
      filename: filenameMatch ? filenameMatch[1] : 'recording.webm',
      mime: typeMatch ? typeMatch[1].trim() : 'audio/webm',
    };
  }

  throw new Error('未找到音频文件');
}

function resolveFileName(filename, mime) {
  const name = (filename || '').toLowerCase();
  const type = (mime || '').toLowerCase();
  if (/\.(mp3|wav|pcm|opus|flac|ogg)$/.test(name)) return filename;
  if (type.includes('webm') || name.endsWith('.webm')) return 'recording.opus';
  return filename || 'recording.opus';
}

function isOk(code) {
  return String(code) === '000000';
}

async function xunfeiRequest({ path, params, secret, body, contentType }) {
  const { query, signature } = buildSignedQuery(params, secret);
  const response = await fetch(`${XUNFEI_HOST}${path}?${query}`, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      signature,
    },
    body,
  });
  const data = await response.json().catch(() => null);
  if (!data) throw new Error(`讯飞接口无响应: ${response.status}`);
  return data;
}

function extractTranscript(orderResult) {
  if (!orderResult) return '';
  const parsed = typeof orderResult === 'string' ? JSON.parse(orderResult) : orderResult;
  const lattice = parsed.lattice || [];
  const pieces = [];

  for (const item of lattice) {
    const best = typeof item.json_1best === 'string' ? JSON.parse(item.json_1best) : item.json_1best;
    for (const rt of best?.st?.rt || []) {
      for (const ws of rt.ws || []) {
        pieces.push(ws.cw?.[0]?.w || '');
      }
    }
  }

  return pieces.join('').trim();
}

async function transcribeWithXunfei(audio) {
  const appId = process.env.XUNFEI_APPID;
  const accessKeyId = process.env.XUNFEI_APIKEY;
  const secret = process.env.XUNFEI_APISECRET;

  if (!appId || !accessKeyId || !secret) {
    throw new Error('讯飞 API 凭证未配置');
  }

  const signatureRandom = randomId(16);
  const fileName = resolveFileName(audio.filename, audio.mime);

  const uploaded = await xunfeiRequest({
    path: '/v2/upload',
    params: {
      appId,
      accessKeyId,
      dateTime: formatDateTime(),
      signatureRandom,
      fileSize: String(audio.buffer.length),
      fileName,
      language: 'autodialect',
      durationCheckDisable: 'true',
    },
    secret,
    body: audio.buffer,
    contentType: 'application/octet-stream',
  });

  if (!isOk(uploaded.code) || !uploaded.content?.orderId) {
    throw new Error(uploaded.desc || uploaded.message || `讯飞上传失败: ${uploaded.code}`);
  }

  const orderId = uploaded.content.orderId;
  const started = Date.now();

  while (Date.now() - started < MAX_WAIT_MS) {
    await sleep(POLL_INTERVAL_MS);

    const result = await xunfeiRequest({
      path: '/v2/getResult',
      params: {
        accessKeyId,
        dateTime: formatDateTime(),
        signatureRandom,
        orderId,
        resultType: 'transfer',
      },
      secret,
      body: '{}',
      contentType: 'application/json',
    });

    if (!isOk(result.code)) {
      throw new Error(result.desc || result.message || `讯飞查询失败: ${result.code}`);
    }

    const info = result.content?.orderInfo || {};
    if (info.status === -1 || (info.failType && info.failType !== 0)) {
      throw new Error(`转写失败（failType=${info.failType || 'unknown'}）`);
    }
    if (info.status === 4) {
      const transcript = extractTranscript(result.content.orderResult);
      if (!transcript) throw new Error('转写结果为空，请重新录音后再试');
      return transcript;
    }
  }

  throw new Error('转写超时，请稍后重试');
}

async function handler(req, res) {
  // 通用响应头：跨域 + 防 MIME 嗅探 + 禁用缓存
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, null);
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: '仅支持 POST' });
    return;
  }

  try {
    const audio = await parseMultipartAudio(req);
    if (!audio.buffer.length) {
      sendJson(res, 400, { error: '音频文件为空' });
      return;
    }
    const transcript = await transcribeWithXunfei(audio);
    sendJson(res, 200, { transcript });
  } catch (err) {
    console.error('[transcribe]', err);
    sendJson(res, 500, { error: err.message || '转写失败' });
  }
}

handler.config = {
  api: { bodyParser: false },
  maxDuration: 60,
};

module.exports = handler;
