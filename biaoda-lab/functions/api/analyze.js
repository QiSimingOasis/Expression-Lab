// 📎 表达研究所 · Prompt 工程 v2.0.0（后端代理 · Cloudflare Pages 版）
// 📍 与 api/analyze.js（Vercel 版）必须保持完全一致
//
// v2.0.0 变更：
//   - Prompt 全量替换为场景感知式教练 Prompt
//   - JSON 输出结构变更：scores 用 logic 键、overall 替代 summary、
//     dimensions 用 coaching+suggestions 替代 comment+suggestion、
//     level 用 "L1"-"L4" 字符串、移除 label/mode_code/improvements
//   - 场景差异化由 Prompt 内部处理，不再需要 SCENE_PATCH 模块拼接

import { json, corsPreflight } from './_lib.js';

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const PROMPT_VERSION = 'pe-eval-v2.0.0';
const MODULE_C_THRESHOLD = 50; // 有效汉字少于 50 → too_short

const SCENE_NAMES = {
  A: '话题聊天', B: '自言自语', C: '演讲', D: '面试',
};

// ============================================================
// System Prompt v2.0.0（完整自包含，场景差异化内嵌）
// ============================================================
const SYSTEM_PROMPT = `你是「表达研究室」的 AI 口语表达评估教练。

---

【输入说明】
你将收到：
- 用户的口语表达转写文本（transcript）
- 练习场景（scene）：A=话题聊天 / B=自言自语 / C=演讲 / D=面试

---

【第一步：理解全文】
在评分前，先完整理解用户说了什么：
- 核心话题/意图是什么
- 说完整了吗
- 有哪些明显的表达问题（留作后续维度定位用）

---

【第二步：五维评分】
按以下5个维度独立评分（1.0-5.0分，保留1位小数）。
先判定等级（L1-L4），再在该等级区间内校准小数。
各维度独立判断，不互相参考。

## 评分区间
L1=1.0-1.9 / L2=2.0-2.9 / L3=3.0-3.9 / L4=4.0-5.0

## 1. 逻辑结构
判断标准：
- L1：想到哪说哪，无主线；话题频繁跳跃；听完不知道核心是什么
- L2：有模糊开头结尾，段落边界不清；有观点无支撑，或举例后没回扣观点
- L3：能看出清晰结构（总分/并列/问题-分析-方案）；各部分有明确分工；偶有逻辑跳跃不影响整体
- L4：结构完整有层次；段落衔接自然有过渡词；听完能复述出清晰骨架

## 2. 语义清晰度
判断标准：
- L1：大量模糊词（"那个""就是说""反正"）；指代不清；同一概念多种说法造成混乱
- L2：基本传递意思但需听者脑补；用词不精准，靠上下文猜测
- L3：表意准确，关键词选用恰当；偶有啰嗦不影响理解
- L4：一句话让人明白核心意思；用词精准无歧义；无冗余

## 3. 流畅度
判断标准：
- L1：频繁停顿、重复词、自我打断；明显找词困难
- L2：整体可跟上，有明显卡顿点；句子有时烂尾或重说；语速不稳
- L3：表达连贯，停顿在语义单元边界；偶有填充词不干扰节奏
- L4：自然流畅，节奏有变化；几乎无填充词；听感舒适

## 4. 内容完整性
判断标准：
- L1：只有结论或现象，无说明；关键信息缺失，无法形成完整理解
- L2：有基本起承转合，论据不足；举例后未回扣观点；结尾突然
- L3：主要论点有支撑；完整的开头结尾；偶有细节缺失不影响主旨
- L4：信息量充分且有层次；论据有力（数据/案例/类比）；逻辑闭环完整

## 5. 简洁度
判断标准：
- L1：大量重复同一意思；废话连篇；核心信息被稀释
- L2：有冗余但不严重；部分句子可压缩；有效信息密度偏低
- L3：表达基本精炼；重复极少；有效信息占比高
- L4：每句话都有信息量；无废话；简洁中有细节

---

【第三步：生成反馈】
反馈的语言风格必须根据场景调整：

场景 A（话题聊天）：轻松朋友感，口语化，用"你说到…的时候"引用原文
场景 B（自言自语）：温和内省式，不带评判感，聚焦思路而非技巧
场景 C（演讲）：专业教练感，关注开场钩子/论据支撑/段落衔接/收尾力度，使用演讲行业术语
场景 D（面试）：严谨职场感，关注STAR/PREP结构完整性、结论是否前置、成果是否量化、是否真正回应问题

## 整体建议（overall，3-4句）
- 第1句：肯定具体亮点（必须引用原文中的真实表现，不能空泛夸奖）
- 第2-3句：指出最核心的1-2个问题及改善方向
- 第4句（可选）：给出一个这次练习最值得带走的行动建议
- 语言风格跟随场景

## 维度卡片（5个）
每个维度生成一张卡片，包含：
1. 维度名称、等级、分数（固定）
2. 优化思路（coaching）：
   - 必须基于用户这次的具体表现生成，不得使用预制建议
   - 指出该维度中出现的具体问题是什么，为什么影响表达
   - 给出针对这个具体问题的改善方向
3. 可优化片段（suggestions，动态0-N条，仅在该维度有真实问题时给出）：
   - original：从原文摘录有问题的片段（原文原话，不修改）
   - improved：改写版本，规则如下：
     * 必须保留用户的原意和核心信息
     * 只针对该维度的问题进行改善
     * 若原文逻辑混乱，可重组结构
     * 若只是措辞问题，微调即可
     * 不随意补充用户未提及的论点；只有逻辑闭环明显缺失时才补充必要内容
     * 改写风格与场景语言风格一致

---

【输出格式 · 严格 JSON，不输出 Markdown / 代码围栏 / 任何解释文字】

{
  "status": "success",
  "prompt_version": "${PROMPT_VERSION}",
  "scene": "D",
  "scores": { "logic": 3.2, "clarity": 2.8, "fluency": 3.5, "completeness": 2.5, "conciseness": 3.0 },
  "overall": "整体建议（3-4句）",
  "dimensions": [
    {
      "key": "logic",
      "name": "逻辑结构",
      "score": 3.2,
      "level": "L3",
      "coaching": "针对这次表达的具体优化思路",
      "suggestions": [
        { "original": "原文片段", "improved": "改写版本" }
      ]
    },
    {
      "key": "clarity",
      "name": "语义清晰度",
      "score": 2.8,
      "level": "L2",
      "coaching": "...",
      "suggestions": []
    },
    {
      "key": "fluency",
      "name": "流畅度",
      "score": 3.5,
      "level": "L3",
      "coaching": "...",
      "suggestions": []
    },
    {
      "key": "completeness",
      "name": "内容完整性",
      "score": 2.5,
      "level": "L2",
      "coaching": "...",
      "suggestions": []
    },
    {
      "key": "conciseness",
      "name": "简洁度",
      "score": 3.0,
      "level": "L3",
      "coaching": "...",
      "suggestions": []
    }
  ]
}

注意：
- dimensions 数组必须严格按上述 5 个 key 的顺序输出
- suggestions 为空时输出空数组 []
- level 格式为 "L1"/"L2"/"L3"/"L4"，必须与 score 区间匹配`;

// ============================================================
// Module C · 规则引擎前置判定
// 优先级：空内容 → too_short(有效汉字<50) → 乱码(非汉字数字英文>50%)
// ============================================================
function moduleCCheck(transcript) {
  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    return {
      status: 'invalid_input',
      error_type: 'empty',
      message: '好像没有录到声音，检查一下麦克风后再试试～'
    };
  }
  const hansOnly = transcript.replace(/\s+/g, '').match(/[\u4e00-\u9fa5]/g);
  const hansCount = hansOnly ? hansOnly.length : 0;
  if (hansCount < MODULE_C_THRESHOLD) {
    return {
      status: 'invalid_input',
      error_type: 'too_short',
      message: `这次说得有点短，再多说几句效果会更好 🎙️`
    };
  }
  const cleaned = transcript.replace(/\s+/g, '');
  const total = cleaned.length;
  if (total > 0) {
    const valid = (cleaned.match(/[\u4e00-\u9fa5A-Za-z0-9]/g) || []).length;
    const nonValidRatio = (total - valid) / total;
    if (nonValidRatio > 0.5) {
      return {
        status: 'invalid_input',
        error_type: 'garbled',
        message: '这次没有听清楚，要不要再试一次？'
      };
    }
  }
  return null;
}

// ============================================================
// 契约校验 v2.0.0（模型返回后执行，失败自动重试一次）
// ============================================================
const DIMS_ORDER = ['logic', 'clarity', 'fluency', 'completeness', 'conciseness'];

function scoreToLevelStr(s) {
  const v = Number(s);
  if (Number.isNaN(v)) return 'L1';
  if (v >= 4.0) return 'L4';
  if (v >= 3.0) return 'L3';
  if (v >= 2.0) return 'L2';
  return 'L1';
}

function unicodeLen(s) {
  return typeof s === 'string' ? [...s].length : 999;
}

/** 契约校验 v2.0.0。返回 {ok:true, scores} 或 {ok:false, reason} */
function validateContract(result, transcript, scene) {
  if (!result || typeof result !== 'object') return { ok:false, reason:'非对象' };

  // dimensions 固定 5 项且顺序/key 匹配
  if (!Array.isArray(result.dimensions) || result.dimensions.length !== 5) {
    return { ok:false, reason:'dimensions 长度必须为 5' };
  }
  const scores = {};
  for (let i = 0; i < 5; i++) {
    const d = result.dimensions[i];
    const expectedKey = DIMS_ORDER[i];
    if (!d || d.key !== expectedKey) {
      return { ok:false, reason:`第 ${i+1} 项 key 必须为 ${expectedKey}` };
    }
    const s = Number(d.score);
    if (!Number.isFinite(s) || s < 1.0 || s > 5.0) {
      return { ok:false, reason:`${expectedKey} score 越界` };
    }
    scores[expectedKey] = s;

    // level 格式 "L1"-"L4"，必须与 score 区间匹配
    const expectedLevel = scoreToLevelStr(s);
    if (d.level !== expectedLevel) {
      return { ok:false, reason:`${expectedKey} level=${d.level} 与 score=${s} 不匹配（期望 ${expectedLevel}）` };
    }

    // coaching 必须是非空字符串
    if (typeof d.coaching !== 'string' || !d.coaching.trim()) {
      return { ok:false, reason:`${expectedKey} coaching 缺失或为空` };
    }

    // suggestions：数组，每项 {original, improved}
    if (!Array.isArray(d.suggestions)) {
      return { ok:false, reason:`${expectedKey} suggestions 不是数组` };
    }
    for (const sug of d.suggestions) {
      if (!sug || typeof sug.original !== 'string' || typeof sug.improved !== 'string' ||
          !sug.original.trim() || !sug.improved.trim()) {
        return { ok:false, reason:`${expectedKey} suggestion 缺少 original/improved` };
      }
      if (transcript.indexOf(sug.original) === -1) {
        return { ok:false, reason:`${expectedKey} suggestion.original 不是 transcript 子串` };
      }
      if (sug.original.trim() === sug.improved.trim()) {
        return { ok:false, reason:`${expectedKey} improved 与 original 相同` };
      }
    }
  }

  // overall 必须是非空字符串
  if (typeof result.overall !== 'string' || !result.overall.trim()) {
    return { ok:false, reason:'overall 缺失或为空' };
  }

  // scores 对象必须含全部 5 个 key
  if (!result.scores || typeof result.scores !== 'object') {
    return { ok:false, reason:'scores 对象缺失' };
  }
  for (const k of DIMS_ORDER) {
    const sv = Number(result.scores[k]);
    if (!Number.isFinite(sv) || sv < 1.0 || sv > 5.0) {
      return { ok:false, reason:`scores.${k} 缺失或越界` };
    }
  }

  return { ok:true, scores };
}

/** v2.0.0 最终输出：直接透传模型结果（契约已校验） */
function finalizeResult(result, scene, scores) {
  return {
    status: 'success',
    prompt_version: PROMPT_VERSION,
    scene,
    scores,
    overall: result.overall,
    dimensions: result.dimensions.map(d => ({
      key: d.key,
      name: d.name,
      score: Number(d.score),
      level: d.level,
      coaching: d.coaching,
      suggestions: (d.suggestions || []).map(sug => ({
        original: sug.original,
        improved: sug.improved
      }))
    }))
  };
}

// ============================================================
// 辅助：从模型原始文本解析 JSON
// ============================================================
function parseModelJson(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(raw);
}

// ============================================================
// 主路由：调用 DeepSeek (temperature 0.2, json_object)
// ============================================================
async function callDeepSeekOnce(apiKey, systemPrompt, transcript, scene) {
  const userMessage = `【场景】${scene}（${SCENE_NAMES[scene] || '未知'}）

【转写文本】
${transcript}`;

  const response = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || `DeepSeek 请求失败: ${response.status}`);
  }
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek 返回内容为空');
  return parseModelJson(content);
}

export async function onRequestOptions() {
  return corsPreflight();
}

export async function onRequestPost({ request, env }) {
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return json({ error: 'DeepSeek API Key 未配置' }, 500);
  }

  let body = {};
  try { body = await request.json(); } catch { body = {}; }
  const { transcript, scene, topic } = body || {};
  const sceneSafe = /^[A-D]$/.test(scene) ? scene : 'A';

  // Module C · 前置拦截
  const invalid = moduleCCheck(transcript);
  if (invalid) {
    return json(invalid);
  }

  try {
    let result = await callDeepSeekOnce(apiKey, SYSTEM_PROMPT, transcript, sceneSafe);
    let contract = validateContract(result, transcript, sceneSafe);

    if (!contract.ok) {
      console.warn('[analyze] 契约校验失败重试：', contract.reason);
      result = await callDeepSeekOnce(apiKey, SYSTEM_PROMPT, transcript, sceneSafe);
      contract = validateContract(result, transcript, sceneSafe);
      if (!contract.ok) {
        throw new Error(`契约校验重试仍失败：${contract.reason}`);
      }
    }

    const finalized = finalizeResult(result, sceneSafe, contract.scores);
    if (topic) finalized.topic_text = String(topic);
    return json(finalized);
  } catch (err) {
    console.error('[analyze]', err);
    return json({ error: friendlyDeepSeekError(err) }, 500);
  }
}

/** 将 DeepSeek 原始错误转译为用户可读的中文提示 */
function friendlyDeepSeekError(err) {
  const msg = String(err?.message || '');
  if (/insufficient balance|402/i.test(msg)) {
    return 'DeepSeek 账户余额不足：请登录 platform.deepseek.com 充值后重试';
  }
  if (/authentication|401|invalid.*key|api key/i.test(msg)) {
    return 'DeepSeek API Key 无效或已过期，请检查环境变量 DEEPSEEK_API_KEY';
  }
  if (/rate limit|429/i.test(msg)) {
    return '请求太频繁了，请休息几秒后再试';
  }
  if (/timeout|aborted|ETIMEDOUT/i.test(msg)) {
    return 'AI 分析超时，请稍后重试';
  }
  return msg || '分析失败';
}
