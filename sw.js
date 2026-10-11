/* Service worker: l'app funziona anche senza internet.
   - guscio dell'app (pagine, script, font, icone): prima la rete (così gli aggiornamenti arrivano subito), poi la copia salvata
   - audio e tratti dei caratteri: prima la copia scaricata (pacchetto offline), poi la rete */
var CACHE = 'longlong-v24';
var MEDIA = 'longlong-media-v1';
var FILES = ['./', 'index.html', 'style.css', 'config.js', 'manifest.json',
  'js/vocab.js', 'js/data.js', 'js/lessons.js', 'js/course.js', 'js/store.js', 'js/entitlement.js', 'js/native.js', 'js/voice.js', 'js/cloud.js', 'js/pitch.js', 'js/phon.js', 'js/asr.js', 'js/audio.js',
  'js/util.js', 'js/steps.js', 'js/intro.js', 'js/offline.js', 'js/billing.js', 'js/app.js', 'lib/hanzi-writer.min.js', 'lib/vosk.js',
  'fonts/nunito-500.woff2', 'fonts/nunito-700.woff2', 'fonts/nunito-800.woff2',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon-32.png', 'favicon.ico', 'audio/manifest.json'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (f) { return c.add(f).catch(function () { /* file facoltativo mancante */ }); }));
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== MEDIA; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* Safari chiede l'audio a pezzi (Range): rispondiamo con la parte giusta del file salvato */
function rangeResponse(req, res) {
  var h = req.headers.get('range'); if (!h) return Promise.resolve(res);
  var m = /bytes=(\d*)-(\d*)/.exec(h); if (!m) return Promise.resolve(res);
  return res.arrayBuffer().then(function (buf) {
    var size = buf.byteLength, start = m[1] ? parseInt(m[1], 10) : 0, end = m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1;
    if (start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
    return new Response(buf.slice(start, end + 1), { status: 206, statusText: 'Partial Content', headers: {
      'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg', 'Content-Length': String(end - start + 1), 'Content-Range': 'bytes ' + start + '-' + end + '/' + size } });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return; // API e CDN: gestiti dal browser
  var isMedia = /\/(audio|strokes|models)\//.test(url.pathname) && !/manifest\.json$/.test(url.pathname);
  if (isMedia) {
    e.respondWith(caches.open(MEDIA).then(function (c) {
      return c.match(req.url).then(function (hit) {
        if (hit) return rangeResponse(req, hit);
        return fetch(req).then(function (r) {
          if (r.ok && r.status === 200 && !req.headers.get('range')) c.put(req.url, r.clone());
          return r;
        });
      });
    }));
    return;
  }
  e.respondWith(
    fetch(req).then(function (r) {
      if (r.ok) { var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return r;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        return hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error());
      });
    })
  );
});
