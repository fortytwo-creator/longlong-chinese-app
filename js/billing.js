/* Acquisto vero dentro l'app (solo nella versione installata da Google Play / App Store), con RevenueCat.
   Nel sito web questo modulo resta spento e vale il codice di attivazione (js/entitlement.js).
   Configurazione: CONFIG.rcKeyAndroid / CONFIG.rcKeyIos (chiavi pubbliche di RevenueCat, si possono mettere nell'app),
   prodotto/abbonamento nell'offerta "current" di RevenueCat, e permesso (entitlement) chiamato "premium".
   NON PROVATO su un telefono vero: va verificato con un acquisto di prova (tester di Google Play / sandbox Apple). */
(function () {
  var plugin = null, configured = false, price = '';

  function P() {
    if (plugin) return plugin;
    var C = window.Capacitor;
    plugin = C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.Purchases || null;
    return plugin;
  }
  function key() {
    var C = window.CONFIG || {}, plat = window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform();
    return plat === 'ios' ? C.rcKeyIos : C.rcKeyAndroid;
  }
  function active(info) { return !!(info && info.customerInfo ? info.customerInfo : info) && !!(((info.customerInfo || info).entitlements || {}).active || {}).premium; }

  function init() {
    if (!P() || !key()) return Promise.resolve(false);
    if (configured) return Promise.resolve(true);
    return P().configure({ apiKey: key() }).then(function () { configured = true; return P().getOfferings(); })
      .then(function (o) { var pk = o && o.current && o.current.availablePackages && o.current.availablePackages[0]; price = pk && pk.product ? pk.product.priceString : ''; return true; })
      .catch(function () { return false; });
  }

  window.Billing = {
    available: function () { return !!(P() && key()); },
    init: init,
    price: function () { return price; },
    /* Promise<bool>: true se il piano completo è attivo */
    buy: function () {
      return init().then(function () { return P().getOfferings(); }).then(function (o) {
        var pk = o && o.current && o.current.availablePackages && o.current.availablePackages[0];
        if (!pk) throw new Error('Nessuna offerta disponibile');
        return P().purchasePackage({ aPackage: pk });
      }).then(active);
    },
    restore: function () { return init().then(function () { return P().restorePurchases(); }).then(active); },
    /* all'avvio: se l'acquisto risulta attivo (anche fatto su un altro telefono) sblocca il piano */
    check: function () { return init().then(function (ok) { return ok ? P().getCustomerInfo().then(active) : false; }).catch(function () { return false; }); }
  };
})();
