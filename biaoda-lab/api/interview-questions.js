// 📎 规格参考：docs/Prompt-Engineering-v1.0.md（模块化 Prompt 思路）+ docs/PRD-V3.0.md
//
// 表达研究所 · 完整面试题目生成（后端代理）
// 输入：岗位 JD + 题目数量（5 或 10）
// 输出：结构化面试题列表（起承转合四阶段结构）：
//   开场破冰 → 经历深挖 → 专业场景 → 动机收尾
// 结构由 Prompt 引导 AI 按 JD 灵活分配（不写死每题的阶段），
// 同一 JD 每次生成通过随机出题侧重 + 高 temperature 产生差异。
//
// 密钥安全：DEEPSEEK_API_KEY 仅存于服务端环境变量，前端零暴露。

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const QUESTION_VERSION = 'interview-q-v1.1.0';

const SYSTEM_PROMPT = `【角色设定】
你是一名资深面试官与人才评估专家，擅长根据岗位 JD 设计结构化面试问题。

【工作方法：先分析，后出题】
拿到 JD 后，先在心里完成结构拆解（此过程不输出）：
1. 提炼核心职责（这份工作每天实际在做什么）
2. 提炼硬技能要求（JD 明确列出的技术/专业能力）
3. 提炼软技能与协作方式（沟通、主导、抗压等信号词）
4. 判断行业背景与岗位级别（初级/资深/管理，影响追问深度）
然后基于这份拆解结果设计面试题，让每道题都能对应到 JD 的某个具体要求。

【结构框架（起承转合，非机械套模板）】
- 开场破冰：让候选人放松，展示表达与自我认知（如自我介绍、职业转变原因）。
- 经历深挖：围绕 JD 相关的真实经历追问，考察 STAR 完整性（情境-任务-行动-结果）。
- 专业场景：构造该岗位真实会遇到的业务场景问题，考察专业能力与解题思路。
- 动机收尾：考察求职动机、岗位理解、职业规划与稳定性。
各阶段的题目数量可按 JD 侧重灵活分配，但整体顺序必须符合起承转合。

【多样性要求 · 重要】
- 题目必须紧扣这份 JD 的具体内容，不出通用泛泛之题。
- 即使是同一份 JD，不同次生成的题目组合也应当不同：换切入点、换场景、换追问角度。
- 避免模板化措辞（如千篇一律的"请介绍一下你最大的缺点"），把问题放进 JD 的真实业务语境里。

【题目要求】
- 题目必须紧扣 JD 中的岗位职责、技能要求与行业背景，不出通用泛泛之题。
- 每题附 hint（1-2 句答题提示，说明考察点或建议的答题方向）。
- 语言自然口语化，像真实面试官会说的话，不使用编号堆砌式措辞。

【输出格式 · 严格遵守，只输出 JSON，不输出任何其他内容】
{
  "questions": [
    {"index": 1, "stage": "开场破冰", "title": "面试问题（口语化，20-60 字）", "hint": "答题提示"}
  ]
}
【约束】
- questions 数量必须与要求的题目数完全一致。
- index 从 1 开始连续编号。
- stage 只能取：开场破冰 / 经历深挖 / 专业场景 / 动机收尾。
- stage 顺序必须符合起承转合结构（前面阶段在前）。`;

/** 解析模型 JSON（容忍代码围栏） */
function parseModelJson(content) {
  const raw = String(content || '').trim();
  try { return JSON.parse(raw); } catch {}
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch {}
  }
  throw new Error('模型返回的不是合法 JSON');
}

/**
 * 出题侧重池：每次请求随机抽 2 条注入，配合高 temperature
 * 保证同一 JD 多次生成的题目组合有差异
 */
const ANGLE_POOL = [
  '侧重考察候选人对岗位核心职责的理解深度',
  '侧重追问真实项目细节与量化结果（STAR 中的 R）',
  '侧重考察跨团队协作与向上沟通能力',
  '侧重考察遇到分歧或高压时的应对方式',
  '侧重考察快速学习新事物与知识迁移能力',
  '侧重考察对行业趋势与竞品的判断力',
  '侧重考察动手落地能力，而非纯理论表达',
  '侧重考察失败/受挫经历的复盘与成长心态',
  '侧重设计与 JD 关键技能直接相关的实战场景题',
  '侧重考察长期职业规划与该岗位的匹配逻辑',
  '侧重考察在资源不足时如何推进事情',
  '侧重考察数据驱动决策与结果衡量意识',
];

/** 从池中随机抽 n 条（Fisher-Yates 洗牌） */
function pickAngles(n) {
  const arr = [...ANGLE_POOL];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

async function callDeepSeek(apiKey, jd, count) {
  // 每次随机抽 2 个出题侧重 → 同一 JD 多次生成产生差异
  const angles = pickAngles(2)
    .map((a, i) => `${i + 1}. ${a}`)
    .join('\n');

  const response = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      // 出题是创造性任务：高温度增加多样性（评分接口才用 0.2 保证稳定）
      temperature: 0.9,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `岗位 JD 如下，请生成 ${count} 道面试题。

【岗位 JD】
${jd}

【本次出题侧重（随机指定，请自然融入合适的阶段）】
${angles}

请先按系统指令拆解这份 JD，再基于拆解结果出题。` }
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

/** 校验并规范化题目列表 */
function normalizeQuestions(result, count) {
  const list = Array.isArray(result.questions) ? result.questions : [];
  if (list.length !== count) return null;
  const validStages = ['开场破冰', '经历深挖', '专业场景', '动机收尾'];
  const seen = new Set();
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const q = list[i];
    const title = typeof q?.title === 'string' ? q.title.trim() : '';
    const stage = validStages.includes(q?.stage) ? q.stage : '动机收尾';
    const hint = typeof q?.hint === 'string' ? q.hint.trim() : '';
    if (!title || title.length < 4) return null;
    if (seen.has(title)) return null;
    seen.add(title);
    out.push({ index: i + 1, stage, title, hint });
  }
  return out;
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

  const { jd, count } = req.body || {};
  const jdText = typeof jd === 'string' ? jd.trim() : '';
  const countSafe = Number(count) === 10 ? 10 : 5;

  // 前置校验：JD 有效性（类似 Module C 的边界检查）
  if (!jdText) {
    res.status(200).json({ status: 'invalid_input', error_type: 'empty_jd', message: '请先粘贴岗位 JD（职位描述）' });
    return;
  }
  if (jdText.length < 30) {
    res.status(200).json({ status: 'invalid_input', error_type: 'jd_too_short', message: 'JD 内容太短了，请粘贴完整的职位描述（至少 30 字）' });
    return;
  }
  if (jdText.length > 5000) {
    res.status(200).json({ status: 'invalid_input', error_type: 'jd_too_long', message: 'JD 内容过长，请精简到 5000 字以内' });
    return;
  }

  try {
    const result = await callDeepSeek(apiKey, jdText, countSafe);
    const questions = normalizeQuestions(result, countSafe);
    if (!questions) {
      throw new Error('题目结构校验失败');
    }
    res.status(200).json({
      status: 'success',
      prompt_version: QUESTION_VERSION,
      count: countSafe,
      questions,
    });
  } catch (err) {
    console.error('[interview-questions]', err);
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
    return 'AI 生成超时，请稍后重试';
  }
  return msg || '题目生成失败，请稍后重试';
}
