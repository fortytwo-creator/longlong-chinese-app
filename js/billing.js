/* Acquisto diretto dagli store (App Store / Google Play), senza servizi esterni né server.
   Usa il plugin gratuito "cordova-plugin-purchase" (MIT): nell'app compare come window.CdvPurchase.
   Un solo prodotto "non consumabile" (si paga una volta, per sempre): CONFIG.productId (default it.longlong.chinese.premium),
   creato con lo stesso identificativo sia su App Store Connect sia su Google Play Console.
   Il piano completo si salva sul telefono (Ent.set): non c'è nessun server che lo conosca. Per un nuovo telefono c'è "Ho già acquistato"
   (ripristina dall'account dello store). Nel sito web questo modulo resta spento e vale il codice di attivazione (js/entitlement.js).
   NON PROVATO su un telefono vero: va verificato con un acquisto di prova (tester di Google Play / sandbox Apple). */
(function () {
  var initP = null, pending = null, lastErr = '', handlers = false;

  function C() { return window.CONFIG || {}; }
  function productId() { return C().productId || 'it.longlong.chinese.premium'; }
  function isNative() { var K = window.Capacitor; return !!(K && K.isNativePlatform && K.isNativePlatform()); }
  function plat() { var K = window.Capacitor; return K && K.getPlatform ? K.getPlatform() : ''; }
  function CP() { return window.CdvPurchase || null; }
  function waitCP(ms) {
    return new Promise(function (res) {
      var t0 = Date.now();
      (function tick() { if (CP()) return res(CP()); if (Date.now() - t0 > ms) return res(null); setTimeout(tick, 150); })();
    });
  }
  function platform(cp) { return plat() === 'ios' ? cp.Platform.APPLE_APPSTORE : cp.Platform.GOOGLE_PLAY; }
  function grant() { try { window.Ent.set(true); } catch (e) { /* ignora */ } }
  function isMine(t) { return (t.products || []).some(function (p) { return p.id === productId(); }); }

  function init() {
    if (initP) return initP;
    if (!isNative() || C().noStore) return Promise.resolve(false);
    initP = waitCP(6000).then(function (cp) {
      if (!cp) return false;
      var store = cp.store, pf = platform(cp);
      if (!handlers) {
        handlers = true;
        store.register([{ id: productId(), type: cp.ProductType.NON_CONSUMABLE, platform: pf }]);
        store.error(function (e) { lastErr = e && e.message ? e.message : String(e); });
        store.when().approved(function (t) {
          if (isMine(t)) { grant(); if (pending) { pending.res(true); pending = null; } }
          t.finish(); // conferma l'acquisto allo store (Google lo rimborsa se non si conferma entro 3 giorni)
        });
      }
      return store.initialize([pf]).then(function () { if (store.owned(productId())) grant(); return true; }).catch(function (e) { lastErr = e && e.message ? e.message : String(e); return false; });
    }).catch(function () { return false; });
    return initP;
  }

  function product() { var cp = CP(); return cp ? cp.store.get(productId(), platform(cp)) : null; }

  window.Billing = {
    available: function () { return isNative() && !C().noStore; },
    init: init,
    price: function () { var p = product(); return p && p.pricing && p.pricing.price ? p.pricing.price : ''; },
    error: function () { return lastErr; },
    /* Promise<bool>: true se il piano completo è stato acquistato (false se annullato) */
    buy: function () {
      return init().then(function (ok) {
        if (!ok) throw new Error('Gli acquisti non sono disponibili su questo telefono.' + (lastErr ? ' (' + lastErr + ')' : ''));
        var cp = CP(), p = product(), offer = p && p.getOffer();
        if (!offer) throw new Error('Il prodotto non risulta negli store: controlla di averlo creato con l\'identificativo ' + productId());
        return new Promise(function (res, rej) {
          pending = { res: res, rej: rej };
          cp.store.order(offer).then(function (err) {
            if (!err) return;
            pending = null;
            if (err.code === cp.ErrorCode.PAYMENT_CANCELLED) res(false); else rej(new Error(err.message || 'Acquisto non riuscito'));
          });
          setTimeout(function () { if (pending) { pending = null; res(window.Ent.isPremium()); } }, 120000);
        });
      });
    },
    /* "Ho già acquistato": chiede agli store gli acquisti di questo account */
    restore: function () {
      return init().then(function (ok) {
        if (!ok) throw new Error('Gli acquisti non sono disponibili su questo telefono.');
        return CP().store.restorePurchases();
      }).then(function () { return new Promise(function (res) { setTimeout(function () { res(window.Ent.isPremium()); }, 2500); }); });
    },
    /* all'avvio: se lo store dice che è già acquistato, sblocca (senza chiedere nulla all'utente) */
    check: function () { return init().then(function () { try { var cp = window.CdvPurchase; if (cp && cp.store && cp.store.owned && cp.store.owned(productId())) grant(); } catch (e) { /* ignora */ } return window.Ent.isPremium(); }).catch(function () { return false; }); }
  };
})();
