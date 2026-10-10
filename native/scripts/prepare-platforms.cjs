#!/usr/bin/env node
/* Dopo "npx cap add ios/android" e "npx cap sync": aggiunge i permessi del microfono e del riconoscimento vocale.
   Si può lanciare più volte: non duplica nulla.  Uso (da native/):  npm run prepare:platforms */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');

/* ---------- iOS: Info.plist ---------- */
const plist = path.join(root, 'ios', 'App', 'App', 'Info.plist');
if (fs.existsSync(plist)) {
  let s = fs.readFileSync(plist, 'utf8'), changed = false;
  const add = (key, text) => {
    if (s.includes('<key>' + key + '</key>')) return;
    s = s.replace(/<\/dict>\s*<\/plist>\s*$/, `\t<key>${key}</key>\n\t<string>${text}</string>\n</dict>\n</plist>\n`); changed = true;
  };
  add('NSMicrophoneUsageDescription', 'Il microfono serve per ascoltare come pronunci le parole cinesi e dirti se i toni sono giusti.');
  add('NSSpeechRecognitionUsageDescription', 'Il riconoscimento vocale serve per capire se hai pronunciato bene le consonanti e le vocali.');
  // evita la domanda "Missing Compliance" ad ogni build su TestFlight (l'app non usa cifratura propria)
  if (!s.includes('ITSAppUsesNonExemptEncryption')) { s = s.replace(/<\/dict>\s*<\/plist>\s*$/, '\t<key>ITSAppUsesNonExemptEncryption</key>\n\t<false/>\n</dict>\n</plist>\n'); changed = true; }
  if (changed) fs.writeFileSync(plist, s);
  console.log('iOS Info.plist:', changed ? 'permessi aggiunti' : 'già a posto');
} else console.log('iOS: cartella non trovata (esegui "npx cap add ios" su un Mac).');

/* ---------- Android: AndroidManifest.xml ---------- */
const man = path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(man)) {
  let s = fs.readFileSync(man, 'utf8'), changed = false;
  ['android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS'].forEach(p => {
    if (s.includes(p)) return;
    s = s.replace(/<\/manifest>/, `    <uses-permission android:name="${p}" />\n</manifest>`); changed = true;
  });
  if (changed) fs.writeFileSync(man, s);
  console.log('Android manifest:', changed ? 'permessi aggiunti' : 'già a posto');
} else console.log('Android: cartella non trovata (esegui "npx cap add android").');

/* ---------- icona dell'app ---------- */
const res = path.join(root, 'resources');
const set = path.join(root, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
if (fs.existsSync(set)) {
  let name = 'AppIcon-512@2x.png';
  try { const c = JSON.parse(fs.readFileSync(path.join(set, 'Contents.json'), 'utf8')); const f = (c.images || []).map(i => i.filename).filter(Boolean)[0]; if (f) name = f; } catch (e) { /* usa il nome standard */ }
  fs.copyFileSync(path.join(res, 'ios', 'AppIcon-1024.png'), path.join(set, name));
  console.log('iOS icona:', name);
}
const droid = path.join(root, 'android', 'app', 'src', 'main', 'res');
if (fs.existsSync(droid)) {
  ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'].forEach(k => ['ic_launcher.png', 'ic_launcher_round.png'].forEach(f => {
    const d = path.join(droid, 'mipmap-' + k); fs.mkdirSync(d, { recursive: true });
    fs.copyFileSync(path.join(res, 'android', 'mipmap-' + k, f), path.join(d, f));
  }));
  fs.rmSync(path.join(droid, 'mipmap-anydpi-v26'), { recursive: true, force: true }); // l'icona adattiva di Capacitor coprirebbe la nostra
  ['ic_launcher_foreground.xml'].forEach(f => fs.rmSync(path.join(droid, 'drawable-v24', f), { force: true }));
  console.log('Android icona: aggiornata');
}
