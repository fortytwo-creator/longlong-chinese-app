/* Voce (file locali, poi Azure, poi voce del browser) e registrazione del microfono. */
(function () {
  var cache = {};
  var current = null;
  var lastError = '';
  var manifest = null;          // { FEMALE: {testo: 'f/abc.mp3'}, MALE: {...} }
  var AUDIO_DIR = 'audio/';

  function esc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function stopAll() {
    if (current) { try { current.pause(); } catch (e) { /* ignora */ } current = null; }
    if ('speechSynthesis' in window) try { speechSynthesis.cancel(); } catch (e) { /* ignora */ }
  }

  function playUrl(url, rate) {
    return new Promise(function (resolve, reject) {
      var a = new Audio(url);
      current = a;
      if (rate && rate !== 1) { a.playbackRate = rate; if ('preservesPitch' in a) a.preservesPitch = true; if ('webkitPreservesPitch' in a) a.webkitPreservesPitch = true; }
      a.onended = function () { resolve(true); };
      a.onerror = function () { reject(new Error('audio non riproducibile')); };
      var p = a.play();
      if (p && p.catch) p.catch(reject);
    });
  }

  /* ---------- file audio scaricati (offline) ---------- */
  var bundled = {};             // percorsi dei file che stanno dentro il pacchetto dell'app
  function loadManifest() {
    return fetch(AUDIO_DIR + 'manifest.json').then(function (r) { if (!r.ok) throw new Error('nessun manifest'); return r.json(); })
      .then(function (m) {
        manifest = m; bundled = {};
        ['FEMALE', 'MALE'].forEach(function (g) { Object.keys(m[g] || {}).forEach(function (t) { bundled[m[g][t]] = 1; }); });
        // pacchetto a pagamento già scaricato: il suo manifest è salvato nella cache sotto audio/manifest-premium.json
        return (window.NativeFS && NativeFS.active() ? NativeFS.init().then(function () { return NativeFS.readPremiumManifest(); }) : Promise.resolve(null))
          .then(function (nm) { return nm || fetch(AUDIO_DIR + 'manifest-premium.json').then(function (r) { return r.ok ? r.json() : null; }); }).then(addManifest).catch(function () {}).then(function () { return manifest; });
      }).catch(function () { manifest = null; return null; });
  }
  function addManifest(m) {
    if (!m || !manifest) return;
    ['FEMALE', 'MALE'].forEach(function (g) { manifest[g] = Object.assign({}, m[g] || {}, manifest[g] || {}); });
  }
  function localUrl(text, gender) {
    var v = manifest && manifest[gender === 'MALE' ? 'MALE' : 'FEMALE'];
    if (!v || !v[text]) return null;
    return (window.NativeFS && NativeFS.url(v[text])) || AUDIO_DIR + v[text];
  }

  /* ---------- Azure (facoltativo: serve solo se non ci sono i file locali) ---------- */
  function azure(text, rate, gender) {
    var C = window.CONFIG || {};
    if (!C.azureKey) return Promise.reject(new Error('nessun file audio e chiave Azure mancante'));
    var key = text + '|' + rate + '|' + gender;
    if (cache[key]) return Promise.resolve(cache[key]);
    var voice = gender === 'MALE' ? 'zh-CN-YunxiNeural' : 'zh-CN-XiaoxiaoNeural';
    var ssml = "<speak version='1.0' xml:lang='zh-CN'><voice name='" + voice + "'><prosody rate='" +
      rate + "'>" + esc(text) + '</prosody></voice></speak>';
    return fetch('https://' + C.azureRegion + '.tts.speech.microsoft.com/cognitiveservices/v1', {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': C.azureKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3'
      },
      body: ssml
    }).then(function (r) {
      if (!r.ok) throw new Error('Azure HTTP ' + r.status);
      return r.blob();
    }).then(function (b) { var url = URL.createObjectURL(b); cache[key] = url; return url; });
  }

  function browserVoice(text, rate) {
    return new Promise(function (resolve, reject) {
      if (!('speechSynthesis' in window)) return reject(new Error('sintesi vocale non disponibile'));
      var voices = speechSynthesis.getVoices();
      var v = voices.filter(function (x) { return /zh[-_]CN|cmn/i.test(x.lang); })[0] ||
        voices.filter(function (x) { return /^zh/i.test(x.lang); })[0];
      if (!v && voices.length) return reject(new Error('nessuna voce cinese installata nel browser'));
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN'; u.rate = rate < 0.8 ? 0.6 : 0.8;
      if (v) u.voice = v;
      u.onend = function () { resolve(true); };
      u.onerror = function () { reject(new Error('errore sintesi vocale')); };
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
      setTimeout(function () { resolve(true); }, 7000);
    });
  }

  /* speak -> Promise<'local'|'azure'|'browser'|'none'>; non va mai in errore */
  function speak(text, opts) {
    opts = opts || {};
    var gender = opts.gender || 'FEMALE', slow = !!opts.slow;
    var rate = slow ? '0.7' : '0.9';
    stopAll();
    var lu = (!opts.noMine && window.Voice && window.Voice.url(text)) || localUrl(text, gender);
    var chain = lu ? playUrl(lu, slow ? 0.72 : 1).then(function () { lastError = ''; return 'local'; })
      : Promise.reject(new Error('file audio non presente'));
    return chain.catch(function (e0) {
      return azure(text, rate, gender).then(function (url) {
        return playUrl(url).then(function () { lastError = ''; return 'azure'; });
      }).catch(function (err) {
        lastError = (lu ? e0.message + ' / ' : '') + (err && err.message ? err.message : String(err));
        return browserVoice(text, rate).then(function () { return 'browser'; })
          .catch(function (e2) { lastError += ' / ' + (e2 && e2.message ? e2.message : e2); return 'none'; });
      });
    });
  }

  /* ---------- microfono nativo (app per iPhone, plugin longlong-speech): campioni grezzi, senza filtri del browser ---------- */
  function nativeMic() { var C = window.Capacitor; return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.LongLongSpeech || null; }
  function f32FromB64(t) { var s = atob(t), u = new Uint8Array(s.length), k; for (k = 0; k < s.length; k++) u[k] = s.charCodeAt(k); return new Float32Array(u.buffer, 0, Math.floor(u.length / 4)); }
  function wavUrl(pcm, sr) {
    var n = pcm.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), p = 0, i;
    function w(t) { for (var k = 0; k < t.length; k++) v.setUint8(p++, t.charCodeAt(k)); }
    w('RIFF'); v.setUint32(p, 36 + n * 2, true); p += 4; w('WAVEfmt '); v.setUint32(p, 16, true); p += 4; v.setUint16(p, 1, true); p += 2; v.setUint16(p, 1, true); p += 2;
    v.setUint32(p, sr, true); p += 4; v.setUint32(p, sr * 2, true); p += 4; v.setUint16(p, 2, true); p += 2; v.setUint16(p, 16, true); p += 2; w('data'); v.setUint32(p, n * 2, true); p += 4;
    for (i = 0; i < n; i++) { var x = Math.max(-1, Math.min(1, pcm[i])); v.setInt16(p, x < 0 ? x * 32768 : x * 32767, true); p += 2; }
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }
  function recordNative(P) {
    return P.requestPermissions().then(function (r) { if (!r || !r.mic) throw new Error('Permesso del microfono negato: attivalo nelle Impostazioni.'); return P.startRecording(); }).then(function () {
      return {
        level: function () { return 0; },
        stop: function () {
          return P.stopRecording().then(function (r) {
            var pcm = f32FromB64(r.audio), sr = r.sampleRate, frames = window.Pitch.framesFromSamples(pcm, sr, 30, 2048);
            return { blob: null, url: pcm.length ? wavUrl(pcm, sr) : null, frames: frames, samples: frames.length, pcm: pcm, sampleRate: sr };
          });
        }
      };
    });
  }

  /* ---------- registrazione: restituisce i frame (altezza + energia) ogni 30 ms ---------- */
  function record() {
    var NP = nativeMic();
    if (NP) return recordNative(NP).catch(function (e) { if (/Permesso/.test(e && e.message)) throw e; return recordWeb(); });
    return recordWeb();
  }
  function recordWeb() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error('Il microfono richiede https oppure localhost'));
    }
    return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } }).then(function (stream) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      var ctx = new Ctx();
      if (ctx.state === 'suspended') ctx.resume();
      var src = ctx.createMediaStreamSource(stream);
      var an = ctx.createAnalyser(); an.fftSize = 2048;
      src.connect(an);
      var buf = new Float32Array(an.fftSize), frames = [], chunks = [], rec = null;
      try { rec = new MediaRecorder(stream); rec.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); }; rec.start(); }
      catch (e) { rec = null; }
      var pcm = [], pcmLen = 0, tap = null;
      try { // copia dei campioni grezzi: serve al riconoscimento dei suoni (ASR)
        tap = ctx.createScriptProcessor(4096, 1, 1);
        tap.onaudioprocess = function (ev) { var d = ev.inputBuffer.getChannelData(0); pcm.push(new Float32Array(d)); pcmLen += d.length; };
        src.connect(tap); tap.connect(ctx.destination);
      } catch (e) { tap = null; }
      var timer = setInterval(function () {
        an.getFloatTimeDomainData(buf);
        frames.push(window.Pitch.frame(buf, ctx.sampleRate));
      }, 30);
      return {
        level: function () { var f = frames[frames.length - 1]; return f ? f.e : 0; },
        stop: function () {
          clearInterval(timer);
          return new Promise(function (resolve) {
            function end() {
              stream.getTracks().forEach(function (t) { t.stop(); });
              var rate = ctx.sampleRate, flat = new Float32Array(pcmLen), off = 0;
              pcm.forEach(function (c) { flat.set(c, off); off += c.length; });
              if (tap) { try { tap.disconnect(); } catch (e) { /* ignora */ } }
              try { ctx.close(); } catch (e) { /* ignora */ }
              var blob = chunks.length ? new Blob(chunks, { type: chunks[0].type || 'audio/webm' }) : null;
              resolve({ blob: blob, url: blob ? URL.createObjectURL(blob) : null, frames: frames, samples: frames.length, pcm: flat, sampleRate: rate });
            }
            if (rec && rec.state !== 'inactive') { rec.onstop = end; rec.stop(); } else end();
          });
        }
      };
    });
  }

  window.AudioKit = {
    speak: speak, stop: stopAll, record: record, playUrl: playUrl, loadManifest: loadManifest, localUrl: localUrl,
    hasManifest: function () { return !!manifest; }, addManifest: addManifest, isBundled: function (rel) { return !!bundled[rel]; }, manifest: function () { return manifest; },
    templateCurve: function (t) { return window.Pitch.templateCurve(t); },
    assess: function (c, t) { return window.Pitch.assess(c, t); },
    getError: function () { return lastError; }
  };
  if ('speechSynthesis' in window) { try { speechSynthesis.getVoices(); } catch (e) { /* ignora */ } }
})();
