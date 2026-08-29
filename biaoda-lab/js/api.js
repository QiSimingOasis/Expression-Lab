/**
 * 📎 规格正本：docs/Prompt-Engineering-v1.0.md §1-8 / docs/PRD-V3.0.md §6
 * 📍 集中索引：docs/README.md → 规格②Prompt工程 / 规格①PRD 落地映射
 *
 * 表达研究室 - API 调用模块（PRD V3.0 + Prompt 工程文档 §1-8）
 *
 * 三层 Prompt 架构（§1.1 / §2.2 8 模块拼接）：
 *   Layer 1：固定基准评分层（5 维定义 + L1-L4 锚定 + 1.0-5.0 映射）
 *   Layer 2：分支补丁层 — SCENE_PATCH{A,B,C,D} 4 个 + LEVEL_PATCH{1,2,3} 3 个
 *   Layer 3：功能输出层 — Module A(≤20字summary) / Module B(场景阈值改写) / Module C(边界兜底)
 *
 * 设计不变量（§1.1 / §4.1）：
 *   - Layer 1 绝对稳定，评分不看 scene / level
 *   - Layer 2 只能改 comment / summary 语气，不改 score / level / label
 *   - Layer 3 各模块独立失败；Module B 失败不影响 5 维评分
 *
 * 分析输出 schema（PRD §6.5 / 文档 §6）：
 * { mode_code, insufficient_sample, dimensions:[{name,score,level,label,comment,evidence}],
 *   scores:{structure,clarity,fluency,completeness,conciseness}, summary<=20字, improvements[] }
 */

const API = {
  /** 维度顺序 & 中文名称 & PRD §5.1 + Prompt §3.2 等级标签映射（宪法级，不随场景变化） */
  DIMS: [
    { key: 'structure',    name: '逻辑结构', L1: '自由发散', L2: '初步成型', L3: '结构清晰', L4: '驾轻就熟' },
    { key: 'clarity',      name: '语义清晰度', L1: '尚需揣摩', L2: '基本可懂', L3: '表意准确', L4: '一语中的' },
    { key: 'fluency',      name: '流畅度', L1: '时有停顿', L2: '基本流畅', L3: '自然流畅', L4: '行云流水' },
    { key: 'completeness', name: '内容完整性', L1: '点到为止', L2: '有头有尾', L3: '论据充分', L4: '深入透彻' },
    { key: 'conciseness',  name: '简洁度', L1: '略显冗余', L2: '基本精炼', L3: '简洁有力', L4: '字字珠玑' },
  ],

  SCORE_TO_LEVEL: (score) => score >= 4.0 ? 'L4' : score >= 3.0 ? 'L3' : score >= 2.0 ? 'L2' : 'L1',

  /**
   * Prompt 工程 8 模块拼接器（§1.1 / §2.2 / §4.5）
   * final_prompt = LAYER1_BASE + SCENE_PATCH[scene] + LEVEL_PATCH[level] + SCHEMA
   * 冲突优先级：水平补丁决定"怎么说"，场景补丁决定"看什么"，Layer 1 绝对优先级
   */
  PromptBuilder: (function () {
    /**
     * Layer 1 固定基准评分（Prompt §3.3 完整原文）：
     * —— 任何情况都不会因为场景/用户水平改变评分标准
     */
    const LAYER1_BASE =
`【角色设定】
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

【Layer 1 评分规则】
- 先匹配等级锚点，再在该等级分数区间内微调；不凭整体印象给分。
- 只输出 5 个维度的 score / level / label，不提前生成 comment / suggestion。
- 不因观点立场、主题讨喜或场景偏好加减分。`;

    /** Layer 2 — 4 个场景补丁（Prompt §4.3）：只调关注视角，不改评分 */
    const SCENE_PATCH = {
      A:
`
【场景补充：话题聊天（A）】
用户正在围绕一个开放话题自由表达。
撰写各维度 comment 时重点关注：
- 逻辑结构：是否围绕话题展开，有没有明显跑题。
- 内容完整性：是否对话题形成完整回应，而非只给零散观点。
语气轻松自然，适合日常练习。不得修改任何 score / level / label。`,
      B:
`
【场景补充：自言自语（B）】
用户正在自由倾诉，没有指定话题。
撰写各维度 comment 时注意：
- 内容完整性：以表达是否有清晰开始和结束为标准，不以话题覆盖度为标准。
- 逻辑结构：允许自然联想，但关键叙事线索应能被追踪。
语气温和，鼓励持续开口。不得修改任何 score / level / label。`,
      C:
`
【场景补充：演讲（C）】
用户正在进行演讲练习，请参考公开演讲专业表达规范。
撰写各维度 comment 时重点关注：
- 逻辑结构：是否有清晰的开场、论述和收尾。
- 内容完整性：论点是否有充分论据或案例支撑。
- 语义清晰度：措辞是否适合公开表达，关键信息能否被听众快速理解。
语气专业、明确。不得把演讲偏好写成新的评分标准。`,
      D:
`
【场景补充：单题面试（D）】
用户正在练习单道面试题，参考 STAR（情境—任务—行动—结果）
或 PREP（观点—理由—例证—重申观点）等结构化方法。
撰写各维度 comment 时重点关注：
- 逻辑结构：是否采用可识别的结构组织回答。
- 内容完整性：是否遗漏背景、个人行动、量化结果或结论等关键信息。
语气专业严格，帮助用户达到面试答题标准。不得修改任何 score / level / label。`,
    };

    /**
     * Layer 2 — 统一反馈标准（v1.1.0 起移除三档水平分级）
     * 所有用户使用同一套客观专业型反馈标准，不给新手保护期
     */
    const FEEDBACK_STANDARD =
`
【反馈标准（统一标准，对所有用户一视同仁）】
- comment 客观指出问题，并给出具体改进方向，像专业表达教练一样直接。
- 可同时指出最多 2 个相互关联的改进点；表现好的维度也指出可继续精进的细节。
- 可以使用常见表达方法（STAR、PREP、金字塔原理等），首次出现时用一句话解释。
- summary 客观友好，不使用过度修辞，不使用"啦/呀/哦"等语气词。
- 不因表达水平降低或放宽标准，也不堆叠与本次表达无关的建议。`;

    /** Layer 3 — 最终 JSON 契约（文档 §6），强制顺序：scores→dims→summary→improvements */
    const SCHEMA_CONSTRAINT =
`

【最终输出 JSON 契约（严格遵守，只输出 JSON，不输出任何其他内容、代码围栏或解释）】
{
  "dimensions": [
    {"key":"structure","name":"逻辑结构","score":2.3,"level":"L2","label":"初步成型","comment":"...","evidence":["...","..."]},
    {"key":"clarity","name":"语义清晰度","score":3.1,"level":"L3","label":"表意准确","comment":"...","evidence":["..."]},
    {"key":"fluency","name":"流畅度","score":1.8,"level":"L1","label":"时有停顿","comment":"...","evidence":["..."]},
    {"key":"completeness","name":"内容完整性","score":2.7,"level":"L2","label":"有头有尾","comment":"...","evidence":["..."]},
    {"key":"conciseness","name":"简洁度","score":3.4,"level":"L3","label":"简洁有力","comment":"...","evidence":["..."]}
  ],
  "summary": "≤20 汉字，先肯定 1 点后指出 1 点",
  "improvements": [
    {"dimension":"逻辑结构","original":"原句","improved":"改写句","reason":""}
  ]
}
【约束】
- dimensions 必须严格 5 项，key/name 顺序固定，不可增删或重排。
- level 与 score 严格映射：1.0-1.9→L1 / 2.0-2.9→L2 / 3.0-3.9→L3 / 4.0-5.0→L4。
- label 由维度名+level 固定映射，不得自由造词。
- evidence 是 transcript 中能逐字定位的 1-2 句连续片段。
- improvements 每条必须真实有效：
  · improved 相比 original 必须有明确可感知的提升（删冗余词/补论据/调语序/换具体词/收束句子）。
  · reason 必须说清两点：改了什么 + 为什么这样更好（对听众理解的具体帮助），15-40 字。
  · 不改变原意，不添加原文没有的事实；improved 要口语自然、可直接照着说。
  · original 必须能在 transcript 中逐字定位。`;

    /**
     * 运行时模块拼接入口（v1.1.0）
     * final_prompt = LAYER1_BASE + SCENE_PATCH[scene] + FEEDBACK_STANDARD + SCHEMA
     * 保留 level 参数仅为向后兼容（内部忽略，统一标准）
     */
    function build(scene, level) {
      const sceneKey = (['A','B','C','D'].includes(scene)) ? scene : 'A';
      return LAYER1_BASE
        + SCENE_PATCH[sceneKey]
        + FEEDBACK_STANDARD
        + SCHEMA_CONSTRAINT;
    }

    /** Module A 独立 Prompt——统一客观语气 */
    function moduleA(evaluationJson) {
      return `根据以下评分结果生成一句总结：
${JSON.stringify(evaluationJson)}
要求：
- 不超过 20 个汉字。
- 先肯定一个表现最好的维度，再指出一个最需要改进的维度。
- 语气客观专业，不使用语气词和过度修辞。
- 不使用"您"，统一使用"你"。
- 只输出总结文字，不输出其他。`;
    }

    /** Module B 独立 Prompt（差异化阈值在调用方判断） */
    function moduleB(transcript, lowDims) {
      return `用户的原始表达如下：
${transcript}
以下维度评分较低，需要给出改写建议：
${JSON.stringify(lowDims)}
请从原文中找出 2–3 个具体句子，给出句子级改写。
要求：
- improved 必须比 original 有明确可感知的提升（删冗余/补论据/调语序/换具体词）。
- reason 说清：改了什么 + 为什么更好（对听众理解的具体帮助），15-40 字。
- 不添加原文完全没有的事实，改写句可直接照着说。
- 优先修复对应维度问题；同一句不因多个维度重复改写。
- 格式为 JSON improvements 数组：{dimension,original,improved,reason}。
- 只输出 JSON。`;
    }

    /** Module C 边界规则引擎（§5.3，评分前执行，命中直接返回状态） */
    const MODULE_C_THRESHOLD = 50; // §5.3：字数过短 < 50 字
    function moduleC(transcript) {
      const t = String(transcript || '');
      if (!t.trim()) return { status: 'invalid_input', error_type: 'empty_content', message: '好像没有录到声音，检查一下麦克风后再试试～' };
      const stripped = t
        .replace(/（.*?）/g, '')
        .replace(/\s+/g, '')
        .replace(/[\uff0c\u3002\uff01\uff1f,.!?;:；:]/g, '');
      if (stripped.length < MODULE_C_THRESHOLD) {
        return { status: 'invalid_input', error_type: 'too_short', message: '这次说得有点短，再多说几句效果会更好 🎙️' };
      }
      const nonCnRate = [...stripped].filter(c => {
        const code = c.codePointAt(0);
        const isNum = code >= 0x30 && code <= 0x39;
        const isUpperEn = code >= 0x41 && code <= 0x5a;
        const isLowerEn = code >= 0x61 && code <= 0x7a;
        const isCn = code >= 0x4e00 && code <= 0x9fff;
        return !isNum && !isUpperEn && !isLowerEn && !isCn;
      }).length / (stripped.length || 1);
      if (nonCnRate > 0.5) {
        return { status: 'invalid_input', error_type: 'gibberish', message: '这次没有听清楚，要不要再试一次？' };
      }
      return null; // 正常，继续 Layer 1
    }

    return {
      LAYER1_BASE, SCENE_PATCH, FEEDBACK_STANDARD, SCHEMA_CONSTRAINT,
      MODULE_C_THRESHOLD,
      build, moduleA, moduleB, moduleC,
    };
  })(),

  /**
   * Module B 触发阈值（Prompt §5.2 矩阵，场景-动机差异化）
   * A/B（低压练习：用户动机是开口/倾诉）：score < 3.0 → 不打击合格表达
   * C/D（专业场景：用户寻求严格反馈）：score < 4.0 → L3 也给句子级示范
   */
  MODULE_B_THRESHOLD: { A: 3.0, B: 3.0, C: 4.0, D: 4.0 },

  async transcribeAudio(audioBlob) {
    // 优先级 1：Web Speech API（Chrome）已捕获的真实转写
    if (window.recordedTranscript && window.recordedTranscript.trim().length > 0) {
      return window.recordedTranscript.trim();
    }
    // 优先级 2：调用后端 /api/transcribe（Vercel 线上部署 / Vercel CLI dev）
    try {
      const form = new FormData();
      form.append('audio', audioBlob, 'recording.webm');
      const res = await fetch('/api/transcribe', { method: 'POST', body: form });
      if (res.ok) {
        const contentType = res.headers.get('Content-Type') || '';
        if (/application\/json/i.test(contentType)) {
          // 后端 vercel serverless: 返回 JSON { transcript: "..." }
          const data = await res.json();
          if (data && typeof data.transcript === 'string' && data.transcript.trim()) {
            return data.transcript.trim();
          }
        } else {
          // 老版本纯文本接口兼容
          const text = await res.text();
          if (text && text.trim().length) return text.trim();
        }
      } else if (res.status === 404 || res.status === 501) {
        // 本地 python http.server → 404，直接跳兜底
      }
    } catch (err) {
      console.warn('[api] transcribe 后端不可用，走兜底：', err);
    }

    // 优先级 3（兜底）：Web Speech 不可用 + 后端转写也不可达
    // 用明确标记的占位文本，而非随机样本文本，避免误导用户
    const durSec = Math.max(5, Math.round((window.recordedDuration || 10000) / 1000));
    if (window._speechNotSupported) {
      return `[占位文本] 当前浏览器不支持实时语音转写，本次练习基于您的录音时长（约 ${durSec} 秒）进行模拟分析。建议使用 Chrome 浏览器体验真实转写。`;
    }
    return `[占位文本] 本次录音未能捕获到有效语音内容（时长约 ${durSec} 秒）。请检查麦克风权限后重试。`;
  },

  /**
   * 前端调用入口：{ scene, levelSegment, topic } → PRD §6.5 schema
   * v1.1.0：levelSegment 仅兼容保留，统一标准固定 '2'（不再按练习次数分级）
   * 流程：Module C → Layer1 纯评分 → (scene 补丁 + 统一反馈标准) → Layer3 A(总结)+B(改写)
   */
  async analyzeExpression(transcript, opts) {
    const { scene = 'A', topic = '' } = opts || {};
    const levelSegment = '2'; // 统一标准：所有用户同一反馈档
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, scene, level_segment: levelSegment, mode_code: scene + levelSegment, topic }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.dimensions) && data.dimensions.length === 5 && data.scores) {
          return this._normalizeBackendResult(data, scene, levelSegment);
        }
      }
    } catch { /* 后端不可用，走前端兜底 */ }
    return this._fallbackAnalyze(transcript, scene, levelSegment, topic);
  },

  /** 后端结果强制校正（§6.6 Prompt 质量保障：不信任模型标签/分数，用前端固定规则重算） */
  _normalizeBackendResult(data, scene, levelSegment) {
    const dims = this.DIMS.map(({ key, name, L1, L2, L3, L4 }) => {
      const raw = (data.dimensions || []).find(d => d && (d.key === key || d.name === name));
      const dScore = raw?.score;
      const score = typeof dScore === 'number' && dScore >= 1 && dScore <= 5
        ? +dScore.toFixed(1)
        : (data.scores?.[key] != null ? +(+data.scores[key]).toFixed(1) : 3.0);
      const level = this.SCORE_TO_LEVEL(score);
      return {
        key,
        name,
        score,
        level,
        label: ({ L1, L2, L3, L4 })[level],
        comment: raw?.comment || '请根据维度说明继续强化。',
        evidence: Array.isArray(raw?.evidence) && raw.evidence.length ? raw.evidence.slice(0, 2) : [],
      };
    });
    const scores = Object.fromEntries(dims.map(d => [d.key, d.score]));
    return {
      mode_code: scene + levelSegment,
      insufficient_sample: !!data.insufficient_sample,
      dimensions: dims,
      scores,
      summary: typeof data.summary === 'string' && [...data.summary].length <= 20 ? data.summary : (this.ModuleA(scores)),
      improvements: Array.isArray(data.improvements) ? data.improvements : [],
    };
  },

  /**
   * 前端兜底分析器（伪三层实现，职责边界与 Prompt 文档完全一致）
   *
   * ① Module C（评分前拦截）→ 空 / 短 / 乱码 直接返回 insufficient_sample=true
   * ② Layer 1（纯评分，与 scene/level 解耦，宪法级稳定）
   * ③ Layer 2（补丁层：scene 决定 comment 关注点；level 决定语气）
   * ④ Layer 3（功能层：Module A summary；Module B 改写按阈值触发）
   */
  _fallbackAnalyze(transcript, scene, levelSegment, topicText) {
    const text = ((transcript || '').replace(/（.*?）/g, '').trim());

    // ========== Layer 3｜Module C（§5.3，先判空→字数→乱码）==========
    const modC = this.PromptBuilder.moduleC(transcript);
    const insufficient = !!modC && modC.error_type !== 'empty_content'
      ? modC.error_type === 'too_short'
      : !!modC;

    // ========== Layer 1｜纯评分（绝对稳定，不看 scene/level）==========
    const charCount = text.length;
    const sentences = text.split(/[。！？!?；;\n]/).map(s => s.trim()).filter(Boolean);
    const sentCount = sentences.length;
    const avgLen = sentCount ? charCount / sentCount : charCount;
    const uniqueChars = new Set(text.replace(/[，。！？；,.!?;\s]/g, '')).size;
    const totalChars = text.replace(/[，。！？；,.!?;\s]/g, '').length || 1;
    const diversity = uniqueChars / totalChars;
    const fillers = (text.match(/嗯|啊|呃|那个|其实|然后|就是说|可能的话|对吧|你知道|你懂吗/g) || []);
    const fillerCount = fillers.length;
    const clamp = (x) => Math.min(5.0, Math.max(1.0, Math.round(x * 10) / 10));

    const structSignals = (text.match(/因为|所以|首先|其次|然后|总之|最后|第一|第二|一方面|另一方面|综上/g) || []).length;
    const structure    = clamp(1.8  + 0.10 * sentCount + 0.22 * structSignals  + Math.min(0.6, charCount / 400));
    const clarity      = clamp(1.6  + diversity * 4.2);
    const fluency      = clamp(3.8  - 0.14 * fillerCount + Math.min(0.6, charCount / 500));
    const completeness = clamp(1.2  + 0.007 * charCount + 0.10 * sentCount);
    let conciseness = 3.4;
    if      (avgLen < 8)  conciseness -= 1.0;
    else if (avgLen < 12) conciseness -= 0.4;
    else if (avgLen > 42) conciseness -= 0.8;
    else if (avgLen > 30) conciseness -= 0.3;
    conciseness = clamp(conciseness);
    const rawScores = { structure, clarity, fluency, completeness, conciseness };

    // ========== Layer 2｜场景+水平补丁（只改 comment/evidence 视角，不改 score）==========
    const scenePatch = this.PromptBuilder.SCENE_PATCH; // 代码里用字符串 match 模拟关注点切换
    const dims = this.DIMS.map(({ key, name, L1, L2, L3, L4 }) => {
      const sc = insufficient ? 2.0 : rawScores[key];
      const score = +sc.toFixed(1);
      const level = this.SCORE_TO_LEVEL(score);
      return {
        key,
        name,
        score,
        level,
        label: ({ L1, L2, L3, L4 })[level],
        // §4.5 拼接职责：scene→"看什么"，level→"怎么说"
        comment: this._patchedComment(key, score, level, {
          sentCount, fillerCount, charCount, avgLen, structSignals, scene, levelSegment, topicText,
        }),
        evidence: this._pickEvidence(key, text, sentences, scene),
      };
    });
    const scores = Object.fromEntries(dims.map(d => [d.key, d.score]));

    // ========== Layer 3｜Module A + Module B（独立，可单独失败不影响评分）==========
    const summary = this.ModuleA(scores);
    const threshold = this.MODULE_B_THRESHOLD[scene] ?? 3.0;
    // 样本不足不提供句子改写
    const improvements = insufficient ? [] : this.ModuleB(text, sentences, dims, threshold);

    return {
      mode_code: scene + levelSegment,
      insufficient_sample: insufficient,
      dimensions: dims,
      scores,
      summary,
      improvements,
    };
  },

  /**
   * Layer 2 → patched comment 生成
   * Prompt §4.5：scene 决定"看什么"（A/B 关注话题/倾诉；C/D 关注公开演讲/STAR）
   *            level 决定"怎么说"（1温柔聚焦1点 / 2客观指2点 /3精准专业术语）
   */
  _patchedComment(key, score, level, ctx) {
    const { scene } = ctx;
    const base = this._ruleCommentBase(key, score, ctx);
    // 场景补丁：把 comment 的视角按 A/B/C/D 追加一个关注点
    const sceneFocus = (() => {
      if (key === 'structure') {
        if (scene === 'A') return '注意整体是否一直围绕话题推进，没有跑题。';
        if (scene === 'B') return '自由联想没问题，但注意保持一条叙事线索。';
        if (scene === 'C') return '演讲特别注意：开场吸睛、主体分层、收尾有力的三板斧。';
        if (scene === 'D') return '面试题请用 STAR/PREP 来组织，让结构一眼被识别。';
      }
      if (key === 'completeness') {
        if (scene === 'A') return '话题回应要形成完整闭环，不要只答一半。';
        if (scene === 'B') return '倾诉时自己给个收尾就好，不用刻意追求话题完整度。';
        if (scene === 'C') return '每一个论点最好加一句具体的案例或数据支撑。';
        if (scene === 'D') return '面试：背景(S)、行动(A)、量化结果(R)、结论缺一到两项就容易失分。';
      }
      if (key === 'clarity') {
        if (scene === 'C') return '公开表达里要用能让 80% 听众一次听懂的词。';
        if (scene === 'D') return '面试里用行业通用术语 + 具象数字替代"大概/可能"。';
      }
      return '';
    })();

    // 统一反馈语气：客观专业，直接指出改进方向
    const tone = score >= 3.8
      ? '当前表现较稳定，可以继续打磨：'
      : '建议集中处理以下关联点：';

    const items = [tone, base];
    if (sceneFocus) items.push(sceneFocus);
    return items.join(' ').trim();
  },

  /** Layer 2 底座 comment（只对应评分值，不看场景/水平） */
  _ruleCommentBase(key, score, ctx) {
    const { sentCount, fillerCount, charCount, avgLen, structSignals } = ctx;
    const g = (low, mid, high) => score < 2.5 ? low : score < 3.7 ? mid : high;
    switch (key) {
      case 'structure':
        return g(
          structSignals
            ? '整体能传达想法，但层次偏散，可以多用连接词把逻辑节点挂起来。'
            : '想法跳跃了一些，试着先总后分：先给结论，再说 2 条理由，最后收一下。',
          '基本结构有了，结论也比较明确，上下句之间的过渡可以再自然一点。',
          '结构清晰，层次分明，过渡自然，收束也很到位。'
        );
      case 'clarity':
        return g(
          '个别意思比较抽象，听众需要猜一猜，试着把抽象词换成具体的例子。',
          '大意可以懂，但关键条件或指代如果加一个解释会更容易抓住。',
          '用词准确、指代明确，关键信息听众一次就能抓住。'
        );
      case 'fluency':
        return g(
          fillerCount >= 5
            ? `填充/卡壳出现约 ${fillerCount} 次，比较影响节奏。`
            : '有明显卡壳或重复，稍微拖慢了听众理解。',
          fillerCount >= 2
            ? '整体流畅，少数"嗯/然后/其实"之类的填充词可以再减少。'
            : '表达自然，基本没有明显停顿词，节奏不错。',
          '节奏稳定、衔接顺畅，听众听起来很舒服。'
        );
      case 'completeness':
        return g(
          charCount < 90
            ? '观点提了但没展开，缺必要的原因或例子来支撑。'
            : '头尾基本有，但中间论据/例证略单薄。',
          '论据已经比较充分，能支撑住主要观点，再加一个细节例子更好。',
          '观点、例证、结论形成完整闭环，论证有厚度。'
        );
      case 'conciseness':
        return g(
          avgLen > 30
            ? '局部语句较长、有重复，信息被稀释了。'
            : '表达有轻微冗余，相近意思不用再说第二遍。',
          avgLen < 14
            ? '短句偏多但不碎，继续保持这个节奏。'
            : avgLen > 26
              ? '信息密度不错，但部分长句可以拆一拆，让节奏更利落。'
              : '信息量扎实，语句比较利落。',
          '每句话都有明确的信息点，节奏利落，几乎没有废话。'
        );
    }
  },

  _pickEvidence(key, text, sentences, scene) {
    if (!sentences.length) return [];
    const picks = [];
    if (key === 'structure') {
      picks.push(sentences[0]);
      if (sentences.length >= 3) picks.push(sentences[sentences.length - 1]);
    } else if (key === 'fluency') {
      const match = sentences.find(s => /嗯|啊|然后|就是|其实/.test(s));
      if (match) picks.push(match);
      else if (sentences.length >= 2) picks.push(sentences[1]);
    } else if (key === 'completeness') {
      // 面试/演讲强调 STAR/例证 → 优先取中间句（例证）
      const idx = (scene === 'C' || scene === 'D') ? Math.floor(sentences.length * 2 / 3) : Math.floor(sentences.length / 2);
      if (sentences[idx]) picks.push(sentences[idx]);
    } else {
      picks.push(sentences[Math.floor(sentences.length / 2)] || sentences[0]);
    }
    return picks.slice(0, 2).map(p => p.length > 40 ? p.slice(0, 38) + '…' : p);
  },

  /**
   * Layer 3｜Module A（独立模块，不依赖 comment）
   * v1.1.0：统一客观专业语气（levelSegment 参数兼容保留，内部忽略）
   * 输出：≤20 汉字；先肯定最高维、再指出最低维
   */
  ModuleA(scores) {
    const dimMap = {
      structure: '结构', clarity: '表意', fluency: '流畅', completeness: '完整度', conciseness: '简洁度',
    };
    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [topKey, topScore] = ranked[0];
    const [botKey] = ranked[ranked.length - 1];

    const praise = topScore >= 4.0 ? `${dimMap[topKey]}表现突出`
                 : topScore >= 3.4 ? `${dimMap[topKey]}较稳定`
                 : `${dimMap[topKey]}基本清楚`;
    const advice = `${dimMap[botKey]}需重点加强`;

    let s = `${praise}，${advice}`;
    // Unicode 字符数 ≤ 20（口径不变）
    if ([...s].length > 20) {
      s = `${dimMap[topKey]}好，${dimMap[botKey]}再稳`;
    }
    // 超长兜底：切 20
    return [...s].slice(0, 20).join('');
  },

  /**
   * Layer 3｜Module B（独立模块；A/B<3.0，C/D<4.0 触发）
   * v1.1.0：统一 reason 标准——说清"改了什么 + 为什么更好"
   *   - 最多 3 条，最少 0 条
   *   - original 必须是 transcript 连续子串（sentences 中的一句+标点）
   */
  ModuleB(transcript, sentences, dims, threshold) {
    if (!Array.isArray(sentences) || !sentences.length) return [];
    const out = [];
    const used = new Set();
    const dimsSorted = [...dims].sort((a, b) => a.score - b.score);
    const needImprov = dimsSorted.filter(d => d.score < threshold);
    // 没有低于阈值就不生成（低压场景不纠错，专业场景才触发）
    if (!needImprov.length) return [];
    const pickList = needImprov;

    // reason 模板：改了什么 + 为什么更好（对听众理解的具体帮助）
    const reasonFor = (key) => ({
      structure:    '开头加了总结词，先给结论再展开，听众一开始就知道你要说什么。',
      clarity:      '把含糊的说法换成具体表述，听众不用猜就能抓住重点。',
      fluency:      '删掉了填充词和重复，句子更连贯，听起来节奏更稳。',
      completeness: '补充了例证收尾，观点有了支撑，论证更完整可信。',
      conciseness:  '合并了重复表达，每句话只推进一个信息点，理解更省力。',
    })[key] || '这版更直接呈现了该维度的要求，听众抓重点更高效。';

    const rewriteFor = (key, original) => {
      let improved = original;
      if (key === 'structure') {
        improved = '总的来说，' + original.replace(/^(那么|嗯|那个|其实|就是说|然后)/, '').trim();
      } else if (key === 'clarity') {
        improved = original
          .replace(/很好/g, '比如…体现得很好')
          .replace(/不错/g, '比如…就表现得不错')
          .replace(/一些|有些|有点/g, '具体有');
      } else if (key === 'fluency') {
        improved = original
          .replace(/嗯[,，。.!！?？\s]*|啊[,，。.!！?？\s]*|呃[,，。.!！?？\s]*/g, '')
          .replace(/然后[^，。！？,.!?]{0,2}(?=[，。！？,.!?])|就是说[^，。！？,.!?]{0,2}(?=[，。！？,.!?])/g, '');
        if (improved === original) improved = original.split(/[，,]/).filter(Boolean).join('，');
      } else if (key === 'completeness') {
        improved = original + ' 举个具体的例子，' + (original.length > 6 ? original.slice(-6) : '') + '这件事就是印证。';
      } else if (key === 'conciseness') {
        const parts = original.split(/[，,]/).map(p => p.trim()).filter(Boolean);
        const uniq = [...new Set(parts)];
        improved = uniq.join('，') + (original.endsWith('。') ? '。' : original.endsWith('！') ? '！' : original.endsWith('？') ? '？' : '。');
      }
      return improved.trim() || original;
    };

    for (const d of pickList) {
      if (out.length >= 3) break;
      const idx = sentences.findIndex(s => !used.has(s) && s.length >= 6);
      if (idx < 0) break;
      const sentence = sentences[idx];
      used.add(sentence);
      const original = (/[。！？]$/.test(sentence)) ? sentence : sentence + '。';
      const improved = rewriteFor(d.key, original);
      const item = { dimension: d.name, original, improved, reason: reasonFor(d.key) };
      out.push(item);
      if (out.length >= 3) break;
    }
    return out;
  },

  /**
   * v1.1.0：移除水平分级，所有用户统一标准
   * 保留函数仅为向后兼容（旧调用处/测试），固定返回统一档 '2'
   */
  computeLevelSegment() {
    return '2';
  },
};
