/**
 * 表达研究室 - 主逻辑（PRD V3.0）
 *
 * 页面入口：
 *   App.initHome()      — index.html：tab切换+主卡片+子模式选择+跳practice
 *   App.initPractice()  — practice.html：参数解析+话题渲染+计时+录音+提交分析
 *   App.initResult()    — result.html：反馈抽屉（雷达图破框/五维/改进建议）
 *   App.initProfile()   — profile.html：概览/近5次平均/成长曲线/日志
 *
 * 提交分析 submitAnalysis()：
 *   遮罩三阶段进度 → 转写 → （水平计算） → 分析 → 写入Storage → 跳 result
 *
 * 兼容：仍会在 localStorage 写 lastResult（result.html 无 id 时回退读取）。
 */

const App = (function () {
  'use strict';

  const SCENE_NAMES = {
    A: '话题聊天', B: '自言自语', C: '演讲', D: '单题面试',
  };
  const MAIN_MODE_BY_SCENE = { A: 'chat', B: 'chat', C: 'scene', D: 'scene' };
  const SUB_BY_MAIN = {
    chat: [
      { scene: 'A', title: '话题聊天', desc: '随机话题，正计时无压力', primary: true },
      { scene: 'B', title: '自言自语', desc: '无题，声音日记', primary: false },
    ],
    scene: [
      { scene: 'C', title: '演讲', desc: '主题库 + 1/3/5 分钟倒计时', primary: true },
      { scene: 'D', title: '单题面试', desc: '每题一次反馈，练习 STAR', primary: false },
    ],
  };

  const RESULT_STORAGE = 'lastResult';
  const PREV_RESULT_STORAGE = 'previousResult';

  // ===== 工具 =====
  function pad(n) { return String(n).padStart(2, '0'); }
  function fmtClock(ms) {
    if (ms == null || isNaN(ms)) return '00:00';
    const total = Math.max(0, Math.floor(ms / 1000));
    return pad(Math.floor(total / 60)) + ':' + pad(total % 60);
  }
  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function qs(id) { return document.getElementById(id); }

  /** 计算综合分（五维均值，保留 1 位小数） */
  function avgFive(scores) {
    if (!scores) return 0;
    const vals = Object.values(scores).filter(v => typeof v === 'number');
    if (!vals.length) return 0;
    return +(vals.reduce((a,b)=>a+b,0) / vals.length).toFixed(2);
  }

  /**
   * 最小展示时长：保证某阶段在 UI 上至少展示 minMs 毫秒
   * 用于让用户能看见 overlay 三阶段进度真实变绿，避免 fallback 路径瞬间完成
   * @param {number} startMs 该阶段开始的时间戳（Date.now()）
   * @param {number} minMs  最小展示毫秒
   */
  async function _minDelay(startMs, minMs) {
    const elapsed = Date.now() - startMs;
    if (elapsed < minMs) await new Promise(r => setTimeout(r, minMs - elapsed));
  }

  /**
   * Prompt v2.0.0 → 前端渲染用的 v1 兼容结构。
   * 新版字段（参见 api/analyze.js）：
   *   prompt_version / scene / scores{logic,..} / overall /
   *   dimensions[{key,name,score,level:"L1-L4",coaching,suggestions[]}]
   * 旧版 v1 渲染依赖：summary / dimensions[i].comment / .suggestion /
   *                    .label / improvements[{original,improved,reason,dimension}]
   * 本函数在 v2 结构上直接"就地填充"这些旧字段，使 renderResultDrawer、
   * renderSuggestionsBlock、renderRecordList 等无需改动。
   * @param {Object} analysis  分析结果对象（v1 或 v2 都可）
   * @returns {Object} 同一个 analysis，原地补齐兼容字段
   */
  function normalizeAnalysisV2(analysis) {
    if (!analysis || typeof analysis !== 'object') return analysis;

    // v1 → 已经是 summary/comment/suggestion/improvements，跳过
    const isV2 = !analysis.summary && (analysis.overall || analysis.prompt_version);
    if (!isV2) return analysis;

    // 1. summary ← overall
    if (!analysis.summary && analysis.overall) {
      analysis.summary = analysis.overall;
    }

    // 2. 聚合 improvements：把所有维度 suggestions[] 平铺
    const aggregatedImprovements = [];

    // 3. dimensions[i] 补齐 comment / suggestion / label
    if (Array.isArray(analysis.dimensions)) {
      analysis.dimensions.forEach(d => {
        // level tag 右侧附加的级别说明
        if (!d.label) {
          const lvMap = { L1: '需要刻意练习', L2: '基础合格', L3: '表达良好', L4: '接近专业' };
          d.label = lvMap[d.level] || '';
        }
        // comment ← coaching（具体问题 + 方向，通常 3-4 句话）
        if (!d.comment && d.coaching) d.comment = String(d.coaching);

        // suggestion ← 第一条 suggestions[].improved 的摘要；否则用 coaching 里的前 20 字
        if (!d.suggestion) {
          if (Array.isArray(d.suggestions) && d.suggestions.length) {
            const first = d.suggestions[0];
            const text = (first.improved || first.original || '').toString();
            d.suggestion = text.length > 30 ? text.slice(0, 28) + '…' : text;
          } else if (d.coaching) {
            const s = String(d.coaching).replace(/\s+/g, ' ');
            d.suggestion = s.length > 28 ? s.slice(0, 26) + '…' : s;
          } else {
            d.suggestion = '多开口练习，每次只改善一个具体点。';
          }
        }

        // 把本维度 suggestions 全部累积到顶层 improvements
        if (Array.isArray(d.suggestions) && d.suggestions.length) {
          d.suggestions.forEach((sg, i) => {
            if (!sg || (!sg.original && !sg.improved)) return;
            aggregatedImprovements.push({
              dimension: d.name || d.key || '',
              original: sg.original || '',
              improved: sg.improved || sg.original || '',
              reason: sg.reason || (sg.context ? `上下文：${sg.context}` : '') || '',
            });
          });
        }
      });
    }

    if (!Array.isArray(analysis.improvements) || !analysis.improvements.length) {
      analysis.improvements = aggregatedImprovements;
    }

    return analysis;
  }

  /**
   * 页内时长选择浮层（替代 window.prompt，兼容 iframe sandbox）
   * 返回 Promise<'1'|'3'|'5'>；用户取消则 resolve(null)
   */
  function _pickDurationModal() {
    return new Promise(resolve => {
      const old = document.getElementById('duration-modal');
      if (old) old.remove();

      const modal = document.createElement('div');
      modal.id = 'duration-modal';
      modal.className = 'modal-overlay';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.innerHTML = `
        <div class="modal-panel">
          <h3 class="modal-title">选择演讲时长</h3>
          <p class="modal-sub">建议 3—5 分钟完整论证；初学者可从 1 分钟热身</p>
          <div class="modal-options">
            <button type="button" class="modal-opt" data-min="1">
              <strong>1 分钟</strong>
              <span>热身 / 破冰</span>
            </button>
            <button type="button" class="modal-opt modal-opt--primary" data-min="3">
              <strong>3 分钟</strong>
              <span>推荐 · 完整论证</span>
            </button>
            <button type="button" class="modal-opt" data-min="5">
              <strong>5 分钟</strong>
              <span>深入展开</span>
            </button>
          </div>
          <button type="button" class="modal-cancel">取消</button>
        </div>
      `;
      document.body.appendChild(modal);
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const close = (val) => {
        modal.remove();
        document.body.style.overflow = prevOverflow;
        resolve(val);
      };
      modal.querySelectorAll('[data-min]').forEach(b => {
        b.addEventListener('click', () => close(b.dataset.min));
      });
      modal.querySelector('.modal-cancel').addEventListener('click', () => close(null));
      modal.addEventListener('click', (e) => { if (e.target === modal) close(null); });
    });
  }

  // ===== 首页 =====
  function initHome() {
    const profileEntry = qs('profile-entry');
    if (profileEntry) profileEntry.addEventListener('click', () => location.href = 'profile.html');

    // 四色模式卡：点击直接进入对应场景（C/D 场景由 goPractice 内部弹层选择）
    document.querySelectorAll('#home-mode-grid .mode-card').forEach(card => {
      card.addEventListener('click', () => goPractice(card.dataset.scene));
    });

    renderHomeDashboard();
  }

  /** 本地日期 YYYY-MM-DD（避免 toISOString 的 UTC 偏移） */
  function _localDateStr(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /** 首页打卡仪表盘：连击天数 + 累计次数 + 最近 7 天日历 */
  function renderHomeDashboard() {
    let records = [];
    try { records = Storage.getAllRecords() || []; } catch (e) { records = []; }

    // 按本地日期去重（练过即打卡）
    const dateSet = new Set(records.map(r => _localDateStr(new Date(r.created_at))));
    const todayStr = _localDateStr(new Date());

    // 连击：从今天（或昨天）往回连续有练习的天数
    let streak = 0;
    const cur = new Date();
    if (!dateSet.has(_localDateStr(cur))) cur.setDate(cur.getDate() - 1); // 今天还没练则从昨天起算
    while (dateSet.has(_localDateStr(cur))) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    }

    const streakEl = qs('dash-streak');
    if (streakEl) streakEl.innerHTML = '🔥 <b>' + streak + '</b>';
    const totalEl = qs('dash-total');
    if (totalEl) totalEl.innerHTML = '💎 <b>' + records.length + '</b>';

    // 最近 7 天日历：今日居中（index 3）→ i∈[-3,3]
    // 只显示日期号（星期信息放在 title 悬浮提示里）
    const cal = qs('dash-cal');
    if (!cal) return;
    cal.innerHTML = '';
    const week = ['日', '一', '二', '三', '四', '五', '六'];
    const today = new Date();
    for (let offset = -3; offset <= 3; offset++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
      const ds = _localDateStr(d);
      const todayStr = _localDateStr(today);
      const done = dateSet.has(ds);
      const isToday = (ds === todayStr);
      const cell = document.createElement('div');
      cell.className = 'cal-cell' + (done ? ' is-done' : '') + (isToday ? ' is-today' : '');

      const day = document.createElement('span');
      day.className = 'cal-day';
      day.textContent = String(d.getDate());
      cell.appendChild(day);

      cell.title = (d.getMonth() + 1) + '月' + d.getDate() + '日（周' + week[d.getDay()] + '）' + (done ? ' 已打卡' : ' 未打卡');
      cal.appendChild(cell);
    }
  }

  /**
   * 页内演讲模式选择浮层：随机演讲题 / 自由演讲
   * 返回 Promise<'random'|'free'|null>
   */
  function _pickSpeechModeModal() {
    return new Promise(resolve => {
      const old = document.getElementById('duration-modal');
      if (old) old.remove();

      const modal = document.createElement('div');
      modal.id = 'duration-modal';
      modal.className = 'modal-overlay';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.innerHTML = `
        <div class="modal-panel">
          <h3 class="modal-title">选择演讲模式</h3>
          <p class="modal-sub">随机题适合日常训练；自由演讲可自拟题目</p>
          <div class="modal-options">
            <button type="button" class="modal-opt" data-mode="random">
              <strong>🎲 随机演讲题</strong>
              <span>从题库随机抽取演讲题目</span>
            </button>
            <button type="button" class="modal-opt modal-opt--primary" data-mode="free">
              <strong>✍️ 自由演讲</strong>
              <span>自填题目 + 选择时长</span>
            </button>
          </div>
          <button type="button" class="modal-cancel">取消</button>
        </div>
      `;
      document.body.appendChild(modal);
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const close = (val) => {
        modal.remove();
        document.body.style.overflow = prevOverflow;
        resolve(val);
      };
      modal.querySelectorAll('[data-mode]').forEach(b => {
        b.addEventListener('click', () => close(b.dataset.mode));
      });
      modal.querySelector('.modal-cancel').addEventListener('click', () => close(null));
      modal.addEventListener('click', (e) => { if (e.target === modal) close(null); });
    });
  }

  /**
   * 自由演讲自定义浮层：自填题目 + 选时长
   * 返回 Promise<{ title:string, minutes:'1'|'3'|'5' }|null>
   */
  function _pickFreeSpeechModal() {
    return new Promise(resolve => {
      const old = document.getElementById('duration-modal');
      if (old) old.remove();

      const modal = document.createElement('div');
      modal.id = 'duration-modal';
      modal.className = 'modal-overlay';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.innerHTML = `
        <div class="modal-panel">
          <h3 class="modal-title">自由演讲</h3>
          <p class="modal-sub">写下你想练的演讲题目，AI 将围绕它进行点评</p>
          <input type="text" class="modal-input" id="free-speech-title"
                 maxlength="60" placeholder="例如：我为什么想加入贵公司 / 短视频对青少年的影响"
                 autocomplete="off" />
          <div class="modal-options" style="margin-top:0.875rem;">
            <button type="button" class="modal-opt" data-min="1">
              <strong>1 分钟</strong><span>热身</span>
            </button>
            <button type="button" class="modal-opt modal-opt--primary" data-min="3">
              <strong>3 分钟</strong><span>推荐</span>
            </button>
            <button type="button" class="modal-opt" data-min="5">
              <strong>5 分钟</strong><span>深入</span>
            </button>
          </div>
          <button type="button" class="modal-cancel">取消</button>
        </div>
      `;
      document.body.appendChild(modal);
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      let minutes = null;
      const input = modal.querySelector('#free-speech-title');
      setTimeout(() => input && input.focus(), 80);

      const close = (val) => {
        modal.remove();
        document.body.style.overflow = prevOverflow;
        resolve(val);
      };
      modal.querySelectorAll('[data-min]').forEach(b => {
        b.addEventListener('click', () => {
          minutes = b.dataset.min;
          const title = (input.value || '').trim();
          if (!title) {
            input.classList.add('is-error');
            input.placeholder = '请先填写演讲题目～';
            input.focus();
            return;
          }
          close({ title, minutes });
        });
      });
      modal.querySelector('.modal-cancel').addEventListener('click', () => close(null));
      modal.addEventListener('click', (e) => { if (e.target === modal) close(null); });
    });
  }

  /**
   * 页内面试模式选择浮层：随机提问 / 完整面试（JD 生成）
   * 返回 Promise<'random'|'full'|null>
   */
  function _pickInterviewModeModal() {
    return new Promise(resolve => {
      const old = document.getElementById('duration-modal');
      if (old) old.remove();

      const modal = document.createElement('div');
      modal.id = 'duration-modal';
      modal.className = 'modal-overlay';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.innerHTML = `
        <div class="modal-panel">
          <h3 class="modal-title">选择面试练习模式</h3>
          <p class="modal-sub">随机单题日常练手；完整面试模拟真实全流程</p>
          <div class="modal-options">
            <button type="button" class="modal-opt" data-mode="random">
              <strong>🎲 随机提问</strong>
              <span>题库随机单题，快速练习</span>
            </button>
            <button type="button" class="modal-opt modal-opt--primary" data-mode="full">
              <strong>💼 完整面试</strong>
              <span>提交岗位 JD，AI 生成 5/10 道结构化题目</span>
            </button>
          </div>
          <button type="button" class="modal-cancel">取消</button>
        </div>
      `;
      document.body.appendChild(modal);
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const close = (val) => {
        modal.remove();
        document.body.style.overflow = prevOverflow;
        resolve(val);
      };
      modal.querySelectorAll('[data-mode]').forEach(b => {
        b.addEventListener('click', () => close(b.dataset.mode));
      });
      modal.querySelector('.modal-cancel').addEventListener('click', () => close(null));
      modal.addEventListener('click', (e) => { if (e.target === modal) close(null); });
    });
  }

  /**
   * 完整面试 JD 输入 → 调 DeepSeek 生成题目 → 存 sessionStorage → 跳转练习页
   * 生成成功返回 true（已跳转），失败/取消返回 false
   */
  async function _interviewJDFlow() {
    const ok = await new Promise(resolve => {
      const old = document.getElementById('duration-modal');
      if (old) old.remove();

      const modal = document.createElement('div');
      modal.id = 'duration-modal';
      modal.className = 'modal-overlay modal-overlay--wide';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.innerHTML = `
        <div class="modal-panel">
          <h3 class="modal-title">💼 完整面试 · 提交岗位 JD</h3>
          <p class="modal-sub">粘贴职位描述，AI 将生成有起承转合结构的面试题：<br/>开场破冰 → 经历深挖 → 专业场景 → 动机收尾</p>
          <textarea class="modal-input modal-textarea" id="interview-jd" rows="6"
            placeholder="粘贴岗位 JD / 职位描述，例如：&#10;岗位：前端开发工程师&#10;职责：负责公司核心产品 Web 端开发…&#10;要求：3 年以上经验，熟悉 React/Vue…"></textarea>
          <div class="interview-count-row">
            <span class="interview-count-label">题目数量</span>
            <div class="interview-count-opts">
              <button type="button" class="interview-count-opt is-active" data-count="5">5 题精简版</button>
              <button type="button" class="interview-count-opt" data-count="10">10 题完整版</button>
            </div>
          </div>
          <button type="button" class="modal-gen-btn" id="interview-gen-btn">✨ 生成面试题</button>
          <button type="button" class="modal-cancel">取消</button>
        </div>
      `;
      document.body.appendChild(modal);
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      let count = 5;
      const ta = modal.querySelector('#interview-jd');
      const genBtn = modal.querySelector('#interview-gen-btn');
      setTimeout(() => ta && ta.focus(), 80);

      const close = (val) => {
        modal.remove();
        document.body.style.overflow = prevOverflow;
        resolve(val);
      };
      modal.querySelectorAll('.interview-count-opt').forEach(b => {
        b.addEventListener('click', () => {
          count = +b.dataset.count;
          modal.querySelectorAll('.interview-count-opt').forEach(x => x.classList.toggle('is-active', x === b));
        });
      });
      modal.querySelector('.modal-cancel').addEventListener('click', () => close(false));
      modal.addEventListener('click', (e) => { if (e.target === modal) close(false); });

      genBtn.addEventListener('click', async () => {
        const jd = (ta.value || '').trim();
        if (jd.length < 30) {
          ta.classList.add('is-error');
          ta.focus();
          return;
        }
        ta.classList.remove('is-error');
        genBtn.disabled = true;
        genBtn.textContent = '🧠 AI 正在分析 JD 并出题…';
        try {
          const res = await fetch('/api/interview-questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jd, count }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !Array.isArray(data.questions) || !data.questions.length) {
            throw new Error(data.message || data.error || '题目生成失败，请稍后重试');
          }
          sessionStorage.setItem('biaoda_lab_interview', JSON.stringify({ jd, questions: data.questions }));
          close(true);
        } catch (err) {
          alert(err.message || '题目生成失败，请稍后重试');
          genBtn.disabled = false;
          genBtn.textContent = '✨ 生成面试题';
        }
      });
    });

    if (!ok) return false;

    // 生成成功 → 跳转练习页（题目从 sessionStorage 读取）
    const interview = JSON.parse(sessionStorage.getItem('biaoda_lab_interview') || 'null');
    if (!interview || !interview.questions?.length) return false;
    const q1 = interview.questions[0];
    const params = new URLSearchParams({
      scene: 'D',
      interview: 'full',
      index: '1',
      topic_id: '',
      topic_text: q1.title,
      hint: q1.hint || '',
    });
    location.href = 'practice.html?' + params.toString();
    return true;
  }

  /** 跳录音页，参数：scene A/B/C/D；D 先选模式（随机提问/完整面试） */
  async function goPractice(scene) {
    if (scene === 'A') {
      const t = pickRandomTopic('A');
      const params = new URLSearchParams({ scene, topic_id: t?.id || '', topic_text: t?.title || '' });
      location.href = 'practice.html?' + params.toString();
    } else if (scene === 'B') {
      location.href = 'practice.html?scene=B';
    } else if (scene === 'C') {
      // 第一步：选演讲模式
      const mode = await _pickSpeechModeModal();
      if (!mode) return;

      if (mode === 'free') {
        // 自由演讲：自填题目 + 选时长
        const custom = await _pickFreeSpeechModal();
        if (!custom) return;
        const params = new URLSearchParams({
          scene: 'C',
          topic_id: '',
          topic_text: custom.title,
          hint: '自由演讲 · 自定义题目',
          duration_min: custom.minutes,
        });
        location.href = 'practice.html?' + params.toString();
        return;
      }

      // 随机演讲题：题库抽题 + 页内时长选择浮层（替代 window.prompt，兼容 iframe sandbox / 移动端）
      const t = pickRandomTopic('C');
      const mm = await _pickDurationModal();
      if (!mm) return; // 用户取消
      const params = new URLSearchParams({
        scene: 'C',
        topic_id: t?.id || '',
        topic_text: t?.title || '',
        hint: t?.hint || '',
        duration_min: mm,
      });
      location.href = 'practice.html?' + params.toString();
    } else if (scene === 'D') {
      // 第一步：选面试模式
      const mode = await _pickInterviewModeModal();
      if (!mode) return;
      if (mode === 'full') {
        // 完整面试：JD 生成题目后跳转
        await _interviewJDFlow();
        return;
      }
      // 随机提问：题库抽题
      const t = pickRandomTopic('D');
      const params = new URLSearchParams({
        scene: 'D',
        topic_id: t?.id || '',
        topic_text: t?.title || '',
        hint: t?.hint || '',
      });
      location.href = 'practice.html?' + params.toString();
    }
  }

  // ===== 录音页 =====
  /** 当前练习页状态（多模式共享） */
  const P = {
    scene: 'A',
    topic: null,                 // { id, title, hint, suggested_minutes }
    durationMin: null,           // C 模式才设
    countdownSec: 0,             // 0 = 正计时
    interviewList: null,         // 完整面试题目列表
    interviewIndex: 0,           // 当前题 index（0-based）
  };

  function initPractice() {
    const params = new URLSearchParams(location.search);
    P.scene = params.get('scene') || 'A';
    if (!['A','B','C','D'].includes(P.scene)) P.scene = 'A';

    const topicId = params.get('topic_id');
    const topicText = params.get('topic_text');
    const hint = params.get('hint');
    if (topicId || topicText) {
      let t = topicId ? getTopicById(P.scene, topicId) : null;
      if (!t) t = { id: topicId || '', title: topicText || '', hint: hint || '' };
      P.topic = t;
    }

    // 完整面试：从 sessionStorage 读取 AI 生成的题目列表，按 URL index 定位当前题
    P.interviewList = null;
    P.interviewIndex = 0;
    if (params.get('interview') === 'full') {
      try {
        const interview = JSON.parse(sessionStorage.getItem('biaoda_lab_interview') || 'null');
        if (interview && Array.isArray(interview.questions) && interview.questions.length) {
          P.interviewList = interview.questions;
          const idx = Math.max(1, Math.min(interview.questions.length, parseInt(params.get('index'), 10) || 1));
          P.interviewIndex = idx - 1;
          const q = interview.questions[P.interviewIndex];
          P.topic = { id: '', title: q.title, hint: q.hint || '', stage: q.stage };
        }
      } catch {}
    }
    if (P.scene === 'C') {
      const mm = params.get('duration_min');
      P.durationMin = (['1','3','5'].includes(mm)) ? mm : (P.topic?.suggested_minutes ? String(P.topic.suggested_minutes) : '3');
      P.countdownSec = (+P.durationMin) * 60;
    } else {
      P.durationMin = null;
      P.countdownSec = 0;
    }
    renderPracticeHeader();
    renderPracticeTopic();
    setupPracticeTimerUI();

    // 换题按钮：仅题库题（有 topic_id）可换；自由演讲的自定义题目不显示，进入录音后禁用
    const btnChange = qs('btn-change-topic');
    if (btnChange && ['A','C','D'].includes(P.scene) && P.topic?.id) {
      btnChange.hidden = false;
      btnChange.addEventListener('click', () => {
        if (Recorder.recording) return;
        const t = pickRandomTopic(P.scene, P.topic?.id);
        if (!t) return;
        P.topic = t;
        renderPracticeTopic();
      });
    } else if (btnChange) {
      btnChange.hidden = true;
    }

    // 初始化 Recorder（按钮、波形、onTick、onStop）
    if (typeof Recorder !== 'undefined') {
      if (P.countdownSec) Recorder.setCountdown(P.countdownSec);
      Recorder.onTick = (elapsed, remaining) => updateClockUI(elapsed, remaining);
      Recorder.onStop = onRecordingStopped;
      Recorder.init();

      // 提前检测 Web Speech 支持，在用户录音前就给出提示
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        const live = document.getElementById('live-transcript');
        if (live) {
          live.textContent = '⚠ 当前浏览器不支持实时语音转写。建议使用 Chrome 浏览器体验真实转写；其他浏览器将基于录音时长生成模拟反馈。';
          live.style.color = '#b45309';
          live.style.fontSize = '0.8rem';
        }
        window._speechNotSupported = true;
      }
    } else {
      updateClockUI(0, P.countdownSec ? P.countdownSec * 1000 : null);
    }

    // 提交 / 取消 / 遮罩
    const btnSubmit = qs('btn-submit');
    if (btnSubmit) btnSubmit.addEventListener('click', submitAnalysis);
    const btnCancel = qs('overlay-cancel');
    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        if (window._analysisComplete) {
          // 分析已完成：点击按钮跳转到反馈页
          location.href = 'result.html';
        } else {
          // 分析未完成：隐藏遮罩，取消提交
          hideSubmissionOverlay();
        }
      });
    }

    window.addEventListener('beforeunload', (e) => {
      // 分析完成后（_analysisComplete=true）放行跳转，避免 iframe sandbox 静默拦截 location.href
      if (window._analysisComplete) return;
      const overlay = qs('submission-overlay');
      if (overlay && !overlay.hidden) { e.preventDefault(); e.returnValue = '分析正在进行中，离开可能会丢失本次结果。'; }
    });
  }

  function renderPracticeHeader() {
    const mode = qs('practice-mode');
    if (mode) mode.textContent = SCENE_NAMES[P.scene] || '练习';
  }

  function renderPracticeTopic() {
    const section = qs('topic-section');
    const eyebrow = qs('topic-eyebrow');
    const title = qs('topic-title');
    const hint = qs('topic-hint');
    if (!section) return;

    if (P.scene === 'B') {
      section.hidden = false;
      if (eyebrow) {
        eyebrow.textContent = '自言自语 · 声音日记';
      }
      if (title) {
        const cfg = (typeof TOPIC_LIBRARY !== 'undefined' && TOPIC_LIBRARY.B_HINT)
          ? TOPIC_LIBRARY.B_HINT
          : { title: '想说什么都可以', hint: '这里没有评判，只是陪你整理思绪。随便说：今天的一件小事、最近想不明白的问题、想对自己说的话……' };
        title.textContent = cfg.title;
      }
      if (hint) {
        const cfg = (typeof TOPIC_LIBRARY !== 'undefined' && TOPIC_LIBRARY.B_HINT)
          ? TOPIC_LIBRARY.B_HINT
          : { hint: '这里没有评判，只是陪你整理思绪。' };
        hint.textContent = cfg.hint;
        hint.hidden = false;
      }
    } else {
      section.hidden = false;
      if (eyebrow) {
        const lbl = ({ A: '今日话题', C: '演讲题目', D: '面试题目' })[P.scene] || '题目';
        if (P.scene === 'D' && P.interviewList) {
          const stage = P.topic?.stage ? ' · ' + P.topic.stage : '';
          eyebrow.textContent = `完整面试 · 第 ${P.interviewIndex + 1}/${P.interviewList.length} 题${stage}`;
        } else {
          eyebrow.textContent = P.topic?.category ? (P.topic.category + ' · ' + lbl) : lbl;
        }
      }
      if (title) {
        title.textContent = P.topic?.title || '请从首页选择一道题目再开始。';
      }
      if (hint) {
        const txt = P.topic?.hint;
        if (txt) { hint.textContent = txt; hint.hidden = false; }
        else hint.hidden = true;
      }
    }
    renderInterviewNav();
  }

  /** 完整面试题目导航条（D 场景 interview=full 时显示） */
  function renderInterviewNav() {
    const old = document.getElementById('interview-nav');
    if (old) old.remove();
    if (!P.interviewList || P.scene !== 'D') return;
    const section = qs('topic-section');
    if (!section) return;
    const nav = document.createElement('div');
    nav.id = 'interview-nav';
    nav.className = 'interview-nav';
    P.interviewList.forEach((q, i) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'interview-nav-chip' + (i === P.interviewIndex ? ' is-current' : '');
      chip.innerHTML = `<strong>${i + 1}</strong><span>${q.stage || ''}</span>`;
      chip.addEventListener('click', () => {
        if (typeof Recorder !== 'undefined' && Recorder.recording) return;
        P.interviewIndex = i;
        P.topic = { id: '', title: q.title, hint: q.hint || '', stage: q.stage };
        renderPracticeTopic();
      });
      nav.appendChild(chip);
    });
    section.appendChild(nav);
  }

  function setupPracticeTimerUI() {
    updateClockUI(0, P.countdownSec ? P.countdownSec * 1000 : null);
  }

  function updateClockUI(elapsedMs, remainingMs) {
    const timer = qs('practice-timer');
    if (!timer) return;
    if (remainingMs == null) {
      timer.textContent = fmtClock(elapsedMs);
      timer.classList.remove('is-countdown', 'is-urgent');
    } else {
      timer.textContent = fmtClock(remainingMs);
      timer.classList.add('is-countdown');
      const sec = remainingMs / 1000;
      timer.classList.toggle('is-urgent', sec <= 10);
    }
  }

  function onRecordingStopped(blob, durationMs, transcript) {
    // 展示回听播放器
    const audioEl = qs('audio-preview');
    if (audioEl && blob) {
      try {
        audioEl.src = URL.createObjectURL(blob);
        audioEl.hidden = false;
      } catch { audioEl.hidden = true; }
    }
    updateClockUI(durationMs, null); // 最终展示为正计时时长
  }

  // ===== 提交分析（三阶段遮罩）=====
  function showSubmissionOverlay() {
    const o = qs('submission-overlay');
    if (o) o.hidden = false;
    setSubmitStep('transcribe');
  }
  function hideSubmissionOverlay() {
    const o = qs('submission-overlay');
    if (o) o.hidden = true;
  }
  function setSubmitStep(step) {
    const steps = {
      transcribe: { title: '转写中', desc: '正在把语音整理成文字…', current: 'transcribe' },
      analyze:    { title: '分析中', desc: '正在按五个维度评估表达…', current: 'analyze' },
      improvement:{ title: '生成建议中', desc: '正在找可以提升的句子…', current: 'improvement' },
    }[step];
    const t = qs('overlay-title'); if (t) t.textContent = steps.title;
    const d = qs('overlay-desc');   if (d) d.textContent = steps.desc;
    const list = qs('overlay-steps');
    if (!list) return;
    const order = ['transcribe', 'analyze', 'improvement'];
    list.querySelectorAll('li').forEach(li => {
      const s = li.dataset.step;
      li.classList.remove('is-current', 'is-done');
      if (s === steps.current) li.classList.add('is-current');
      else if (order.indexOf(s) < order.indexOf(steps.current)) li.classList.add('is-done');
    });
  }

  async function submitAnalysis() {
    const blob = window.recordedBlob;
    if (!blob) return;
    const btn = qs('btn-submit');
    if (btn) { btn.disabled = true; btn.textContent = '分析中…'; }

    const transcriptElapsedRef = { transcript: '' };
    let analysis = null;

    try {
      showSubmissionOverlay();
      setSubmitStep('transcribe');
      const t0 = Date.now();

      // 阶段 1：转写
      let transcript;
      try {
        transcript = await API.transcribeAudio(blob);
      } catch (e) {
        alert('转写失败：' + (e.message || e) + '\n请稍后重试，或点击「↺ 重录」再试一次。');
        hideSubmissionOverlay();
        if (btn) { btn.disabled = false; btn.textContent = '✓ 提交分析'; }
        return;
      }
      // 最小展示 800ms：让用户看见「转写中」变绿（fallback 路径瞬间完成会看不到）
      await _minDelay(t0, 800);
      transcriptElapsedRef.transcript = transcript;

      // 检测占位文本（Web Speech 不可用或转写失败）
      const isPlaceholder = (transcript || '').startsWith('[占位文本]');

      // 样本不足判断（Module C，<48字）
      const charCount = (transcript || '').replace(/（.*?）/g, '').replace(/[\s，。！？,.!?；;]/g, '').length;
      const insufficientSample = charCount < 48 || isPlaceholder;

      setSubmitStep('analyze');
      const t1 = Date.now();

      // v1.1.0：统一评分标准，level_segment 固定 '2'（不再按练习次数分级、无新手保护期）
      const levelSegment = '2';

      // 阶段 2：分析
      analysis = await API.analyzeExpression(transcript, { scene: P.scene, levelSegment, topic: P.topic?.title || '' });
      // v2.0.0 → v1 字段兼容（overall/summary、coaching/comment、suggestions/improvements）
      analysis = normalizeAnalysisV2(analysis || {});
      // 最小展示 1200ms：让用户看见「分析中」变绿
      await _minDelay(t1, 1200);
      analysis.mode_code = P.scene + levelSegment;

      setSubmitStep('improvement');
      const t2 = Date.now();

      // 组装 record
      const now = new Date();
      const durationSec = Math.max(1, Math.round((window.recordedDuration || 0) / 1000));
      const record = {
        id: Date.now(),
        created_at: now.toISOString(),
        scene: P.scene,
        level_segment: levelSegment,
        mode_code: analysis.mode_code,
        topic_id: P.topic?.id || null,
        topic_text: P.topic?.title || (P.scene === 'B' ? SCENE_NAMES.B : null),
        duration_sec: durationSec,
        audio_ref: null,
        transcript,
        transcript_is_placeholder: isPlaceholder,
        scores: analysis.scores,
        dimensions: analysis.dimensions,
        insufficient_sample: insufficientSample,
        summary: analysis.summary,
        improvements: analysis.improvements,
      };

      // 录音 Blob 存 IndexedDB（持久化，刷新后仍可播放）；audio_ref 存引用 'idb:<id>'
      if (blob && window.IDBAudio) {
        try {
          await window.IDBAudio.save(record.id, blob);
          record.audio_ref = 'idb:' + record.id;
        } catch { /* 存储失败不阻塞分析结果 */ }
      }

      // 最小展示 600ms：让用户看见「生成建议中」变绿，再切到「分析完成」
      await _minDelay(t2, 600);

      // previousResult（包 try-catch：iframe sandbox / 存储满时 localStorage 会抛 SecurityError / QuotaExceededError）
      let lastResultStr = null;
      try { lastResultStr = localStorage.getItem(RESULT_STORAGE); } catch {}
      if (lastResultStr) {
        try { localStorage.setItem(PREV_RESULT_STORAGE, lastResultStr); } catch {}
      }

      // 保存 lastResult（result.html 无 id 用）
      let lastResultSaved = false;
      try {
        localStorage.setItem(RESULT_STORAGE, JSON.stringify({
          id: record.id,
          mode: SCENE_NAMES[P.scene],
          scene: P.scene,
          level_segment: levelSegment,
          mode_code: analysis.mode_code,
          topic_id: record.topic_id,
          topic_text: record.topic_text,
          duration: durationSec * 1000,
          createdAt: record.created_at,
          transcript,
          transcript_is_placeholder: isPlaceholder,
          analysis,
        }));
        lastResultSaved = true;
      } catch (e) {
        console.error('[submitAnalysis] lastResult 写入失败:', e);
      }

      // 写入记录（即使样本不足也保存，方便日志回看，只在统计时 filter 掉）
      const saved = Storage.saveRecord(record);
      if (!saved || !lastResultSaved) {
        // localStorage 不可用（iframe sandbox 屏蔽）或已满：明确告知，不静默失败
        console.error('[submitAnalysis] 保存失败：saved=' + saved + ' lastResultSaved=' + lastResultSaved);
        alert('⚠ 本次练习记录未能保存到本地存储。\n\n可能原因：\n• 在 IDE 内嵌预览环境内访问（localStorage 被沙箱屏蔽）\n• 浏览器存储已满（quota exceeded）\n\n建议：\n• 在外层浏览器直接打开 http://localhost:3000/index.html\n• 或清理浏览器存储后重试\n\n本次反馈结果仍可查看，但刷新后「我的」页面不会显示这条记录。');
      }

      // 完成：全部打勾
      ['transcribe','analyze','improvement'].forEach((_, i, arr) => {
        const li = document.querySelector(`#overlay-steps li[data-step="${arr[i]}"]`);
        if (li) { li.classList.remove('is-current'); li.classList.add('is-done'); }
      });
      const title = qs('overlay-title'); if (title) title.textContent = '分析完成';
      const desc = qs('overlay-desc');   if (desc) desc.textContent = '正在跳转到反馈页…';

      // 隐藏 spinner，避免用户一直看到转圈
      const spinner = document.querySelector('.overlay-spinner');
      if (spinner) spinner.hidden = true;

      // 更新按钮文字，引导用户跳转
      const btnCancel = qs('overlay-cancel');
      if (btnCancel) {
        btnCancel.textContent = '前往反馈页 →';
        btnCancel.classList.add('btn--primary');
      }

      // 标记分析已完成：beforeunload 据此放行跳转（否则 iframe sandbox 会静默拦截 location.href）
      window._analysisComplete = true;

      // 多重导航兜底：600ms 后跳转；若被浏览器/iframe sandbox 拦截，2.5s 后再试一次
      const navigateToResult = () => {
        try {
          hideSubmissionOverlay();
          window.location.replace('result.html?id=' + encodeURIComponent(record.id));
        } catch {
          try {
            hideSubmissionOverlay();
            location.href = 'result.html?id=' + encodeURIComponent(record.id);
          } catch {
            // 终极兜底：显示手动跳转链接
            const descEl = qs('overlay-desc');
            if (descEl) {
              descEl.innerHTML = '自动跳转被浏览器拦截，请点击 <a href="result.html?id=' + encodeURIComponent(record.id) + '">前往反馈页 →</a>';
            }
          }
        }
      };

      // 主跳转：600ms（让用户看见三个绿勾）
      setTimeout(navigateToResult, 600);
      // 兜底跳转：2.5s 后再试（防止 iframe sandbox 静默阻断）
      setTimeout(navigateToResult, 2500);

    } catch (err) {
      console.error('[submitAnalysis] error:', err);
      alert('分析出错了：' + (err && err.message ? err.message : err) + '\n请点击「✓ 提交分析」重试，本次录音不会丢失。');
      hideSubmissionOverlay();
      if (btn) { btn.disabled = false; btn.textContent = '✓ 提交分析'; }
    }
  }

  // ===== result.html =====
  let currentRadarChart = null;

  function initResultPage() {
    // 1. 先拿到 DOM 引用
    const emptyEl = qs('result-empty');
    const contentEl = qs('result-content');
    const drawerEl = document.getElementById('result-drawer');

    // 2. 查找 record
    const idParam = new URLSearchParams(location.search).get('id');
    let record = idParam ? Storage.getRecordById(idParam) : null;
    if (!record) {
      const lastStr = localStorage.getItem(RESULT_STORAGE);
      if (lastStr) {
        try {
          const lr = JSON.parse(lastStr);
          if (lr.analysis) {
            // v2 兼容：本地存储的老数据如果是 v2 结构但缺失 v1 字段，就地补齐
            normalizeAnalysisV2(lr.analysis);
            record = {
              id: lr.id || 'last',
              created_at: lr.createdAt || new Date().toISOString(),
              scene: lr.scene || 'A',
              level_segment: lr.level_segment || '1',
              mode_code: lr.mode_code || 'A1',
              topic_id: lr.topic_id || null,
              topic_text: lr.topic_text || null,
              duration_sec: Math.round((lr.duration || 0) / 1000),
              audio_ref: null,
              transcript: lr.transcript || '',
              transcript_is_placeholder: !!lr.transcript_is_placeholder,
              scores: lr.analysis.scores,
              dimensions: lr.analysis.dimensions,
              insufficient_sample: !!lr.analysis.insufficient_sample,
              summary: lr.analysis.summary,
              improvements: lr.analysis.improvements || [],
            };
          }
        } catch {}
      }
    }

    // 3. 明确控制空状态 / 内容 / 抽屉 的可见性（仅在真正无数据时才展示空状态）
    if (!record) {
      if (emptyEl)   emptyEl.hidden = false;
      if (contentEl) contentEl.hidden = true;
      if (drawerEl)  drawerEl.hidden = true;
      return;
    }
    // 有记录：隐藏空状态，显示内容 + 抽屉
    if (emptyEl)   emptyEl.hidden = true;
    if (contentEl) contentEl.hidden = false;
    if (drawerEl)  drawerEl.hidden = false;

    renderResultInfo(record);

    // 找「上次成绩」用于雷达对比：同 id 的上一条
    let prevScores = null;
    const all = Storage.getAllRecords();
    if (idParam) {
      const idx = all.findIndex(r => String(r.id) === String(idParam));
      if (idx >= 0 && idx + 1 < all.length) {
        const p = all[idx + 1];
        if (!p.insufficient_sample) prevScores = p.scores;
      }
    } else {
      const prevStr = localStorage.getItem(PREV_RESULT_STORAGE);
      if (prevStr) {
        try {
          const pr = JSON.parse(prevStr);
          if (pr.analysis?.scores) prevScores = pr.analysis.scores;
          else if (pr.scores) prevScores = pr.scores;
        } catch {}
      }
    }

    renderRadarChart(record.scores, prevScores);
    renderResultDrawer(record);
    initDrawer(record);
  }

  function renderResultInfo(record) {
    const modeLabel = qs('info-mode');
    const dateLabel = qs('info-date');
    const durLabel = qs('info-duration');
    if (modeLabel) modeLabel.textContent = SCENE_NAMES[record.scene] || '练习';
    if (dateLabel) {
      const d = new Date(record.created_at);
      dateLabel.textContent = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    if (durLabel) {
      const s = record.duration_sec;
      durLabel.textContent = s < 60 ? `${s}秒` : `${Math.floor(s/60)}分${s%60}秒`;
    }
    const card = document.querySelector('.info-card');
    if (record.insufficient_sample) {
      if (card) {
        const tag = document.createElement('div');
        tag.className = 'eyebrow';
        tag.style.marginTop = '0.75rem';
        tag.style.background = 'rgba(245, 158, 11, 0.12)';
        tag.style.color = '#b45309';
        tag.textContent = '⚠ 内容较短，不纳入成长统计';
        card.appendChild(tag);
      }
    }
    if (record.transcript_is_placeholder) {
      if (card) {
        const tag = document.createElement('div');
        tag.className = 'eyebrow';
        tag.style.marginTop = '0.5rem';
        tag.style.background = 'rgba(245, 158, 11, 0.12)';
        tag.style.color = '#b45309';
        tag.textContent = '⚠ 本次转写为占位文本，请使用 Chrome 浏览器体验真实转写';
        card.appendChild(tag);
      }
    }
  }

  function renderRadarChart(scores, prevScores) {
    const canvas = document.getElementById('radar-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (currentRadarChart) try { currentRadarChart.destroy(); } catch {}
    const labels = API.DIMS.map(d => d.name);
    const keys = API.DIMS.map(d => d.key);
    const currentData = keys.map(k => scores ? (+(+scores[k]).toFixed(1) || 3) : 3);
    const hasPrev = !!prevScores;
    const prevData = hasPrev ? keys.map(k => +(+prevScores[k]).toFixed(1) || 3) : null;

    // 破框效果（PRD §4.4）：默认 max=5，若有 L4 则把雷达图 grid 设为突破，通过 4.0 的点画额外高光
    const anyL4 = currentData.some(s => s >= 4.0);

    // 给 radar-wrap 加破框视觉类（CSS 负责 box-shadow / 圆角）
    const radarWrap = canvas.parentElement;
    if (radarWrap && radarWrap.classList) {
      radarWrap.classList.toggle('break-frame', anyL4);
    }

    currentRadarChart = new Chart(canvas, {
      type: 'radar',
      data: {
        labels,
        datasets: [
          {
            label: '本次',
            data: currentData,
            borderColor: '#4a7cff',
            backgroundColor: 'rgba(74,124,255,0.18)',
            borderWidth: 2,
            pointBackgroundColor: '#4a7cff',
            pointRadius: anyL4 ? 4 : 3,
            pointBorderWidth: 1,
            pointBorderColor: '#fff',
          },
          hasPrev && {
            label: '上次',
            data: prevData,
            borderColor: '#9aa4bd',
            borderDash: [6, 4],
            backgroundColor: 'rgba(154,164,189,0.08)',
            borderWidth: 1.6,
            pointBackgroundColor: '#9aa4bd',
            pointRadius: 2.5,
            pointBorderWidth: 1,
            pointBorderColor: '#fff',
          },
        ].filter(Boolean),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 10, padding: 12, usePointStyle: true, pointStyle: 'circle' } },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}：${ctx.formattedValue}` } },
        },
        scales: {
          r: {
            min: 0,
            max: 5,
            ticks: { stepSize: 1, display: false, backdropColor: 'transparent' },
            angleLines: { color: 'rgba(160, 170, 200, 0.28)' },
            grid: { color: 'rgba(160, 170, 200, 0.22)' },
            suggestedMax: 5,
            pointLabels: { font: { size: 12 }, color: '#51586d' },
          },
        },
      },
    });
  }

  function renderResultDrawer(record) {
    const summaryEl = qs('summary-text');
    if (summaryEl) summaryEl.textContent = record.summary || '本次表达分析已完成。';

    const dimsWrap = qs('dimensions-wrap');
    if (dimsWrap) dimsWrap.innerHTML = '';
    if (dimsWrap && Array.isArray(record.dimensions)) {
      record.dimensions.forEach(d => dimsWrap.appendChild(buildDimensionCard(d)));
    }

    renderSuggestionsBlock(record);
  }

  function buildDimensionCard(d) {
    const card = document.createElement('div');
    card.className = 'dimension-card';

    const head = document.createElement('div');
    head.className = 'dim-head';
    const nameEl = document.createElement('div');
    nameEl.className = 'dim-name';
    nameEl.textContent = d.name;
    const tag = document.createElement('span');
    const tagClass = d.level === 'L1' ? 'level-tag--L1' : d.level === 'L2' ? 'level-tag--L2' : d.level === 'L3' ? 'level-tag--L3' : 'level-tag--L4';
    tag.className = 'level-tag ' + tagClass;
    tag.textContent = `${d.level} · ${d.label || ''}`;
    const score = document.createElement('div');
    score.className = 'dim-score';
    score.textContent = (+d.score).toFixed(1);
    head.appendChild(nameEl);
    head.appendChild(tag);
    head.appendChild(score);
    card.appendChild(head);

    const comment = document.createElement('div');
    comment.className = 'dim-comment';
    comment.textContent = d.comment || '';
    card.appendChild(comment);

    if (Array.isArray(d.evidence) && d.evidence.length) {
      const ev = document.createElement('div');
      ev.className = 'dim-evidence';
      const title = document.createElement('div');
      title.className = 'dim-evidence-title';
      title.textContent = '参考片段';
      ev.appendChild(title);
      d.evidence.forEach(e => {
        const line = document.createElement('div');
        line.className = 'dim-evidence-line';
        line.textContent = '「' + e + '」';
        ev.appendChild(line);
      });
      card.appendChild(ev);
    }

    const sug = document.createElement('div');
    sug.className = 'dim-suggestion';
    sug.innerHTML = '<span class="dim-suggestion-icon">💡</span> ' + (d.suggestion || '多开口练习，每次只改善一个具体点。');
    card.appendChild(sug);

    return card;
  }

  function renderSuggestionsBlock(record) {
    const block = qs('suggestions-block');
    if (!block) return;
    block.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'suggestions-title';
    title.textContent = '💡 这样说会更好';
    block.appendChild(title);

    const items = Array.isArray(record.improvements) ? record.improvements.filter(i => i && i.original && i.improved) : [];
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'suggestions-empty';
      empty.textContent = record.insufficient_sample
        ? '本次内容较短，暂不提供句子改写。多表达一些再提交会得到更具体的建议。'
        : '当前整体表现已经超过触发阈值，暂时没有额外的句子改写。继续保持！';
      block.appendChild(empty);
      return;
    }

    items.forEach((it, idx) => {
      const el = document.createElement('div');
      el.className = 'improvement-card';
      el.innerHTML = `
        <div class="imp-head"><span class="imp-idx">#${idx + 1}</span><span class="imp-dim">${it.dimension || ''}</span></div>
        <div class="imp-pair">
          <div class="imp-line imp-line--original"><span class="imp-label">原句</span>${escapeHtml(it.original)}</div>
          <div class="imp-line imp-line--improved"><span class="imp-label">更好</span>${escapeHtml(it.improved)}</div>
        </div>
        ${it.reason ? `<div class="imp-reason">📘 ${escapeHtml(it.reason)}</div>` : ''}
      `;
      block.appendChild(el);
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function initDrawer(record) {
    const drawer = document.querySelector('.drawer');
    const handle = document.querySelector('.drawer-handle');
    const upHint = document.querySelector('.drawer-up-hint');
    if (!drawer) return;
    const toggle = () => drawer.classList.toggle('is-open');
    if (handle) handle.addEventListener('click', toggle);
    if (upHint) upHint.addEventListener('click', toggle);

    let startY = null;
    drawer.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
    drawer.addEventListener('touchend', (e) => {
      if (startY == null) return;
      const dy = (e.changedTouches[0].clientY) - startY;
      if (dy < -30) drawer.classList.add('is-open');
      if (dy > 30) drawer.classList.remove('is-open');
      startY = null;
    });
  }

  // ===== profile.html =====
  let profileLineChart = null;
  let profileRadarChart = null;

  function initProfilePage() {
    // 头像入口 → 首页
    const back = document.querySelector('.page-header a');
    // 空状态判断 + 统计 + 图表 + 记录列表
    const all = Storage.getAllRecords();
    const valid = Storage.getValidRecords();

    if (!all.length) {
      const empty = qs('profile-empty');
      if (empty) empty.hidden = false;
      const content = qs('profile-content');
      if (content) content.hidden = true;
      const btn = qs('empty-go-home');
      if (btn) btn.addEventListener('click', () => location.href = 'index.html');
      return;
    }

    // 有记录：明确隐藏空状态，显示内容区
    const emptyEl = qs('profile-empty');
    if (emptyEl) emptyEl.hidden = true;
    const contentEl = qs('profile-content');
    if (contentEl) contentEl.hidden = false;

    renderProfileStats(valid);

    // 月度打卡热力图（当前月）
    renderMonthHeatmap(valid);

    // 雷达：最近 5 条平均分
    const lastN = valid.slice(0, 5);
    renderAvgRadar(lastN);

    // 成长曲线：最近 10 条有效
    const last10 = valid.slice(0, 10).reverse();
    renderGrowthCurve(last10);

    renderRecordList(all);
  }

  function renderProfileStats(valid) {
    const cnt = qs('stat-count');
    const min = qs('stat-minutes');
    const streak = qs('stat-streak');
    if (cnt) cnt.textContent = String(valid.length);
    const totalMin = Math.max(0, Math.round(valid.reduce((s, r) => s + (r.duration_sec || 0), 0) / 60));
    if (min) min.textContent = String(totalMin);

    // 连续天数
    const dates = Array.from(new Set(valid.map(r => new Date(r.created_at).toISOString().slice(0,10)))).sort((a,b)=>b<a?1:-1);
    let streakDays = 0;
    if (dates.length) {
      streakDays = 1;
      const today = new Date().toISOString().slice(0,10);
      // 允许"今天还没练"也从昨天算连续
      for (let i = 1; i < dates.length; i++) {
        const d1 = new Date(dates[i-1]);
        const d2 = new Date(dates[i]);
        if (Math.round((d1 - d2) / 86400000) === 1) streakDays++;
        else break;
      }
    }
    if (streak) streak.textContent = String(streakDays);
  }

  function renderAvgRadar(lastN) {
    const canvas = qs('avg-radar');
    if (!canvas || typeof Chart === 'undefined') return;
    if (profileRadarChart) try { profileRadarChart.destroy(); } catch {}
    const keys = API.DIMS.map(d => d.key);
    const labels = API.DIMS.map(d => d.name);
    const avg = keys.map(k => {
      const vals = lastN.map(r => +r.scores[k]).filter(v => !isNaN(v));
      if (!vals.length) return 3.0;
      return +(vals.reduce((a,b)=>a+b,0) / vals.length).toFixed(2);
    });
    const label = `近 ${lastN.length} 次平均`;
    qs('avg-radar-title') && (qs('avg-radar-title').textContent = label);
    profileRadarChart = new Chart(canvas, {
      type: 'radar',
      data: {
        labels,
        datasets: [{
          label,
          data: avg,
          borderColor: '#4a7cff',
          backgroundColor: 'rgba(74,124,255,0.18)',
          borderWidth: 2,
          pointBackgroundColor: '#4a7cff',
          pointRadius: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { r: { min: 0, max: 5, ticks: { display: false }, suggestedMax: 5,
          angleLines: { color: 'rgba(160,170,200,0.25)' },
          grid: { color: 'rgba(160,170,200,0.2)' },
          pointLabels: { font: { size: 11 }, color: '#51586d' } } },
      },
    });
  }

  /** 个人中心：当前月打卡热力图（简单月度热力图，周一为首列） */
  /**
   * 打卡热力图（GitHub 贡献图风格）：
   * - 永远展示最近 12 个月（52 周 + 当周），每列一周、7 行星期，横向滚动
   * - 起点对齐周日、终点止于今天（未来不画格子，右侧无空白）
   * - 5 级绿色阶；今天用品牌橙描边高亮
   */
  function renderMonthHeatmap(valid) {
    const root = qs('month-heatmap');
    const title = qs('heatmap-month-title');
    if (!root) return;
    root.innerHTML = '';
    if (title) title.textContent = '近 12 个月打卡';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = _localDateStr(today);

    // 打卡日期 → 当天练习次数
    const dayCountMap = {};
    valid.forEach(r => {
      const ds = _localDateStr(new Date(r.created_at));
      dayCountMap[ds] = (dayCountMap[ds] || 0) + 1;
    });

    // 范围：52 周前的周日 → 今天（终点不留未来空格）
    const start = new Date(today);
    start.setDate(start.getDate() - 364);
    start.setDate(start.getDate() - start.getDay()); // 回退到当周周日
    const totalDays = Math.round((today - start) / 86400000) + 1;
    const weeks = Math.ceil(totalDays / 7);

    const levelClass = (count) => {
      if (count <= 0) return 'gh-cell--0';
      if (count === 1) return 'gh-cell--1';
      if (count === 2) return 'gh-cell--2';
      if (count <= 4) return 'gh-cell--3';
      return 'gh-cell--4';
    };

    const wrap = document.createElement('div');
    wrap.className = 'gh-heatmap';

    const scroll = document.createElement('div');
    scroll.className = 'gh-scroll';

    // —— 顶部月份标签：每周一列，包含 1 号的那一周显示月份
    const monthsRow = document.createElement('div');
    monthsRow.className = 'gh-months';
    for (let w = 0; w < weeks; w++) {
      const lab = document.createElement('span');
      lab.className = 'gh-month-label';
      const sunday = new Date(start);
      sunday.setDate(start.getDate() + w * 7);
      if (sunday.getDate() <= 7) lab.textContent = (sunday.getMonth() + 1) + '月';
      monthsRow.appendChild(lab);
    }
    scroll.appendChild(monthsRow);

    const body = document.createElement('div');
    body.className = 'gh-body';

    // —— 左侧星期列（只标 一/三/五，与 GitHub 一致）
    const wdCol = document.createElement('div');
    wdCol.className = 'gh-wdcol';
    ['', '一', '', '三', '', '五', ''].forEach(t => {
      const s = document.createElement('span');
      s.textContent = t;
      wdCol.appendChild(s);
    });
    body.appendChild(wdCol);

    // —— 格子区：grid 按列填充，每列 7 格（周日→周六）
    const grid = document.createElement('div');
    grid.className = 'gh-grid';
    const cursor = new Date(start);
    for (let i = 0; i < totalDays; i++) {
      const ds = _localDateStr(cursor);
      const count = dayCountMap[ds] || 0;
      const cell = document.createElement('div');
      const cls = ['gh-cell', levelClass(count)];
      if (ds === todayStr) cls.push('gh-cell--today');
      cell.className = cls.join(' ');
      cell.title = (cursor.getMonth() + 1) + '月' + cursor.getDate() + '日' + (count ? `：${count} 次练习` : '：未打卡');
      grid.appendChild(cell);
      cursor.setDate(cursor.getDate() + 1);
    }
    body.appendChild(grid);
    scroll.appendChild(body);
    wrap.appendChild(scroll);

    // —— 图例：少 → 多
    const legend = document.createElement('div');
    legend.className = 'gh-legend';
    legend.innerHTML =
      '<span>少</span>' +
      '<span class="gh-cell gh-cell--0"></span>' +
      '<span class="gh-cell gh-cell--1"></span>' +
      '<span class="gh-cell gh-cell--2"></span>' +
      '<span class="gh-cell gh-cell--3"></span>' +
      '<span class="gh-cell gh-cell--4"></span>' +
      '<span>多</span>';
    wrap.appendChild(legend);

    root.appendChild(wrap);

    // 默认滚动到最右端（最近的日期）
    requestAnimationFrame(() => { scroll.scrollLeft = scroll.scrollWidth; });
  }

  function renderGrowthCurve(last10) {
    const canvas = qs('growth-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (profileLineChart) try { profileLineChart.destroy(); } catch {}
    const labels = last10.map((r, i) => {
      const d = new Date(r.created_at);
      return `${pad(d.getMonth()+1)}/${pad(d.getDate())}`;
    });
    const data = last10.map(r => avgFive(r.scores));
    profileLineChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: '综合分',
          data,
          borderColor: '#4a7cff',
          backgroundColor: 'rgba(74,124,255,0.12)',
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#4a7cff',
          pointRadius: 4,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 1, max: 5, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: 'rgba(160,170,200,0.2)' } },
          x: { ticks: { font: { size: 11 } }, grid: { display: false } },
        },
      },
    });
  }

  function renderRecordList(all) {
    const list = qs('record-list');
    if (!list) return;
    list.innerHTML = '';
    const levels = { L1:'level-tag--L1', L2:'level-tag--L2', L3:'level-tag--L3', L4:'level-tag--L4' };
    all.forEach(r => {
      const item = document.createElement('article');
      item.className = 'record-card';
      const d = new Date(r.created_at);
      const head = document.createElement('div');
      head.className = 'record-head';
      const date = document.createElement('span');
      date.className = 'record-date';
      date.textContent = `${d.getMonth()+1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      const modeTag = document.createElement('span');
      modeTag.className = 'mode-chip mode-chip--' + r.scene;
      modeTag.textContent = SCENE_NAMES[r.scene] || '练习';
      head.appendChild(date);
      head.appendChild(modeTag);
      if (r.insufficient_sample) {
        const warn = document.createElement('span');
        warn.className = 'eyebrow';
        warn.style.background = 'rgba(245,158,11,0.12)';
        warn.style.color = '#b45309';
        warn.style.marginLeft = 'auto';
        warn.textContent = '样本较短';
        head.appendChild(warn);
      }
      if (r.transcript_is_placeholder) {
        const warn = document.createElement('span');
        warn.className = 'eyebrow';
        warn.style.background = 'rgba(239,68,68,0.12)';
        warn.style.color = '#dc2626';
        warn.style.marginLeft = 'auto';
        warn.textContent = '⚠ 转写不可用';
        warn.title = '本次未捕获到真实语音，建议使用 Chrome 浏览器';
        head.appendChild(warn);
      }
      item.appendChild(head);

      const sum = document.createElement('p');
      sum.className = 'record-summary';
      sum.textContent = r.summary || '（无总结）';
      item.appendChild(sum);

      const tags = document.createElement('div');
      tags.className = 'dim-tags';
      (r.dimensions || []).forEach(dim => {
        const s = document.createElement('span');
        s.className = 'dim-tag ' + levels[dim.level];
        s.textContent = `${dim.name} ${dim.level}`;
        tags.appendChild(s);
      });
      item.appendChild(tags);

      // 文字转写正文（默认收起，点「文字转写」按钮切换）
      const transcriptBody = document.createElement('p');
      transcriptBody.className = 'record-transcript-body';
      transcriptBody.hidden = true;
      if (r.transcript_is_placeholder) {
        transcriptBody.style.color = '#dc2626';
        transcriptBody.style.fontStyle = 'italic';
        transcriptBody.textContent = '⚠ 本次未捕获到真实语音转写。' + (r.transcript || '');
      } else {
        transcriptBody.textContent = r.transcript || '（无）';
      }

      if (r.improvements && r.improvements.length) {
        const imp = document.createElement('details');
        imp.className = 'record-transcript';
        imp.style.marginTop = '0.375rem';
        const s2 = document.createElement('summary');
        s2.textContent = `查看改写建议（${r.improvements.length}）`;
        r.improvements.forEach((it, i) => {
          const card = document.createElement('div');
          card.className = 'improvement-card';
          card.style.marginTop = '0.75rem';
          card.innerHTML = `
            <div class="imp-head"><span class="imp-idx">#${i+1}</span><span class="imp-dim">${it.dimension || ''}</span></div>
            <div class="imp-pair">
              <div class="imp-line imp-line--original"><span class="imp-label">原句</span>${escapeHtml(it.original)}</div>
              <div class="imp-line imp-line--improved"><span class="imp-label">更好</span>${escapeHtml(it.improved)}</div>
            </div>
            ${it.reason ? `<div class="imp-reason">📘 ${escapeHtml(it.reason)}</div>` : ''}
          `;
          imp.appendChild(card);
        });
        item.appendChild(imp);
      }

      // 操作区：「📋 文字转写」「▶ 播放录音」「📊 表达分析」三个按钮同一排等宽
      const actions = document.createElement('div');
      actions.className = 'record-actions';

      const tBtn = document.createElement('button');
      tBtn.type = 'button';
      tBtn.className = 'record-btn';
      tBtn.innerHTML = '📋 <span>文字转写</span>';
      tBtn.addEventListener('click', () => {
        transcriptBody.hidden = !transcriptBody.hidden;
        tBtn.classList.toggle('is-active', !transcriptBody.hidden);
      });

      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'record-btn';
      playBtn.innerHTML = '▶ <span>播放录音</span>';
      const setPlayDisabled = (text) => {
        playBtn.innerHTML = '🔇 <span>' + text + '</span>';
        playBtn.classList.add('is-disabled');
        playBtn.disabled = true;
      };
      const idbKey = window.IDBAudio ? window.IDBAudio.keyFromRef(r.audio_ref) : null;
      if (idbKey) {
        playBtn.addEventListener('click', async () => {
          playBtn.innerHTML = '⏳ <span>加载中…</span>';
          const blob = await window.IDBAudio.get(idbKey);
          if (!blob) { setPlayDisabled('录音已过期'); return; }
          try {
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.onerror = () => setPlayDisabled('播放失败');
            audio.onended = () => { playBtn.innerHTML = '▶ <span>播放录音</span>'; URL.revokeObjectURL(url); };
            await audio.play();
            playBtn.innerHTML = '🔊 <span>播放中…</span>';
          } catch { setPlayDisabled('播放失败'); }
        });
      } else if (r.audio_ref) {
        // 旧记录：blob: 链接刷新后已失效
        setPlayDisabled('录音已过期');
      } else {
        setPlayDisabled('无录音');
      }

      // 「📊 表达分析」与前两个按钮同一排
      const detailBtn = document.createElement('a');
      detailBtn.className = 'record-btn record-btn--detail';
      detailBtn.href = 'result.html?id=' + encodeURIComponent(r.id);
      detailBtn.innerHTML = '📊 <span>表达分析</span>';

      actions.appendChild(tBtn);
      actions.appendChild(playBtn);
      actions.appendChild(detailBtn);
      item.appendChild(transcriptBody);
      item.appendChild(actions);

      list.appendChild(item);
    });
  }

  return {
    initHome, initPractice, submitAnalysis, initResultPage, initProfilePage,
    // 测试/调试用
    _debug: { SCENE_NAMES, MAIN_MODE_BY_SCENE, SUB_BY_MAIN, fmtClock, avgFive, goPractice },
  };
})();
