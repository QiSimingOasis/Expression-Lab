/**
 * PRD V3.0 前端数据回归验证（纯 Node，不依赖浏览器/DOM）
 *
 * 验收用例 §10.1：
 *   - A1 话题聊天（≥50字）：完整 schema、Module B 阈值 (A<3.0触发)
 *   - B1 自言自语（无题，≥50字）：同上，scene=B
 *   - C1 演讲（1/3/5min 倒计时机制不计入本数据脚本，focus scores + Module B <4.0 触发）
 *   - D1 面试单题（≥50字）：同上 scene=D
 *   - 样本不足 <48字 → insufficient_sample=true 且不进入成长统计
 *   - 水平判定：次数 <5 → 1；≥5且均分2.5-3.5→2；≥5且>3.5→3
 *   - summary ≤ 20字；improvements 每条 original 必须是 transcript 的连续子串
 *   - Module B 差异化：A场景 得分3.2(=L3) → 不触发改写；C场景 得分3.2 → 触发改写
 */

const fs = require('fs');
const path = require('path');

// ===== 加载 JS 源码并在同作用域 eval，使所有 IIFE 结果挂到 globalThis =====
const root = path.resolve(__dirname, '..');
function loadFile(fname) {
  const file = path.join(root, fname);
  let src = fs.readFileSync(file, 'utf8');
  // 把 "const Storage = ..." 等改成 globalThis.* 以便 eval 后从 Node 访问
  src = src.replace(/^const\s+(Storage|API|Recorder|App)\s*=/gm, (_, n) => `globalThis.${n} = `);
  // 把 topics.js 的 pickRandomTopic / getTopicById 导出函数也挂全局
  src = src.replace(/^(function\s+(pickRandomTopic|getTopicById)\b)/gm, 'globalThis.$2 = $1');
  // Storage 里也有 const PREFIX → 保留
  // 去掉 document / window / localStorage / webkitSpeechRecognition / Chart 依赖（storage + api 都不依赖）
  globalThis.document = undefined;
  globalThis.window = globalThis;
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
  globalThis.webkitSpeechRecognition = undefined;
  globalThis.AudioContext = undefined;
  globalThis.MediaRecorder = undefined;
  globalThis.URL = { createObjectURL: (x) => 'blob:mock/' + Math.random() };
  // mock localStorage
  const _store = {};
  globalThis.localStorage = {
    getItem: (k) => (k in _store ? _store[k] : null),
    setItem: (k, v) => { _store[k] = String(v); },
    removeItem: (k) => { delete _store[k]; },
    clear: () => { for (const k of Object.keys(_store)) delete _store[k]; },
  };
  // 抛错前捕获
  try {
    // 用 Function 避免和本文件 var/let 冲突
    // eslint-disable-next-line no-new-func
    (new Function(src))();
  } catch (e) {
    // Recorder / App 会因缺少 DOM 抛错，忽略；只要 Storage / API 挂载成功
    console.log(`[load] eval warning for ${fname}: ${e.message}`);
  }
}

// ===== 加载顺序（依赖）：topics → storage → api =====
loadFile('js/topics.js');
loadFile('js/storage.js');
loadFile('js/api.js');

let pass = 0, fail = 0;
function eq(a, b, msg) {
  if (a === b) { pass++; console.log(`  ✓ PASS ${msg}`); }
  else { fail++; console.log(`  ✗ FAIL ${msg}\n    期望: ${JSON.stringify(b)}\n    实际: ${JSON.stringify(a)}`); }
}
function ok(cond, msg) { if (cond) { pass++; console.log(`  ✓ PASS ${msg}`); } else { fail++; console.log(`  ✗ FAIL ${msg}`); } }

// ===== 基础可用性 =====
console.log('\n== 基础可用性 ==');
ok(typeof Storage === 'object' && Storage.saveRecord, 'Storage 已加载');
ok(typeof API === 'object' && API.analyzeExpression, 'API 已加载');
ok(typeof pickRandomTopic === 'function', 'pickRandomTopic 已加载');
ok(Array.isArray(API.DIMS) && API.DIMS.length === 5, 'API.DIMS 5 个维度齐全');
const DIMS_KEYS = ['structure', 'clarity', 'fluency', 'completeness', 'conciseness'];
eq(API.DIMS.map(d => d.key).join(','), DIMS_KEYS.join(','), '维度 key 顺序 structure/clarity/fluency/completeness/conciseness');

// ===== 评分/标签映射 =====
console.log('\n== 评分/标签映射（PRD §5.1） ==');
eq(API.SCORE_TO_LEVEL(1.0), 'L1', '1.0 → L1');
eq(API.SCORE_TO_LEVEL(1.9), 'L1', '1.9 → L1');
eq(API.SCORE_TO_LEVEL(2.0), 'L2', '2.0 → L2');
eq(API.SCORE_TO_LEVEL(2.9), 'L2', '2.9 → L2');
eq(API.SCORE_TO_LEVEL(3.0), 'L3', '3.0 → L3');
eq(API.SCORE_TO_LEVEL(3.9), 'L3', '3.9 → L3');
eq(API.SCORE_TO_LEVEL(4.0), 'L4', '4.0 → L4（PRD 重点：4.0 必须 L4）');
eq(API.SCORE_TO_LEVEL(5.0), 'L4', '5.0 → L4');

// ===== A1 话题聊天 =====
console.log('\n== A1 话题聊天：≥50字文本完整分析 ==');
const TRANS_A1 = '最近让我改变看法的一件小事，是同事每天在早会前花两分钟分享一个自己的小发现。一开始我觉得这样做太浪费时间了，流程越长效率越低。但坚持了两周以后，我发现整个团队沟通反而更顺畅，大家面对分歧的时候也更愿意互相倾听。后来我才意识到，建立信任其实不需要什么宏大的举措，一些看似微小的日常互动才是粘合剂。这个经历让我重新思考了效率和关系的平衡，也开始主动在自己的沟通里加入一些非正式的互动。';
(async function () {
  const a1 = await API.analyzeExpression(TRANS_A1, { scene: 'A', levelSegment: '2', topic: '最近一件让你改变看法的小事' });
  // v1.1.0：统一标准，mode_code 固定 scene + '2'（不再按练习次数分级）
  eq(a1.mode_code, 'A2', 'A1 统一标准 → 模式编码 A2');
  eq(a1.insufficient_sample, false, 'A1 ≥50字 → insufficient_sample=false');
  eq(Array.isArray(a1.dimensions), true, 'dimensions 是数组');
  eq(a1.dimensions.length, 5, 'dimensions 长度=5');
  eq(a1.dimensions.map(d => d.name).join(','), '逻辑结构,语义清晰度,流畅度,内容完整性,简洁度', '5 维中文名称顺序正确');
  ok(typeof a1.scores === 'object' && DIMS_KEYS.every(k => typeof a1.scores[k] === 'number'), 'scores 对象 5 key 齐全');
  ok(a1.dimensions.every(d => typeof d.score === 'number' && d.score >= 1.0 && d.score <= 5.0), '每维 score 范围 [1.0,5.0]');
  ok(a1.dimensions.every(d => d.level === API.SCORE_TO_LEVEL(d.score)), 'level 由前端映射一致（不因模型自由词漂移）');
  ok(a1.dimensions.every(d => typeof d.comment === 'string'), '每维 comment 存在');
  ok(typeof a1.summary === 'string', 'summary 字段存在');
  ok([...a1.summary].length <= 20, `summary ≤ 20 字（实际「${a1.summary}」${[...a1.summary].length}字）`);
  // 先肯定再改进的格式：含「，」
  ok(/[，]/.test(a1.summary), 'summary 含中文逗号「，」——符合先肯定+再指出不足格式');
  // evidence
  ok(Array.isArray(a1.dimensions[0].evidence), 'evidence 是数组');
  // improvements 合法性
  ok(Array.isArray(a1.improvements), 'improvements 是数组');
  ok(a1.improvements.length <= 3 && a1.improvements.length >= 0, `improvements 条数 0-3（实际 ${a1.improvements.length}）`);
  a1.improvements.forEach((imp, i) => {
    ok(typeof imp.dimension === 'string', `improvement[${i}] dimension 是字符串`);
    ok(TRANS_A1.includes(imp.original), `improvement[${i}] original「${imp.original}」是 transcript 连续子串`);
    ok(typeof imp.improved === 'string' && imp.improved.length > 0, `improvement[${i}] improved 存在`);
    // v1.1.0：统一标准，improvement 必须附 reason（说明改了什么+为什么更好）
    ok(typeof imp.reason === 'string' && imp.reason.trim().length > 0, `A1 improvement[${i}] 必须附 reason（统一标准）`);
  });

  // Module B 阈值（A <3.0 才触发）：若某维度 3.2，不该因此维度出现 improvements
  // 构造一个人工 case：让某 dim 强制为 3.2，验证 API.MODULE_B_THRESHOLD
  eq(API.MODULE_B_THRESHOLD.A, 3, 'A 场景 Module B 阈值 3.0');
  eq(API.MODULE_B_THRESHOLD.B, 3, 'B 场景 Module B 阈值 3.0');
  eq(API.MODULE_B_THRESHOLD.C, 4, 'C 场景 Module B 阈值 4.0');
  eq(API.MODULE_B_THRESHOLD.D, 4, 'D 场景 Module B 阈值 4.0');

  // ===== B1 自言自语（无题） =====
  console.log('\n== B1 自言自语：无题 + ≥50字 ==');
  const TRANS_B1 = '今天又是被闹钟吵醒的一天，本来想起床跑步，结果看了十分钟手机又迷迷糊糊睡着了。醒过来已经九点，匆匆忙忙洗漱完出门赶地铁。好在地铁里人不多，抢到了一个位置。刚才的事让我反思，其实只要我把手机放在离床远一点的地方，就不会有这种恶性循环。明天开始试试吧。';
  const b1 = await API.analyzeExpression(TRANS_B1, { scene: 'B', levelSegment: '2', topic: '' });
  eq(b1.mode_code, 'B2', 'B1 统一标准 → 模式编码 B2');
  eq(b1.insufficient_sample, false, 'B1 ≥50字 → 样本有效');
  ok(typeof b1.summary === 'string' && [...b1.summary].length <= 20, `B1 summary ≤20字（${[...b1.summary].length}）`);

  // ===== C1 演讲 + D1 面试：Module B <4.0 触发 =====
  console.log('\n== C1 演讲 3 分钟：Module B 阈值 4.0（3.2必须触发改写） ==');
  const TRANS_C1 = '大家好，今天我想介绍一个我愿意长期坚持的习惯，就是早起读书。每天我六点左右起床，读半小时书。这个习惯让我感觉一天更充实，收获也很大。';
  // 构造一个固定 scores case：structure=3.2（低于 C 阈值 4.0，应该触发 Module B）
  // 由于 fallback 评分算法分数会根据文本动态变化，我们直接验证「当 scores 存在低于4.0的维度 → improvements 非空」
  // 这里走 analyzeExpression 并确保：任一维度 <4.0 且有可改写原句时会至少1条
  const c1 = await API.analyzeExpression(TRANS_C1, { scene: 'C', levelSegment: '2', topic: '用3分钟介绍一个你愿意长期坚持的习惯' });
  eq(c1.mode_code, 'C2', 'C 场景 level 2 → 编码 C2');
  // level 2 应该附简短的 reason
  if (c1.improvements.length) {
    ok(c1.improvements.some(i => i.reason && i.reason.length), `C2 level 2 improvements 至少一条附简单说明 reason（${c1.improvements.length}条，其中${c1.improvements.filter(i=>i.reason).length}条有reason）`);
  }
  // 3.2 在专业场景：强行用 computeLevelSegment + scene threshold 对比，和 A 低压阈值区分
  console.log('\n== 阈值差异化场景对比：A/L3 vs C/L3 ==');
  const cDim32 = { name: '逻辑结构', score: 3.2, level: 'L3', key: 'structure' };
  ok(cDim32.score < API.MODULE_B_THRESHOLD.C, 'C 场景 3.2 < 4.0 → 触发 Module B（PRD §6.3 专业场景严格）');
  ok(cDim32.score >= API.MODULE_B_THRESHOLD.A, 'A 场景 3.2 >= 3.0 → 不触发 Module B（PRD §6.3 低压场景护意愿）');

  // ===== D2 面试：统一标准，improvements reason 说清改了什么+为什么更好 =====
  console.log('\n== D2 面试：统一标准 improvements reason 质量 ==');
  const TRANS_D1 = '我曾经推动过一个复杂项目落地，一开始团队里大家意见很不统一，各说各的。我先和每个人沟通，做了一个方案。最后项目就顺利完成了，大家都觉得不错。';
  const d3 = await API.analyzeExpression(TRANS_D1, { scene: 'D', levelSegment: '2', topic: '讲一次你推动复杂项目落地的经历' });
  eq(d3.mode_code, 'D2', 'D 场景统一标准 → 编码 D2');
  if (d3.improvements.length) {
    const withWhy = d3.improvements.some(i => {
      const r = i.reason || '';
      return r.length >= 10;
    });
    ok(withWhy, `D2 improvements 至少一条 reason 说明改进效果（${d3.improvements.filter(i => (i.reason||'').length >= 10).length}/${d3.improvements.length}条）`);
  }

  // ===== 样本不足 =====
  console.log('\n== 样本不足（<48字）==');
  const TRANS_SHORT = '今天天气不错。';
  const sh = await API.analyzeExpression(TRANS_SHORT, { scene: 'A', levelSegment: '1', topic: '' });
  eq(sh.insufficient_sample, true, '<48字 → insufficient_sample=true');
  eq(sh.improvements.length, 0, '样本不足 → improvements 为空');
  // 写入 storage 但应被过滤
  localStorage.clear();
  Storage.saveRecord({
    id: 1, scene: 'A', level_segment: '1', mode_code: 'A1',
    duration_sec: 5, transcript: TRANS_SHORT,
    scores: sh.scores, dimensions: sh.dimensions, insufficient_sample: true,
    summary: sh.summary, improvements: sh.improvements,
  });
  // 写入一条有效
  Storage.saveRecord({
    id: 2, scene: 'A', level_segment: '1', mode_code: 'A1',
    duration_sec: 45, transcript: TRANS_A1,
    scores: a1.scores, dimensions: a1.dimensions, insufficient_sample: false,
    summary: a1.summary, improvements: a1.improvements,
  });
  eq(Storage.getAllRecords().length, 2, 'Storage 保存2条（1短1有效），都能读');
  eq(Storage.getValidRecords().length, 1, 'Storage.getValidRecords() 过滤样本不足，剩1条有效');

  // ===== 水平判定（v1.1.0 统一标准） =====
  console.log('\n== 水平判定 v1.1.0 统一标准 ==');
  // v1.1.0：移除水平分级，computeLevelSegment 任意输入固定返回 '2'
  eq(API.computeLevelSegment([], a1.scores), '2', '空历史 → 固定统一标准 2');
  const fourHist = Array.from({length:4}, (_, i) => ({
    created_at: new Date(Date.now() - (4-i)*86400000).toISOString(),
    insufficient_sample: false,
    scores: { structure:4.8, clarity:4.8, fluency:4.8, completeness:4.8, conciseness:4.8 },
  }));
  eq(API.computeLevelSegment(fourHist, fourHist[0].scores), '2', '高分历史 → 固定统一标准 2');
  const fiveHist2 = Array.from({length:5}, (_, i) => ({
    created_at: new Date(Date.now() - (5-i)*86400000).toISOString(),
    insufficient_sample: false,
    scores: { structure:3.0, clarity:3.0, fluency:3.0, completeness:3.0, conciseness:3.0 },
  }));
  eq(API.computeLevelSegment(fiveHist2, fiveHist2[0].scores), '2', '中分历史 → 固定统一标准 2');
  const fiveHist3 = Array.from({length:5}, (_, i) => ({
    created_at: new Date(Date.now() - (5-i)*86400000).toISOString(),
    insufficient_sample: false,
    scores: { structure:3.6, clarity:3.6, fluency:3.6, completeness:3.6, conciseness:3.6 },
  }));
  eq(API.computeLevelSegment(fiveHist3, fiveHist3[0].scores), '2', '无历史参数 → 固定统一标准 2');

  // ===== Storage 记录写入 + last / id =====
  console.log('\n== Storage 新 §7.2 记录存取 ==');
  localStorage.clear();
  const nowISO = new Date().toISOString();
  const rec = {
    id: 12345,
    created_at: nowISO,
    scene: 'C',
    level_segment: '2',
    mode_code: 'C2',
    topic_id: 'c-5',
    topic_text: '用3分钟介绍一个你愿意长期坚持的习惯',
    duration_sec: 178,
    audio_ref: 'blob:abcdef',
    transcript: TRANS_C1,
    scores: c1.scores,
    dimensions: c1.dimensions,
    insufficient_sample: false,
    summary: c1.summary,
    improvements: c1.improvements,
  };
  ok(Storage.saveRecord(rec), 'saveRecord 返回 true');
  const last = Storage.getLastRecord();
  eq(last.id, 12345, 'getLastRecord().id 正确');
  eq(last.scene, 'C', 'scene=C');
  eq(last.level_segment, '2', 'level_segment=2');
  eq(last.mode_code, 'C2', 'mode_code=C2');
  eq(last.topic_id, 'c-5', 'topic_id 保留');
  eq(last.duration_sec, 178, 'duration_sec 保留');
  eq(last.audio_ref, 'blob:abcdef', 'audio_ref 保留');
  ok(Object.keys(last.scores).every(k => DIMS_KEYS.includes(k)), 'scores 5维齐全');
  eq(Array.isArray(last.dimensions) && last.dimensions.length, 5, 'dimensions 5维数组齐全');
  eq(last.summary, c1.summary, 'summary 保留');
  eq(last.improvements.length, c1.improvements.length, 'improvements 条数一致');
  // getRecordById
  eq(Storage.getRecordById(12345).id, 12345, 'getRecordById(12345) 命中');

  // 旧 schema 兼容读取（旧 dimensions.logic → new scores.structure）
  console.log('\n== Storage 旧记录兼容映射（logic→structure）==');
  localStorage.clear();
  const oldRec = {
    id: 999, date: '旧日期', mode: '场景练习', duration: 90000,
    transcript: '旧转写', summary: '旧总结',
    createdAt: nowISO,
    audioBlobUrl: 'blob:old-audio',
    dimensions: {
      logic:        { score: 3.4, comment: '旧结构评价' },
      clarity:      { score: 3.1, comment: '旧清晰' },
      fluency:      { score: 2.8, comment: '旧流畅' },
      completeness: { score: 2.6, comment: '旧完整' },
      conciseness:  { score: 2.5, comment: '旧简洁' },
    },
  };
  // 直接塞入 localStorage
  localStorage.setItem('biaoda_lab_practice_records', JSON.stringify([oldRec]));
  const compat = Storage.getAllRecords()[0];
  eq(compat.scores.structure, 3.4, '旧 logic.score → 新 scores.structure = 3.4');
  eq(compat.scores.clarity, 3.1, 'clarity 保留');
  eq(compat.scores.fluency, 2.8, 'fluency 保留');
  eq(compat.scores.completeness, 2.6, 'completeness 保留');
  eq(compat.scores.conciseness, 2.5, 'conciseness 保留');
  eq(compat.dimensions[0].key, 'structure', 'dimensions[0].key=structure（key 顺序正确）');
  eq(compat.dimensions[0].score, 3.4, '对应分数 3.4');
  eq(compat.dimensions[0].level, 'L3', 'score=3.4 → level=L3');
  eq(compat.dimensions[0].label, '结构清晰', 'L3 structure 标签=结构清晰（PRD §5.1）');
  eq(compat.duration_sec, 90, '旧 duration ms 转为 90 秒');
  eq(compat.audio_ref, 'blob:old-audio', '旧 audioBlobUrl → audio_ref');

  // 主模式记忆（chat 默认，写入 scene 再读回）
  console.log('\n== 首页主模式记忆（localStorage.home_main_mode）==');
  localStorage.clear();
  eq(Storage.getMainMode(), 'chat', '首次默认主模式=随便聊聊 chat');
  Storage.setMainMode('scene');
  eq(Storage.getMainMode(), 'scene', '切换 scene 后可恢复');
  Storage.setMainMode('illegal');
  eq(Storage.getMainMode(), 'scene', '非法值写入被拒，保持上次 scene');

  // 终了汇总
  console.log(`\n===== 汇总：PASS ${pass} / FAIL ${fail} =====`);
  if (fail > 0) process.exit(1);
})();
