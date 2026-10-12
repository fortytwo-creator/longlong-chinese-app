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

/* ---------- Android: firma e numero di versione (per l'APK da installare a mano) ---------- */
const gr = path.join(root, 'android', 'app', 'build.gradle');
if (fs.existsSync(gr)) {
  let s = fs.readFileSync(gr, 'utf8'), changed = false;
  const E = process.env, vc = parseInt(E.BUILD_NUMBER || E.PROJECT_BUILD_NUMBER || '', 10);
  if (vc > 0) {   // ogni build ha un numero più alto: Android permette di installare sopra la versione precedente, senza perdere i progressi
    s = s.replace(/versionCode\s+\d+/, 'versionCode ' + vc).replace(/versionName\s+"[^"]*"/, 'versionName "1.0.' + vc + '"'); changed = true;
  }
  if (E.CM_KEYSTORE_PATH && !s.includes('signingConfigs')) {
    const sc = `    signingConfigs {
        release {
            storeFile file(System.getenv("CM_KEYSTORE_PATH"))
            storePassword System.getenv("CM_KEYSTORE_PASSWORD")
            keyAlias System.getenv("CM_KEY_ALIAS")
            keyPassword System.getenv("CM_KEY_PASSWORD")
        }
    }
    buildTypes {`;
    if (/buildTypes\s*\{\s*release\s*\{/.test(s)) {
      s = s.replace(/buildTypes\s*\{\s*release\s*\{/, m => sc + '\n        release {\n            signingConfig signingConfigs.release'); changed = true;
    } else console.log('Android build.gradle: blocco release non trovato, firma NON aggiunta');
  }
  // androidx.core 1.15+ richiede compileSdk 35 e un Android Gradle Plugin più nuovo: si resta sulla 1.13.1 (compatibile con compileSdk 34 di Capacitor 6)
  if (!s.includes('LONGLONG_PIN')) {
    s += `
// LONGLONG_PIN: blocca androidx.core alla versione compatibile con compileSdk 34
configurations.all {
    resolutionStrategy {
        force 'androidx.core:core:1.13.1'
        force 'androidx.core:core-ktx:1.13.1'
    }
}
`; changed = true;
  }
  if (changed) fs.writeFileSync(gr, s);
  console.log('Android build.gradle:', changed ? 'versione/firma impostate' : 'invariato');
}

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
