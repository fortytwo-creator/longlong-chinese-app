/* Riconoscimento dei suoni (consonanti e vocali), tutto sul dispositivo, senza rete.
   Usa Vosk (lib/vosk.js) con il modello cinese piccolo in models/vosk-cn.tar.gz.
   Se il modello non c'è, l'app continua a controllare solo i toni. Non rompe mai nulla. */
(function () {
  var MODEL_URL = 'models/vosk-cn.tar.gz', LIB_URL = 'lib/vosk.js';
  var state = 'idle', model = null, waiting = null, lastError = '';

  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (window.Vosk) return res();
      var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('lib/vosk.js non trovato')); };
      document.head.appendChild(s);
    });
  }

  /* Carica il modello (una volta sola). Promise<bool>: true se il riconoscimento è pronto. */
  function init() {
    if (waiting) return waiting;
    state = 'loading';
    waiting = fetch(MODEL_URL, { headers: { Range: 'bytes=0-0' } }).then(function (r) { if (!r.ok) throw new Error('modello assente'); return loadScript(LIB_URL); })
      .then(function () { return window.Vosk.createModel(MODEL_URL); })
      .then(function (m) { model = m; state = 'ready'; return true; })
      .catch(function (e) { state = 'off'; lastError = e && e.message ? e.message : String(e); return false; });
    return waiting;
  }

  function grammarFor(w) {
    var list = [w.zh].concat(window.Phon ? window.Phon.confusables(w, 8) : []);
    return JSON.stringify(list.map(function (z) { return Array.from(z).join(' '); }).concat(['[unk]']));
  }

  /* pcm: Float32Array registrato a sampleRate; w: parola attesa. Promise<string|null> (testo capito, senza spazi) */
  function recognize(pcm, sampleRate, w) {
    if (state !== 'ready' || !model || !pcm || !pcm.length) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var rec, done = false, text = '';
      function finish() { if (done) return; done = true; try { rec.remove(); } catch (e) { /* ignora */ } resolve(text ? text.replace(/\s+/g, '').replace(/\[unk\]/g, '') : ''); }
      try {
        rec = new model.KaldiRecognizer(sampleRate, grammarFor(w));
        rec.on('result', function (m) { text += (m && m.result && m.result.text) || ''; finish(); });
        var tail = new Float32Array(Math.round(sampleRate * 0.4)); // un po' di silenzio in fondo, così il riconoscitore chiude la frase
        var all = new Float32Array(pcm.length + tail.length); all.set(pcm); all.set(tail, pcm.length);
        rec.acceptWaveformFloat(all, sampleRate);
        rec.retrieveFinalResult();
        setTimeout(finish, 8000);
      } catch (e) { lastError = e && e.message ? e.message : String(e); resolve(null); }
    });
  }

  window.ASR = { init: init, recognize: recognize, state: function () { return state; }, ready: function () { return state === 'ready'; }, error: function () { return lastError; } };
})();
