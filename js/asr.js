/* Riconoscimento dei suoni (consonanti e vocali), tutto sul dispositivo, senza rete.
   Usa Vosk (lib/vosk.js) con il modello cinese piccolo in models/vosk-cn.tar.gz.
   Se il modello non c'è, l'app continua a controllare solo i toni. Non rompe mai nulla.
   Nell'app per iPhone usa invece il riconoscitore di Apple (plugin longlong-speech): è più preciso, non scarica nessun modello
   e non occupa memoria nella pagina. Vosk resta come riserva se Apple non è disponibile. */
(function () {
  var MODEL_URL = 'models/vosk-cn.tar.gz', LIB_URL = 'lib/vosk.js';
  var state = 'idle', model = null, waiting = null, lastError = '', engine = 'vosk';

  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (window.Vosk) return res();
      var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('lib/vosk.js non trovato')); };
      document.head.appendChild(s);
    });
  }

  function apple() { var C = window.Capacitor; return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.LongLongSpeech || null; }
  function toB64(f32) { var u = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength), s = '', k; for (k = 0; k < u.length; k += 0x8000) s += String.fromCharCode.apply(null, u.subarray(k, k + 0x8000)); return btoa(s); }
  var DIG = '零一二三四五六七八九';
  function cleanApple(t) {
    t = (t || '').replace(/[\s，。！？、,.!?「」“”"']/g, '');
    return /^[0-9]$/.test(t) ? DIG.charAt(+t) : t;
  }
  function initApple(P) {
    return P.requestPermissions().then(function (p) { if (!p || !p.speech) throw new Error('permesso negato'); return P.isAvailable({ locale: 'zh-CN' }); })
      .then(function (a) { if (!a || !a.available) throw new Error('Apple non disponibile'); if (!a.onDevice) throw new Error('Apple non può riconoscere sul telefono: non invio la voce di un bambino a server esterni'); engine = 'apple'; state = 'ready'; return true; });
  }

  /* Carica il modello (una volta sola). Promise<bool>: true se il riconoscimento è pronto. */
  function init() {
    if (waiting) return waiting;
    state = 'loading';
    var P = apple();
    waiting = (P ? initApple(P).catch(function (e) { lastError = e && e.message ? e.message : String(e); return false; }) : Promise.resolve(false)).then(function (ok) { return ok ? true : initVosk(); });
    return waiting;
  }
  function initVosk() {
    return fetch(MODEL_URL, { headers: { Range: 'bytes=0-0' } }).then(function (r) { if (!r.ok) throw new Error('modello assente'); return loadScript(LIB_URL); })
      .then(function () { return window.Vosk.createModel(MODEL_URL); })
      .then(function (m) { model = m; engine = 'vosk'; state = 'ready'; return true; })
      .catch(function (e) { state = 'off'; lastError = e && e.message ? e.message : String(e); return false; });
  }

  function grammarFor(w) {
    var list = [w.zh].concat(window.Phon ? window.Phon.confusables(w, 8) : []);
    return JSON.stringify(list.map(function (z) { return Array.from(z).join(' '); }).concat(['[unk]']));
  }

  /* pcm: Float32Array registrato a sampleRate; w: parola attesa. Promise<string|null> (testo capito, senza spazi) */
  function recognize(pcm, sampleRate, w) {
    if (state !== 'ready' || !pcm || !pcm.length) return Promise.resolve(null);
    if (engine === 'apple') {
      return apple().recognize({ audio: toB64(pcm), sampleRate: sampleRate, locale: 'zh-CN' })
        .then(function (r) { return cleanApple(r && r.text); })
        .catch(function (e) { lastError = e && e.message ? e.message : String(e); return null; });
    }
    if (!model) return Promise.resolve(null);
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

  window.ASR = { init: init, recognize: recognize, state: function () { return state; }, ready: function () { return state === 'ready'; }, engine: function () { return engine; }, error: function () { return lastError; } };
})();
