/* Suoni del pinyin: iniziale + finale. Serve a confrontare la parola attesa con quella che il riconoscitore
   vocale ha capito, e a dire a Noah se ha sbagliato la consonante o la vocale.
   Non ascolta l'audio: lavora solo sul testo. */
(function () {
  var INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];
  var MARKS = {
    'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a', 'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e', 'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
    'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o', 'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u', 'ǖ': 'ü', 'ǘ': 'ü', 'ǚ': 'ü', 'ǜ': 'ü'
  };
  var HINT_I = {
    zh: 'zh: lingua un po\' arrotolata indietro, come "g" di "gente" ma più dura',
    ch: 'ch: come zh ma con un soffio forte',
    sh: 'sh: come "sc" di "scena", lingua un po\' indietro',
    z: 'z: come "dz" di "zero", senza soffio',
    c: 'c: come "ts" di "zio", con un soffio forte',
    s: 's: una "s" normale',
    x: 'x: tra "s" e "sc", sorridi e lingua dietro i denti bassi',
    q: 'q: come "c" di "ciao" ma con un soffio forte',
    j: 'j: come "g" di "gita", sorridi',
    r: 'r: un po\' come "j" francese, lingua indietro',
    n: 'n e l sono diversi: n tocca il palato col naso, l con la lingua sui lati',
    l: 'n e l sono diversi: n tocca il palato col naso, l con la lingua sui lati'
  };
  var HINT_F = {
    'ü': 'ü: labbra a "u" ma dì "i"',
    'üe': 'üe: labbra a "u" e poi "e"',
    'uo': 'uo: "u" veloce e poi "o"',
    'ou': 'ou: "o" poi "u"',
    'ui': 'ui: si legge "uei"',
    'iu': 'iu: si legge "iou"',
    'an': 'an finisce con la "n" (lingua su)',
    'ang': 'ang finisce con la "ng" (lingua giù, in gola)',
    'en': 'en finisce con la "n" (lingua su)',
    'eng': 'eng finisce con la "ng" (lingua giù, in gola)',
    'in': 'in finisce con la "n" (lingua su)',
    'ing': 'ing finisce con la "ng" (lingua giù, in gola)',
    'e': 'e: come una "o" ma con le labbra aperte, in gola',
    'i': 'i dopo zh, ch, sh, r, z, c, s è una vocale "ronzante", non una vera "i"'
  };

  function baseOf(syl) { return syl.replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/g, function (c) { return MARKS[c]; }).replace(/v/g, 'ü'); }

  /* "shēng" -> {i:'sh', f:'eng'}  ('yi'/'wu'/'yu' -> i/u/ü come nel pinyin standard) */
  function split(syl) {
    var b = baseOf(syl.toLowerCase()), ini = '', fin = b, i;
    for (i = 0; i < INITIALS.length; i++) if (b.indexOf(INITIALS[i]) === 0 && b.length > INITIALS[i].length) { ini = INITIALS[i]; fin = b.slice(ini.length); break; }
    if (ini === 'y') { ini = ''; fin = /^(u|ue|uan|un)$/.test(fin) ? fin.replace(/^u/, 'ü') : (/^i/.test(fin) ? fin : 'i' + fin); if (fin === 'ii') fin = 'i'; if (fin === 'iou') fin = 'iu'; }
    else if (ini === 'w') { ini = ''; fin = /^u/.test(fin) ? fin : 'u' + fin; if (fin === 'uuo' || fin === 'uo') fin = 'uo'; }
    else if (/^[jqx]$/.test(ini)) fin = fin.replace(/^u/, 'ü');
    else if (/^[nl]$/.test(ini) && /^ue$/.test(fin)) fin = 'üe';
    fin = fin.replace(/^uei$/, 'ui').replace(/^iou$/, 'iu').replace(/^uen$/, 'un');
    return { i: ini, f: fin, b: b };
  }

  /* ---------- carattere -> pinyin (dal vocabolario) ---------- */
  var CHAR = {}, WORD = {};
  (window.VOCAB || []).forEach(function (w) {
    var sy = w.py.split(/\s+/).filter(function (s) { return s && s !== 'r'; }), ch = Array.from(w.zh).filter(function (c) { return c !== '儿' || sy.length === Array.from(w.zh).length; });
    WORD[w.zh] = sy;
    if (sy.length === ch.length) ch.forEach(function (c, k) { if (!CHAR[c]) CHAR[c] = sy[k]; });
  });
  function pinyinOf(text) {
    if (WORD[text]) return WORD[text];
    var out = [], ok = true;
    Array.from(text).forEach(function (c) { if (CHAR[c]) out.push(CHAR[c]); else ok = false; });
    return ok ? out : null;
  }
  function clean(t) { return (t || '').replace(/[\s，。！？、,.!?「」“”"'\[\]()（）]/g, '').replace(/\bunk\b/g, ''); }

  function sameSound(a, b) { var x = split(a), y = split(b); return x.i === y.i && x.f === y.f; }

  /* Confronto: expected = parola del vocabolario, heard = testo capito dal riconoscitore.
     Restituisce { known, ok, heard, py, syl:[{exp,got,ini,fin}], hints:[] }  (ok = suoni giusti, toni esclusi) */
  function compare(w, heardText) {
    var heard = clean(heardText), exp = WORD[w.zh] || w.py.split(/\s+/).filter(function (s) { return s && s !== 'r'; });
    var res = { known: false, ok: false, heard: heard, py: null, syl: [], hints: [] };
    if (!heard) return res;
    var got = pinyinOf(heard);
    res.py = got;
    if (!got) { res.known = false; return res; }
    res.known = true;
    if (heard === w.zh || got.length === exp.length && got.every(function (g, k) { return sameSound(g, exp[k]); })) { res.ok = true; }
    if (got.length === exp.length) {
      exp.forEach(function (e, k) {
        var a = split(e), b = split(got[k]), s = { exp: e, got: got[k], ini: a.i === b.i, fin: a.f === b.f };
        res.syl.push(s);
        if (!s.ini && HINT_I[a.i || '']) res.hints.push(HINT_I[a.i]);
        if (!s.fin && HINT_F[a.f]) res.hints.push(HINT_F[a.f]);
      });
    }
    res.hints = res.hints.filter(function (h, k, arr) { return arr.indexOf(h) === k; }).slice(0, 2);
    return res;
  }

  /* parole simili (stesso numero di sillabe, una sola sillaba diversa in iniziale o finale): per la grammatica ristretta del riconoscitore */
  var SWAP_I = { zh: 'z', z: 'zh', ch: 'c', c: 'ch', sh: 's', s: 'sh', n: 'l', l: 'n', j: 'x', x: 'j', q: 'x', b: 'p', p: 'b', d: 't', t: 'd', g: 'k', k: 'g' };
  function confusables(w, limit) {
    var exp = WORD[w.zh]; if (!exp) return [];
    var E = exp.map(split), out = [];
    (window.VOCAB || []).forEach(function (v) {
      if (v.zh === w.zh) return;
      var s = WORD[v.zh]; if (!s || s.length !== exp.length) return;
      var diff = 0, near = true;
      s.forEach(function (x, k) {
        var y = split(x), a = E[k];
        if (y.i !== a.i || y.f !== a.f) { diff++; if (!(y.i === a.i || y.f === a.f || SWAP_I[a.i] === y.i)) near = false; }
      });
      if (diff === 1 && near) {
        var close = s.some(function (x, k) { var y = split(x), a = E[k]; return (y.i !== a.i && SWAP_I[a.i] === y.i && y.f === a.f) || (y.i === a.i && y.b !== a.b && y.f.replace(/g$/, '') === a.f.replace(/g$/, '')); });
        out.push({ z: v.zh, r: close ? 0 : 1 });
      }
    });
    out.sort(function (a, b) { return a.r - b.r; });
    return out.map(function (o) { return o.z; }).slice(0, limit || 8);
  }

  window.Phon = { split: split, baseOf: baseOf, pinyinOf: pinyinOf, compare: compare, confusables: confusables, sameSound: sameSound };
})();
