/**
 * 表达研究室 - 录音模块（PRD V3.0）
 * - MediaRecorder 录音 + Web Audio 实时波形
 * - Web Speech API (webkitSpeechRecognition) 实时转写
 * - 提供 onTick / onStop 回调供上层（app.js）控制正计时/倒计时 UI
 * - 上层可通过 setCountdown(seconds) 开启倒计时，为 0 时 Recorder 自动 stop
 */

const Recorder = {
  mediaRecorder: null,
  audioContext: null,
  audioChunks: [],
  mediaStream: null,
  animationId: null,
  canvas: null,
  ctx: null,
  recording: false,
  startTime: null,
  recognition: null,
  transcriptText: '',
  recognitionError: null,

  // 回调接口（上层设置）
  onTick: null,     // (elapsedMs, remainingMs) => void；remainingMs 仅倒计时模式有值
  onStop: null,     // (blob, durationMs, transcript) => void

  // 倒计时
  _countdownMs: 0,
  _tickTimer: null,

  init() {
    this.canvas = document.getElementById('waveform');
    this.ctx = this.canvas?.getContext('2d');

    window.recordedBlob = null;
    window.recordedDuration = 0;
    window.recordedTranscript = '';

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    document.getElementById('btn-record')?.addEventListener('click', () => {
      if (this.recording) this.stop();
      else this.start();
    });

    document.getElementById('btn-rerecord')?.addEventListener('click', () => this.reset());

    this.drawIdleWaveform();
    this.updateUI();
  },

  resizeCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    if (!this.recording) this.drawIdleWaveform();
  },

  updateUI() {
    const btn = document.getElementById('btn-record');
    const btnSubmit = document.getElementById('btn-submit');
    const btnRerecord = document.getElementById('btn-rerecord');
    const actions = document.getElementById('post-record-actions');
    const hint = document.getElementById('record-hint');
    const btnLabel = btn?.querySelector('.btn-record-label');

    if (btn) {
      if (this.recording) {
        if (btnLabel) btnLabel.textContent = '停止录音';
        btn.classList.add('is-recording');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        if (btnLabel) btnLabel.textContent = '开始录音';
        btn.classList.remove('is-recording');
        btn.setAttribute('aria-pressed', 'false');
      }
    }

    const hasBlob = !!window.recordedBlob;
    if (actions) actions.hidden = !hasBlob || this.recording;
    if (btnSubmit) btnSubmit.disabled = !hasBlob || this.recording;
    if (btnRerecord) btnRerecord.disabled = this.recording;
    if (hint) hint.hidden = this.recording || hasBlob;
  },

  drawIdleWaveform() {
    if (!this.ctx || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    this.ctx.clearRect(0, 0, w, h);

    // 静止状态：一排矮矮的等间距竖条，中间略高，呈现"就绪"的静止造型
    const BAR_COUNT = 64;
    const barWidth = (w * 0.8) / BAR_COUNT;
    const gap = (w * 0.2) / (BAR_COUNT + 1);
    const mid = BAR_COUNT / 2;
    for (let i = 0; i < BAR_COUNT; i++) {
      const distFromCenter = Math.abs(i - mid) / mid; // 0 (center) → 1 (edge)
      // 高斯/钟形曲线包络：中间 1.0，两侧 0.25
      const envelope = 0.25 + 0.75 * Math.exp(-4 * distFromCenter * distFromCenter);
      const barH = Math.max(2, (h * 0.06) * envelope);
      const x = gap + i * (barWidth + gap);
      const y = (h - barH) / 2;
      this.ctx.fillStyle = 'rgba(74, 124, 255, 0.25)';
      // 圆角竖条
      const radius = Math.min(barWidth / 2, barH / 2);
      this._drawRoundedRect(x, y, barWidth, barH, radius);
    }
  },

  /** 工具：圆角矩形填充（竖条用） */
  _drawRoundedRect(x, y, w, h, r) {
    if (h <= 0 || w <= 0) return;
    r = Math.min(r, w / 2, h / 2);
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + w - r, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    this.ctx.lineTo(x + w, y + h - r);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.ctx.lineTo(x + r, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
    this.ctx.fill();
  },

  startWaveformAnimation(source) {
    const analyser = this.audioContext.createAnalyser();
    // fftSize 越大，频域采样点越多；这里我们用频域数据做条形图
    analyser.fftSize = 128;
    source.connect(analyser);
    const freqBinCount = analyser.frequencyBinCount; // = fftSize/2 = 64
    const freqArray = new Uint8Array(freqBinCount);
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    // 绘制参数：BAR_COUNT 条竖条，均匀分布在画布上，两侧留白
    const BAR_COUNT = Math.min(freqBinCount, 64);
    const barWidth = (w * 0.88) / BAR_COUNT;
    const gap = (w * 0.12) / (BAR_COUNT + 1);
    const mid = BAR_COUNT / 2;

    const draw = () => {
      this.animationId = requestAnimationFrame(draw);
      // 取频域幅度（0-255），这样低音/中音/高音分区更自然
      analyser.getByteFrequencyData(freqArray);
      this.ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < BAR_COUNT; i++) {
        // 重采样：把频域数组压缩到 BAR_COUNT 条
        const srcIdx = Math.floor((i / BAR_COUNT) * freqBinCount);
        const raw = freqArray[srcIdx] / 255; // 0 ~ 1

        // 距离中心的位置：0（最左）→ 0.5（中间）→ 1（最右）
        const pos = i / (BAR_COUNT - 1);
        const distFromCenter = 2 * Math.abs(pos - 0.5); // 0 (center) → 1 (edge)

        // 高斯/钟形包络曲线：中间 1.0，两侧衰减到 0.15
        // 这保证了"中间竖条最高，两侧逐渐降低"的视觉效果，匹配用户给出的参考图
        const envelope = 0.15 + 0.85 * Math.exp(-5 * distFromCenter * distFromCenter);

        // 结合原始音量 + 包络，给出最终条高
        let barH = Math.max(2, (h * 0.88) * raw * envelope);
        // 说话安静时也保留微小律动（根据包络高度的 10% 作为底噪，让画面有呼吸感）
        barH = Math.max(barH, h * 0.04 * envelope);

        const x = gap + i * (barWidth + gap);
        const y = (h - barH) / 2; // 上下居中

        // 渐变色：中间偏蓝，两侧偏浅蓝（视觉层次）
        const centerRatio = 1 - distFromCenter;
        const alpha = 0.55 + 0.45 * centerRatio;
        this.ctx.fillStyle = `rgba(74, 124, 255, ${alpha})`;

        // 圆角竖条
        const radius = Math.min(barWidth / 2, barH / 2);
        this._drawRoundedRect(x, y, barWidth, barH, radius);
      }
    };
    draw();
  },

  stopWaveformAnimation() {
    if (this.animationId) { cancelAnimationFrame(this.animationId); this.animationId = null; }
    this.drawIdleWaveform();
  },

  startRecognition() {
    this.transcriptText = '';
    this.recognitionError = null;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      this.recognitionError = 'NOT_SUPPORTED';
      // 标记：Web Speech 不可用，api.js fallback 会据此显示提示
      window._speechNotSupported = true;
      // 页面内显示明确警告（非 Chrome 浏览器用户能看到）
      const live = document.getElementById('live-transcript');
      if (live) {
        live.textContent = '⚠ 当前浏览器不支持语音转写，请使用 Chrome 浏览器体验真实转写';
        live.style.color = '#b45309';
      }
      return;
    }
    // 清除上一次的不支持标记
    window._speechNotSupported = false;
    const rec = new SR();
    rec.lang = 'zh-CN';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let finalText = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      if (finalText) this.transcriptText += finalText;
      const display = (this.transcriptText + interim).trim();
      const el = document.getElementById('live-transcript');
      if (el && display) {
        el.textContent = display.length > 60 ? '…' + display.slice(-60) : display;
      }
    };
    rec.onerror = (e) => { this.recognitionError = e.error || 'ERROR'; };
    try { rec.start(); this.recognition = rec; }
    catch (e) { this.recognitionError = e.message || 'START_FAILED'; }
  },

  stopRecognition() {
    if (!this.recognition) return;
    try { this.recognition.stop(); } catch {}
    this.recognition = null;
  },

  /** 设置倒计时模式（秒数；不传或 0 → 正计时） */
  setCountdown(seconds) {
    if (!seconds || seconds <= 0) { this._countdownMs = 0; return; }
    this._countdownMs = seconds * 1000;
  },

  _startTick() {
    if (this._tickTimer) return;
    this._tickTimer = setInterval(() => {
      const elapsed = Date.now() - this.startTime;
      let remaining = null;
      if (this._countdownMs > 0) {
        remaining = Math.max(0, this._countdownMs - elapsed);
        if (typeof this.onTick === 'function') this.onTick(elapsed, remaining);
        if (remaining <= 0) { this.stop(); return; }
      } else {
        if (typeof this.onTick === 'function') this.onTick(elapsed, null);
      }
    }, 250);
  },

  _stopTick() {
    if (this._tickTimer) { clearInterval(this._tickTimer); this._tickTimer = null; }
  },

  async start() {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioChunks = [];
    this.startTime = Date.now();
    this.transcriptText = '';

    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);

    const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    const mimeType = mimeTypes.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    this.mediaRecorder = new MediaRecorder(this.mediaStream, mimeType ? { mimeType } : undefined);

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.audioChunks.push(e.data);
    };

    this.mediaRecorder.onstop = async () => {
      this.stopWaveformAnimation();
      this._stopTick();

      const actualMime = this.mediaRecorder.mimeType || 'audio/webm';
      const blob = new Blob(this.audioChunks, { type: actualMime });
      const duration = this.startTime ? Date.now() - this.startTime : 0;

      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((t) => t.stop());
        this.mediaStream = null;
      }
      if (this.audioContext) {
        await this.audioContext.close().catch(() => {});
        this.audioContext = null;
      }

      this.recording = false;
      window.recordedBlob = blob;
      window.recordedDuration = duration;
      window.recordedTranscript = this.transcriptText.trim();

      this.updateUI();
      if (typeof this.onStop === 'function') {
        try { this.onStop(blob, duration, this.transcriptText.trim()); } catch {}
      }
    };

    this.mediaRecorder.start(100);
    this.recording = true;
    this.startRecognition();
    this._startTick();
    this.startWaveformAnimation(source);
    this.updateUI();
    // 立即触发一次 tick（显示 00:00）
    if (typeof this.onTick === 'function') {
      this.onTick(0, this._countdownMs > 0 ? this._countdownMs : null);
    }
  },

  stop() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') this.mediaRecorder.stop();
    this.stopRecognition();
  },

  reset() {
    window.recordedBlob = null;
    window.recordedDuration = 0;
    window.recordedTranscript = '';
    this.audioChunks = [];
    this.transcriptText = '';
    this._countdownMs = 0;
    const live = document.getElementById('live-transcript');
    if (live) live.textContent = '';
    this.drawIdleWaveform();
    this.updateUI();
  },
};
