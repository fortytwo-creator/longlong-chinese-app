#!/usr/bin/env node
/* Genera i file audio (mp3) di tutte le parole e frasi con Azure Speech e scrive audio/manifest.json.
   Uso (da questa cartella):
       set AZURE_KEY=la_tua_chiave        (PowerShell:  $env:AZURE_KEY="la_tua_chiave")
       set AZURE_REGION=italynorth
       node tools/make-audio.cjs
   Se AZURE_KEY non c'è, la legge da tools/azure-key.txt (riga 1: chiave, riga 2: regione) o da config.js. Si può rilanciare: i file già creati non vengono rifatti.
   Costo: circa 3.400 caratteri per voce, ben dentro il piano gratuito di Azure (500.000 caratteri al mese). */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto'), https = require('https'), http = require('http');
const root = path.join(__dirname, '..');

const ctx = { console, Math, JSON, Object, Array, String, Number, Date }; ctx.window = ctx; vm.createContext(ctx);
['vocab.js', 'data.js', 'lessons.js', 'course.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f }));
if (ctx.COURSE_ERRORS.length) { console.error('Errori nel corso:\n' + ctx.COURSE_ERRORS.join('\n')); process.exit(1); }
const texts = ctx.audioTexts('full');

let key = process.env.AZURE_KEY, region = process.env.AZURE_REGION;
if (!key) { // tools/azure-key.txt: prima riga la chiave, seconda riga (facoltativa) la regione. Il file non va pubblicato.
  try { const l = fs.readFileSync(path.join(__dirname, 'azure-key.txt'), 'utf8').split(/\r?\n/).map(x => x.trim()).filter(Boolean); key = l[0]; region = region || l[1]; } catch (e) { /* niente */ }
}
if (!key) { try { const c = fs.readFileSync(path.join(root, 'config.js'), 'utf8'); key = (c.match(/azureKey\s*:\s*'([^']+)'/) || [])[1]; region = region || (c.match(/azureRegion\s*:\s*'([^']+)'/) || [])[1]; } catch (e) { /* niente */ } }
region = region || 'italynorth';
const endpoint = process.env.AZURE_ENDPOINT || `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
if (!key) { console.error('Manca la chiave Azure: imposta AZURE_KEY oppure scrivila in tools/azure-key.txt.'); process.exit(1); }

const VOICES = { FEMALE: { name: 'zh-CN-XiaoxiaoNeural', dir: 'f' }, MALE: { name: 'zh-CN-YunxiNeural', dir: 'm' } };
const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fileOf = (t, v) => `${VOICES[v].dir}/${crypto.createHash('sha1').update(t).digest('hex').slice(0, 10)}.mp3`;

function tts(text, voice) {
  const ssml = `<speak version='1.0' xml:lang='zh-CN'><voice name='${VOICES[voice].name}'><prosody rate='0.9'>${esc(text)}</prosody></voice></speak>`;
  return new Promise((resolve, reject) => {
    const u = new URL(endpoint), lib = u.protocol === 'http:' ? http : https;
    const req = lib.request(u, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'longlong-make-audio' } }, res => {
      const chunks = []; res.on('data', c => chunks.push(c));
      res.on('end', () => res.statusCode === 200 ? resolve(Buffer.concat(chunks)) : reject(new Error('HTTP ' + res.statusCode + ' ' + Buffer.concat(chunks).toString().slice(0, 120))));
    });
    req.on('error', reject); req.write(ssml); req.end();
  });
}

(async () => {
  const manifest = { FEMALE: {}, MALE: {} };
  const jobs = [];
  for (const v of Object.keys(VOICES)) {
    fs.mkdirSync(path.join(root, 'audio', VOICES[v].dir), { recursive: true });
    for (const t of texts) { const rel = fileOf(t, v); manifest[v][t] = rel; jobs.push({ t, v, rel, abs: path.join(root, 'audio', rel) }); }
  }
  let done = 0, made = 0, failed = [];
  const have = f => fs.existsSync(f) && fs.statSync(f).size > 200;
  const todo = jobs.filter(j => !(have(j.abs) || have(j.abs.replace(path.sep + 'audio' + path.sep, path.sep + 'audio-premium' + path.sep))));
  console.log(`${texts.length} testi x 2 voci = ${jobs.length} file; da creare: ${todo.length}`);
  let idx = 0;
  async function worker() {
    while (idx < todo.length) {
      const j = todo[idx++];
      for (let attempt = 1; attempt <= 3; attempt++) {
        try { fs.writeFileSync(j.abs, await tts(j.t, j.v)); made++; break; }
        catch (e) { if (attempt === 3) failed.push(j.t + ' (' + j.v + '): ' + e.message); else await new Promise(r => setTimeout(r, 800 * attempt)); }
      }
      if (++done % 50 === 0 || done === todo.length) process.stdout.write(`\r${done}/${todo.length}`);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  console.log('');
  // il manifest elenca solo i file che esistono davvero
  for (const v of Object.keys(manifest)) for (const t of Object.keys(manifest[v])) if (!fs.existsSync(path.join(root, 'audio', manifest[v][t])) && !fs.existsSync(path.join(root, 'audio-premium', manifest[v][t]))) delete manifest[v][t];
  fs.writeFileSync(path.join(root, 'audio', 'manifest.json'), JSON.stringify(manifest));
  console.log(`Creati ${made} file. Nel manifest: ${Object.keys(manifest.FEMALE).length} (voce femminile) + ${Object.keys(manifest.MALE).length} (voce maschile).`);
  if (failed.length) { console.log('Non riusciti (rilancia il comando):\n' + failed.join('\n')); process.exitCode = 2; }
  else console.log('Fatto! L\'app non ha più bisogno della chiave Azure: non metterla nei file pubblicati.');
})();
