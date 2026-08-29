// 📎 规格正本：docs/Prompt-Engineering-v1.0.md §1-8 + docs/PRD-V3.0.md §6 / §7.2
// 📍 集中索引：docs/README.md → 规格②Prompt工程 / 规格①PRD 落地映射
//
// 表达研究所 · Prompt 工程落地 (后端代理)
// 对齐规格：《表达研究所 - Prompt 工程》§1-8 + PRD V3.0 §6 / §7.2
//
// 架构：三层不变量 + 模块可组合
//   Layer 1 (固定基准评分：L1_BASE)    → 5 维定义 + L1-L4 锚定标准  §3
//   Layer 2 (差异化补丁)               → 4 场景 SCENE_PATCH[A-D]    §4.3
//                                     + 统一反馈标准 FEEDBACK_STANDARD (v1.1.0)
//   Layer 3 (功能输出：按需触发)       → SCHEMA 契约约束 §6
//   Module C (规则引擎，调用前执行)    → 空/短<50/乱码 顺序判定     §5.3
//
// 模式编码 mode_code = scene(A-D) + level_segment，v1.1.0 起 level_segment 统一 '2'
// 运行时只拼接：L1 + SCENE + FEEDBACK + SCHEMA。

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const PROMPT_VERSION = 'pe-eval-v1.1.0';
const MODULE_C_THRESHOLD = 50; // §5.3 有效汉字少于 50 → too_short

// ============================================================
// Prompt 工程 · 8 模块正文（与 js/api.js 保持完全一致，方便作品展示）
// ============================================================
const PROMPT_BUILDER = (() => {
  // §3.3 Layer 1 基准评分层（固定）— 评分宪法
  const LAYER1_BASE = `【角色设定】
你是一名专业的中文口语表达评估系统。你的评分标准客观、固定，
不因用户身份、表达立场、内容主题或使用场景而改变。

【评分任务】
请分别评估以下 5 个维度。每个维度独立评分，分数为 1.0–5.0，保留 1 位小数。
等级映射固定为：L1=1.0–1.9，L2=2.0–2.9，L3=3.0–3.9，L4=4.0–5.0。

1. 逻辑结构：判断表达是否有清晰层次、组织顺序和自然推进。
L1 自由发散：随意跳跃，无明显逻辑顺序。
L2 初步成型：有基本起承转合，但层次或过渡不清。
L3 结构清晰：开头、论述、结尾明确，层次分明。
L4 驾轻就熟：结构严谨，主次清楚，推进自然且无冗余跳跃。

2. 语义清晰度：判断用词、指代、概念和因果关系是否准确、无歧义。
L1 尚需揣摩：核心意思模糊，听者需要猜测。
L2 基本可懂：大意可理解，但存在模糊词或关键信息缺失。
L3 表意准确：用词和指代基本准确，信息可直接理解。
L4 一语中的：表达精准具体，复杂信息也清晰无歧义。

3. 流畅度：仅依据转写文本中的填充词、重复、断裂、自我修正和衔接进行判断；
不要推断语速、音量、语调或真实停顿时长。
L1 时有停顿：填充、重复或断裂频繁，明显阻断理解。
L2 基本流畅：整体可理解，但有若干重复或衔接生硬。
L3 自然流畅：句间衔接自然，少量修正不影响理解。
L4 行云流水：表达连续稳定，衔接准确，几乎无无效重复。

4. 内容完整性：判断表达是否形成信息闭环，是否包含必要背景、观点、理由、行动或结果。
L1 点到为止：只有结论或零散信息，关键内容缺失。
L2 有头有尾：表达基本闭合，但论据、过程或结果较薄弱。
L3 论据充分：观点有背景、理由或案例支撑，无明显缺口。
L4 深入透彻：覆盖关键条件、证据、影响和结论，信息闭环完整。

5. 简洁度：判断是否存在重复、无效铺垫和可删除信息。
L1 略显冗余：同义重复或填充较多，关键信息被稀释。
L2 基本精炼：主要信息有效，但仍有可压缩内容。
L3 简洁有力：表达直接、信息密度较高，仅有少量冗余。
L4 字字珠玑：高度凝练，每句话都推动理解，且不损失必要信息。

【评分规则】
- 先匹配等级锚点，再在该等级分数区间内微调。
- 不要因用户观点是否正确、内容是否讨喜而影响分数。
- 不要把场景要求写入分数；场景只影响后续反馈视角。`;

  // §4.3 Layer 2 · 场景补丁（决定"看什么"，不改分数）
  const SCENE_PATCH = {
    A: `
【场景补充：话题聊天】
用户正在围绕一个开放话题进行自由表达。
撰写各维度 comment 时重点关注：
- 逻辑结构：表达是否围绕话题展开，有没有明显跑题。
- 内容完整性：是否对话题形成完整回应，而非只给出零散观点。
其他维度按 Layer 1 标准解释。语气轻松自然，适合日常练习。
不得修改任何 score、level 或 label。`,
    B: `
【场景补充：自言自语】
用户正在自由倾诉，没有指定话题。
撰写各维度 comment 时注意：
- 内容完整性：以表达是否有清晰开始和结束为标准，不以话题覆盖度为标准。
- 逻辑结构：允许自然联想，但关键叙事线索应能被追踪。
其他维度按 Layer 1 标准解释。语气温和，鼓励用户持续开口。
不得修改任何 score、level 或 label。`,
    C: `
【场景补充：演讲】
用户正在进行演讲练习，请参考公开演讲的专业表达规范。
撰写各维度 comment 时重点关注：
- 逻辑结构：是否有清晰的开场、论述和收尾。
- 内容完整性：论点是否有充分论据或案例支撑。
- 语义清晰度：措辞是否适合公开表达，关键信息能否被听众快速理解。
语气专业、明确，但不要把演讲偏好写成新的评分标准。
不得修改任何 score、level 或 label。`,
    D: `
【场景补充：面试】
用户正在练习单道面试题，参考 STAR（情境—任务—行动—结果）
或 PREP（观点—理由—例证—重申观点）等结构化表达方法。
撰写各维度 comment 时重点关注：
- 逻辑结构：是否采用可识别的结构组织回答。
- 内容完整性：是否遗漏背景、个人行动、量化结果或结论等关键信息。
语气专业严格，帮助用户达到面试答题标准。
不得修改任何 score、level 或 label。`
  };

  // v1.1.0 Layer 2 · 统一反馈标准（移除三档水平分级，所有用户同一标准）
  const FEEDBACK_STANDARD = `
【反馈标准（统一标准，对所有用户一视同仁）】
- comment 客观指出问题，并给出具体改进方向，像专业表达教练一样直接。
- 可同时指出最多 2 个相互关联的改进点；表现好的维度也指出可继续精进的细节。
- 可以使用常见表达方法（STAR、PREP、金字塔原理等），首次出现时用一句话解释。
- summary 客观友好，不使用过度修辞，不使用"啦/呀/哦"等语气词。
- 不因表达水平降低或放宽标准，也不堆叠与本次表达无关的建议。`;

  // §6 · JSON 契约约束（输出格式 + 顺序 + 校验规则）
  const SCHEMA_CONSTRAINT = `
【输出格式 · JSON 契约】
五维度 key 与顺序固定为：logic, clarity, fluency, completeness, conciseness。
每个维度必须包含：name(中文), score(1.0-5.0 一位小数), level(1-4),
label(对应等级锚定), comment(诊断现状), suggestion(15-20字可执行改进)。

summary 不超过 20 个汉字，先肯定一个最强维度，再指出一个最需改进的维度。
improvements 为 0-3 项句子级改写（"原句 → 改写句"），格式 {original, improved, reason}，
每条必须真实有效：
- improved 相比 original 必须有明确可感知的提升（删冗余词/补论据/调语序/换具体词/收束句子）。
- reason 必须说清两点：改了什么 + 为什么这样更好（对听众理解的具体帮助），15-40 字。
- 不改变原意，不添加原文没有的事实；improved 要口语自然、可直接照着说。

只输出 JSON，不输出 Markdown、代码围栏或任何解释文字。

期望格式：
{
  "status": "success",
  "mode_code": "D2",
  "prompt_version": "${PROMPT_VERSION}",
  "dimensions": [
    {"key":"logic","name":"逻辑结构","score":2.3,"level":2,"label":"初步成型",
     "comment":"...","suggestion":"..."},
    {"key":"clarity","name":"语义清晰度","score":3.1,"level":3,"label":"表意准确",
     "comment":"...","suggestion":"..."},
    {"key":"fluency","name":"流畅度","score":1.8,"level":1,"label":"时有停顿",
     "comment":"...","suggestion":"..."},
    {"key":"completeness","name":"内容完整性","score":2.7,"level":2,"label":"有头有尾",
     "comment":"...","suggestion":"..."},
    {"key":"conciseness","name":"简洁度","score":3.4,"level":3,"label":"简洁有力",
     "comment":"...","suggestion":"..."}
  ],
  "summary": "不超过20字一句话总结",
  "improvements": [
    {"original":"原句","improved":"改写句","reason":"改了什么+为什么更好"}
  ]
}`;

  /** 拼接模块最终 system prompt（v1.1.0：统一标准，levelSegment 仅兼容保留） */
  function build(scene, levelSegment) {
    const s = SCENE_PATCH[scene] || SCENE_PATCH.A;
    return LAYER1_BASE + s + FEEDBACK_STANDARD + SCHEMA_CONSTRAINT;
  }

  return {
    LAYER1_BASE,
    SCENE_PATCH,
    FEEDBACK_STANDARD,
    SCHEMA_CONSTRAINT,
    PROMPT_VERSION,
    MODULE_C_THRESHOLD,
    build
  };
})();

// ============================================================
// Module C · 规则引擎前置判定 §5.3
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
    // 同时做连续可读性判断：如果汉字+数字+英文不足一半，判定为乱码/识别失败
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
// §6 · 契约校验（模型返回后执行，失败自动重试一次）
// ============================================================
const DIMS_ORDER = ['logic', 'clarity', 'fluency', 'completeness', 'conciseness'];
const DIMS_LABEL_MAP = {
  logic:       { 1: '自由发散',   2: '初步成型',   3: '结构清晰',   4: '驾轻就熟' },
  clarity:     { 1: '尚需揣摩',   2: '基本可懂',   3: '表意准确',   4: '一语中的' },
  fluency:     { 1: '时有停顿',   2: '基本流畅',   3: '自然流畅',   4: '行云流水' },
  completeness:{ 1: '点到为止',   2: '有头有尾',   3: '论据充分',   4: '深入透彻' },
  conciseness: { 1: '略显冗余',   2: '基本精炼',   3: '简洁有力',   4: '字字珠玑' }
};

function scoreToLevel(s) {
  const v = Number(s);
  if (Number.isNaN(v)) return 1;
  if (v >= 4.0) return 4;
  if (v >= 3.0) return 3;
  if (v >= 2.0) return 2;
  return 1;
}

function unicodeLen(s) {
  return typeof s === 'string' ? [...s].length : 999;
}

/** §6 契约校验。返回 {ok:true, result} 或 {ok:false, reason} */
function validateContract(result, transcript, scene, levelSegment) {
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
    const expectedLevel = scoreToLevel(s);
    if (Number(d.level) !== expectedLevel) {
      return { ok:false, reason:`${expectedKey} level 与 score 不匹配` };
    }
    const expectedLabel = DIMS_LABEL_MAP[expectedKey][expectedLevel];
    if (d.label !== expectedLabel) {
      return { ok:false, reason:`${expectedKey} label 与等级映射不一致` };
    }
    if (typeof d.comment !== 'string' || typeof d.suggestion !== 'string') {
      return { ok:false, reason:`${expectedKey} 缺少 comment/suggestion` };
    }
    const sugLen = unicodeLen(d.suggestion);
    if (sugLen < 10 || sugLen > 25) { // 容忍 15-20 上下浮动
      return { ok:false, reason:`${expectedKey} suggestion 长度偏离 15-20` };
    }
  }

  // summary ≤ 20 字符
  if (typeof result.summary !== 'string' || unicodeLen(result.summary) > 20) {
    return { ok:false, reason:'summary 超过 20 字或缺失' };
  }

  // improvements：0-3 项；每项 dimension/original/improved 非空；
  // original 必须是 transcript 逐字连续子串；v1.1.0 起统一要求 reason 非空
  if (!Array.isArray(result.improvements) || result.improvements.length > 3) {
    return { ok:false, reason:'improvements 必须为 0-3 项数组' };
  }
  for (const imp of result.improvements) {
    if (!imp || typeof imp.original !== 'string' || typeof imp.improved !== 'string' ||
        !imp.original.trim() || !imp.improved.trim()) {
      return { ok:false, reason:'improvement 缺少 original/improved' };
    }
    if (transcript.indexOf(imp.original) === -1) {
      return { ok:false, reason:'improvement.original 不是 transcript 连续子串' };
    }
    if (imp.original.trim() === imp.improved.trim()) {
      return { ok:false, reason:'improved 与 original 相同，改写无效' };
    }
    if (!imp.reason || !String(imp.reason).trim()) {
      return { ok:false, reason:'improvement.reason 缺失（需说明改了什么+为什么更好）' };
    }
  }

  // mode_code 校验：^[A-D][1-3]$
  const expectedMode = `${scene}${levelSegment}`;
  if (!/^[A-D][1-3]$/.test(expectedMode)) {
    return { ok:false, reason:'scene/level_segment 生成的 mode_code 非法' };
  }

  return { ok:true, scores, mode_code:expectedMode };
}

/** 契约"宽容修补"：若模型返回只是标签或顺序偏差，前端也会再 normalize 一层；
 *  但后端这里仅做"结构性失败→重试"，不主动改写模型 score（不变量：Layer1 锁定）。
 *  本函数把契约字段补全到 PRD §7.2 前端期望形状。 */
function finalizeResult(result, transcript, scene, levelSegment, scores, mode_code) {
  const scoresObj = {};
  scoresObj.structure = scores.logic; // 新 storage schema：logic → structure 键名
  scoresObj.clarity = scores.clarity;
  scoresObj.fluency = scores.fluency;
  scoresObj.completeness = scores.completeness;
  scoresObj.conciseness = scores.conciseness;

  return {
    status: 'success',
    mode_code,
    prompt_version: PROMPT_VERSION,
    insufficient_sample: false,
    scores: scoresObj,
    dimensions: result.dimensions.map(d => ({
      key: d.key === 'logic' ? 'structure' : d.key,
      name: d.name,
      score: Number(d.score),
      level: Number(d.level),
      label: d.label,
      comment: d.comment,
      suggestion: d.suggestion,
      evidence: []
    })),
    summary: result.summary,
    improvements: (result.improvements || []).map(imp => ({
      dimension: imp.dimension || '',
      original: imp.original,
      improved: imp.improved,
      reason: imp.reason || ''
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
// 主路由：调用一次 DeepSeek (temperature 0.2, json_object)
// §8 已决策：MVP 合并一次 API 调用，temperature=0.2；若发现漂移再拆两次。
// ============================================================
async function callDeepSeekOnce(apiKey, systemPrompt, transcript) {
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
        { role: 'user', content: transcript }
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

module.exports = async function handler(req, res) {
  // 通用响应头：跨域 + 防 MIME 嗅探 + 禁用缓存
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: '仅支持 POST' });
    return;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'DeepSeek API Key 未配置' });
    return;
  }

  // 入参：scene ∈ {A,B,C,D}；v1.1.0 起 level_segment 统一 '2'（入参仅兼容保留）
  const { transcript, scene, level_segment, topic } = req.body || {};
  const sceneSafe = /^[A-D]$/.test(scene) ? scene : 'A';
  const levelSafe = '2';

  // Module C · 前置拦截
  const invalid = moduleCCheck(transcript);
  if (invalid) {
    res.status(200).json(invalid);
    return;
  }

  const systemPrompt = PROMPT_BUILDER.build(sceneSafe, levelSafe);

  try {
    // §8 决策：一次调用 + 低温度 0.2
    let result = await callDeepSeekOnce(apiKey, systemPrompt, transcript);
    let contract = validateContract(result, transcript, sceneSafe, levelSafe);

    // 契约失败自动重试一次（Prompt §6 末尾校验策略）
    if (!contract.ok) {
      console.warn('[analyze] 契约校验失败重试：', contract.reason);
      result = await callDeepSeekOnce(apiKey, systemPrompt, transcript);
      contract = validateContract(result, transcript, sceneSafe, levelSafe);
      if (!contract.ok) {
        throw new Error(`契约校验重试仍失败：${contract.reason}`);
      }
    }

    const finalized = finalizeResult(result, transcript, sceneSafe, levelSafe,
                                     contract.scores, contract.mode_code);
    if (topic) finalized.topic_text = String(topic);
    res.status(200).json(finalized);
  } catch (err) {
    console.error('[analyze]', err);
    // 返回 5xx，前端 app.js 会自动走 _fallbackAnalyze 兜底，不丢用户录音
    res.status(500).json({ error: friendlyDeepSeekError(err) });
  }
};

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
