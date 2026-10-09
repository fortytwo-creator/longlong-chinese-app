/* Account e salvataggio nel cloud (Supabase). Il genitore entra con l'email e un codice a 6 cifre.
   Si salvano solo i progressi di Noah (parole, lezioni, stelle, serie). Il piano a pagamento è deciso dal server (tabella entitlements).
   Funziona anche offline: i progressi restano sul telefono e si sincronizzano appena torna la rete.
   Senza CONFIG.supabaseUrl e CONFIG.supabaseKey (chiave PUBBLICA "publishable") questa parte resta spenta. */
(function () {
  var S = window.Store, AUTH = 'longlong.auth', session = null, timer = null, busy = null, listeners = [], last = { at: 0, error: '' };

  function C() { return window.CONFIG || {}; }
  function url() { return (C().supabaseUrl || '').replace(/\/+$/, ''); }
  function configured() { return !!(url() && C().supabaseKey); }
  function notify() { listeners.forEach(function (f) { try { f(); } catch (e) { /* ignora */ } }); }

  function load() { try { session = JSON.parse(localStorage.getItem(AUTH)); } catch (e) { session = null; } try { last.at = +localStorage.getItem(AUTH + '.at') || 0; } catch (e) { /* ignora */ } }
  function store(s) { session = s; try { if (s) localStorage.setItem(AUTH, JSON.stringify(s)); else localStorage.removeItem(AUTH); } catch (e) { /* ignora */ } }
  load();

  function headers(token) {
    return { apikey: C().supabaseKey, Authorization: 'Bearer ' + (token || C().supabaseKey), 'Content-Type': 'application/json' };
  }
  function http(path, opt) {
    return fetch(url() + path, opt).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { /* non JSON */ }
        if (!r.ok) { var m = (j && (j.msg || j.message || j.error_description || j.error)) || ('HTTP ' + r.status); var err = new Error(m); err.status = r.status; throw err; }
        return j;
      });
    });
  }
  function toSession(j) {
    return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || (Math.floor(Date.now() / 1000) + (j.expires_in || 3600)), user: { id: j.user.id, email: j.user.email } };
  }

  /* token valido (lo rinnova se sta per scadere) */
  function token() {
    if (!session) return Promise.reject(new Error('non sei connesso'));
    if (session.expires_at - 60 > Date.now() / 1000) return Promise.resolve(session.access_token);
    return http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: headers(), body: JSON.stringify({ refresh_token: session.refresh_token }) })
      .then(function (j) { store(toSession(j)); return session.access_token; })
      .catch(function (e) { if (e.status === 400 || e.status === 401) { store(null); notify(); } throw e; });
  }
  function rest(path, opt) {
    return token().then(function (t) { opt = opt || {}; opt.headers = Object.assign(headers(t), opt.headers || {}); return http('/rest/v1/' + path, opt); });
  }

  function pull() {
    return rest('progress?select=data,updated_at&limit=1').then(function (rows) { return rows && rows[0] ? rows[0].data : null; });
  }
  function push() {
    var body = { user_id: session.user.id, data: S.exportData(), updated_at: new Date().toISOString() };
    return rest('progress?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(body) });
  }
  function pullPremium() {
    return rest('entitlements?select=premium&limit=1').then(function (rows) {
      if (rows && rows[0] && rows[0].premium && window.Ent && !window.Ent.isPremium()) { window.Ent.set(true); return true; }
      return false;
    });
  }

  /* scarica, unisce, rimanda su. Una sola alla volta. */
  function sync() {
    if (!configured() || !session) return Promise.resolve(false);
    if (busy) return busy;
    clearTimeout(timer); timer = null;
    busy = pull().then(function (remote) { var changed = S.mergeRemote(remote); return pullPremium().catch(function () { return false; }).then(function (p) { return changed || p; }); })
      .then(function (changed) { return push().then(function () { return changed; }); })
      .then(function (changed) {
        last.at = Date.now(); last.error = ''; try { localStorage.setItem(AUTH + '.at', String(last.at)); } catch (e) { /* ignora */ }
        busy = null; notify(); return changed;
      }).catch(function (e) { busy = null; last.error = e && e.message ? e.message : String(e); notify(); return false; });
    return busy;
  }
  function later() { if (!configured() || !session) return; clearTimeout(timer); timer = setTimeout(sync, 6000); }
  S.onSave(later);

  window.Cloud = {
    configured: configured,
    signedIn: function () { return !!session; },
    email: function () { return session ? session.user.email : ''; },
    lastSync: function () { return last.at; },
    lastError: function () { return last.error; },
    onChange: function (f) { listeners.push(f); },
    sync: sync,
    /* 1) manda il codice per email */
    sendCode: function (email) {
      return http('/auth/v1/otp?redirect_to=' + encodeURIComponent(location.origin + location.pathname), { method: 'POST', headers: headers(), body: JSON.stringify({ email: email, create_user: true }) }).then(function () { return true; });
    },
    /* 2) controlla il codice ed entra; poi unisce i progressi */
    verify: function (email, code) {
      return http('/auth/v1/verify', { method: 'POST', headers: headers(), body: JSON.stringify({ type: 'email', email: email, token: String(code).replace(/\s+/g, '') }) })
        .then(function (j) { store(toSession(j)); notify(); return sync(); }).then(function () { return true; });
    },
    signOut: function () {
      var t = session && session.access_token;
      store(null); notify();
      if (t && configured()) fetch(url() + '/auth/v1/logout', { method: 'POST', headers: headers(t) }).catch(function () { /* ignora */ });
      return Promise.resolve();
    },
    /* dopo "Azzera i progressi": sovrascrive anche il cloud */
    forcePush: function () { clearTimeout(timer); timer = null; if (!configured() || !session) return Promise.resolve(false); return push().then(function () { return true; }).catch(function () { return false; }); },
    /* cancella account e dati (richiesto anche dagli store) */
    deleteAccount: function () {
      return rest('rpc/delete_my_account', { method: 'POST', body: '{}' }).then(function () { store(null); notify(); return true; });
    }
  };

  /* Accesso dal link dell'email: Supabase riporta qui con #access_token=... nell'indirizzo */
  function fromLink() {
    var h = location.hash || '';
    if (!configured() || h.indexOf('access_token=') < 0) {
      if (h.indexOf('error_description=') >= 0) { var q0 = new URLSearchParams(h.replace(/^#/, '')); last.error = (q0.get('error_description') || 'link non valido').replace(/\+/g, ' '); try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignora */ } return Promise.resolve(false); }
      return Promise.resolve(false);
    }
    var q = new URLSearchParams(h.replace(/^#/, '')), at = q.get('access_token'), rt = q.get('refresh_token');
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignora */ }
    if (!at || !rt) return Promise.resolve(false);
    return http('/auth/v1/user', { headers: headers(at) }).then(function (u) {
      store({ access_token: at, refresh_token: rt, expires_at: +q.get('expires_at') || (Math.floor(Date.now() / 1000) + (+q.get('expires_in') || 3600)), user: { id: u.id, email: u.email } });
      notify(); return sync();
    }).then(function () { return true; }).catch(function (e) { last.error = e.message; return false; });
  }
  window.Cloud.fromLink = fromLink;

  if (configured() && session) { window.addEventListener('online', sync); setTimeout(sync, 1500); }
})();
