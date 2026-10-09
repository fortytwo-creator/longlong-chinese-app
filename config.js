/* Impostazioni opzionali. NON scrivere qui chiavi segrete: questo file viene pubblicato insieme al sito.
   L'app usa i file audio già creati (cartella audio/), quindi non servono chiavi per funzionare.
   - azureKey / azureRegion: solo se vuoi che la voce online (Azure) copra i testi senza file audio. Meglio lasciarli vuoti.
   - supabaseUrl / supabaseKey: account e salvataggio nel cloud. La chiave è quella PUBBLICA ("publishable" o "anon"), mai la "service_role"/"secret".
   - packUrl: indirizzo (https://…/) dove hai messo la cartella audio-premium/. L'app la scarica dopo l'acquisto.
   - assetsBundled: true solo nella versione per gli store (audio gratis e tratti dei caratteri sono dentro l'app).
   - buyUrl: indirizzo della pagina dove i genitori comprano il codice del piano completo (facoltativo). */
(function () {
  var SUPABASE_URL = 'https://rppkvbtyfobteywaollz.supabase.co';   // es. 'https://abcdefgh.supabase.co'   (Supabase > Project Settings > API > Project URL)
  var SUPABASE_KEY = 'sb_publishable_LR94C3CobSTPLXrO1cpCwg_nIvw5r-2';   // la chiave PUBBLICA: 'sb_publishable_...' (o la "anon"). MAI la "secret" / "service_role".
  function ls(k) { try { return localStorage.getItem('CONFIG_' + k); } catch (e) { return null; } }
  window.CONFIG = {
    azureKey: ls('azureKey') || '',
    azureRegion: ls('azureRegion') || 'italynorth',
    buyUrl: ls('buyUrl') || '',
    packUrl: ls('packUrl') || '',
    supabaseUrl: ls('supabaseUrl') || SUPABASE_URL,
    supabaseKey: ls('supabaseKey') || SUPABASE_KEY,
    assetsBundled: false
  };
})();
