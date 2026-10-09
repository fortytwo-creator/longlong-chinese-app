#!/usr/bin/env node
/* Prepara native/www: una copia dell'app pensata per gli store.
   - dentro ci vanno: pagine, script, font, tratti dei caratteri, audio GRATIS (cartella audio/), icone e, se presente, il modello vocale (models/)
   - NON ci va: audio-premium/ (lo metti su un hosting, indirizzo in CONFIG.packUrl), tools/, native/, chiavi
   Uso: dalla cartella native:  npm run www      (variabile PACK_URL=https://.../ e RC_KEY_ANDROID / RC_KEY_IOS) */
'use strict';
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..', '..'), out = path.join(__dirname, '..', 'www');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const copy = (rel) => { const a = path.join(src, rel); if (!fs.existsSync(a)) return false; fs.cpSync(a, path.join(out, rel), { recursive: true }); return true; };
['index.html', 'style.css', 'manifest.json', 'sw.js', 'js', 'lib', 'fonts', 'strokes', 'audio', 'models',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon-32.png', 'favicon.ico'].forEach(r => { if (!copy(r)) console.log('manca (facoltativo):', r); });
const E = process.env;
const cfg = `/* generato da native/scripts/build-www.cjs */
window.CONFIG = { azureKey: '', azureRegion: '', buyUrl: '', assetsBundled: true,
  packUrl: ${JSON.stringify(E.PACK_URL || '')}, rcKeyAndroid: ${JSON.stringify(E.RC_KEY_ANDROID || '')}, rcKeyIos: ${JSON.stringify(E.RC_KEY_IOS || '')} };\n`;
fs.writeFileSync(path.join(out, 'config.js'), cfg);
const du = d => { let s = 0; (function w(x) { for (const e of fs.readdirSync(x, { withFileTypes: true })) e.isDirectory() ? w(path.join(x, e.name)) : s += fs.statSync(path.join(x, e.name)).size; })(d); return (s / 1048576).toFixed(1) + ' MB'; };
console.log('native/www pronto,', du(out));
if (!fs.existsSync(path.join(out, 'audio', 'manifest.json'))) console.log('ATTENZIONE: manca audio/ (lancia make-audio.cjs e split-audio.cjs)');
if (!fs.existsSync(path.join(out, 'models', 'vosk-cn.tar.gz'))) console.log('Nota: manca models/vosk-cn.tar.gz: senza, "Ripeti" controlla solo i toni.');
if (!E.PACK_URL) console.log('Nota: PACK_URL non impostato: dopo l\'acquisto non si potranno scaricare le lezioni a pagamento.');
