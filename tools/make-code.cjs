#!/usr/bin/env node
/* Codici di attivazione del piano completo (per regali, tester, i telefoni di famiglia).
   Uso:
     node tools/make-code.cjs --nuovi 5      crea 5 codici casuali e stampa codice + impronta
     node tools/make-code.cjs IL-MIO-CODICE  stampa l'impronta di un codice scelto da te
   Incolla le impronte nell'elenco PREMIUM_HASHES in js/entitlement.js (i codici NON vanno scritti in chiaro nell'app).
   Attenzione: non c'è un server, quindi ogni codice vale per chiunque lo conosca e si può usare più volte. */
const crypto = require('crypto');
const h = c => crypto.createHash('sha256').update(c).digest('hex');
const a = process.argv.slice(2);
if (a[0] === '--nuovi') {
  const n = parseInt(a[1], 10) || 1, abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  for (let i = 0; i < n; i++) {
    const r = Array.from(crypto.randomBytes(12), b => abc[b % abc.length]).join('');
    const code = 'LL-' + r.slice(0, 4) + '-' + r.slice(4, 8) + '-' + r.slice(8);
    console.log(code + '   ' + h(code));
  }
} else {
  const code = (a[0] || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!code) { console.error('Uso: node tools/make-code.cjs --nuovi 5   oppure   node tools/make-code.cjs IL-MIO-CODICE'); process.exit(1); }
  console.log(h(code));
}
