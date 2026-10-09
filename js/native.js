/* Solo nell'app Android/iOS (Capacitor): salva l'audio a pagamento nella cartella privata dell'app
   (non si cancella con la cache del browser) e copia i progressi in Documenti/LongLong.
   Nel browser non fa nulla: Offline e AudioKit usano la cache come prima. */
(function () {
  var DIR = 'DATA', ROOT = 'audio', INDEX = ROOT + '/index.json', MAN = ROOT + '/manifest-premium.json';
  var have = {}, base = '', ready = false;

  function plug() { var C = window.Capacitor; return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.Filesystem ? C.Plugins.Filesystem : null; }
  function active() { return !!plug(); }

  function init() {
    var F = plug(); if (!F) return Promise.resolve(false);
    return F.getUri({ path: ROOT, directory: DIR }).then(function (r) { base = r.uri.replace(/\/$/, ''); }).catch(function () {})
      .then(function () { return F.readFile({ path: INDEX, directory: DIR, encoding: 'utf8' }); })
      .then(function (r) { have = {}; JSON.parse(r.data).forEach(function (k) { have[k] = 1; }); }).catch(function () { have = {}; })
      .then(function () { ready = true; return true; });
  }
  function url(rel) { return ready && have[rel] && base ? window.Capacitor.convertFileSrc(base + '/' + rel) : null; }
  function count() { return Object.keys(have).length; }
  function has(rel) { return !!have[rel]; }

  function saveIndex() { return plug().writeFile({ path: INDEX, directory: DIR, encoding: 'utf8', data: JSON.stringify(Object.keys(have)), recursive: true }); }
  function toBase64(blob) {
    return new Promise(function (res, rej) {
      var fr = new FileReader(); fr.onload = function () { res(String(fr.result).split(',')[1] || ''); }; fr.onerror = rej; fr.readAsDataURL(blob);
    });
  }
  /* rel = 'f/abc.mp3' (percorso come nel manifest) */
  function saveFile(rel, blob) {
    return toBase64(blob).then(function (b64) { return plug().writeFile({ path: ROOT + '/' + rel, directory: DIR, data: b64, recursive: true }); })
      .then(function () { have[rel] = 1; });
  }
  function saveText(name, txt) { return plug().writeFile({ path: ROOT + '/' + name, directory: DIR, encoding: 'utf8', data: txt, recursive: true }); }
  function readPremiumManifest() { if (!plug()) return Promise.resolve(null); return plug().readFile({ path: MAN, directory: DIR, encoding: 'utf8' }).then(function (r) { return JSON.parse(r.data); }).catch(function () { return null; }); }
  function clear() { have = {}; if (!plug()) return Promise.resolve(); return plug().rmdir({ path: ROOT, directory: DIR, recursive: true }).catch(function () {}); }

  /* ---------- copia dei progressi in Documenti/LongLong ---------- */
  var bt = null;
  function backupNow() {
    var F = plug(); if (!F || !window.Store) return Promise.resolve(false);
    var txt = JSON.stringify({ app: 'longlong', saved: new Date().toISOString(), data: window.Store.exportData() });
    return F.writeFile({ path: 'LongLong/progressi-longlong.json', directory: 'DOCUMENTS', encoding: 'utf8', data: txt, recursive: true }).then(function () { return true; }).catch(function () { return false; });
  }
  function watch() { if (!active() || !window.Store || !Store.onSave) return; Store.onSave(function () { clearTimeout(bt); bt = setTimeout(backupNow, 8000); }); }

  window.NativeFS = { active: active, init: init, url: url, has: has, count: count, saveFile: saveFile, saveText: saveText, saveIndex: function () { return active() ? saveIndex() : Promise.resolve(); }, readPremiumManifest: readPremiumManifest, clear: clear, backupNow: backupNow, watch: watch };
})();
