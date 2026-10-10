/* "La mia voce": registra le parole con una voce madrelingua (la tua).
   Servono a tre cose: 1) ascoltarle al posto della voce sintetica (se attivi l'opzione),
   2) provare subito se il controllo dei toni e dei suoni ti riconosce, 3) esportarle per tarare l'app.
   Tutto resta sul telefono (IndexedDB) finché non premi "Esporta". */
(function () {
  var DB = 'longlong-voice', SR = 16000, mem = {}, urls = {}, byZh = {}, dbp = null, loaded = false;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('niente IndexedDB'));
      var q = indexedDB.open(DB, 1);
      q.onupgradeneeded = function () { q.result.createObjectStore('rec', { keyPath: 'id' }); };
      q.onsuccess = function () { res(q.result); }; q.onerror = function () { rej(q.error); };
    }).catch(function () { return null; });
    return dbp;
  }
  function tx(mode, fn) {
    return open().then(function (db) {
      if (!db) return fn(null);
      return new Promise(function (res, rej) { var t = db.transaction('rec', mode), r = fn(t.objectStore('rec')); t.oncomplete = function () { res(r && r.result !== undefined ? r.result : r); }; t.onerror = function () { rej(t.error); }; });
    });
  }
  function init() {
    if (loaded) return Promise.resolve(true);
    return tx('readonly', function (st) { return st ? st.getAll() : null; }).then(function (all) {
      (all || []).forEach(function (r) { mem[r.id] = r; });
      loaded = true; reindex(); return true;
    }).catch(function () { loaded = true; return false; });
  }
  function reindex() {
    byZh = {}; (window.VOCAB || []).forEach(function (w) { if (mem[w.id]) byZh[w.zh] = w.id; });
  }

  /* ---------- audio: 16 kHz, Int16, senza il silenzio ai bordi ---------- */
  function toInt16(pcm, sr) {
    var ratio = sr / SR, n = Math.floor(pcm.length / ratio), out = new Float32Array(n), i, j, a, b, s, c;
    for (i = 0; i < n; i++) { a = Math.floor(i * ratio); b = Math.min(pcm.length, Math.max(a + 1, Math.floor((i + 1) * ratio))); s = 0; c = 0; for (j = a; j < b; j++) { s += pcm[j]; c++; } out[i] = c ? s / c : 0; }
    var win = Math.round(SR * 0.02), peak = 0, e = [], k;
    for (i = 0; i + win <= n; i += win) { s = 0; for (k = 0; k < win; k++) s += out[i + k] * out[i + k]; e.push(Math.sqrt(s / win)); peak = Math.max(peak, e[e.length - 1]); }
    var thr = peak * 0.1, f = 0, l = e.length - 1;
    while (f < e.length && e[f] < thr) f++;
    while (l > f && e[l] < thr) l--;
    var pad = Math.round(0.15 * SR), from = Math.max(0, f * win - pad), to = Math.min(n, (l + 1) * win + pad);
    var res = new Int16Array(Math.max(0, to - from));
    for (i = 0; i < res.length; i++) { var v = Math.max(-1, Math.min(1, out[from + i])); res[i] = v < 0 ? v * 32768 : v * 32767; }
    return res;
  }
  function wavBlob(i16) {
    var n = i16.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), p = 0;
    function s(t) { for (var k = 0; k < t.length; k++) v.setUint8(p++, t.charCodeAt(k)); }
    s('RIFF'); v.setUint32(p, 36 + n * 2, true); p += 4; s('WAVEfmt '); v.setUint32(p, 16, true); p += 4; v.setUint16(p, 1, true); p += 2; v.setUint16(p, 1, true); p += 2;
    v.setUint32(p, SR, true); p += 4; v.setUint32(p, SR * 2, true); p += 4; v.setUint16(p, 2, true); p += 2; v.setUint16(p, 16, true); p += 2; s('data'); v.setUint32(p, n * 2, true); p += 4;
    for (var i = 0; i < n; i++) { v.setInt16(p, i16[i], true); p += 2; }
    return new Blob([buf], { type: 'audio/wav' });
  }
  function b64(i16) { var u = new Uint8Array(i16.buffer, i16.byteOffset, i16.byteLength), s = '', k; for (k = 0; k < u.length; k += 0x8000) s += String.fromCharCode.apply(null, u.subarray(k, k + 0x8000)); return btoa(s); }
  function unb64(t) { var s = atob(t), u = new Uint8Array(s.length), k; for (k = 0; k < s.length; k++) u[k] = s.charCodeAt(k); return new Int16Array(u.buffer); }

  /* ---------- archivio ---------- */
  function save(w, i16, info) {
    var rec = { id: w.id, zh: w.zh, py: w.py, sr: SR, pcm: i16.buffer.slice(i16.byteOffset, i16.byteOffset + i16.byteLength), info: info || null, ts: Date.now() };
    mem[w.id] = rec; if (urls[w.id]) { URL.revokeObjectURL(urls[w.id]); delete urls[w.id]; } reindex();
    return tx('readwrite', function (st) { return st ? st.put(rec) : null; }).catch(function () {});
  }
  function remove(id) { delete mem[id]; if (urls[id]) { URL.revokeObjectURL(urls[id]); delete urls[id]; } reindex(); return tx('readwrite', function (st) { return st ? st.delete(id) : null; }).catch(function () {}); }
  function urlOf(id) { if (!mem[id]) return null; if (!urls[id]) urls[id] = URL.createObjectURL(wavBlob(new Int16Array(mem[id].pcm))); return urls[id]; }
  function enabled() { try { return !!window.Store.get().profile.useMyVoice; } catch (e) { return false; } }
  /* usato da AudioKit.speak: indirizzo del file della mia voce per questo testo (solo parole intere) */
  function url(text) { return enabled() && byZh[text] ? urlOf(byZh[text]) : null; }
  function count() { return Object.keys(mem).length; }

  function exportAll(who) {
    var items = Object.keys(mem).map(function (id) { var r = mem[id]; return { id: r.id, zh: r.zh, py: r.py, pcm: b64(new Int16Array(r.pcm)), info: r.info }; });
    return new Blob([JSON.stringify({ app: 'longlong', kind: 'voice', who: who || '', sr: SR, format: 'int16-le-base64', date: new Date().toISOString(), items: items })], { type: 'application/json' });
  }
  function importText(txt) {
    var d = JSON.parse(txt); if (!d || d.kind !== 'voice' || !d.items) throw new Error('Questo file non è una registrazione di LongLong.');
    var byId = {}; (window.VOCAB || []).forEach(function (w) { byId[w.id] = w; });
    var ps = d.items.filter(function (it) { return byId[it.id]; }).map(function (it) { return save(byId[it.id], unb64(it.pcm), it.info); });
    return Promise.all(ps).then(function () { return ps.length; });
  }

  /* ---------- schermata di registrazione ---------- */
  function studio(body, opt) {
    opt = opt || {};
    var A = window.AudioKit, P = window.Pitch, W = window.VOCAB || [], i = 0, rec = null, busy = false, timer = null, targets = null;
    function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
    function firstTodo() { for (var k = 0; k < W.length; k++) if (!mem[W[k].id]) return k; return 0; }
    function render() {
      var w = W[i], has = !!mem[w.id];
      body.innerHTML = '<div class="vs"><p class="lead">Registrate: <b>' + count() + ' / ' + W.length + '</b>. Parla con voce naturale, vicino al microfono, in un posto silenzioso.</p>' +
        '<div class="vs-word"><div class="vs-zh">' + esc(w.zh) + '</div><div class="vs-py">' + esc(w.py) + '</div><div class="vs-it">' + esc(w.it) + (has ? ' · ✓ registrata' : '') + '</div></div>' +
        '<button class="btn primary" data-v="rec" id="vsRec">🎤 Registra</button>' +
        '<div class="vs-msg" id="vsMsg">Tocca “Registra”, di\' la parola e tocca “Ferma”.</div>' +
        '<div class="vs-row"><button class="btn soft" data-v="prev">‹ Indietro</button><button class="btn soft" data-v="next">Avanti ›</button></div>' +
        '<div class="vs-row"><button class="btn soft" data-v="mine"' + (has ? '' : ' disabled') + '>▶ La mia</button><button class="btn soft" data-v="app">🔊 Voce app</button></div>' +
        '<h3 class="sec">File</h3><div class="vs-row"><button class="btn soft" data-v="export">📤 Esporta</button><button class="btn soft" data-v="import">📥 Importa</button></div>' +
        '<input type="file" id="vsFile" accept="application/json,.json" hidden>' +
        '<button class="btn soft" data-v="close">Chiudi</button></div>';
      var f = body.querySelector('#vsFile');
      f.onchange = function () {
        var file = f.files && f.files[0]; if (!file) return; var fr = new FileReader();
        fr.onload = function () { importText(String(fr.result)).then(function (n) { say('Importate ' + n + ' registrazioni.'); render(); }).catch(function (e) { say('⚠️ ' + e.message); }); };
        fr.readAsText(file); f.value = '';
      };
    }
    function say(t) { var m = body.querySelector('#vsMsg'); if (m) m.innerHTML = t; }
    function go(d) { clearTimeout(timer); i = (i + d + W.length) % W.length; render(); }
    function finish(r) {
      var w = W[i], res = null;
      try { targets = P.targetTones(w.py); res = P.analyze(r.frames, targets); } catch (e) { res = null; }
      var i16 = toInt16(r.pcm, r.sampleRate);
      if (i16.length < SR * 0.25 || (res && !res.speech)) { say('<b style="color:#d9534f">Non ti ho sentito.</b> Avvicinati e riprova.'); return; }
      var info = res ? { score: res.score, pass: !!res.pass, found: res.found, expected: res.expected } : {};
      function store(heard) {
        if (heard !== undefined) { info.heard = heard; }
        save(w, i16, info).then(function () {
          var okTone = res && res.pass, line = '<b style="color:#2e9e5b">✓ Salvata.</b> Toni: ' + (res ? (okTone ? 'riconosciuti ✓' : '<span style="color:#d9534f">non riconosciuti (' + res.score + '/100)</span>') : '—');
          if (heard !== undefined) {
            var cmp = window.Phon ? window.Phon.compare(w, heard) : null;
            line += ' · Suoni: ' + (cmp && cmp.ok ? 'riconosciuti ✓' : '<span style="color:#d9534f">capito «' + esc(heard || '…') + '»</span>');
            info.soundOk = !!(cmp && cmp.ok);
          }
          say(line); var h = body.querySelector('.vs-it'); if (h) h.textContent = w.it + ' · ✓ registrata';
          var mb = body.querySelector('[data-v="mine"]'); if (mb) mb.disabled = false;
          clearTimeout(timer); timer = setTimeout(function () { go(1); }, 1800);
        });
      }
      if (window.ASR && window.ASR.ready()) { say('Controllo i suoni…'); window.ASR.recognize(r.pcm, r.sampleRate, w).then(function (t) { store(t || ''); }, function () { store(); }); } else store();
    }
    body.onclick = function (e) {
      var b = e.target.closest('[data-v]'); if (!b || b.disabled) return; var a = b.dataset.v, w = W[i];
      if (a !== 'rec') clearTimeout(timer);
      if (a === 'close') { if (opt.close) opt.close(); }
      else if (a === 'prev') go(-1); else if (a === 'next') go(1);
      else if (a === 'app') A.speak(w.zh, { gender: 'FEMALE', slow: false, noMine: true });
      else if (a === 'mine') { var u = urlOf(w.id); if (u) A.playUrl(u).catch(function () {}); }
      else if (a === 'export') {
        var blob = exportAll(opt.who), l = document.createElement('a');
        l.href = URL.createObjectURL(blob); l.download = 'mia-voce-longlong-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(l); l.click(); l.remove();
        setTimeout(function () { URL.revokeObjectURL(l.href); }, 4000); say('📤 File scaricato (' + count() + ' parole).');
      } else if (a === 'import') body.querySelector('#vsFile').click();
      else if (a === 'rec') {
        if (busy) return; clearTimeout(timer);
        if (rec) { busy = true; rec.stop().then(function (r) { rec = null; busy = false; b.classList.remove('live'); b.textContent = '🎤 Registra di nuovo'; finish(r); }); }
        else { A.stop(); A.record().then(function (r) { rec = r; b.classList.add('live'); b.textContent = '⏹️ Ferma'; say('Ti ascolto… di\' la parola e tocca “Ferma”.'); }).catch(function (er) { say('Microfono non disponibile: ' + esc(er.message)); }); }
      }
    };
    if (window.ASR) window.ASR.init();
    return init().then(function () { i = firstTodo(); render(); return function cleanup() { clearTimeout(timer); if (rec) { try { rec.stop(); } catch (e) { /* ignora */ } rec = null; } }; });
  }

  window.Voice = { init: init, studio: studio, url: url, count: count, enabled: enabled, has: function (zh) { return !!byZh[zh]; }, importText: importText, remove: remove };
})();
