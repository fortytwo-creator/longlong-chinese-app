#!/usr/bin/env node
/* Divide gli audio in due pacchetti, dopo make-audio.cjs:
     audio/          -> solo parole e frasi GRATIS (lezioni 1-20, prime 50 parole): va dentro l'app
     audio-premium/  -> tutto il resto: lo metti su un hosting (Netlify, Firebase Storage, Cloudflare R2...) e l'app lo scarica dopo l'acquisto
   Uso:  node tools/split-audio.cjs        (si può rilanciare) */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Object, Array, String, Number, Date }; ctx.window = ctx; vm.createContext(ctx);
['vocab.js', 'data.js', 'lessons.js', 'course.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f }));
const free = new Set(ctx.audioTexts('free'));
const A = path.join(root, 'audio'), P = path.join(root, 'audio-premium');
const rd = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return { FEMALE: {}, MALE: {} }; } };
const a = rd(path.join(A, 'manifest.json')), p = rd(path.join(P, 'manifest.json'));
if (!Object.keys(a.FEMALE).length && !Object.keys(p.FEMALE).length) { console.error('Nessun audio: lancia prima node tools/make-audio.cjs'); process.exit(1); }
const full = { FEMALE: Object.assign({}, p.FEMALE, a.FEMALE), MALE: Object.assign({}, p.MALE, a.MALE) };
const outA = { FEMALE: {}, MALE: {} }, outP = { FEMALE: {}, MALE: {} };
let moved = 0;
for (const v of ['FEMALE', 'MALE']) {
  for (const [t, rel] of Object.entries(full[v])) {
    const inA = path.join(A, rel), inP = path.join(P, rel);
    const src = fs.existsSync(inA) ? inA : fs.existsSync(inP) ? inP : null; if (!src) continue;
    if (free.has(t)) {
      if (src !== inA) { fs.mkdirSync(path.dirname(inA), { recursive: true }); fs.renameSync(src, inA); moved++; }
      outA[v][t] = rel;
    } else {
      if (src !== inP) { fs.mkdirSync(path.dirname(inP), { recursive: true }); fs.renameSync(src, inP); moved++; }
      outP[v][t] = rel;
    }
  }
}
fs.mkdirSync(P, { recursive: true });
fs.writeFileSync(path.join(A, 'manifest.json'), JSON.stringify(outA));
fs.writeFileSync(path.join(P, 'manifest.json'), JSON.stringify(outP));
const sz = d => { let s = 0; (function w(x) { for (const e of fs.readdirSync(x, { withFileTypes: true })) e.isDirectory() ? w(path.join(x, e.name)) : s += fs.statSync(path.join(x, e.name)).size; })(d); return (s / 1048576).toFixed(1) + ' MB'; };
console.log(`audio/ (nell'app):      ${Object.keys(outA.FEMALE).length} testi x 2 voci, ${sz(A)}`);
console.log(`audio-premium/ (hosting): ${Object.keys(outP.FEMALE).length} testi x 2 voci, ${sz(P)}`);
