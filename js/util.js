/* Funzioni comuni a schermate e attività. */
(function () {
  var TONES = window.TONES, S = window.Store, A = window.AudioKit;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function $(s, r) { return (r || document).querySelector(s); }

  function toneOf(syl) {
    if (/[āēīōūǖ]/.test(syl)) return 1;
    if (/[áéíóúǘ]/.test(syl)) return 2;
    if (/[ǎěǐǒǔǚ]/.test(syl)) return 3;
    if (/[àèìòùǜ]/.test(syl)) return 4;
    return 5;
  }
  function toneColor(n) { return TONES[n - 1].color; }

  /* w = {zh, py}: ogni carattere prende il colore del proprio tono */
  function zhHtml(w) {
    var sy = w.py.split(' '), chars = Array.from(w.zh);
    return chars.map(function (c, i) { return '<span style="color:' + toneColor(toneOf(sy[i] || '')) + '">' + esc(c) + '</span>'; }).join('');
  }
  function pyHtml(w) {
    return w.py.split(' ').map(function (s) { return '<span style="color:' + toneColor(toneOf(s)) + '">' + esc(s) + '</span>'; }).join(' ');
  }
  /* Una parola di frase: pinyin sopra, caratteri sotto */
  function tokHtml(t) { return '<span class="tk"><small>' + pyHtml(t) + '</small><b>' + zhHtml(t) + '</b></span>'; }
  function sentHtml(s) {
    return '<span class="sent">' + s.tokens.map(function (t) {
      return tokHtml(t) + (t.after ? '<span class="pu">' + esc(t.after) + '</span>' : '');
    }).join('') + '<span class="pu">' + esc(s.p) + '</span></span>';
  }

  /* Parole di una sola sillaba con tono 1-4 (per gli esercizi sui toni); se un tono manca si usano le sillabe di allenamento */
  function toneItems(list) {
    var out = [];
    (list || []).forEach(function (w) {
      var sy = w.py.split(' ');
      if (Array.from(w.zh).length === 1 && sy.length === 1) { var t = toneOf(sy[0]); if (t < 5) out.push({ zh: w.zh, py: w.py, t: t, it: w.it, id: w.id }); }
    });
    [1, 2, 3, 4].forEach(function (t) {
      if (!out.some(function (x) { return x.t === t; })) window.TONE_SETS.forEach(function (set) { set.items.forEach(function (it) { if (it.t === t) out.push(it); }); });
    });
    return out;
  }

  function toneSvg(n) {
    var paths = { 1: 'M6 10 L54 10', 2: 'M6 30 L54 8', 3: 'M6 14 Q22 38 32 32 T54 8', 4: 'M6 8 L54 32' };
    return '<path d="' + paths[n] + '" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>';
  }
  function stars(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }

  var audioWarned = false;
  function say(text, slow) {
    return A.speak(text, { gender: S.get().profile.voice, slow: slow }).then(function (eng) {
      if (eng === 'none') toast('Audio non disponibile: ' + A.getError());
      else if (eng === 'browser' && !audioWarned) { audioWarned = true; toast('Uso la voce del browser (Azure: ' + (A.getError() || 'non raggiungibile') + ')'); }
      return eng;
    });
  }
  function sayAll(list, i) {
    i = i || 0; if (i >= list.length) return Promise.resolve();
    return say(list[i]).then(function () { return new Promise(function (r) { setTimeout(r, 175); }); }).then(function () { return sayAll(list, i + 1); });
  }

  /* Salva/esporta un file. Nell'app (iPhone/Android) e dal telefono apre il foglio di condivisione ("Salva su File", AirDrop, WhatsApp, e-mail…):
     il classico <a download> non funziona dentro l'app. Su PC scarica il file. Ritorna una Promise: 'shared' | 'saved' | 'cancel'. */
  function saveFile(blob, name) {
    var C = window.Capacitor, native = !!(C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.Filesystem && C.Plugins.Share);
    if (native) {
      return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(String(fr.result).split(',')[1] || ''); }; fr.onerror = function () { rej(fr.error); }; fr.readAsDataURL(blob); })
        .then(function (b64) { return C.Plugins.Filesystem.writeFile({ path: name, directory: 'CACHE', data: b64 }); })
        .then(function (r) { return C.Plugins.Share.share({ title: name, dialogTitle: 'Salva o invia il file', files: [r.uri] }); })
        .then(function () { return 'shared'; })
        .catch(function (e) { if (e && /cancel|dismiss/i.test(String(e.message || e))) return 'cancel'; throw e; });
    }
    try {
      var f = new File([blob], name, { type: blob.type || 'application/octet-stream' });
      if (navigator.canShare && navigator.canShare({ files: [f] }) && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) {
        return navigator.share({ files: [f], title: name }).then(function () { return 'shared'; }).catch(function (e) { if (e && e.name === 'AbortError') return 'cancel'; return anchor(); });
      }
    } catch (e) { /* ripiega sul download */ }
    return Promise.resolve(anchor());
    function anchor() {
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); return 'saved';
    }
  }

  window.Util = { saveFile: saveFile, esc: esc, shuffle: shuffle, pick: pick, $: $, toneOf: toneOf, toneColor: toneColor, zhHtml: zhHtml, pyHtml: pyHtml,
    tokHtml: tokHtml, sentHtml: sentHtml, toneItems: toneItems, toneSvg: toneSvg, stars: stars, toast: toast, say: say, sayAll: sayAll };
})();
