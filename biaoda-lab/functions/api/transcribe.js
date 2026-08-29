// 📎 Cloudflare Pages Functions 版本 · 逻辑与 api/transcribe.js（Vercel 版）保持一致
// 📍 差异说明：Workers 运行时无 Node Buffer/crypto 模块，
//    已用 Web Crypto（HMAC-SHA1）+ Uint8Array（multipart 解析）等价实现。
// 📍 两版需同步维护：讯飞签名规则 / 轮询参数 / 错误文案不允许出现差异。

import { json, corsPreflight } from './_lib.js';

const XUNFEI_HOST = 'https://office-api-ist-dx.iflyaisol.com';
const POLL_INTERVAL_MS = 2500;
const MAX_WAIT_MS = 50000;

/** 对齐 Java URLEncoder.encode(value, UTF-8) */
function javaUrlEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/%20/g, '+')
    .replace(/%2A/g, '*');
}

/** Web Crypto 版 HMAC-SHA1 → Base64（等价 Node crypto.createHmac('sha1', secret)） */
async function hmacSha1Base64(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const bytes = new Uint8Array(sig);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** 计算签名 query（原 buildSignedQuery 的异步版） */
async function buildSignedQuery(params, secret) {
  const keys = Object.keys(params)
    .filter((key) => key !== 'signature' && params[key] !== undefined && params[key] !== null && params[key] !== '')
    .sort();
  const query = keys.map((key) => `${key}=${javaUrlEncode(params[key])}`).join('&');
  const signature = await hmacSha1Base64(secret, query);
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

/** Web Crypto 版随机 ID（等价 Node crypto.randomBytes） */
function randomId(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Uint8Array 版 indexOf（等价 Buffer.indexOf(haystack, needle)） */
function indexOfBytes(hay, needle, from = 0) {
  const first = needle[0];
  const max = hay.length - needle.length;
  for (let i = from; i <= max; i++) {
    if (hay[i] !== first) continue;
    let j = 1;
    while (j < needle.length && hay[i + j] === needle[j]) j++;
    if (j === needle.length) return i;
  }
  return -1;
}

function bytesOf(str) {
  return new TextEncoder().encode(str);
}

async function parseMultipartAudio(request) {
  const contentType = request.headers.get('content-type') || '';
  const bytes = new Uint8Array(await request.arrayBuffer());
  return extractAudioPart(bytes, contentType);
}

/** 从 multipart 请求体中提取 name="audio" 的文件分片（Uint8Array 版） */
function extractAudioPart(bytes, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!match) throw new Error('无效的上传格式');

  const delim = bytesOf(`--${(match[1] || match[2]).trim()}`);
  const indices = [];
  let cursor = 0;
  while (cursor < bytes.length) {
    const idx = indexOfBytes(bytes, delim, cursor);
    if (idx === -1) break;
    indices.push(idx);
    cursor = idx + delim.length;
  }

  for (let i = 0; i < indices.length - 1; i++) {
    let slice = bytes.subarray(indices[i] + delim.length, indices[i + 1]);
    if (slice[0] === 13 && slice[1] === 10) slice = slice.subarray(2);
    if (slice.length >= 2 && slice[slice.length - 2] === 13 && slice[slice.length - 1] === 10) {
      slice = slice.subarray(0, slice.length - 2);
    }
    if (!slice.length || (slice[0] === 45 && slice[1] === 45)) continue;

    const headerEnd = indexOfBytes(slice, bytesOf('\r\n\r\n'));
    if (headerEnd === -1) continue;
    const headers = new TextDecoder().decode(slice.subarray(0, headerEnd));
    if (!/name="audio"/i.test(headers)) continue;

    const filenameMatch = /filename="([^"]*)"/i.exec(headers);
    const typeMatch = /Content-Type:\s*([^\r\n]+)/i.exec(headers);
    return {
      bytes: slice.subarray(headerEnd + 4),
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
  const { query, signature } = await buildSignedQuery(params, secret);
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

async function transcribeWithXunfei(audio, env) {
  const appId = env.XUNFEI_APPID;
  const accessKeyId = env.XUNFEI_APIKEY;
  const secret = env.XUNFEI_APISECRET;

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
      fileSize: String(audio.bytes.length),
      fileName,
      language: 'autodialect',
      durationCheckDisable: 'true',
    },
    secret,
    body: audio.bytes,
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

export async function onRequestOptions() {
  return corsPreflight();
}

export async function onRequestPost({ request, env }) {
  try {
    const audio = await parseMultipartAudio(request);
    if (!audio.bytes.length) {
      return json({ error: '音频文件为空' }, 400);
    }
    const transcript = await transcribeWithXunfei(audio, env);
    return json({ transcript });
  } catch (err) {
    console.error('[transcribe]', err);
    return json({ error: err.message || '转写失败' }, 500);
  }
}
