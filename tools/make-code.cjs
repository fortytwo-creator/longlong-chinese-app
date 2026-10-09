#!/usr/bin/env node
/* Crea l'impronta (hash) di un codice di attivazione del piano completo.
   Uso:  node tools/make-code.cjs IL-MIO-CODICE
   Poi incolla l'impronta stampata nell'elenco PREMIUM_HASHES in js/entitlement.js. I codici non vanno scritti in chiaro nell'app. */
const crypto = require('crypto');
const code = (process.argv[2] || '').trim().toUpperCase().replace(/\s+/g, '');
if (!code) { console.error('Uso: node tools/make-code.cjs IL-MIO-CODICE'); process.exit(1); }
console.log(crypto.createHash('sha256').update(code).digest('hex'));
