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

/* ---------- Android: minSdk 24 (Android 7: richiesto da Google Play e dalla libreria degli acquisti) ---------- */
const vg = path.join(root, 'android', 'variables.gradle');
if (fs.existsSync(vg)) {
  let v = fs.readFileSync(vg, 'utf8');
  if (/minSdkVersion\s*=\s*(1\d|2[0-3])\b/.test(v)) { v = v.replace(/minSdkVersion\s*=\s*(1\d|2[0-3])\b/, 'minSdkVersion = 24'); fs.writeFileSync(vg, v); console.log('Android variables.gradle: minSdkVersion 24'); }
  else console.log('Android variables.gradle: minSdk già a posto');
}

/* ---------- Android: target API 36 (richiesto da Google Play) ---------- */
const adr = path.join(root, 'android');
if (fs.existsSync(adr)) {
  const patch = (file, fn, label) => { if (!fs.existsSync(file)) return; const a = fs.readFileSync(file, 'utf8'), b = fn(a); if (b !== a) { fs.writeFileSync(file, b); console.log('Android', label, ': aggiornato'); } else console.log('Android', label, ': già a posto'); };
  patch(vg, v => v.replace(/compileSdkVersion\s*=\s*\d+/, 'compileSdkVersion = 36').replace(/targetSdkVersion\s*=\s*\d+/, 'targetSdkVersion = 36'), 'variables.gradle (compile/target 36)');
  patch(path.join(adr, 'build.gradle'), v => v.replace(/(com\.android\.tools\.build:gradle:)[\d.]+/, '$18.10.1'), 'Android Gradle Plugin 8.10.1');
  patch(path.join(adr, 'gradle', 'wrapper', 'gradle-wrapper.properties'), v => v.replace(/gradle-[\d.]+-(all|bin)\.zip/, 'gradle-8.11.1-all.zip'), 'Gradle 8.11.1');
  patch(path.join(adr, 'gradle.properties'), v => v.includes('suppressUnsupportedCompileSdk') ? v : v.replace(/\s*$/, '\n') + 'android.suppressUnsupportedCompileSdk=36\n', 'gradle.properties');
  // da API 35 lo schermo è "a bordo a bordo": la pagina finirebbe sotto barra di stato e barra di navigazione. Si aggiunge il margine di sicurezza.
  const ma = path.join(adr, 'app', 'src', 'main', 'java', 'it', 'longlong', 'chinese', 'MainActivity.java');
  patch(ma, v => {
    if (v.includes('LONGLONG_INSETS')) return v;
    return `package it.longlong.chinese;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

// LONGLONG_INSETS: margini per barra di stato / navigazione (obbligatori con target API 35+)
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(true);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightNavigationBars(true);
        final View root = findViewById(android.R.id.content);
        root.setBackgroundColor(Color.parseColor("#fff7fa"));
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
    }
}
`;
  }, 'MainActivity (margini di sicurezza)');
}

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
