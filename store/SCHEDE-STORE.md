# 龙龙中文 – Schede per App Store Connect e Google Play

Da compilare prima: [TITOLARE], [EMAIL], URL privacy = `https://<tuo-sito-netlify>/privacy.html`.

## 1. App Store Connect – "Privacy dell'app" (App Privacy)
- **Raccogliete dati da quest'app?** → **No, non raccogliamo dati da questa app.**
  (L'audio del microfono è elaborato solo sul dispositivo e non lascia mai il telefono; nessun analytics, nessun account, nessuna pubblicità.)
- **URL informativa privacy**: la pagina `privacy.html`.
- **Tracciamento (ATT)**: nessuno → non serve il popup di tracciamento.

### Classificazione per età (questionario)
Tutte le risposte "Nessuno/No" (violenza, contenuti sessuali, gioco d'azzardo, accesso web illimitato, ecc.). Risultato atteso: 4+.

### Categoria "Bambini" (facoltativo)
Se vuoi comparire in "Bambini": fascia 6-8 o 9-11. Richiede: nessuna pubblicità, nessun link esterno senza controllo parentale, nessuna analisi di terze parti. L'app rispetta tutto, ma gli acquisti in-app richiedono un "parental gate". **Decidilo prima: se non scegli la categoria Bambini, il passaggio è più semplice.**

### Crittografia (export compliance)
Già impostato: `ITSAppUsesNonExemptEncryption = false`. Risposta: "No, usa solo la crittografia standard del sistema".

### Autorizzazioni (testi già nell'app)
- Microfono: per esercitare pronuncia e toni.
- Riconoscimento vocale: per controllare la pronuncia (solo su dispositivo).

## 2. Google Play – "Sicurezza dei dati" (Data safety)
- **L'app raccoglie o condivide dati utente richiesti?** → **No**.
- **Tutti i dati sono crittografati in transito?** → non applicabile (nessun dato in transito).
- **Gli utenti possono chiedere la cancellazione dei dati?** → non applicabile (nessun dato raccolto; i dati locali si cancellano disinstallando).
- **Audio**: elaborato solo sul dispositivo, non raccolto.
- **Pubblico (Target audience)**: se scegli 5-8/9-12 entri nella policy "Famiglie": no pubblicità, SDK conformi. Va bene, ma verifica il questionario.
- **Classificazione dei contenuti (IARC)**: tutte "No".
- **Dichiarazione pubblicità**: l'app non contiene annunci.
- **Autorizzazioni**: RECORD_AUDIO (esercizi di pronuncia).
- **Acquisti in-app**: prodotto non consumabile `it.longlong.chinese.premium`.

## 3. Testi per la scheda (bozza)
**Nome**: 龙龙中文 – Impara il cinese
**Sottotitolo (iOS, 30 car.)**: HSK 1 per bambini e famiglie
**Descrizione breve (Android, 80 car.)**: Impara le prime parole di cinese con giochi, caratteri e pronuncia.
**Descrizione**:
Impara il cinese un po' ogni giorno, con calma e senza fretta. 龙龙中文 segue il nuovo livello HSK 1 con lezioni brevi, giochi nel Dojo, tracciamento dei caratteri e ripasso intelligente delle parole.
• Lezioni brevi con parole e frasi, audio nativo
• Tracciare i caratteri con l'ordine dei tratti
• Esercizi di pronuncia e toni con il microfono (elaborazione sul dispositivo)
• Ripasso a intervalli: le parole difficili tornano più spesso
• "La mia voce": un genitore può registrare la propria voce
• Nessuna pubblicità, nessun account, nessun dato raccolto
Gratis: le prime 20 lezioni. Un acquisto una tantum sblocca tutto il corso.
Nota: 龙龙中文 non è affiliata né approvata da Hanban/CLEC o dagli enti dell'esame HSK.

**Parole chiave (iOS, 100 car.)**: cinese,mandarino,HSK,bambini,caratteri,pinyin,toni,hanzi,imparare

## 4. Immagini da preparare
- Icona 1024×1024 (senza trasparenza).
- Screenshot: iPhone 6,7" (1290×2796 o 1284×2778) minimo 3; iPad solo se l'app lo supporta.
- Android: icona 512×512, immagine in evidenza 1024×500, almeno 2 screenshot.
