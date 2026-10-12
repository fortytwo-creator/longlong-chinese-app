/* Effetti: tocco animato sui tasti, "tic" di selezione nella home, rumore della matita mentre si scrive, coriandoli allo sblocco.
   I suoni sono sintetizzati (Web Audio): nessun file da scaricare, funzionano senza internet. Si spengono da Profilo → Effetti sonori. */
(function () {
  'use strict';
  var ctx = null;
  function on() { try { var p = window.Store && Store.get().profile; return !p || p.sfx !== false; } catch (e) { return true; } }
  function ac() {
    if (!ctx) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { ctx = new C(); } catch (e) { return null; } }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, t0, dur, vol, type) {
    var a = ac(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain(), t = a.currentTime + (t0 || 0);
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  /* vibrazione: nell'app (iPhone e Android) con il plugin Haptics di Capacitor; nel browser solo Android (iPhone/Safari non la permette) */
  function hap() { var C = window.Capacitor; return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.Haptics || null; }
  function buzz(kind) {
    if (!on()) return;
    var H = hap();
    try {
      if (H) { if (kind === 'win') H.notification({ type: 'SUCCESS' }); else H.impact({ style: 'LIGHT' }); }
      else if (navigator.vibrate) navigator.vibrate(kind === 'win' ? [30, 40, 30, 40, 60] : 6);
    } catch (e) { /* ignora */ }
  }
  function tick() { if (!on()) return; tone(880, 0, 0.09, 0.09, 'sine'); tone(1320, 0.02, 0.07, 0.04, 'sine'); }

  /* ---------- tocco: piccola animazione su qualsiasi tasto ---------- */
  var TAPPABLE = 'button, .btn, .node, .unit, .opt, .tile, .chip, .word, .tcard, .act, a.btn';
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest(TAPPABLE); if (!b || b.disabled) return;
    b.classList.remove('tap'); void b.offsetWidth; b.classList.add('tap');
    setTimeout(function () { b.classList.remove('tap'); }, 260);
    buzz('tap');
  }, true);

  /* ---------- "tic" di selezione: home, corso, dojo, profilo (non dentro le lezioni, dove parla la voce) ---------- */
  var SILENT_ACTS = { say: 1, sayzh: 1, tonesample: 1, voice: 1 };
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest(TAPPABLE); if (!b || b.disabled) return;
    if (b.closest('#sheet')) return;
    var act = b.dataset && b.dataset.act; if (act && SILENT_ACTS[act]) return;
    tick();
  }, true);

  /* ---------- matita: rumore di grafite mentre il dito scorre sul riquadro di scrittura ---------- */
  var pen = null, last = null;
  function penStart() {
    if (!on() || pen) return; var a = ac(); if (!a) return;
    var len = a.sampleRate * 1, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = a.createBufferSource(); src.buffer = buf; src.loop = true;
    var bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.7;
    var hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    var g = a.createGain(); g.gain.value = 0;
    src.connect(bp); bp.connect(hp); hp.connect(g); g.connect(a.destination); src.start();
    pen = { src: src, g: g, bp: bp };
  }
  function penMove(x, y, t) {
    if (!pen) return;
    var v = 0;
    if (last) { var dt = Math.max(1, t - last.t); v = Math.hypot(x - last.x, y - last.y) / dt; }   // px per ms
    last = { x: x, y: y, t: t };
    var vol = Math.min(0.16, v * 0.09), now = ctx.currentTime;
    pen.g.gain.cancelScheduledValues(now); pen.g.gain.setTargetAtTime(vol, now, 0.03);
    pen.bp.frequency.setTargetAtTime(2000 + Math.min(1800, v * 1400), now, 0.05);
  }
  function penStop() {
    if (!pen) return; var p = pen; pen = null; last = null;
    try { p.g.gain.cancelScheduledValues(ctx.currentTime); p.g.gain.setTargetAtTime(0, ctx.currentTime, 0.02); setTimeout(function () { try { p.src.stop(); } catch (e) { /* ignora */ } }, 120); } catch (e) { /* ignora */ }
  }
  document.addEventListener('pointerdown', function (e) { if (e.target.closest && e.target.closest('#hz')) { penStart(); penMove(e.clientX, e.clientY, e.timeStamp); } }, true);
  document.addEventListener('pointermove', function (e) { if (pen) penMove(e.clientX, e.clientY, e.timeStamp); }, true);
  ['pointerup', 'pointercancel', 'blur'].forEach(function (ev) { (ev === 'blur' ? window : document).addEventListener(ev, penStop, true); });

  /* ---------- coriandoli + fanfara ---------- */
  function confetti() {
    var cv = document.createElement('canvas'); cv.className = 'confetti';
    cv.width = window.innerWidth; cv.height = window.innerHeight; document.body.appendChild(cv);
    var g = cv.getContext('2d'), W = cv.width, H = cv.height, cols = ['#ff6b9d', '#ffd54f', '#4cd08a', '#5bc0ff', '#b388ff', '#ff9a8a'], ps = [];
    for (var s = 0; s < 2; s++) for (var i = 0; i < 90; i++) {         // due cannoni, ai lati in basso
      var ang = (s ? Math.PI * 1.25 : Math.PI * 1.75) + (Math.random() - 0.5) * 0.9, sp = 11 + Math.random() * 11;
      ps.push({ x: s ? W + 6 : -6, y: H * 0.9, vx: Math.cos(ang) * sp * (s ? -1 : 1) * -1, vy: Math.sin(ang) * sp, w: 6 + Math.random() * 6, h: 4 + Math.random() * 5,
        c: cols[(Math.random() * cols.length) | 0], r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, round: Math.random() < 0.25 });
    }
    // sistema le direzioni: a sinistra verso destra/alto, a destra verso sinistra/alto
    ps.forEach(function (p, k) { var left = k < 90; p.vx = Math.abs(p.vx) * (left ? 1 : -1); p.vy = -Math.abs(p.vy); });
    var t0 = performance.now(), reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    (function frame(t) {
      var el = t - t0; g.clearRect(0, 0, W, H);
      ps.forEach(function (p) {
        p.vy += 0.38; p.vx *= 0.992; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.globalAlpha = Math.max(0, Math.min(1, (3400 - el) / 900)); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c;
        if (p.round) { g.beginPath(); g.arc(0, 0, p.h * 0.7, 0, 7); g.fill(); } else g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        g.restore();
      });
      if (el < 3400 && !reduce) requestAnimationFrame(frame); else if (cv.parentNode) cv.parentNode.removeChild(cv);
    })(t0);
    buzz('win');
    if (on()) { [523, 659, 784, 1047].forEach(function (f, k) { tone(f, k * 0.11, 0.35, 0.1, 'triangle'); }); tone(1568, 0.5, 0.6, 0.07, 'sine'); }
  }

  window.Fx = { tick: tick, buzz: buzz, confetti: confetti };
})();
