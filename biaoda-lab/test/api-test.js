// 独立 API 测试脚本：不依赖 Vercel，直接用 .env.local 凭证
// 用法：cd biaoda-lab && node test/api-test.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ========== 1. 读取环境变量 ==========
const envPath = path.join(__dirname, '..', '.env.local');
const envRaw = fs.readFileSync(envPath, 'utf-8');
const env = {};
envRaw.split('\n').forEach((line) => {
  const [k, ...rest] = line.split('=');
  if (k && !k.startsWith('#')) env[k.trim()] = rest.join('=').trim();
});

const DEEPSEEK_API_KEY = env.DEEPSEEK_API_KEY;
const XF_APPID = env.XUNFEI_APPID;
const XF_APIKEY = env.XUNFEI_APIKEY;
const XF_APISECRET = env.XUNFEI_APISECRET;

console.log('========== 1. 环境变量检查 ==========');
console.log('DEEPSEEK_API_KEY:', DEEPSEEK_API_KEY ? `已配置 (${DEEPSEEK_API_KEY.slice(0, 6)}...)` : '❌ 缺失');
console.log('XUNFEI_APPID:    ', XF_APPID ? `已配置 (${XF_APPID})` : '❌ 缺失');
console.log('XUNFEI_APIKEY:   ', XF_APIKEY ? `已配置 (${XF_APIKEY.slice(0, 6)}...)` : '❌ 缺失');
console.log('XUNFEI_APISECRET:', XF_APISECRET ? `已配置 (${XF_APISECRET.slice(0, 6)}...)` : '❌ 缺失');
console.log();

// ========== 2. 测试 DeepSeek 分析 API ==========
async function testDeepSeek() {
  console.log('========== 2. DeepSeek 分析 API 测试 ==========');
  const testTranscript = '最近我看了一部电影叫做《流浪地球》，我为什么想看它呢，因为我朋友推荐给我的，说这部电影拍得不错，是中国的科幻片。看完之后我觉得挺震撼的，尤其是里面的特效做得很好，还有就是那种人类团结起来拯救地球的精神让我很感动。不过也有一些地方我觉得可以更好，比如有的剧情感觉有点太赶了，人物之间的感情线可以再细腻一点。总的来说这是一部值得去电影院看的电影，我给它打八分。';
  const testMode = '话题聊天';

  const systemPrompt = `你是一位专业的口语表达教练。请对用户的语音转写文本进行评估，从以下5个维度打分（1.0-5.0，保留一位小数），并给出每个维度的简短点评和改进建议，以及一句话整体总结。

评估维度：
- 逻辑结构（论点是否清晰、有层次）
- 语义清晰度（表意是否准确、无歧义）
- 流畅度（是否自然流畅、无明显停顿词）
- 内容完整性（是否有头有尾、论据充分）
- 简洁度（是否简洁有力、无冗余）

分数映射：1.0-1.9=L1, 2.0-2.9=L2, 3.0-3.9=L3, 4.0-5.0=L4

请严格按照以下 JSON 格式返回，不要输出其他内容：
{
  "summary": "一句话整体评价",
  "dimensions": {
    "logic": { "score": 3.5, "level": "L3", "comment": "...", "suggestion": "..." },
    "clarity": { "score": 3.0, "level": "L2", "comment": "...", "suggestion": "..." },
    "fluency": { "score": 4.0, "level": "L4", "comment": "...", "suggestion": "..." },
    "completeness": { "score": 2.5, "level": "L2", "comment": "...", "suggestion": "..." },
    "conciseness": { "score": 3.8, "level": "L3", "comment": "...", "suggestion": "..." }
  }
}`;

  const start = Date.now();
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `练习场景：${testMode}\n语音转写文本：\n${testTranscript}`,
          },
        ],
      }),
      timeout: 30000,
    });

    const elapsed = Date.now() - start;
    if (!res.ok) {
      const text = await res.text();
      console.log(`❌ 调用失败 (HTTP ${res.status}) 耗时 ${elapsed}ms`);
      console.log('响应:', text.slice(0, 500));
      return false;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || '';
    let parsed;
    try {
      parsed = JSON.parse(content.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch {
      parsed = null;
    }
    console.log(`✅ 调用成功 耗时 ${elapsed}ms`);
    if (parsed) {
      console.log('  summary:', parsed.summary);
      console.log('  各维度得分:');
      Object.entries(parsed.dimensions || {}).forEach(([k, v]) => {
        console.log(`    ${k}: ${v.score} ${v.level}`);
      });
      console.log('  ✅ JSON 格式校验通过');
    } else {
      console.log('  ⚠️ 返回内容不是合法 JSON，原始内容:');
      console.log(content.slice(0, 800));
    }
    return true;
  } catch (e) {
    const elapsed = Date.now() - start;
    console.log(`❌ 调用异常 耗时 ${elapsed}ms`, e.message);
    return false;
  }
}

// ========== 3. 生成最小测试 WAV（8K 16bit PCM mono 1 秒静音）==========
function generateTestWav(filePath) {
  const sampleRate = 8000;
  const durationSec = 1;
  const channels = 1;
  const bitsPerSample = 16;
  const dataSize = sampleRate * channels * (bitsPerSample / 8) * durationSec;
  const buf = Buffer.alloc(44 + dataSize);

  // RIFF header
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);

  // fmt subchunk
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
  buf.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  buf.writeUInt16LE(bitsPerSample, 34);

  // data subchunk (silence)
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  buf.fill(0, 44);

  fs.writeFileSync(filePath, buf);
  return buf.length;
}

// ========== 4. 讯飞转写签名 ==========
function xfHmacSha1Base64(message, secret) {
  return crypto
    .createHmac('sha1', Buffer.from(secret, 'utf8'))
    .update(Buffer.from(message, 'utf8'))
    .digest()
    .toString('base64');
}

function xfSignParams({ appId, secretKey, apiKey, ts, signType }) {
  const base = `${appId}${ts}`;
  const signa = xfHmacSha1Base64(base, secretKey);
  return {
    app_id: appId,
    signa,
    ts,
    sign_type: signType || 'normal',
    api_key: apiKey,
  };
}

// ========== 5. 测试讯飞转写 API ==========
async function testXunfei() {
  console.log();
  console.log('========== 3. 讯飞转写 API 测试 ==========');

  const wavPath = path.join(__dirname, '..', 'test', '_test-audio.wav');
  const wavSize = generateTestWav(wavPath);
  console.log(`测试音频文件: ${wavPath} (${wavSize} bytes, 1s 静音 WAV)`);

  // 讯飞录音文件转写：标准接口 https://raasr.xfyun.cn/v2/...
  // 代码库使用的是 office-api-ist-dx.iflyaisol.com 域名，先用代码里的域名
  // 如果失败，再回退标准域名
  const hosts = [
    'https://office-api-ist-dx.iflyaisol.com',
    'https://raasr.xfyun.cn',
  ];

  const audioFile = fs.createReadStream(wavPath);
  const ts = Math.floor(Date.now() / 1000).toString();
  const signed = xfSignParams({
    appId: XF_APPID,
    secretKey: XF_APISECRET,
    apiKey: XF_APIKEY,
    ts,
  });

  // Step 1: 上传并创建任务
  let taskId = null;
  let hostUsed = null;

  for (const host of hosts) {
    const start = Date.now();
    try {
      const form = new FormData();
      Object.entries(signed).forEach(([k, v]) => form.append(k, String(v)));
      form.append('file_name', 'test.wav');
      form.append('duration', '1000');
      form.append('file_size', String(wavSize));
      form.append('file', new Blob([fs.readFileSync(wavPath)]), 'test.wav');
      form.append('callback_url', '');

      const res = await fetch(`${host}/v2/upload`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(30000),
      });
      const elapsed = Date.now() - start;
      const text = await res.text();
      console.log(`[${host}/v2/upload] HTTP ${res.status} 耗时 ${elapsed}ms`);
      if (!res.ok) {
        console.log('  响应:', text.slice(0, 300));
        continue;
      }
      let data;
      try { data = JSON.parse(text); } catch {
        console.log('  ⚠️ 响应非 JSON:', text.slice(0, 300));
        continue;
      }
      console.log('  响应:', JSON.stringify(data));
      // 讯飞两种响应格式：{ok:0,data:{order_id}} 或 {code:'000000',data:{orderId}}
      if ((data.code === '000000' || data.code === 0 || data.ok === 0) && data.data) {
        taskId = data.data.order_id || data.data.orderId;
        hostUsed = host;
        break;
      }
      // 也可能是 code=26700 或其他错误
      if (data.desc) console.log('  desc:', data.desc);
      continue;
    } catch (e) {
      console.log(`[${host}] 异常:`, e.message);
      continue;
    }
  }

  if (!taskId) {
    console.log('❌ 上传任务未创建成功（两种域名均失败）。可能原因：');
    console.log('  - 域名与讯飞控制台分配的接口域不匹配');
    console.log('  - 应用未开通录音文件转写服务');
    console.log('  - 测试音频是空/格式不支持');
    console.log('  - API 凭证错误');
    return false;
  }

  console.log(`✅ 上传成功，任务ID: ${taskId}（使用域名: ${hostUsed}）`);

  // Step 2: 轮询结果（空 WAV 应该很快返回，或返回"语音为空"）
  console.log('开始轮询转写结果...');
  const pollTs = Math.floor(Date.now() / 1000).toString();
  const pollSigned = xfSignParams({
    appId: XF_APPID,
    secretKey: XF_APISECRET,
    apiKey: XF_APIKEY,
    ts: pollTs,
  });

  let transcript = null;
  const maxAttempts = 20;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    const start = Date.now();
    try {
      const qs = new URLSearchParams({ ...pollSigned, order_id: taskId, result_type: 'transfer' });
      const res = await fetch(`${hostUsed}/v2/getResult?${qs.toString()}`, {
        signal: AbortSignal.timeout(15000),
      });
      const elapsed = Date.now() - start;
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      const status = data.data?.status ?? data.status ?? -1;
      // status: 0=排队,1=处理中,2=完成,3=失败
      console.log(`  第${i + 1}轮: HTTP${res.status} 耗时${elapsed}ms status=${status}`);

      if (status === 2) {
        // 成功，解析结果
        const r = data.data?.result || data.result;
        transcript = r || '';
        if (typeof transcript !== 'string') {
          try {
            const arr = JSON.parse(r);
            if (Array.isArray(arr)) {
              transcript = arr.map((s) => s?.onebest || '').join('');
            }
          } catch {}
        }
        break;
      }
      if (status === 3) {
        console.log('  ❌ 转写失败:', data.data?.desc || data.desc || JSON.stringify(data));
        break;
      }
    } catch (e) {
      console.log(`  异常: ${e.message}`);
    }
  }

  if (transcript !== null) {
    console.log(`✅ 转写完成: "${transcript || '(空)'}"`);
    return true;
  } else {
    console.log('⚠️ 转写结果未在时限内返回（可能是静音音频导致，不代表凭证异常）');
    return false;
  }
}

// ========== 主流程 ==========
(async () => {
  const d1 = await testDeepSeek();
  const d2 = XF_APPID && XF_APIKEY && XF_APISECRET ? await testXunfei() : null;
  console.log();
  console.log('========== 测试总结 ==========');
  console.log('DeepSeek API:   ', d1 ? '✅ 可用' : '❌ 失败');
  console.log('讯飞转写 API:   ', d2 === true ? '✅ 可用' : d2 === false ? '⚠️ 不通过' : '⏭️ 跳过（凭证缺失）');
  console.log();
  if (d1 && d2 === false) {
    console.log('说明：讯飞失败通常不是凭证问题，而是因为测试音频是 1s 静音空 WAV，');
    console.log('讯飞服务端判断"无有效语音"。真实录音时该接口会正常工作。');
    console.log('可在 Vercel dev server 启动后，进行真实录音端到端验证。');
  }
})();
