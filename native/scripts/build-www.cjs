#!/usr/bin/env node
/* Prepara native/www: una copia dell'app pensata per gli store.
   - dentro ci vanno: pagine, script, font, tratti dei caratteri, audio (cartella audio/, più audio-premium/ se c'è), icone e, se presente, il modello vocale (models/)
   - NON ci va: tools/, native/, chiavi (e audio-premium/ solo se imposti PACK_URL: allora l'audio a pagamento si scarica da lì)
   Versione "senza server": tutto l'audio sta dentro l'app (audio/ + audio-premium/ se c'è), nessun account, nessun pacchetto da scaricare.
   Il piano completo si compra dagli store (CONFIG.productId, default it.longlong.chinese.premium).
   Uso: dalla cartella native:  npm run www
   Variabili facoltative:  NOSTORE=1 (APK fuori dagli store: niente acquisto, solo codici)   PRODUCT_ID=...   ACCOUNT=1 (rimette l'account cloud, serve Supabase)   PACK_URL=https://.../ (solo se NON metti tutto l'audio dentro) */
'use strict';
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..', '..'), out = path.join(__dirname, '..', 'www');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const copy = (rel) => { const a = path.join(src, rel); if (!fs.existsSync(a)) return false; fs.cpSync(a, path.join(out, rel), { recursive: true }); return true; };
['index.html', 'style.css', 'manifest.json', 'sw.js', 'js', 'lib', 'fonts', 'strokes', 'audio', 'models',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon-32.png', 'favicon.ico'].forEach(r => { if (!copy(r)) console.log('manca (facoltativo):', r); });
/* se esiste audio-premium/ (dopo split-audio) lo mette nella stessa cartella audio/ dell'app e unisce i manifest */
const ap = path.join(src, 'audio-premium');
if (fs.existsSync(ap) && !process.env.PACK_URL) {
  const rd = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return { FEMALE: {}, MALE: {} }; } };
  const outA = path.join(out, 'audio'); fs.mkdirSync(outA, { recursive: true });
  const a = rd(path.join(outA, 'manifest.json')), p = rd(path.join(ap, 'manifest.json'));
  let n = 0;
  (function walk(dir, rel) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = path.join(rel, e.name);
      if (e.isDirectory()) walk(path.join(dir, e.name), r);
      else if (e.name !== 'manifest.json') { const dst = path.join(outA, r); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(path.join(dir, e.name), dst); n++; }
    }
  })(ap, '');
  fs.writeFileSync(path.join(outA, 'manifest.json'), JSON.stringify({ FEMALE: Object.assign({}, p.FEMALE, a.FEMALE), MALE: Object.assign({}, p.MALE, a.MALE) }));
  console.log('audio-premium unito all\'audio dell\'app:', n, 'file');
}
const E = process.env;
const cfg = `/* generato da native/scripts/build-www.cjs */
window.CONFIG = { azureKey: '', azureRegion: '', buyUrl: '', assetsBundled: true,
  noAccount: ${E.ACCOUNT === '1' ? 'false' : 'true'}, noStore: ${E.NOSTORE === '1' ? 'true' : 'false'}, productId: ${JSON.stringify(E.PRODUCT_ID || 'it.longlong.chinese.premium')},
  packUrl: ${JSON.stringify(E.PACK_URL || '')} };
`;
fs.writeFileSync(path.join(out, 'config.js'), cfg);
const du = d => { let s = 0; (function w(x) { for (const e of fs.readdirSync(x, { withFileTypes: true })) e.isDirectory() ? w(path.join(x, e.name)) : s += fs.statSync(path.join(x, e.name)).size; })(d); return (s / 1048576).toFixed(1) + ' MB'; };
console.log('native/www pronto,', du(out));
if (!fs.existsSync(path.join(out, 'audio', 'manifest.json'))) console.log('ATTENZIONE: manca audio/ (lancia make-audio.cjs e split-audio.cjs)');
if (!fs.existsSync(path.join(out, 'models', 'vosk-cn.tar.gz'))) console.log('Nota: manca models/vosk-cn.tar.gz: senza, "Ripeti" controlla solo i toni.');
if (!E.PACK_URL && !fs.existsSync(path.join(src, 'audio-premium')) && !fs.existsSync(path.join(out, 'audio', 'manifest.json'))) console.log('Nota: senza audio/ l\'app non avrà le voci registrate.');
