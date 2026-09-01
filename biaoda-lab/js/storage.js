/**
 * 表达研究室 - localStorage 操作（PRD V3.0 数据结构）
 *
 * 训练记录结构（§7.2 基本对齐；audio_ref / transcript 兼容 MVP）：
 * {
 *   id: number/string,
 *   created_at: ISO-8601,
 *   scene: 'A' | 'B' | 'C' | 'D',
 *   level_segment: '1' | '2' | '3',
 *   mode_code: 'A1' | 'B2' ...,
 *   topic_id: string | null,
 *   topic_text: string | null,
 *   duration_sec: number,
 *   audio_ref: string | null,         // blob: URL
 *   transcript: string,
 *   scores: { structure, clarity, fluency, completeness, conciseness },
 *   dimensions: [ { key, name, score, level, label, comment, evidence } ],
 *   insufficient_sample: boolean,
 *   summary: string,
 *   improvements: [ { dimension, original, improved, reason? } ]
 * }
 *
 * 兼容旧字段：旧的 lastResult / previousResult 仍可读到；saveRecord 时统一格式。
 */

const Storage = (function () {
  const PREFIX = 'biaoda_lab_';
  const REC_KEY = PREFIX + 'practice_records';
  const MAIN_MODE_KEY = PREFIX + 'main_mode';     // 'chat' | 'scene'
  const MAX_RECORDS = 100;

  /** 兼容旧数据：把 App 历史里的旧 dimensions { logic, clarity...} 映射成新 scores + dimensions 数组 */
  function _normalizeRecord(r) {
    if (!r) return null;
    const out = {
      id: r.id ?? Date.now(),
      created_at: r.created_at || r.createdAt || new Date().toISOString(),
      scene: r.scene || r.scene_code || (r.mode === '场景练习' || r.mode === '演讲' || r.mode === '单题面试' ? 'D' : 'A'),
      level_segment: String(r.level_segment || r.levelSegment || '1'),
      mode_code: r.mode_code || r.modeCode || null,
      topic_id: r.topic_id ?? r.topicId ?? null,
      topic_text: r.topic_text ?? r.topicText ?? r.topic ?? null,
      duration_sec: typeof r.duration_sec === 'number' ? r.duration_sec
                  : typeof r.duration === 'number' ? Math.round(r.duration / 1000) : 0,
      audio_ref: r.audio_ref ?? r.audioBlobUrl ?? r.audioRef ?? null,
      transcript: r.transcript || '',
      insufficient_sample: !!r.insufficient_sample,
      summary: r.summary || '',
      improvements: Array.isArray(r.improvements) ? r.improvements : [],
    };

    if (!out.mode_code) out.mode_code = out.scene + out.level_segment;

    // —— v2.0.0 兼容：如果顶层记录缺失 summary/improvements，但 dimensions 有 coaching/suggestions 或
    // 从 r.overall 补 summary；从 r.dimensions 聚合 improvements。
    if (!out.summary && typeof r.overall === 'string' && r.overall) {
      out.summary = r.overall;
    }

    // scores
    if (r.scores && typeof r.scores === 'object') {
      out.scores = {
        structure:    +(r.scores.structure    ?? r.scores.logic ?? 3.0).toFixed(1),
        clarity:      +(r.scores.clarity      ?? 3.0).toFixed(1),
        fluency:      +(r.scores.fluency      ?? 3.0).toFixed(1),
        completeness: +(r.scores.completeness ?? 3.0).toFixed(1),
        conciseness:  +(r.scores.conciseness  ?? 3.0).toFixed(1),
      };
    } else if (r.dimensions && typeof r.dimensions === 'object') {
      out.scores = {
        structure:    +(r.dimensions.structure?.score ?? r.dimensions.logic?.score ?? 3.0).toFixed(1),
        clarity:      +(r.dimensions.clarity?.score      ?? 3.0).toFixed(1),
        fluency:      +(r.dimensions.fluency?.score      ?? 3.0).toFixed(1),
        completeness: +(r.dimensions.completeness?.score ?? 3.0).toFixed(1),
        conciseness:  +(r.dimensions.conciseness?.score  ?? 3.0).toFixed(1),
      };
    } else {
      out.scores = { structure: 3.0, clarity: 3.0, fluency: 3.0, completeness: 3.0, conciseness: 3.0 };
    }

    // dimensions 数组（如果不存在就从 scores 构造，保证后续 render 统一）
    if (Array.isArray(r.dimensions)) {
      const LABEL_MAP = { L1: '需要刻意练习', L2: '基础合格', L3: '表达良好', L4: '接近专业' };
      out.dimensions = r.dimensions.map(d => {
        const key = d.key || d.name_key || _guessKeyByName(d.name);
        const score = +(+d.score).toFixed(1);
        const level = d.level || _scoreLevel(score);
        // v2.0.0 字段：comment ← coaching；suggestion ← 首条 suggestions；顶层 v1 label 补默认
        let comment = d.comment || '';
        if (!comment && d.coaching) comment = String(d.coaching);
        let suggestion = d.suggestion || '';
        if (!suggestion) {
          if (Array.isArray(d.suggestions) && d.suggestions.length) {
            const first = d.suggestions[0];
            const text = (first.improved || first.original || '').toString();
            suggestion = text.length > 30 ? text.slice(0, 28) + '…' : text;
          } else if (d.coaching) {
            const s = String(d.coaching).replace(/\s+/g, ' ');
            suggestion = s.length > 28 ? s.slice(0, 26) + '…' : s;
          } else {
            suggestion = '多开口练习，每次只改善一个具体点。';
          }
        }
        return {
          key,
          name: d.name,
          score,
          level,
          label: d.label || LABEL_MAP[level] || '',
          coaching: d.coaching || '',
          comment,
          suggestion,
          suggestions: Array.isArray(d.suggestions) ? d.suggestions : [],
          evidence: Array.isArray(d.evidence) ? d.evidence : [],
        };
      });
    } else {
      const LEVEL_MAP = {
        structure:    { L1: '自由发散', L2: '初步成型', L3: '结构清晰', L4: '驾轻就熟' },
        clarity:      { L1: '尚需揣摩', L2: '基本可懂', L3: '表意准确', L4: '一语中的' },
        fluency:      { L1: '时有停顿', L2: '基本流畅', L3: '自然流畅', L4: '行云流水' },
        completeness: { L1: '点到为止', L2: '有头有尾', L3: '论据充分', L4: '深入透彻' },
        conciseness:  { L1: '略显冗余', L2: '基本精炼', L3: '简洁有力', L4: '字字珠玑' },
      };
      out.dimensions = ['structure', 'clarity', 'fluency', 'completeness', 'conciseness'].map(key => {
        const NAMES = { structure: '逻辑结构', clarity: '语义清晰度', fluency: '流畅度', completeness: '内容完整性', conciseness: '简洁度' };
        const score = out.scores[key];
        const level = _scoreLevel(score);
        return {
          key, name: NAMES[key], score, level,
          label: LEVEL_MAP[key][level],
          comment: (r.dimensions && r.dimensions[key]?.comment) || '请根据维度说明继续强化。',
          evidence: (r.dimensions && Array.isArray(r.dimensions[key]?.evidence)) ? r.dimensions[key].evidence : [],
        };
      });
    }

    // —— v2 兼容：如果顶层 improvements 为空，但 out.dimensions 带 suggestions[]，则聚合填充
    if ((!out.improvements || !out.improvements.length) && Array.isArray(out.dimensions)) {
      const merged = [];
      out.dimensions.forEach(d => {
        if (Array.isArray(d.suggestions) && d.suggestions.length) {
          d.suggestions.forEach(sg => {
            if (!sg || (!sg.original && !sg.improved)) return;
            merged.push({
              dimension: d.name || '',
              original: sg.original || '',
              improved: sg.improved || sg.original || '',
              reason: sg.reason || (sg.context ? `上下文：${sg.context}` : '') || '',
            });
          });
        }
      });
      if (merged.length) out.improvements = merged;
    }

    // —— v2 兼容：如果 summary 仍为空，从 dimensions[0].comment 兜底
    if (!out.summary && Array.isArray(out.dimensions) && out.dimensions[0]?.comment) {
      out.summary = out.dimensions.map(d => d.comment).filter(Boolean).join(' ');
      if (out.summary.length > 160) out.summary = out.summary.slice(0, 158) + '…';
    }

    return out;
  }

  function _scoreLevel(s) { return s >= 4.0 ? 'L4' : s >= 3.0 ? 'L3' : s >= 2.0 ? 'L2' : 'L1'; }
  function _guessKeyByName(name) {
    return ({ '逻辑结构':'structure','语义清晰度':'clarity','流畅度':'fluency','内容完整性':'completeness','简洁度':'conciseness' })[name] || 'structure';
  }

  function saveRecord(record) {
    const norm = _normalizeRecord(record);
    if (!norm) return false;

    let arr;
    try {
      arr = JSON.parse(localStorage.getItem(REC_KEY) || '[]');
      if (!Array.isArray(arr)) arr = [];
    } catch (e) { arr = []; }

    arr.unshift(norm);
    if (arr.length > MAX_RECORDS) arr.length = MAX_RECORDS;

    // 尝试写入；遇 QuotaExceededError 时，从数组末尾（最旧）开始 null 掉 audio_ref
    // 直到能写入为止（保留文本/评分/总结，仅丢最旧临时 blob 音频引用，对齐 PRD §8 P2）
    const tryWrite = () => {
      try {
        localStorage.setItem(REC_KEY, JSON.stringify(arr));
        return true;
      } catch (e) {
        // QuotaExceededError: DOMException name 或 IE/旧浏览器 code
        if (e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014)) return false;
        return false;
      }
    };

    if (tryWrite()) return true;

    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i].audio_ref) {
        arr[i].audio_ref = null;
        if (tryWrite()) return true;
      }
    }

    return false;
  }

  function getAllRecords() {
    try {
      const arr = JSON.parse(localStorage.getItem(REC_KEY) || '[]');
      if (!Array.isArray(arr)) return [];
      return arr.map(_normalizeRecord).filter(Boolean);
    } catch { return []; }
  }

  function getLastRecord() {
    const arr = getAllRecords();
    return arr.length ? arr[0] : null;
  }

  function getRecordById(id) {
    return getAllRecords().find(r => String(r.id) === String(id)) || null;
  }

  function getMainMode() {
    return localStorage.getItem(MAIN_MODE_KEY) || 'chat';
  }

  function setMainMode(v) {
    if (v !== 'chat' && v !== 'scene') return;
    localStorage.setItem(MAIN_MODE_KEY, v);
  }

  /** 有效记录（样本不足的不计入成长统计） */
  function getValidRecords() {
    return getAllRecords().filter(r => !r.insufficient_sample);
  }

  return {
    saveRecord, getAllRecords, getLastRecord, getRecordById,
    getMainMode, setMainMode, getValidRecords,
    _normalizeRecord, // 测试用
  };
})();
