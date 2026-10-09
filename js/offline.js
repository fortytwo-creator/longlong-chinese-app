/* Pacchetto offline: scarica sul telefono i file audio e i tratti dei caratteri.
   Il resto dell'app (pagine, script, font) viene salvato automaticamente dal service worker. */
(function () {
  var MEDIA = 'longlong-media-v1';

  function NF() { return window.NativeFS; }
  /* nell'app i file audio a pagamento stanno nella memoria privata dell'app, non nella cache */
  function isNat(u) { return !!(NF() && NF().active()) && /^audio\//.test(u); }
  function relOf(u) { return u.replace(/^audio\//, ''); }
  function absolute(rel) { return new URL(rel, location.href).href; }

  /* elenco dei file di un pacchetto: 'free' (lezioni 1-20) oppure 'full' */
  function packBase() { var u = (window.CONFIG && window.CONFIG.packUrl) || ''; return u ? u.replace(/\/?$/, '/') : ''; }
  /* true se il file è già dentro l'app (versione installata dallo store: CONFIG.assetsBundled) */
  function inApp(rel) {
    var C = window.CONFIG || {}; if (!C.assetsBundled) return false;
    return /^strokes\//.test(rel) || window.AudioKit.isBundled(rel.replace(/^audio\//, ''));
  }

  function list(pack, voice) {
    var texts = window.audioTexts(pack), man = window.AudioKit.manifest(), v = man && man[voice], audio = [], strokes = {}, miss = 0;
    texts.forEach(function (t) { if (v && v[t]) audio.push('audio/' + v[t]); else miss++; });
    window.ALLWORDS.forEach(function (w) {
      if (pack === 'free' && !w.free) return;
      var chars = Array.from(w.zh); if (chars.length > 2) return;
      chars.forEach(function (c) { strokes[c] = 1; });
    });
    var st = Object.keys(strokes).map(function (c) { return 'strokes/' + encodeURIComponent(c) + '.json'; });
    var all = audio.concat(st).filter(function (u) { return !inApp(u); });
    return { audio: audio, strokes: st, all: all, missingAudio: miss, hasManifest: !!man };
  }

  function cachedSet() {
    if (!('caches' in window)) return Promise.resolve({});
    return caches.open(MEDIA).then(function (c) { return c.keys(); }).then(function (ks) {
      var o = {}; ks.forEach(function (k) { o[k.url] = 1; }); return o;
    }).catch(function () { return {}; });
  }

  function status(pack, voice) {
    var l = list(pack, voice);
    return cachedSet().then(function (set) {
      var have = l.all.filter(function (u) { return isNat(u) ? NF().has(relOf(u)) : set[absolute(u)]; }).length;
      return { total: l.all.length + (pack === 'full' && packBase() ? l.missingAudio : 0), have: have, info: l };
    });
  }

  /* scarica con 4 richieste alla volta; onProgress(fatti, totale) */
  function fetchPremiumManifest() {
    var base = packBase(); if (!base) return Promise.resolve(false);
    return fetch(base + 'manifest.json', { cache: 'reload' }).then(function (r) { if (!r.ok) throw new Error('Il pacchetto a pagamento non è raggiungibile (HTTP ' + r.status + ').'); return r.text(); })
      .then(function (txt) {
        window.AudioKit.addManifest(JSON.parse(txt));
        if (NF() && NF().active()) return NF().saveText('manifest-premium.json', txt);
        return caches.open(MEDIA).then(function (c) { return c.put(absolute('audio/manifest-premium.json'), new Response(txt, { headers: { 'Content-Type': 'application/json' } })); });
      }).then(function () { return true; });
  }
  /* da dove scaricare un file: i file non inclusi nell'app vengono dal pacchetto a pagamento (CONFIG.packUrl) */
  function srcOf(rel) {
    var base = packBase();
    if (base && /^audio\//.test(rel) && !window.AudioKit.isBundled(rel.replace(/^audio\//, ''))) return base + rel.replace(/^audio\//, '');
    return absolute(rel);
  }

  function download(pack, voice, onProgress) {
    if (!('caches' in window) && !(NF() && NF().active())) return Promise.reject(new Error('Questo browser non può salvare file offline.'));
    return (pack === 'full' ? fetchPremiumManifest() : Promise.resolve(false)).then(function () { return downloadList(pack, voice, onProgress); });
  }

  function downloadList(pack, voice, onProgress) {
    var l = list(pack, voice);
    if (!l.hasManifest) return Promise.reject(new Error('I file audio non sono ancora stati creati (vedi tools/make-audio.cjs).'));
    var nat = NF() && NF().active();
    return (nat ? NF().init() : Promise.resolve()).then(function () { return caches.open(MEDIA); }).then(function (cache) {
      return cache.keys().then(function (ks) {
        var have = {}; ks.forEach(function (k) { have[k.url] = 1; });
        var todo = l.all.filter(function (u) { return isNat(u) ? !NF().has(relOf(u)) : !have[absolute(u)]; }), total = l.all.length, done = total - todo.length, idx = 0, failed = 0;
        onProgress(done, total);
        function worker() {
          if (idx >= todo.length) return Promise.resolve();
          var u = todo[idx++];
          return fetch(srcOf(u), { cache: 'reload' }).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return isNat(u) ? r.blob().then(function (b) { return NF().saveFile(relOf(u), b); }) : cache.put(absolute(u), r);
          }).catch(function () { failed++; }).then(function () { done++; if (nat && done % 40 === 0) NF().saveIndex().catch(function () {}); onProgress(done, total); return worker(); });
        }
        return Promise.all([worker(), worker(), worker(), worker()]).then(function () { return nat ? NF().saveIndex().then(function () { return { total: total, failed: failed }; }) : { total: total, failed: failed }; });
      });
    });
  }

  function clear() { return Promise.all([('caches' in window) ? caches.delete(MEDIA) : null, NF() && NF().active() ? NF().clear() : null]).then(function () {}); }

  window.Offline = { list: list, status: status, download: download, clear: clear };
})();
