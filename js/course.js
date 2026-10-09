/* Corso guidato: trasforma le specifiche di lessons.js in lezioni, frasi e dialoghi. */
(function () {
  var BYZH = window.WORDBYZH, ALL = window.ALLWORDS;
  var NAMES = { '龙龙': 'lóng long', '诺亚': 'nuò yà' };
  var CL = { '个': 1, '本': 1, '件': 1, '口': 1, '只': 1, '块': 1, '些': 1, '点': 1, '元': 1, '岁': 1 };
  var PUNCT = '，。？！';
  var errors = [];

  function toneOfSyl(s) {
    if (/[āēīōūǖ]/.test(s)) return 1; if (/[áéíóúǘ]/.test(s)) return 2;
    if (/[ǎěǐǒǔǚ]/.test(s)) return 3; if (/[àèìòùǜ]/.test(s)) return 4; return 5;
  }

  /* 'zh|py' oppure parola del vocabolario oppure nome. */
  function parseSent(str, it, where) {
    var toks = [];
    str.split(/\s+/).filter(Boolean).forEach(function (raw) {
      var after = '';
      while (raw.length && PUNCT.indexOf(raw[raw.length - 1]) >= 0) { after = raw[raw.length - 1] + after; raw = raw.slice(0, -1); }
      var zh = raw, py = null;
      if (raw.indexOf('|') > 0) { var a = raw.split('|'); zh = a[0]; py = a[1]; }
      var w = BYZH[zh];
      if (py === null) {
        if (w) py = w.py; else if (NAMES[zh]) py = NAMES[zh];
        else { errors.push(where + ': parola sconosciuta "' + zh + '" in "' + str + '"'); py = zh; }
      }
      toks.push({ zh: zh, py: py, after: after, word: w || null });
    });
    var last = toks[toks.length - 1], p = last.after || '。'; last.after = '';
    /* sandhi scritto: 不 davanti a quarto tono, 一 davanti a contatori */
    toks.forEach(function (t, i) {
      var nx = toks[i + 1]; if (!nx) return;
      var t1 = toneOfSyl(nx.py.split(' ')[0]);
      if (t.zh === '不' && t.py === 'bù' && t1 === 4) t.py = 'bú';
      if (t.zh === '一' && t.py === 'yī' && CL[nx.zh]) t.py = t1 === 4 ? 'yí' : 'yì';
    });
    return {
      tokens: toks, p: p, it: it,
      core: toks.map(function (t) { return t.zh; }).join(''),
      zh: toks.map(function (t) { return t.zh + t.after; }).join('')
    };
  }
  window.parseSentence = parseSent;

  var specs = window.LESSON_SPECS, FREE_LESSONS = 20;
  var LESSONS = specs.map(function (sp, i) {
    var n = i + 1, where = 'L' + n;
    var L = {
      n: n, id: 'c' + n, part: Math.floor(i / 10), e: sp.e, t: sp.t, boss: !!sp.boss, intro: sp.intro, tip: sp.tip,
      free: n <= FREE_LESSONS, w: sp.w
    };
    L.words = (sp.w || '').split(/\s+/).filter(Boolean).map(function (z) {
      var w = BYZH[z]; if (!w) { errors.push(where + ': parola non nel vocabolario "' + z + '"'); return null; }
      return w;
    }).filter(Boolean);
    L.s = (sp.s || []).map(function (a, k) { return parseSent(a[0], a[1], where + ' frase ' + (k + 1)); });
    L.scene = sp.scene ? { title: sp.scene.title, lines: sp.scene.lines.map(function (l, k) { return [l[0], parseSent(l[1], l[2], where + ' dialogo ' + (k + 1))]; }) } : null;
    return L;
  });

  /* parole insegnate in ogni lezione, gratuite/premium, controlli di copertura */
  var taught = {}, lessonOf = {};
  LESSONS.forEach(function (L, i) {
    L.words.forEach(function (w) {
      if (taught[w.id]) errors.push('L' + L.n + ': parola già insegnata: ' + w.zh);
      taught[w.id] = true; lessonOf[w.id] = i; w.free = L.free; w.lesson = L.n;
    });
  });
  var known = {};
  LESSONS.forEach(function (L, i) {
    L.words.forEach(function (w) { known[w.zh] = true; });
    var chk = function (s, label) {
      s.tokens.forEach(function (t) { if (t.word && !known[t.zh]) errors.push('L' + L.n + ' ' + label + ': "' + t.zh + '" non ancora insegnata'); });
    };
    L.s.forEach(function (s) { chk(s, 'frase'); });
    if (L.scene) L.scene.lines.forEach(function (l) { chk(l[1], 'dialogo'); });
  });
  ALL.forEach(function (w) { if (!taught[w.id]) errors.push('Parola mai insegnata: ' + w.zh); });

  /* gare di ripasso: parole e frasi di tutta la parte */
  LESSONS.forEach(function (L, i) {
    if (!L.boss) return;
    var from = L.part * 10, ws = [], ss = [];
    for (var j = from; j < i; j++) { ws = ws.concat(LESSONS[j].words); ss = ss.concat(LESSONS[j].s); }
    L.review = ws; L.pool = ss; L.s = ss.slice(0, 4);
  });


  /* Tutti i testi che l'app può pronunciare (per generare e scaricare i file audio).
     scope 'free' = solo lezioni e parole gratuite, 'full' = tutto. */
  window.audioTexts = function (scope) {
    var out = {}, free = scope === 'free';
    function add(t) { if (t) out[t] = 1; }
    ALL.forEach(function (w) { if (!free || w.free) add(w.zh); });
    LESSONS.forEach(function (L) {
      if (free && !L.free) return;
      L.s.forEach(function (s) { add(s.zh + s.p); });
      if (L.scene) L.scene.lines.forEach(function (l) { add(l[1].zh + l[1].p); });
    });
    Object.keys(NAMES).forEach(add);
    window.TONE_SETS.forEach(function (set) { set.items.forEach(function (it) { add(it.zh); }); });
    window.TONE_PAIRS.forEach(function (p) { add(p.a); add(p.b); });
    add('你好，我是龙龙');
    return Object.keys(out);
  };

  window.LESSONS = LESSONS;
  window.FREE_LESSONS = FREE_LESSONS;
  window.COURSE_ERRORS = errors;
  window.WORD_LESSON = lessonOf;
  if (errors.length && window.console) console.warn('Errori nel corso:\n' + errors.join('\n'));
})();
