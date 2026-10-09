/* Analisi dell'intonazione: tutto in locale (funziona offline).
   1) frame(): altezza (Hz) ed energia ogni ~30 ms
   2) analyze(): divide la parlata in sillabe, riconosce il tono di ciascuna e lo confronta con quello atteso.
   Non riconosce le parole: controlla numero di sillabe, toni e ritmo. */
(function () {
  var NPTS = 12;

  /* ---------- livello 1: un frame di audio ---------- */
  function rmsOf(buf) { var s = 0, i; for (i = 0; i < buf.length; i++) s += buf[i] * buf[i]; return Math.sqrt(s / buf.length); }

  function pitchOf(buf, sr, rms) {
    var n = buf.length, i, lag;
    if (rms < 0.006) return null;
    var minLag = Math.floor(sr / 420), maxLag = Math.min(Math.floor(sr / 70), n - 2);
    var cs = new Array(maxLag + 2), best = 0;
    for (lag = minLag; lag <= maxLag; lag++) {
      var sum = 0, e1 = 0, e2 = 0;
      for (i = 0; i < n - lag; i++) { sum += buf[i] * buf[i + lag]; e1 += buf[i] * buf[i]; e2 += buf[i + lag] * buf[i + lag]; }
      var c = sum / Math.sqrt(e1 * e2 + 1e-9);
      cs[lag] = c; if (c > best) best = c;
    }
    if (best < 0.55) return null;
    for (lag = minLag + 1; lag < maxLag; lag++) { // primo picco alto: evita gli errori d'ottava
      if (cs[lag] >= best * 0.92 && cs[lag] >= cs[lag - 1] && cs[lag] >= cs[lag + 1]) return sr / lag;
    }
    return null;
  }

  function frame(buf, sr) { var e = rmsOf(buf); return { f: pitchOf(buf, sr, e), e: e }; }

  /* per i test: segnale intero -> frames (una finestra ogni hopMs) */
  function framesFromSamples(x, sr, hopMs, win) {
    hopMs = hopMs || 30; win = win || 2048;
    var hop = Math.round(sr * hopMs / 1000), out = [];
    for (var end = win; end <= x.length; end += hop) out.push(frame(x.subarray(end - win, end), sr));
    return out;
  }

  /* ---------- toni attesi ---------- */
  function toneOfSyl(s) {
    if (/[āēīōūǖ]/.test(s)) return 1; if (/[áéíóúǘ]/.test(s)) return 2;
    if (/[ǎěǐǒǔǚ]/.test(s)) return 3; if (/[àèìòùǜ]/.test(s)) return 4; return 5;
  }
  /* py: "nǐ hǎo" -> [{syl, t0, t, sandhi, last}] ; la 'r' dell'erhua non è una sillaba a parte; 3+3 -> 2+3 */
  function targetTones(py) {
    var sy = py.split(/\s+/).filter(function (s) { return s && s !== 'r'; });
    var arr = sy.map(function (s) { var t = toneOfSyl(s); return { syl: s, t0: t, t: t, sandhi: false, last: false }; });
    for (var i = 0; i < arr.length - 1; i++) {
      if (arr[i].t0 === 3 && arr[i + 1].t0 === 3) { arr[i].t = 2; arr[i].sandhi = true; }
    }
    if (arr.length) arr[arr.length - 1].last = true;
    return arr;
  }

  /* ---------- modelli dei toni (semitoni, 12 punti, media tolta) ---------- */
  function tpl(tone, x) {
    if (tone === 1) return 0;
    if (tone === 2) return -3 + 6 * x;
    if (tone === 3) return x < 0.4 ? -4 * (x / 0.4) : -4 + 7 * ((x - 0.4) / 0.6);
    if (tone === 'h') return 2 - 4 * Math.min(1, x / 0.7);          // terzo tono "mezzo": solo la discesa
    return 4 - 8 * x;
  }
  function curve(tone, n) {
    n = n || NPTS; var c = [], i;
    for (i = 0; i < n; i++) c.push(tpl(tone, i / (n - 1)));
    var m = c.reduce(function (s, v) { return s + v; }, 0) / n;
    return c.map(function (v) { return v - m; });
  }
  function templateCurve(tone, n) { return curve(tone === 5 ? 1 : tone, n || 24); }
  var TPL = { 1: curve(1), 2: curve(2), 3: curve(3), h: curve('h'), 4: curve(4) };

  function rmsDiff(a, b) { var s = 0, i; for (i = 0; i < a.length; i++) s += Math.pow(a[i] - b[i], 2); return Math.sqrt(s / a.length); }

  /* ---------- livello 2: dai frame alle sillabe ---------- */
  function median(a) { var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.floor(s.length / 2)]; }
  function percentile(a, p) { var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; }
  function smooth(a, w) { // media mobile su valori non nulli
    return a.map(function (v, i) {
      if (v === null) return null; var s = 0, n = 0;
      for (var k = -w; k <= w; k++) if (a[i + k] !== undefined && a[i + k] !== null) { s += a[i + k]; n++; }
      return s / n;
    });
  }

  /* forma generale della sillaba: scende / sale / piatta / a V (tono 3) */
  function featTone(c, range) {
    var n = c.length, q = Math.max(2, Math.round(n / 3)), a = 0, b = 0, i, mn = 1e9, mi = 0;
    for (i = 0; i < q; i++) { a += c[i]; b += c[n - 1 - i]; }
    a /= q; b /= q;
    for (i = 0; i < n; i++) if (c[i] < mn) { mn = c[i]; mi = i; }
    var d = b - a, dip = mi > n * 0.2 && mi < n * 0.8 && (a - mn) > 1.2 && (b - mn) > 0.8;
    if (dip) return 3;
    if (d <= -1.4) return 4;
    if (d >= 1.4) return 2;
    return range < 3 ? 1 : (d < 0 ? 4 : 2);
  }

  function analyze(frames, targets) {
    var k = targets.length, N = frames.length, i;
    var res = { ok: false, expected: k, found: 0, syl: [], correct: 0, score: 0, pass: false, speech: false, frames: N };
    if (N < 4) return res;
    var en = frames.map(function (f) { return f.e; });
    /* soglia di energia: si calcola sui frame con altezza riconosciuta (la vocale), così una "s" o "sh" rumorosa non nasconde la vocale più debole */
    var ve = [], vi;
    for (vi = 0; vi < N; vi++) if (frames[vi].f) ve.push(en[vi]);
    var peak = ve.length >= 3 ? percentile(ve, 0.9) : percentile(en, 0.92), thr = Math.max(0.006, peak * 0.14);
    var act = en.map(function (e, j) { return e >= thr || (!!frames[j].f && e >= thr * 0.35); });
    var first = act.indexOf(true), last = act.lastIndexOf(true);
    if (first < 0 || last - first < 2) return res;
    res.speech = true;

    /* altezza in semitoni, pulizia degli errori d'ottava */
    var st = frames.map(function (f, j) { return (f.f && act[j]) ? 12 * Math.log(f.f / 100) / Math.LN2 : null; });
    var base = st.filter(function (v) { return v !== null; });
    if (base.length < 4) { res.voiced = base.length; return res; }
    var med = median(base);
    st = st.map(function (v) { return (v !== null && Math.abs(v - med) > 9) ? null : v; });
    var sm = smooth(st, 1);
    st = sm.map(function (v, j) { // scarta i salti isolati
      if (v === null) return null; var a = sm[j - 1], b = sm[j + 1];
      if (a !== null && a !== undefined && b !== null && b !== undefined && Math.abs(v - a) > 4 && Math.abs(v - b) > 4) return null;
      return v;
    });

    /* tratti sonori continui (si ricuciono i buchi di 1 frame) */
    var voiced = st.map(function (v, j) { return v !== null && j >= first && j <= last; });
    for (i = 1; i < N - 1; i++) if (!voiced[i] && voiced[i - 1] && voiced[i + 1] && act[i]) { voiced[i] = true; st[i] = (st[i - 1] + st[i + 1]) / 2; }
    var runs = [], s0 = -1;
    for (i = 0; i <= N; i++) {
      if (i < N && voiced[i]) { if (s0 < 0) s0 = i; } else if (s0 >= 0) { runs.push([s0, i - 1]); s0 = -1; }
    }
    var minLen = 3;
    var kept = runs.filter(function (r) { return r[1] - r[0] + 1 >= minLen; });
    if (!kept.length) return res;
    runs = kept;

    /* forza il numero di tratti a k: unisce i più vicini oppure divide i più lunghi */
    while (runs.length > k) {
      var bi = 0, bg = 1e9;
      for (i = 0; i < runs.length - 1; i++) { var g = runs[i + 1][0] - runs[i][1]; if (g < bg) { bg = g; bi = i; } }
      runs.splice(bi, 2, [runs[bi][0], runs[bi + 1][1]]);
    }
    res.found = runs.length;
    function splitRun(r) { // taglia dove l'energia è più bassa nella parte centrale
      var a = r[0], b = r[1], n = b - a + 1, lo = a + Math.max(1, Math.round(n * 0.3)), hi = b - Math.max(1, Math.round(n * 0.3));
      var cut = Math.round((a + b) / 2), best = 1e9;
      var e2 = en.map(function (v, j) { return ((en[j - 1] || v) + v + (en[j + 1] || v)) / 3; });
      for (var j = lo; j <= hi; j++) if (e2[j] < best) { best = e2[j]; cut = j; }
      return [[a, cut], [cut + 1, b]];
    }
    while (runs.length < k) {
      var li = 0, ll = 0;
      for (i = 0; i < runs.length; i++) { var len = runs[i][1] - runs[i][0] + 1; if (len > ll) { ll = len; li = i; } }
      if (ll < 4) break;
      var parts = splitRun(runs[li]); runs.splice(li, 1, parts[0], parts[1]);
    }
    res.segs = runs.length;

    /* una curva per sillaba */
    var vals = st.filter(function (v) { return v !== null; });
    var center = median(vals);
    var scoreSum = 0;
    targets.forEach(function (tg, idx) {
      var r = runs[idx], o = { target: tg.t, t0: tg.t0, syl: tg.syl, sandhi: tg.sandhi, detected: null, score: 0, ok: false, present: !!r };
      if (r) {
        var a = r[0], b = r[1], n = b - a + 1;
        if (n > 7) { a += 1; b -= 1; n = b - a + 1; }
        var seg = [], j;
        for (j = a; j <= b; j++) seg.push(st[j]);
        for (j = 0; j < seg.length; j++) { // buchi -> interpolazione
          if (seg[j] === null) {
            var p = j - 1, q = j + 1; while (q < seg.length && seg[q] === null) q++;
            seg[j] = (p >= 0 && q < seg.length) ? seg[p] + (seg[q] - seg[p]) * (j - p) / (q - p) : (p >= 0 ? seg[p] : seg[q]);
          }
        }
        var pts = [];
        for (j = 0; j < NPTS; j++) {
          var pos = seg.length > 1 ? j * (seg.length - 1) / (NPTS - 1) : 0, lo2 = Math.floor(pos), hi2 = Math.min(seg.length - 1, lo2 + 1);
          pts.push(seg[lo2] + (seg[hi2] - seg[lo2]) * (pos - lo2));
        }
        var mean = pts.reduce(function (s, v) { return s + v; }, 0) / NPTS;
        o.level = mean - center; o.dur = (r[1] - r[0] + 1);
        o.contour = pts.map(function (v) { return v - mean; });
        o.range = Math.max.apply(null, o.contour) - Math.min.apply(null, o.contour);
        o.start = r[0]; o.end = r[1];
        var d = {}, bestT = 1, bestD = 1e9;
        [1, 2, 3, 4].forEach(function (t) { d[t] = rmsDiff(o.contour, TPL[t]); });
        d.h = rmsDiff(o.contour, TPL.h);
        var half = (tg.t === 3 && !tg.last);
        [1, 2, 3, 4].forEach(function (t) {
          var dd = (t === 3 && half) ? Math.min(d[3], d.h) : d[t];
          if (dd < bestD) { bestD = dd; bestT = t; }
        });
        o.feat = featTone(o.contour, o.range);
        if (o.feat && o.feat !== bestT && o.feat === tg.t) { bestT = tg.t; bestD = d[tg.t]; } // sillabe brevi: la forma generale conta più del modello esatto
        o.detected = bestT; o.dists = d;
        if (tg.t === 5) { o.score = 100; o.ok = true; o.detected = 5; }
        else {
          var dt = (tg.t === 3 && half) ? Math.min(d[3], d.h) : d[tg.t];
          o.score = Math.max(0, Math.min(100, Math.round(100 - dt * 16)));
          o.ok = (bestT === tg.t) && (o.score >= 45 || o.feat === tg.t);
          if (o.ok && o.score < 60 && o.feat === tg.t) o.score = 60;
        }
      } else if (tg.t === 5) { o.score = 0; }
      if (o.ok) res.correct++;
      scoreSum += o.score;
      res.syl.push(o);
    });
    /* terzo tono non finale (o 3+3): spesso è solo "basso e quasi piatto"; lo accettiamo se è più basso delle altre sillabe */
    var lv = res.syl.filter(function (o) { return o.present && o.level !== undefined; });
    var avgLv = lv.length ? lv.reduce(function (sum, o) { return sum + o.level; }, 0) / lv.length : 0;
    res.syl.forEach(function (o, idx) {
      var tg = targets[idx];
      if (o.ok || !o.present || !o.contour) return;
      if ((tg.t0 === 3 && !tg.last) && o.range < 3.5 && o.level < avgLv + 0.5) {
        var ns = Math.max(o.score, 60); scoreSum += ns - o.score; o.score = ns; o.ok = true; o.detected = 3; res.correct++;
      }
    });
    res.score = Math.round(scoreSum / k);
    var need = k <= 2 ? k : Math.ceil(0.6 * k);
    res.need = need;
    res.pass = res.correct >= need && res.speech;
    res.ok = true;
    return res;
  }

  /* compatibilità con il vecchio controllo del singolo tono (palestra) */
  function assess(contour, target) {
    var rms = {}, best = 1, bestR = 1e9;
    [1, 2, 3, 4].forEach(function (t) {
      var tc = curve(t, contour.length); rms[t] = rmsDiff(contour, tc);
      if (rms[t] < bestR) { bestR = rms[t]; best = t; }
    });
    return { detected: best, score: Math.max(0, Math.min(100, Math.round(100 - rms[target] * 16))), rms: rms };
  }

  window.Pitch = { frame: frame, framesFromSamples: framesFromSamples, analyze: analyze, targetTones: targetTones,
    templateCurve: templateCurve, curve: curve, toneOfSyl: toneOfSyl, assess: assess, NPTS: NPTS };
})();
