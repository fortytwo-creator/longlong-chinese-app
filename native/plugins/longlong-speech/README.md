# longlong-speech (iOS)
Plugin Capacitor locale: microfono nativo + riconoscimento vocale di Apple (cinese, sul dispositivo se disponibile).
Si installa da solo con `npm install` in `native/` (dipendenza `file:`), poi `npx cap sync ios`.
Il codice JS (js/asr.js e js/audio.js) lo usa solo se esiste; altrimenti ricade su Vosk e sul microfono del browser.
