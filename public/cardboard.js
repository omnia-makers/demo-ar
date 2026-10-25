// Headset (Cardboard-style) mode of index.html: after A-Frame renders each frame (tock), copy what the phone
// would show into #stereo twice, side by side, so both eyes see the same image (no depth). Each copy is
// centred on its lens with the values from calibrate.html (CardboardCalibration): if the two images
// are not centred on the lenses the eyes cannot fuse them and everything is seen twice. Subtitles and
// hints are drawn per eye, around the same centre, because the DOM overlays cannot be duplicated.
// There are no touch controls in this mode (only the X to leave): once the floor is detected a
// countdown gives time to put the phone in the viewer, then the narration starts by itself.
const CARDBOARD_COUNTDOWN_MS = 10000;
AFRAME.registerComponent('cardboard', {
  init() {
    this.countdownEnd = null;
    this.started = false;
    // Only if the browser refused to start the audio on its own: then a tap is needed once.
    this.blocked = false;
    this.onTap = () => { if (this.blocked) this.startNarration(); };
    document.querySelector('#stereo').addEventListener('pointerup', this.onTap);
    // The countdown waits for a detection made in this mode: forget the current one (if MindAR is
    // still tracking, it reports the floor again on the next frame) and drop a countdown started just
    // before MindAR restarts for the rotation to landscape.
    this.target = document.querySelector('#target');
    this.onFound = () => {
      if (!this.started && !this.blocked && this.countdownEnd === null) {
        this.countdownEnd = performance.now() + CARDBOARD_COUNTDOWN_MS;
      }
    };
    this.onRestarted = () => { if (!this.started) this.countdownEnd = null; };
    this.target.addEventListener('targetFound', this.onFound);
    this.el.addEventListener('arReady', this.onRestarted);
    window.markTargetsLost?.();
    this.out = document.querySelector('#stereo');
    this.ctx = this.out.getContext('2d');
    this.subtitle = document.querySelector('#subtitles');
    this.calibration = window.CardboardCalibration.load();
    this.onResize = () => {
      this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      this.out.width = Math.round(window.innerWidth * this.dpr);
      this.out.height = Math.round(window.innerHeight * this.dpr);
    };
    this.onResize();
    window.addEventListener('resize', this.onResize);
    document.body.classList.add('cardboard');
  },
  remove() {
    document.querySelector('#stereo').removeEventListener('pointerup', this.onTap);
    this.target.removeEventListener('targetFound', this.onFound);
    this.el.removeEventListener('arReady', this.onRestarted);
    window.removeEventListener('resize', this.onResize);
    document.body.classList.remove('cardboard');
  },
  tock() {
    const { ctx, dpr } = this;
    const W = window.innerWidth, H = window.innerHeight;
    const video = this.el.systems['mindar-image-system'].video;
    const c = window.CardboardCalibration.resolve(W, H, this.calibration);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    this.updateCountdown();
    const overlays = this.overlays();
    for (const { cx, cy, clipX, clipW } of window.CardboardCalibration.eyes(W, H, c)) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(clipX, 0, clipW, H);
      ctx.clip();
      ctx.save();
      // The centre of the normal full-screen view goes to the lens centre, scaled by the zoom.
      ctx.translate(cx, cy);
      ctx.scale(c.zoom, c.zoom);
      ctx.translate(-W / 2, -H / 2);
      // MindAR sizes the video to cover the screen and offsets it with inline styles.
      if (video && video.readyState >= 2) {
        const s = video.style;
        ctx.drawImage(video, parseFloat(s.left) || 0, parseFloat(s.top) || 0,
                      parseFloat(s.width) || W, parseFloat(s.height) || H);
      }
      ctx.drawImage(this.el.canvas, 0, 0, W, H);
      ctx.restore();
      for (const text of overlays) this.drawText(text, cx, cy, H, c.zoom);
      ctx.restore();
    }
    ctx.fillStyle = '#000';
    ctx.fillRect(W / 2 - 1, 0, 2, H);
  },
  // The countdown is started by onFound; it keeps running if the floor is lost while the phone goes
  // into the viewer, and starts the narration when it ends. Once per visit to the mode.
  updateCountdown() {
    const n = window.narration;
    if (!n || this.started || this.blocked) return;
    if (n.state === 'playing' || n.state === 'paused') {
      this.started = true;
      return;
    }
    if (this.countdownEnd !== null && performance.now() >= this.countdownEnd) this.startNarration();
  },
  startNarration() {
    this.started = true;
    this.blocked = false;
    this.countdownEnd = null;
    window.narration.start().catch(() => { this.blocked = true; });
  },
  // Texts drawn in each eye: the current subtitle plus a status hint. dy = offset from the lens
  // centre as a fraction of the screen height.
  overlays() {
    const out = [];
    if (!this.subtitle.hidden) out.push({ lines: this.subtitle.textContent.split('\n'), dy: 0.22 });
    const n = window.narration;
    if (!n) return out;
    if (this.blocked) out.push({ lines: ['Toca la pantalla para empezar'], dy: 0 });
    else if (n.state === 'paused') out.push({ lines: ['En pausa'], dy: -0.28 });
    else if (this.countdownEnd !== null) {
      const secs = Math.max(1, Math.ceil((this.countdownEnd - performance.now()) / 1000));
      out.push({ lines: ['Coloca el móvil en las gafas', `Empieza en ${secs}`], dy: 0.2 });
    } else if (n.state === 'ended' && this.started) out.push({ lines: ['Fin'], dy: 0 });
    else if (!n.available && n.state !== 'playing') out.push({ lines: ['Apunta al suelo'], dy: 0 });
    return out;
  },
  drawText({ lines, dy }, cx, cy, H, zoom) {
    const { ctx } = this;
    const size = Math.max(12, Math.round(H * 0.04 * zoom));
    const lineH = size * 1.5;
    ctx.font = `500 ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((line, i) => {
      const raw = cy + H * dy * zoom + (i - (lines.length - 1) / 2) * lineH;
      const ly = Math.min(H - lineH / 2, Math.max(lineH / 2, raw));
      const w = ctx.measureText(line).width + size;
      ctx.fillStyle = '#000';
      ctx.fillRect(cx - w / 2, ly - lineH / 2, w, lineH);
      ctx.fillStyle = '#fff';
      ctx.fillText(line, cx, ly);
    });
  },
});
