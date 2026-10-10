# 龙龙中文

App per imparare il cinese, pensata per un bambino di 8 anni: tutto il **nuovo HSK 1** (300 parole) in **100 lezioni** guidate,
più un Dojo di allenamento libero. Funziona anche **senza internet** e ha un **piano gratuito** (20 lezioni, 50 parole) e uno completo.

## Com'è fatto il corso
- 10 parti da 10 lezioni. Ogni 10ª lezione è una **gara di ripasso**. In totale 90 lezioni nuove, ogni parola è insegnata una volta sola.
- Ogni lezione = **teoria** (il drago spiega, parole nuove, curiosità, frasi o dialogo) + **pratica** divisa in quattro abilità:
  **听 ascoltare** (quiz con l'audio) · **说 parlare** (ripeti ogni parola: controllo dei toni sillaba per sillaba) ·
  **读 leggere** (puzzle pinyin, quiz, costruisci la frase) · **写 scrivere** (traccia i caratteri).
- Lezioni 1-20 e 50 parole: gratis. Lezioni 21-100 e le altre 250 parole: piano completo.

## Cartella del sito
```
index.html  style.css  sw.js  manifest.json  config.js  netlify.toml
js/        vocab.js (300 parole) · lessons.js (testi delle 100 lezioni) · course.js · pitch.js (analisi dei toni) · ...
lib/       hanzi-writer.min.js          strokes/  tratti dei caratteri (offline)       fonts/  Nunito
audio/     (da generare, vedi sotto)    tools/    make-audio.cjs · make-code.cjs
icon-*.png apple-touch-icon.png favicon.ico
```
**Importante:** la cartella che pubblichi deve essere quella che contiene `index.html` e `sw.js`. Se nella tua cartella ci sono ancora
i file della prima versione (`app.js`, `modules/`, `longlong-complete.html`, `*.zip`, `*.png` di prova) cancellali: non servono più.

## 1) Creare i file audio (una volta sola)
Serve per l'uso offline e per non dover pubblicare la chiave Azure.
1. Crea il file `tools/azure-key.txt` con la chiave Azure Speech nella prima riga e la regione (es. `italynorth`) nella seconda. Il file è già escluso da git.
2. Da questa cartella: `node tools/make-audio.cjs` (serve Node 18 o più nuovo).
3. Compaiono `audio/f/…` (voce Xiaoxiao), `audio/m/…` (voce Yunxi) e `audio/manifest.json`. Sono 767 testi per voce, circa 3.400 caratteri: dentro il piano gratuito di Azure.
4. Pubblica la cartella `audio/` insieme al resto. Si può rilanciare il comando: rifà solo i file mancanti.

## 2) Uso offline
- Pagine, programma, font e libreria dei tratti si salvano da soli alla prima visita (service worker).
- Audio e caratteri si scaricano dal **Profilo → "Scarica per usare offline"**: piano gratuito = solo le lezioni 1-20, piano completo = tutto.
- Il riconoscimento dei toni gira sul telefono (`js/pitch.js`), quindi funziona anche offline.
- **Limite onesto:** il controllo "ripeti" verifica numero di sillabe, **toni** e ritmo. Non riconosce le consonanti e le vocali (servirebbe un modello di riconoscimento vocale da decine di MB oppure un servizio online come Azure Pronunciation Assessment).

## 3) Piano gratuito / completo
- `js/entitlement.js` contiene l'interruttore. Il piano completo si attiva dal Profilo (o dal paywall) con un **codice**; prima c'è un controllo "per i genitori" (una moltiplicazione).
- Codice di prova: `DRAGO-2026` (cambialo!). Per crearne uno: `node tools/make-code.cjs IL-MIO-CODICE` e incolla l'impronta in `PREMIUM_HASHES`.
- **Attenzione:** il controllo è sul telefono, quindi chi sa programmare può aggirarlo. Per incassare davvero serve un servizio esterno che emetta i codici
  (negozio app, Stripe con una funzione server, ecc.). `buyUrl` in `config.js` è il link "Acquista il codice" (facoltativo).

## 4) Icona sulla schermata Home
- L'icona è `apple-touch-icon.png` (iPhone, 180×180) e `icon-192/512/maskable-512.png` (Android, dal manifest).
- Il telefono salva l'icona **nel momento in cui aggiungi il collegamento**: dopo aver pubblicato i file, elimina il vecchio collegamento e aggiungilo di nuovo.
- Se non compare: Profilo → "Controlla l'icona dell'app" dice se i file sono raggiungibili sul sito. Oppure apri `https://IL-TUO-SITO/apple-touch-icon.png` nel browser: deve mostrare l'immagine.
- Causa tipica: sul sito c'è ancora la vecchia `index.html` (con un'icona SVG, che iPhone ignora) o mancano i PNG.

## Sicurezza
- Non pubblicare `tools/azure-key.txt` né chiavi in `config.js`. Se una chiave è già stata su GitHub, **rigenerala** dal portale Azure.
- Il remote git non deve contenere token nell'indirizzo (`https://utente:ghp_…@github.com/...`): rimuovilo con `git remote set-url origin https://github.com/UTENTE/REPO.git` e revoca il token.

## Come modificare i contenuti
- Parole: `js/vocab.js`. Lezioni (testi, curiosità, frasi, dialoghi): `js/lessons.js`. Le frasi si scrivono con le parole del vocabolario separate da spazi;
  il pinyin lo prende dal vocabolario. All'apertura l'app controlla che ogni frase usi solo parole già insegnate (errori nella console del browser).
- Controllo veloce da terminale: apri `index.html` con la console e verifica che `COURSE_ERRORS` sia vuoto.

## Licenze
- Lista di parole: nuovo HSK livello 1 (HSK 3.0). Traduzioni italiane e testi delle lezioni: da rivedere con un madrelingua prima della pubblicazione.
- Hanzi Writer (MIT). Dati dei tratti `hanzi-writer-data`: Arphic Public License (vedi `strokes/LICENSE-ARPHIC.txt`). Font Nunito: SIL Open Font License.

---

## Da sito ad app vera (Android / iPhone) con Capacitor

La cartella `native/` incarta lo stesso codice come app dello store. Prima serve fare una volta sola sul tuo PC (Node.js installato):

1. **Audio**: `node tools/make-audio.cjs` (con la chiave Azure, vedi sopra), poi `node tools/split-audio.cjs`.
   - `audio/` = solo le lezioni 1-20 e le prime 50 parole: **va dentro l'app**.
   - `audio-premium/` = tutto il resto: caricalo su un hosting (anche questo sito Netlify: `https://TUOSITO.netlify.app/audio-premium/`). L'app lo scarica **dopo l'acquisto**. Su un hosting pubblico chiunque conosca l'indirizzo può scaricarlo: per proteggerlo serve un hosting con accesso controllato (Firebase Storage con regole, ecc.).
2. **Riconoscimento di consonanti e vocali** (facoltativo ma consigliato): scarica `vosk-model-small-cn-0.22.zip` da https://alphacephei.com/vosk/models, scompattalo, rinomina la cartella in `model`, poi `tar -czf vosk-cn.tar.gz model` e metti il file in `models/vosk-cn.tar.gz` (circa 40 MB, resta dentro l'app così funziona offline anche nel piano gratuito). Senza il modello "Ripeti" controlla solo i toni.
3. Dalla cartella `native`:
   ```
   npm install
   set PACK_URL=https://TUOSITO.netlify.app/audio-premium/
   set RC_KEY_ANDROID=chiave_pubblica_revenuecat
   npm run www
   npx cap add android
   npm run android        (si apre Android Studio: Run per provare, poi Build > Generate Signed Bundle per Google Play)
   ```
4. Acquisto dentro l'app: crea l'account RevenueCat, collega Google Play, crea un prodotto, mettilo nell'offerta "current" e dai al permesso (entitlement) il nome `premium`. Il codice è in `js/billing.js`. Nell'app dello store il codice di attivazione sparisce e compare il bottone Acquista.
5. iPhone: serve un Mac (o un servizio di build come Codemagic) e l'account Apple Developer. Su iPhone il pacchetto a pagamento scaricato dopo l'acquisto non è ancora gestito (il service worker non gira lì): per ora procedi con Android.

Cosa NON ho potuto provare: la compilazione con Android Studio, un acquisto vero, il modello Vosk vero (il test è stato fatto con un riconoscitore finto che restituisce il testo che gli dico io). Quando lo provi sul telefono, scrivimi cosa succede.


---

## Account e salvataggio nel cloud (Supabase)

Il genitore entra con l'email e un codice a 6 cifre; i progressi di Noah (parole, lezioni, stelle, serie) si salvano nel cloud e si ritrovano su un altro telefono. L'app funziona anche offline: si sincronizza appena torna la rete. Il piano completo viene letto dal server (tabella `entitlements`), così non si può attivare da telefono.

Come attivarlo (10 minuti, gratis):
1. Su https://supabase.com crea un account (con la TUA email) e un **New project** (piano Free, regione Europa, es. Frankfurt). Segna la password del database, ma non serve nell'app.
2. **SQL Editor** > New query > incolla tutto il contenuto di `supabase/schema.sql` > Run.
3. (Solo se hai collegato un tuo SMTP: nel piano Free con l'invio email predefinito i modelli NON si modificano e si usa il link dell'email, vedi sotto.) **Authentication > Email Templates**: nei modelli **Magic Link** e **Confirm signup** sostituisci il contenuto con il codice, per esempio:
   `<h2>Il tuo codice per 龙龙中文</h2><p>Codice: <b>{{ .Token }}</b></p>`
   (senza `{{ .Token }}` arriva il link invece del codice e l'app non funziona).
4. **Project Settings > API**: copia **Project URL** e la chiave **publishable** (o "anon"). Incollale in cima a `config.js` (`SUPABASE_URL` e `SUPABASE_KEY`). La chiave pubblica si può pubblicare; la "secret"/"service_role" **mai**.
5. Ricarica il sito. In Profilo compare la scheda **Account**.

Attenzione:
- L'invio email integrato di Supabase è limitato (poche email all'ora): va bene per provare, per l'uso vero collega un tuo servizio email (Authentication > SMTP Settings: Resend, Brevo, ecc.).
- Per dare il piano completo a un account (finché non c'è l'acquisto vero) esegui nel SQL Editor l'esempio in fondo a `supabase/schema.sql`.
- "Elimina account e dati" cancella tutto dal cloud: serve anche per le regole degli store.
- È l'email di un genitore: serve una pagina di informativa privacy (cosa si salva: email e progressi, nient'altro) prima di pubblicare l'app. Non si raccolgono dati di Noah oltre ai progressi.

### Accesso con il link dell'email (senza modificare i modelli)
Con l'invio email predefinito di Supabase l'email contiene un link «Sign in», non un codice. L'app lo gestisce:
1. **Authentication > URL Configuration**: in **Site URL** scrivi l'indirizzo del tuo sito Netlify (es. `https://nome.netlify.app`) e aggiungilo anche in **Redirect URLs**.
2. In app: Profilo > Account > email > Invia. Poi apri l'email **sullo stesso telefono** e tocca «Sign in»: l'app si apre già collegata.
3. Il link vale una volta sola e scade presto. Se non funziona, rifai l'invio.

## Android: dove stanno i file
- Audio gratis e tratti: dentro l'app (`native/www`).
- Audio a pagamento: scaricati dopo l'acquisto nella cartella privata dell'app (plugin `@capacitor/filesystem`, `js/native.js`); non si perdono pulendo la cache.
- Progressi: copia automatica in `Documenti/LongLong/progressi-longlong.json` (ogni modifica, con 8 s di attesa) + account cloud.
- Dopo `npm install` in `native/`: `npx cap sync`.

## La mia voce (madrelingua)
Profilo → "La mia voce": registra le parole (16 kHz, restano sul telefono in IndexedDB), prova subito toni e suoni, e con "Esporta" scarichi un unico file `mia-voce-longlong-DATA.json` (audio + risultati). Si può usare al posto della voce sintetica ("Usa la mia voce").

## iPhone: microfono nativo e riconoscimento di Apple (plugin `longlong-speech`)
Su un Mac con Xcode, da `native/`:
1. `npm install`
2. `npx cap add ios` (una volta sola)
3. `npm run www && npx cap sync ios`
4. `npm run prepare:platforms` (aggiunge le frasi del microfono e del riconoscimento vocale in Info.plist; vale anche per Android: RECORD_AUDIO)
5. `npx cap open ios`: in Xcode scegli il tuo team (Signing & Capabilities) e premi Run sul telefono.

Cosa cambia solo nell'app: il microfono dà campioni grezzi (senza filtri del browser) e i suoni vengono riconosciuti da Apple (cinese, sul dispositivo se disponibile).
Se Apple non è disponibile, ricade su Vosk; sul sito e su Android non cambia nulla. La parola attesa NON viene passata ad Apple come suggerimento, così non "corregge" una pronuncia sbagliata.
Il codice Swift è in `native/plugins/longlong-speech/ios/Plugin/`.

## Codemagic (compilare senza Mac)
`codemagic.yaml` è nella radice. Collega il repository a Codemagic: parti da **ios-prova** (non serve l'account Apple) per vedere se il codice Swift compila; poi **android-prova** per un APK; **ios-testflight** solo con l'account Apple Developer. Imposta le variabili del gruppo `longlong` (PACK_URL, RC_KEY_IOS, RC_KEY_ANDROID). Il modello Vosk (`models/vosk-cn.tar.gz`) non è nel repository: serve solo ad Android.
