#!/usr/bin/env node
/* Rimette tutto insieme: sposta i file di audio-premium/ dentro audio/ e unisce i due manifest.
   Serve per il sito web (Netlify), dove l'audio sta tutto in una cartella sola.
   Uso:  node tools/merge-audio.cjs      (si può rilanciare senza rischi) */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), A = path.join(root, 'audio'), P = path.join(root, 'audio-premium');
const rd = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return { FEMALE: {}, MALE: {} }; } };
if (!fs.existsSync(P)) { console.log('Non c\'è la cartella audio-premium: niente da unire.'); process.exit(0); }
const a = rd(path.join(A, 'manifest.json')), p = rd(path.join(P, 'manifest.json'));
const m = { FEMALE: Object.assign({}, p.FEMALE, a.FEMALE), MALE: Object.assign({}, p.MALE, a.MALE) };
let moved = 0;
(function walk(dir, rel) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = path.join(rel, e.name);
    if (e.isDirectory()) walk(path.join(dir, e.name), r);
    else if (e.name !== 'manifest.json') { const dst = path.join(A, r); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(path.join(dir, e.name), dst); moved++; }
  }
})(P, '');
fs.writeFileSync(path.join(A, 'manifest.json'), JSON.stringify(m));
fs.rmSync(P, { recursive: true, force: true });
console.log(`Fatto: ${moved} file spostati in audio/. Nel manifest: ${Object.keys(m.FEMALE).length} testi (voce femminile) + ${Object.keys(m.MALE).length} (maschile).`);
