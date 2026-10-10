/* Piano gratuito / completo.
   Gratis: le prime 20 lezioni (50 parole). Completo: tutte le 100 lezioni e 300 parole.
   ATTENZIONE: questo controllo è sul telefono e quindi aggirabile da chi sa programmare.
   Per un vero pagamento serve un servizio esterno (negozio app, Stripe + funzione server, ...) che emetta i codici:
   qui c'è solo l'interruttore che quel servizio dovrà attivare. Per creare un codice: node tools/make-code.js MIO-CODICE */
(function () {
  var S = window.Store;
  /* hash SHA-256 dei codici validi (non i codici in chiaro). I codici veri li hai tu (tools/make-code.cjs --nuovi) */
  window.PREMIUM_HASHES = window.PREMIUM_HASHES || [
    '8c01e004311b799d88eb12d8089ae358c61a365be4265f4ee3fded955da47403',
    '56868b01996e214874804fa2b5a36d320459a4f89d0c6119ea0f45f6c8cb1b0e',
    '1d61c9f7aa66af64bb5b0ea69f623aadcf1eec92cbd07ebdda1066a39f51a58b',
    '1f01ca2f425e43fe71243598effa80b8d659a14c7c6da0725c4d25e074e252d8',
    '1abc6ab5c7e70a053306e9f5541b8ee0add53345ec8fabb8660c2b791c6bba41',
    'a112c90db2655c992aa922847db86c5fa115ab5bcc32fb6cf38b8b45f4ecb310'
  ];

  function sha256(str) {
    var K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    var b = unescape(encodeURIComponent(str)), bytes = [], i, j;
    for (i = 0; i < b.length; i++) bytes.push(b.charCodeAt(i));
    var bl = bytes.length * 8; bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bl >>> (i * 8)) & 255);
    function rr(x, n) { return (x >>> n) | (x << (32 - n)); }
    for (i = 0; i < bytes.length; i += 64) {
      var w = [];
      for (j = 0; j < 16; j++) w[j] = (bytes[i + j * 4] << 24) | (bytes[i + j * 4 + 1] << 16) | (bytes[i + j * 4 + 2] << 8) | bytes[i + j * 4 + 3];
      for (j = 16; j < 64; j++) {
        var s0 = rr(w[j - 15], 7) ^ rr(w[j - 15], 18) ^ (w[j - 15] >>> 3), s1 = rr(w[j - 2], 17) ^ rr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      var a = H[0], bb = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (j = 0; j < 64; j++) {
        var S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K[j] + w[j]) | 0;
        var S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22), mj = (a & bb) ^ (a & c) ^ (bb & c), t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + bb) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
  }

  function norm(code) { return String(code || '').trim().toUpperCase().replace(/\s+/g, ''); }

  window.Ent = {
    sha256: sha256,
    isPremium: function () { return !!S.get().profile.premium; },
    lessonOpen: function (L) { return L.free || this.isPremium(); },
    wordOpen: function (w) { return w.free || this.isPremium(); },
    words: function () { var p = this.isPremium(); return window.ALLWORDS.filter(function (w) { return p || w.free; }); },
    activate: function (code) {
      var ok = window.PREMIUM_HASHES.indexOf(sha256(norm(code))) >= 0;
      if (ok) { S.get().profile.premium = true; S.save(); }
      return ok;
    },
    set: function (on) { S.get().profile.premium = !!on; S.save(); },
    deactivate: function () { S.get().profile.premium = false; S.save(); }
  };
})();
