#!/usr/bin/env node
/* Controlla che nella cartella ci sia tutto il necessario per un'app che funziona senza internet:
   audio di ogni parola/frase (voce femminile e maschile), tratti di ogni carattere da scrivere, modello vocale, icone.
   Uso (dalla cartella del progetto):  node tools/check-offline.cjs */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Object, Array, String, Number, Date }; ctx.window = ctx; vm.createContext(ctx);
['vocab.js', 'data.js', 'lessons.js', 'course.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f }));
let bad = 0;
const ko = m => { bad++; console.log('✗ ' + m); }, ok = m => console.log('✓ ' + m);

/* 1. tratti dei caratteri (scrittura): tutte le parole di 1-2 caratteri + quelli dell'introduzione */
const chars = new Set(['中', '文']);
ctx.ALLWORDS.forEach(w => { const c = Array.from(w.zh); if (c.length <= 2) c.forEach(x => chars.add(x)); });
const miss = [...chars].filter(c => !fs.existsSync(path.join(root, 'strokes', c + '.json')));
miss.length ? ko('tratti mancanti per ' + miss.length + ' caratteri: ' + miss.join(' ')) : ok('tratti: tutti i ' + chars.size + ' caratteri da scrivere sono nella cartella strokes/');

/* 2. audio */
const texts = ctx.audioTexts('full');
const man = { FEMALE: {}, MALE: {} }, dirs = [];
['audio', 'audio-premium'].forEach(d => {
  const f = path.join(root, d, 'manifest.json');
  if (!fs.existsSync(f)) return; dirs.push(d);
  const m = JSON.parse(fs.readFileSync(f, 'utf8'));
  ['FEMALE', 'MALE'].forEach(g => Object.keys(m[g] || {}).forEach(t => { man[g][t] = path.join(root, d, m[g][t]); }));
});
if (!dirs.length) ko('cartella audio/ non trovata (qui: nessun file audio da controllare)');
else {
  ['FEMALE', 'MALE'].forEach(g => {
    const noMan = texts.filter(t => !man[g][t]), noFile = texts.filter(t => man[g][t] && !fs.existsSync(man[g][t]));
    noMan.length ? ko('audio ' + g + ': ' + noMan.length + ' testi senza file, ad esempio: ' + noMan.slice(0, 8).join(' | ') + ' → rilancia make-audio.cjs') : ok('audio ' + g + ': tutti i ' + texts.length + ' testi hanno il manifest');
    if (noFile.length) ko('audio ' + g + ': ' + noFile.length + ' file nel manifest ma assenti dal disco');
  });
}

/* 3. modello vocale (serve a Android; su iPhone il riconoscimento è quello di Apple) */
const model = path.join(root, 'models', 'vosk-cn.tar.gz');
fs.existsSync(model) ? ok('modello vocale: presente (' + Math.round(fs.statSync(model).size / 1e6) + ' MB)') : ko('manca models/vosk-cn.tar.gz: su Android "Ripeti" controllerebbe solo i toni');

/* 4. icone e librerie locali */
['icon-512.png', 'native/resources/ios/AppIcon-1024.png', 'lib/hanzi-writer.min.js', 'lib/vosk.js', 'fonts/nunito-500.woff2', 'fonts/nunito-700.woff2', 'fonts/nunito-800.woff2']
  .forEach(f => fs.existsSync(path.join(root, f)) ? ok(f) : ko('manca ' + f));
console.log(bad ? '\n' + bad + ' problemi da sistemare prima della build.' : '\nTutto a posto: l\'app può funzionare senza internet.');
process.exit(bad ? 1 : 0);
