/* Attività riusabili: sia il dojo sia le lezioni del corso le usano.
   Ogni attività: Steps.nome(body, cfg, ctl)
   ctl = { progress(i, n), done({correct, total}), cleanup(fn) }
   听 ascoltare: quiz   ·   说 parlare: repeat   ·   读 leggere: match, quiz, build, flash   ·   写 scrivere: write */
(function () {
  var U = window.Util, A = window.AudioKit, S = window.Store, P = window.Pitch, TONES = window.TONES;
  var esc = U.esc, shuffle = U.shuffle, pick = U.pick, zhHtml = U.zhHtml, pyHtml = U.pyHtml, say = U.say, toast = U.toast, toneColor = U.toneColor, toneSvg = U.toneSvg;
  var ALL = window.ALLWORDS;

  function once(fn) { var d = false; return function (x) { if (d) return; d = true; fn(x); }; }

  /* ---------- schede ---------- */
  function flash(body, cfg, ctl) {
    var deck = shuffle(cfg.words), i = 0, known = 0, flipped = false, done = once(ctl.done);
    function show() {
      if (i >= deck.length) return done({ correct: known, total: deck.length });
      ctl.progress(i, deck.length); flipped = false; var w = deck[i];
      body.innerHTML = '<div class="flash" data-f="flip"><div class="f-em">' + w.em + '</div><div class="f-zh">' + zhHtml(w) + '</div>' +
        '<div class="f-back" id="fBack"><div class="f-py">' + pyHtml(w) + '</div><div class="f-it">' + esc(w.it) + '</div></div>' +
        '<small class="f-tip" id="fTip">Tocca per girare</small></div>' +
        '<div class="row2"><button class="btn soft" data-f="say">🔊 Ascolta</button><button class="btn soft" data-f="slow">🐢 Lento</button></div>' +
        '<div class="row2 hide" id="fAns"><button class="btn danger" data-f="no">Ancora</button><button class="btn primary" data-f="yes">Lo so</button></div>';
    }
    body.onclick = function (e) {
      var t = e.target.closest('[data-f]'); if (!t) return; var w = deck[i], a = t.dataset.f;
      if (a === 'flip') { flipped = true; body.querySelector('#fBack').classList.add('on'); body.querySelector('#fTip').textContent = ''; body.querySelector('#fAns').classList.remove('hide'); say(w.zh); }
      else if (a === 'say') say(w.zh);
      else if (a === 'slow') say(w.zh, true);
      else if (a === 'yes' || a === 'no') { if (!flipped) return; S.markWord(w.id, a === 'yes'); if (a === 'yes') known++; i++; show(); }
    };
    show();
  }

  /* ---------- quiz (听 e 读) ---------- */
  function distractors(w, pool, key, n) {
    var seen = {}; seen[w[key]] = 1; var out = [];
    shuffle(pool).forEach(function (x) { if (out.length < n && !seen[x[key]]) { seen[x[key]] = 1; out.push(x); } });
    if (out.length < n) shuffle(window.Ent ? window.Ent.words() : ALL).forEach(function (x) { if (out.length < n && !seen[x[key]]) { seen[x[key]] = 1; out.push(x); } });
    return out;
  }
  function buildQuestions(words, pool, kinds, n, toneIt, seq) {
    var qs = [], deck = [], guard = 0;
    while (qs.length < n && guard++ < 200) {
      if (!deck.length) deck = shuffle(words);
      var w = deck.pop(), kind = pick(kinds);
      if (kind === 'tone') {
        if (!toneIt.length) continue;
        var it = seq ? toneIt[qs.length % toneIt.length] : pick(toneIt);
        qs.push({ kind: 'tone', item: it, opts: [1, 2, 3, 4], answer: it.t });
      } else {
        var key = (kind === 'rev' || kind === 'listenzh') ? 'zh' : 'it';
        var opts = shuffle([w].concat(distractors(w, pool, key, 3)));
        qs.push({ kind: kind, w: w, opts: opts, answer: w.id });
      }
    }
    return qs;
  }

  function quiz(body, cfg, ctl) {
    var pool = cfg.pool || cfg.words, toneIt = cfg.toneItems || U.toneItems(pool);
    var kinds = cfg.kinds.filter(function (k) { return k !== 'tone' || toneIt.length; });
    var qs = buildQuestions(cfg.words, pool, kinds, cfg.n || 8, cfg.seqTones ? shuffle(toneIt) : toneIt, !!cfg.seqTones), i = 0, correct = 0, locked = -1, done = once(ctl.done), nextTimer = null;
    ctl.cleanup(function () { clearTimeout(nextTimer); });
    function show() {
      if (i >= qs.length) return done({ correct: correct, total: qs.length });
      ctl.progress(i, qs.length);
      var q = qs[i], h = '<div class="q">';
      if (q.kind === 'listen') h += '<p class="q-hint">Ascolta e scegli il significato</p><button class="big-speaker" data-q="replay">🔊</button><button class="btn soft slim" data-q="slow">🐢 Lento</button>';
      else if (q.kind === 'listenzh') h += '<p class="q-hint">Ascolta e scegli il carattere</p><button class="big-speaker" data-q="replay">🔊</button><button class="btn soft slim" data-q="slow">🐢 Lento</button>';
      else if (q.kind === 'mean') h += '<p class="q-hint">Cosa significa?</p><div class="q-zh">' + zhHtml(q.w) + '</div><div class="q-py">' + pyHtml(q.w) + '</div>';
      else if (q.kind === 'rev') h += '<p class="q-hint">Come si dice in cinese?</p><div class="q-it">' + q.w.em + ' ' + esc(q.w.it) + '</div>';
      else h += '<p class="q-hint">Che tono senti?</p><button class="big-speaker" data-q="replay">🔊</button>';
      h += '<div class="opts ' + (q.kind === 'tone' ? 'tone-opts' : '') + '">';
      q.opts.forEach(function (o, k) {
        if (q.kind === 'tone') h += '<button class="opt tone" data-q="opt" data-k="' + k + '" style="--c:' + toneColor(o) + '"><svg viewBox="0 0 60 40">' + toneSvg(o) + '</svg><span>' + o + '</span></button>';
        else if (q.kind === 'rev' || q.kind === 'listenzh') h += '<button class="opt" data-q="opt" data-k="' + k + '"><span class="o-zh">' + zhHtml(o) + '</span><small>' + pyHtml(o) + '</small></button>';
        else h += '<button class="opt" data-q="opt" data-k="' + k + '">' + o.em + ' ' + esc(o.it) + '</button>';
      });
      body.innerHTML = h + '</div><div class="fb" id="fb"></div></div>';
      if (q.kind === 'listen' || q.kind === 'listenzh') say(q.w.zh);
      if (q.kind === 'tone') say(q.item.zh);
    }
    body.onclick = function (e) {
      var t = e.target.closest('[data-q]'); if (!t) return; var q = qs[i];
      if (t.dataset.q === 'replay') { say(q.kind === 'tone' ? q.item.zh : q.w.zh); return; }
      if (t.dataset.q === 'slow') { say(q.w.zh, true); return; }
      if (t.dataset.q === 'next') { i++; show(); return; }
      if (t.dataset.q !== 'opt' || locked === i) return;
      locked = i;
      var chosen = q.opts[+t.dataset.k], id = q.kind === 'tone' ? chosen : chosen.id, ok = id === q.answer;
      if (ok) correct++;
      if (q.kind !== 'tone') S.markWord(q.w.id, ok);
      body.querySelectorAll('.opt').forEach(function (b) {
        var o = q.opts[+b.dataset.k], oid = q.kind === 'tone' ? o : o.id;
        if (oid === q.answer) b.classList.add('right'); else if (b === t) b.classList.add('wrong');
        b.disabled = true;
      });
      var fb = body.querySelector('#fb');
      if (q.kind === 'tone') {
        fb.innerHTML = '<div class="' + (ok ? 'good' : 'bad') + '">' + (ok ? '✓ Giusto!' : '✗ Era il tono ' + q.answer) + ' — ' + q.item.zh + ' ' + q.item.py + ' (' + esc(q.item.it) + ')</div>';
        say(q.item.zh);
      } else {
        fb.innerHTML = '<div class="' + (ok ? 'good' : 'bad') + '">' + (ok ? '✓ Giusto!' : '✗ Non proprio') + ' — ' + zhHtml(q.w) + ' ' + pyHtml(q.w) + ' = ' + esc(q.w.it) + '</div>';
        if (q.kind !== 'listen' && q.kind !== 'listenzh') say(q.w.zh);
      }
      nextTimer = setTimeout(function () { i++; show(); }, ok ? 1300 : 2600);
    };
    show();
  }

  /* ---------- puzzle: abbina cinese con significato o con pinyin ---------- */
  function match(body, cfg, ctl) {
    var ws = cfg.words, mode = cfg.mode || 'py', sel = null, matched = 0, mistakes = 0, done = once(ctl.done);
    function key(w) { return mode === 'py' ? w.py : w.id; }
    var L = shuffle(ws), R = shuffle(ws);
    var h = '<p class="q-hint">' + (mode === 'py' ? 'Abbina ogni carattere al suo pinyin' : 'Abbina ogni parola al suo significato') + '</p><div class="match"><div class="mcol">';
    L.forEach(function (w, i) { h += '<button class="m" data-m="zh" data-k="' + esc(key(w)) + '" data-i="' + i + '"><span class="o-zh">' + (mode === 'py' ? esc(w.zh) : zhHtml(w)) + '</span></button>'; });
    h += '</div><div class="mcol">';
    R.forEach(function (w, i) {
      h += '<button class="m" data-m="r" data-k="' + esc(key(w)) + '" data-i="' + i + '">' +
        (mode === 'py' ? '<span class="o-py">' + pyHtml(w) + '</span>' : w.em + ' ' + esc(w.it)) + '</button>';
    });
    body.innerHTML = h + '</div></div>';
    ctl.progress(0, ws.length);
    body.onclick = function (e) {
      var t = e.target.closest('[data-m]'); if (!t || t.classList.contains('ok')) return;
      if (t.dataset.m === 'zh') {
        body.querySelectorAll('[data-m=zh]').forEach(function (b) { b.classList.remove('sel'); });
        t.classList.add('sel'); sel = t; say(L[+t.dataset.i].zh); return;
      }
      if (!sel) { toast('Prima scegli un carattere a sinistra'); return; }
      if (sel.dataset.k === t.dataset.k) {
        sel.classList.remove('sel'); sel.classList.add('ok'); t.classList.add('ok'); S.markWord(L[+sel.dataset.i].id, true);
        sel = null; matched++; ctl.progress(matched, ws.length);
        if (matched === ws.length) setTimeout(function () { done({ correct: Math.max(0, ws.length - mistakes), total: ws.length }); }, 500);
      } else {
        mistakes++; S.markWord(L[+sel.dataset.i].id, false);
        t.classList.add('shake'); setTimeout(function () { t.classList.remove('shake'); }, 400);
      }
    };
  }

  /* ---------- costruisci la frase ---------- */
  function build(body, cfg, ctl) {
    var ss = cfg.sentences, i = 0, first = 0, tries = 0, placed = [], order = [], locked = false, done = once(ctl.done), nextTimer = null;
    ctl.cleanup(function () { clearTimeout(nextTimer); });
    function show() {
      if (i >= ss.length) return done({ correct: first, total: ss.length });
      ctl.progress(i, ss.length); var s = ss[i]; tries = 0; placed = []; locked = false;
      order = s.tokens.map(function (t, k) { return k; });
      if (order.length > 1) { var tries2 = 0; do { order = shuffle(order); tries2++; } while (tries2 < 8 && order.every(function (k, j) { return k === j; })); }
      body.innerHTML = '<p class="q-hint">Metti le parole in ordine</p><div class="b-it">' + esc(s.it) + '</div>' +
        '<button class="btn soft" data-b="say">🔊 Ascolta la frase</button><div class="b-slots" id="bs"></div><div class="b-bank" id="bb"></div><div class="fb" id="bf"></div>';
      render();
    }
    function tile(s, k, act) { return '<button class="tile" data-b="' + act + '" data-k="' + k + '">' + U.tokHtml(s.tokens[k]) + '</button>'; }
    function render() {
      var s = ss[i], sl = '', bank = '';
      placed.forEach(function (k) { sl += tile(s, k, 'un'); });
      for (var j = placed.length; j < s.tokens.length; j++) sl += '<span class="slot"></span>';
      order.forEach(function (k) { if (placed.indexOf(k) < 0) bank += tile(s, k, 'pl'); });
      body.querySelector('#bs').innerHTML = sl; body.querySelector('#bb').innerHTML = bank;
    }
    body.onclick = function (e) {
      var t = e.target.closest('[data-b]'); if (!t) return; var s = ss[i], a = t.dataset.b;
      if (a === 'say') { say(s.zh + s.p); return; }
      if (a === 'next') { i++; show(); return; }
      if (locked) return;
      var k = +t.dataset.k;
      if (a === 'pl') { placed.push(k); say(s.tokens[k].zh); }
      else if (a === 'un') { placed.splice(placed.indexOf(k), 1); }
      render();
      if (placed.length === s.tokens.length) {
        var got = placed.map(function (x) { return s.tokens[x].zh; }).join('');
        if (got === s.core) {
          locked = true; if (tries === 0) first++;
          body.querySelectorAll('#bs .tile').forEach(function (b) { b.classList.add('right'); });
          body.querySelector('#bf').innerHTML = '<div class="good">✓ Perfetto!</div>';
          setTimeout(function () { say(s.zh + s.p); }, 250);
          nextTimer = setTimeout(function () { i++; show(); }, 2200);
        } else {
          tries++; locked = true;
          body.querySelectorAll('#bs .tile').forEach(function (b) { b.classList.add('wrong'); });
          body.querySelector('#bf').innerHTML = '<div class="bad">Quasi! Era così: ' + esc(s.zh) + '</div>';
          setTimeout(function () { say(s.zh + s.p); }, 250);
          nextTimer = setTimeout(function () { i++; show(); }, 3200);
        }
      }
    };
    show();
  }

  /* ---------- scrivi (写) ---------- */
  function strokeLoader(ch, onLoad, onFail) {
    fetch('strokes/' + encodeURIComponent(ch) + '.json').then(function (r) { if (!r.ok) throw new Error('no'); return r.json(); }).then(onLoad)
      .catch(function () {
        fetch('https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/' + encodeURIComponent(ch) + '.json').then(function (r) { if (!r.ok) throw new Error('no'); return r.json(); }).then(onLoad).catch(onFail);
      });
  }

  function write(body, cfg, ctl) {
    var strict = !!cfg.strict, skipAfter = cfg.skipAfter || 3;
    var ws = cfg.words.filter(function (w) { return Array.from(w.zh).length <= 2; }).slice(0, cfg.max || 4), wi = 0, ci = 0, correct = 0, mistakes = 0, writer = null, done = once(ctl.done);
    if (!ws.length) return done({ correct: 0, total: 0 });
    if (!window.HanziWriter) {
      toast('Scrittura saltata: manca la libreria dei tratti.');
      return done({ correct: 0, total: 0 });
    }
    function next() {
      if (wi >= ws.length) return done({ correct: correct, total: ws.length });
      ctl.progress(wi, ws.length);
      var w = ws[wi], chars = Array.from(w.zh);
      body.innerHTML = '<div class="w-prompt">' + w.em + ' <b>' + esc(w.it) + '</b><div>' + pyHtml(w) + '</div></div>' +
        '<div class="w-dots">' + chars.map(function (c, k) { return '<i class="' + (k < ci ? 'done' : k === ci ? 'cur' : '') + '"></i>'; }).join('') + '</div>' +
        '<div id="hz" class="hz"></div><p class="lead" id="hzMsg">Traccia il carattere seguendo i tratti.</p>' +
        '<div class="row3"><button class="btn soft" data-w="hint">💡 Aiuto</button><button class="btn soft" data-w="anim">▶️ Mostra</button><button class="btn soft' + (strict && mistakes < skipAfter ? ' hide' : '') + '" id="wSkip" data-w="skip">Salta</button></div>';
      if (!cfg.silent) say(w.zh);
      try {
        writer = HanziWriter.create(body.querySelector('#hz'), chars[ci], { width: 240, height: 240, padding: 12, showOutline: true, strokeColor: '#ff6b9d', outlineColor: '#e6dcd6', drawingWidth: 14, showCharacter: false, charDataLoader: strokeLoader,
          onLoadCharDataError: function () { var m = body.querySelector('#hzMsg'); if (m) m.textContent = 'Questo carattere non è ancora scaricato: scarica il pacchetto offline dal Profilo.'; } });
        startQuiz(w, chars);
      } catch (err) { body.querySelector('#hzMsg').textContent = 'Carattere non disponibile.'; }
    }
    function startQuiz(w, chars) {
      writer.quiz({
        onMistake: function () { mistakes++; var sb = body.querySelector('#wSkip'); if (strict && sb && mistakes >= skipAfter) sb.classList.remove('hide'); },
        onComplete: function () {
          ci++;
          if (ci < chars.length) { setTimeout(next, 400); }
          else { var ok = mistakes <= 3 * chars.length; if (ok) correct++; if (w.id) S.markWord(w.id, ok); mistakes = 0; ci = 0; wi++; setTimeout(next, 700); }
        }
      });
    }
    body.onclick = function (e) {
      var t = e.target.closest('[data-w]'); if (!t || !writer) return; var a = t.dataset.w, w = ws[wi], chars = Array.from(w.zh);
      if (a === 'hint') { mistakes++; var sb2 = body.querySelector('#wSkip'); if (strict && sb2 && mistakes >= skipAfter) sb2.classList.remove('hide'); writer.cancelQuiz(); writer.animateCharacter({ onComplete: function () { startQuiz(w, chars); } }); }
      else if (a === 'anim') { writer.cancelQuiz(); writer.animateCharacter({ onComplete: function () { startQuiz(w, chars); } }); }
      else if (a === 'skip') { if (w.id) S.markWord(w.id, false); ci = 0; mistakes = 0; wi++; next(); }
    };
    next();
  }

  /* ---------- ripeti (说): vale per ogni parola, anche di più sillabe ---------- */
  var MARKER = '#e57373'; // rosso tenue: la tua voce
  var TONENAME = ['', '1° tono (alto e piatto)', '2° tono (sale)', '3° tono (scende e sale)', '4° tono (cade)', 'tono neutro (leggero)'];

  function drawAnalysis(canvas, targets, res) {
    var c = canvas.getContext('2d'), W = canvas.width, H = canvas.height, k = targets.length, colW = W / k;
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(0,0,0,0.04)'; c.fillRect(0, 0, W, H);
    var scale = H / 20;
    targets.forEach(function (tg, i) {
      var x0 = i * colW, x1 = (i + 1) * colW, pad = Math.min(14, colW * 0.12);
      if (i) { c.strokeStyle = 'rgba(0,0,0,0.08)'; c.setLineDash([3, 4]); c.lineWidth = 1; c.beginPath(); c.moveTo(x0, 6); c.lineTo(x0, H - 6); c.stroke(); }
      function line(arr, col, dash, lw, alpha) {
        c.beginPath(); c.setLineDash(dash || []); c.lineWidth = lw; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round'; c.globalAlpha = alpha || 1;
        arr.forEach(function (v, j) {
          var x = x0 + pad + j * (colW - 2 * pad) / (arr.length - 1), y = H / 2 - v * scale;
          if (j) c.lineTo(x, y); else c.moveTo(x, y);
        });
        c.stroke(); c.globalAlpha = 1;
      }
      var tone = tg.t === 5 ? 5 : tg.t;
      line(P.templateCurve(tone === 5 ? 1 : tone), toneColor(tone), [8, 6], 5, tone === 5 ? 0.45 : 1);
      var s = res && res.syl[i];
      if (s && s.contour) line(s.contour, MARKER, [], 6, 1);
      else if (res) { c.fillStyle = 'rgba(229,115,115,0.12)'; c.fillRect(x0 + 2, 2, colW - 4, H - 4); }
    });
    c.setLineDash([]);
  }

  function repeat(body, cfg, ctl) {
    var ws = cfg.words, i = 0, passed = 0, rec = null, mine = null, advancing = false, timer = null, fails = 0, targets = [], done = once(ctl.done), busy = false;
    var strict = !!cfg.strict, skipAfter = cfg.skipAfter || 3; /* strict (introduzione): non si va avanti da soli, si riprova; "Salta" compare dopo alcuni errori */
    function noteFail() { fails++; var sb = body.querySelector('#skipBtn'); if (strict && sb && fails >= skipAfter) sb.classList.remove('hide'); }
    ctl.cleanup(function () { clearTimeout(timer); if (rec) { rec.stop(); rec = null; } });
    function show() {
      advancing = false; mine = null; fails = 0; busy = false;
      if (i >= ws.length) return done({ correct: passed, total: ws.length });
      ctl.progress(i, ws.length);
      var w = ws[i]; targets = P.targetTones(w.py);
      var sylRow = targets.map(function (tg) {
        return '<span class="syl" style="--c:' + toneColor(tg.t) + '"><svg viewBox="0 0 60 40">' + toneSvg(tg.t === 5 ? 1 : tg.t) + '</svg><b>' + esc(tg.syl) + '</b><small>' +
          (tg.sandhi ? 'si dice come 2° tono' : tg.t === 5 ? 'leggero' : tg.t + '° tono') + '</small></span>';
      }).join('');
      body.innerHTML = '<div class="flash static"><div class="f-em">' + (w.em || '🎵') + '</div><div class="f-zh">' + zhHtml(w) + '</div>' +
        '<div class="f-py">' + pyHtml(w) + '</div><div class="f-it">' + esc(w.it) + '</div></div>' +
        '<div class="syl-row">' + sylRow + '</div>' +
        '<canvas id="cv" width="320" height="140"></canvas>' +
        '<p class="lead" id="tMsg">La linea tratteggiata è il tono da imitare. La tua voce sarà la linea rossa.</p><div class="chips-res" id="rChips"></div>' +
        '<div class="row2"><button class="btn soft" data-t="say">🔊 Ascolta</button><button class="btn soft" data-t="slow">🐢 Lento</button></div>' +
        '<button class="btn rec" id="recBtn" data-t="rec">🎤 Tocca, di\' la parola, tocca ancora</button>' +
        '<div class="row2"><button class="btn soft hide" id="mineBtn" data-t="mine">▶️ Riascolta te</button><button class="btn soft' + (strict ? ' hide' : '') + '" id="skipBtn" data-t="skip">Salta ›</button></div>';
      drawAnalysis(body.querySelector('#cv'), targets, null);
    }
    function leave(ok) {
      var w = ws[i]; if (w.id) S.markWord(w.id, ok);
      if (ok) passed++;
      i++; show();
    }
    function feedback(res, w, ph) {
      var msg = body.querySelector('#tMsg'), chips = body.querySelector('#rChips'), skip = body.querySelector('#skipBtn');
      if (!res.speech) { noteFail(); msg.innerHTML = '<b style="color:#d9534f">Non ti ho sentito.</b> Avvicinati al microfono, parla un po\' più forte e riprova.'; chips.innerHTML = ''; return; }
      if (!res.ok) { noteFail(); msg.innerHTML = '<b style="color:#d9534f">Ho sentito poco.</b> Dì la parola con calma e a voce alta, poi tocca di nuovo.'; chips.innerHTML = ''; return; }
      drawAnalysis(body.querySelector('#cv'), targets, res);
      chips.innerHTML = res.syl.map(function (s) {
        var txt = !s.present ? 'non sentita' : s.ok ? (s.target === 5 ? 'ok' : s.target + '° tono ✓') : ('sembrava ' + s.detected + '°, serve ' + s.target + '°');
        return '<span class="rchip ' + (s.ok ? 'ok' : 'ko') + '"><b>' + esc(s.syl) + '</b> ' + txt + '</span>';
      }).join('');
      var sc = s0();
      sc.tones.best = Math.max(sc.tones.best, res.score); sc.tones.tries++; S.save();
      var bad = ph && ph.known && !ph.ok && ph.heard, why = '';
      if (bad) {
        why = ' Ho capito «' + esc(ph.heard) + '» (' + esc((ph.py || []).join(' ')) + ') invece di «' + esc(w.zh) + '».';
        var kinds = ph.syl.filter(function (x) { return !x.ini || !x.fin; });
        if (kinds.length) why += ' ' + (kinds.some(function (x) { return !x.ini; }) ? 'Cambia la consonante' : 'Cambia la vocale') + (kinds.some(function (x) { return !x.ini; }) && kinds.some(function (x) { return !x.fin; }) ? ' e la vocale' : '') + '.';
        if (ph.hints.length) why += ' <small>' + ph.hints.map(esc).join(' · ') + '</small>';
      }
      if (res.pass && !bad) {
        advancing = true;
        msg.innerHTML = '<b style="color:#2e9e5b">✓ Bravo! ' + res.score + '/100</b> — passo alla prossima!';
        timer = setTimeout(function () { leave(true); }, 1600);
      } else {
        if (strict) noteFail(); else fails++;
        var extra = res.found < res.expected ? ' Ho sentito ' + res.found + ' sillab' + (res.found === 1 ? 'a' : 'e') + ', ne servono ' + res.expected + '.' : '';
        msg.innerHTML = '<b style="color:#d9534f">' + res.score + '/100</b> — ' + (res.pass ? 'il tono va bene, ma i suoni no.' : 'guarda la linea tratteggiata.') + extra + why + (strict ? '<br><small>Riprova: ascolta di nuovo 🔊 e tocca 🎤.' + (fails >= skipAfter ? ' Se vuoi, puoi saltare.' : '') + '</small>' : '<br><small>Vado alla prossima… (tocca 🎤 per riprovare subito)</small>');
        if (!strict) { clearTimeout(timer); timer = setTimeout(function () { if (!advancing) leave(false); }, 4200); }
      }
    }
    function s0() { return S.get(); }
    body.onclick = function (e) {
      var t = e.target.closest('[data-t]'); if (!t || advancing) return; var a = t.dataset.t, w = ws[i];
      if (a !== 'skip') clearTimeout(timer); // se tocca qualcosa, non andiamo avanti da soli
      if (a === 'say') say(w.zh);
      else if (a === 'slow') say(w.zh, true);
      else if (a === 'skip') { if (rec) { rec.stop(); rec = null; } leave(false); }
      else if (a === 'mine') { if (mine && mine.url) A.playUrl(mine.url).catch(function () {}); }
      else if (a === 'rec') {
        if (busy) return;
        var btn = body.querySelector('#recBtn'), msg = body.querySelector('#tMsg');
        if (rec) {
          busy = true;
          rec.stop().then(function (r) {
            rec = null; busy = false; mine = r; btn.classList.remove('live'); btn.textContent = '🎤 Riprova';
            if (r.url) body.querySelector('#mineBtn').classList.remove('hide');
            var res = P.analyze(r.frames, targets);
            if (window.ASR && window.ASR.ready() && res.speech && res.ok) {
              msg.textContent = 'Controllo i suoni…'; busy = true;
              window.ASR.recognize(r.pcm, r.sampleRate, w).then(function (text) {
                busy = false; if (ws[i] !== w || advancing) return;
                feedback(res, w, window.Phon.compare(w, text));
              });
            } else feedback(res, w, null);
          });
        } else {
          A.stop();
          A.record().then(function (r) { rec = r; btn.classList.add('live'); btn.textContent = '⏹️ Ferma'; msg.textContent = 'Ti ascolto… di\' la parola e tocca ancora.'; })
            .catch(function (err) { msg.textContent = 'Microfono non disponibile: ' + err.message + ' Puoi saltare.'; var sb = body.querySelector('#skipBtn'); if (sb) sb.classList.remove('hide'); });
        }
      }
    };
    if (window.ASR) window.ASR.init();
    show();
  }

  window.Steps = { flash: flash, quiz: quiz, match: match, build: build, write: write, repeat: repeat, drawAnalysis: drawAnalysis };
})();
