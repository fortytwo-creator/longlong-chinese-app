/* 龙龙中文 - schermate, corso guidato (100 lezioni) e dojo. Tutti i pulsanti usano la delega degli eventi. */
(function () {
  window.APP_VERSION = '2026-10-10 · ios 1';
  'use strict';

  var Ut = window.Util, Steps = window.Steps, A = window.AudioKit, S = window.Store, Ent = window.Ent, Off = window.Offline, P = window.Pitch;
  var UNITS = window.UNITS, TONES = window.TONES, LESSONS = window.LESSONS, PARTS = window.PARTS;
  var ALL = window.ALLWORDS, BYID = window.WORDBYID, BYZH = window.WORDBYZH;
  var esc = Ut.esc, shuffle = Ut.shuffle, pick = Ut.pick, zhHtml = Ut.zhHtml, pyHtml = Ut.pyHtml, stars = Ut.stars, say = Ut.say, toast = Ut.toast;
  var toneColor = Ut.toneColor, toneSvg = Ut.toneSvg, sentHtml = Ut.sentHtml, $ = Ut.$;
  var UBYID = {}; UNITS.forEach(function (u) { UBYID[u.id] = u; });
  var N = LESSONS.length, FREE_N = window.FREE_LESSONS;

  /* ---------- corso: stato ---------- */
  function lessonUnlocked(i) {                       // ordine: la lezione precedente deve essere finita
    if (S.get().profile.unlockAll || i === 0) return true;
    return S.lessonStars(LESSONS[i - 1].id) > 0;
  }
  function lessonOpen(i) { return Ent.lessonOpen(LESSONS[i]); }   // piano: gratis o completo
  function doneCount() { return LESSONS.filter(function (L) { return S.lessonStars(L.id) > 0; }).length; }
  function nextIndex() {
    for (var i = 0; i < N; i++) if (S.lessonStars(LESSONS[i].id) === 0) return i;
    return -1;
  }
  function wordsBefore(idx) {
    var seen = {}, out = [];
    for (var j = 0; j < idx; j++) LESSONS[j].words.forEach(function (w) { if (!seen[w.id]) { seen[w.id] = 1; out.push(w); } });
    return out;
  }
  function learnedWords() {
    var seen = {}, out = [];
    LESSONS.forEach(function (L) { if (S.lessonStars(L.id) > 0) L.words.forEach(function (w) { if (!seen[w.id]) { seen[w.id] = 1; out.push(w); } }); });
    return out;
  }
  function openWords() { return Ent.words(); }
  function total() { return openWords().length; }

  /* ---------- schermate ---------- */
  var state = { name: 'home', id: null };

  function go(name, id) {
    A.stop(); state = { name: name, id: id || null };
    render(); $('#view').scrollTop = 0;
  }

  function updateHeader() {
    var s = S.get();
    $('#hAvatar').textContent = s.profile.avatar;
    $('#hName').textContent = 'Ciao, ' + s.profile.name + '!';
    $('#hStreak').textContent = s.streak; $('#hXp').textContent = s.xp; $('#hCoins').textContent = s.coins;
    var cur = (state.name === 'unit' || state.name === 'tones') ? 'arcade' : state.name;
    document.querySelectorAll('#nav [data-id]').forEach(function (b) { b.classList.toggle('active', b.dataset.id === cur); });
  }

  function dueWords() { return openWords().filter(function (w) { return S.isDue(w.id); }); }
  function act(kind, id, em, title, sub) {
    return '<button class="act" data-act="start" data-kind="' + kind + '" data-id="' + id + '"><span class="a-em">' + em + '</span><b>' + title + '</b><small>' + sub + '</small></button>';
  }
  function kpi(em, v, label) { return '<div class="kpi"><span>' + em + '</span><b>' + v + '</b><small>' + label + '</small></div>'; }
  function wordRow(w) {
    return '<button class="word" data-act="say" data-id="' + w.id + '"><span class="w-em">' + w.em + '</span><span class="w-mid"><span class="w-zh">' + zhHtml(w) + '</span><span class="w-py">' + pyHtml(w) + '</span></span><span class="w-it">' + esc(w.it) + '</span><span class="w-sp">🔊</span></button>';
  }
  function planCard() {
    if (Ent.isPremium()) return '<div class="plan-card"><span>💎</span><div><b>Piano completo attivo</b><small>' + N + ' lezioni · ' + ALL.length + ' parole</small></div></div>';
    return '<button class="plan-card" data-act="paywall"><span>💎</span><div><b>Piano gratuito: ' + FREE_N + ' lezioni · ' + total() + ' parole</b><small>Sblocca tutte le ' + N + ' lezioni e le ' + ALL.length + ' parole</small></div></button>';
  }

  var views = {
    home: function () {
      var s = S.get(), goal = s.profile.goal, pct = Math.min(100, Math.round(100 * s.todayActs / goal));
      var done = doneCount(), next = nextIndex(), due = dueWords().length, daily = s.dailyDone === S.today();
      var cta = done === 0 ? 'Inizia Corso' : next < 0 ? 'Rivedi il corso' : 'Continua · Lezione ' + (next + 1);
      var sub = done === 0 ? N + ' lezioni guidate: tutto il nuovo HSK 1' : next < 0 ? 'Corso completato! 🎉' : 'Prossima: ' + LESSONS[next].t;
      var html = '<section class="course-card"><div class="cc-top"><span class="cc-dragon">🐉</span><div><h2>Il corso di 龙龙</h2><p>' + esc(sub) + '</p></div></div>' +
        '<div class="bar light"><i style="width:' + Math.round(100 * done / N) + '%"></i></div><small class="cc-n">' + done + ' di ' + N + ' lezioni</small>' +
        '<button class="btn big" data-act="startcourse">' + cta + '</button></section>';
      html += planCard();
      html += '<section class="card hero" style="margin-top:12px"><div class="hero-top"><div><h2>Obiettivo di oggi</h2><p>' + Math.min(s.todayActs, goal) + ' di ' + goal + ' attività completate</p></div>' +
        '<div class="ring" style="--p:' + pct + '"><span>' + pct + '%</span></div></div>' +
        '<div class="row2"><button class="btn primary" data-act="daily">' + (daily ? '✅ Sfida fatta' : '🎯 Sfida del giorno') + '</button>' +
        '<button class="btn soft" data-act="review">🔁 Ripasso' + (due ? ' (' + due + ')' : '') + '</button></div></section>';
      html += '<button class="unit arcade-link" data-act="nav" data-id="arcade" style="margin-top:12px"><span class="u-em">🥋</span><span class="u-tx"><b>Dojo</b><small>Allenati liberamente: toni, schede, giochi</small></span><span class="u-go">›</span></button>';
      return html;
    },

    course: function () {
      var done = doneCount(), next = nextIndex(), prem = Ent.isPremium();
      var html = '<h2 class="page">Il corso</h2><p class="lead">' + done + ' di ' + N + ' lezioni completate. Ogni lezione ha una parte da leggere e una da giocare: 听 ascoltare, 说 parlare, 读 leggere, 写 scrivere.</p>' +
        '<div class="bar"><i style="width:' + Math.round(100 * done / N) + '%"></i></div>';
      var part = -1;
      LESSONS.forEach(function (L, i) {
        if (L.part !== part) {
          part = L.part;
          html += '<h3 class="sec">Parte ' + (part + 1) + ' · ' + PARTS[part] + (prem ? '' : (part * 10 < FREE_N ? '<span class="part-badge free">gratis</span>' : '<span class="part-badge">💎 completo</span>')) + '</h3>';
        }
        var st = S.lessonStars(L.id), open = lessonOpen(i), locked = open && !lessonUnlocked(i);
        var icon = !open ? '💎' : locked ? '🔒' : L.n;
        html += '<button class="node' + (locked ? ' locked' : '') + (!open ? ' premium' : '') + (i === next && open ? ' next' : '') + (st ? ' done' : '') + '" data-act="lesson" data-id="' + i + '">' +
          '<span class="n-num">' + icon + '</span><span class="n-em">' + L.e + '</span>' +
          '<span class="n-tx"><b>' + esc(L.t) + '</b><small>' + (L.boss ? 'Gara di ripasso' : L.words.map(function (w) { return w.zh; }).join(' ')) + '</small></span>' +
          '<span class="stars">' + (st ? stars(st) : (i === next && open ? '▶' : '')) + '</span></button>';
      });
      return html;
    },

    arcade: function () {
      var s = S.get();
      var html = '<h2 class="page">Dojo</h2><p class="lead">Allenamento libero: scegli tu cosa fare e quanto giocare.</p>' +
        '<button class="unit tone-unit" data-act="nav" data-id="tones"><span class="u-em">🎵</span><span class="u-tx"><b>I 4 toni</b><small>Ascolta, ripeti, confronta</small></span><span class="u-go">›</span></button>' +
        '<h3 class="sec">Parole a tema</h3><div class="units">';
      UNITS.forEach(function (u) {
        var ow = u.words.filter(Ent.wordOpen.bind(Ent)), p = S.unitProgress(u, ow), st = (s.units[u.id] || {}).stars || 0, locked = ow.length < 2;
        html += '<button class="unit' + (locked ? ' locked' : '') + '" data-act="unit" data-id="' + u.id + '" style="--c:' + u.color + '"><span class="u-em">' + u.emoji + '</span><span class="u-tx"><b>' + u.title + '</b><small>' +
          (locked ? '💎 Nel piano completo' : u.desc + ' · ' + ow.length + (ow.length === u.words.length ? '' : ' di ' + u.words.length) + ' parole') + '</small>' +
          '<span class="bar sm"><i style="width:' + p + '%"></i></span></span><span class="u-meta"><span class="stars">' + stars(st) + '</span><small>' + p + '%</small></span></button>';
      });
      return html + '</div>';
    },

    unit: function (id) {
      var u = UBYID[id], ow = u.words.filter(Ent.wordOpen.bind(Ent));
      var html = '<button class="back" data-act="nav" data-id="arcade">‹ Dojo</button>' +
        '<div class="unit-head" style="--c:' + u.color + '"><span>' + u.emoji + '</span><div><h2>' + u.title + '</h2><p>' + u.desc + '</p></div></div>' +
        '<h3 class="sec">Attività</h3><div class="acts">' +
        act('flash', id, '🃏', 'Schede', 'Impara le parole') + act('listen', id, '👂', 'Ascolta', 'Cosa hai sentito?') +
        act('listenzh', id, '🔈', 'Ascolta e leggi', 'Scegli il carattere') + act('mean', id, '🔤', 'Significato', 'Cinese → italiano') +
        act('rev', id, '🔁', 'Inverso', 'Italiano → cinese') + act('match', id, '🧩', 'Abbina', 'Trova le coppie') +
        act('puzzle', id, '🔡', 'Puzzle pinyin', 'Carattere + suono') + act('repeat', id, '🎤', 'Ripeti', 'Toni e sillabe') +
        act('write', id, '✍️', 'Scrivi', 'Traccia i caratteri') + '</div>';
      if (!Ent.isPremium() && ow.length < u.words.length) html += '<button class="plan-card" data-act="paywall"><span>💎</span><div><b>' + (u.words.length - ow.length) + ' parole nel piano completo</b><small>Sbloccale per giocare con tutte</small></div></button>';
      html += '<h3 class="sec">Parole (' + u.words.length + ')</h3><div class="words">';
      u.words.forEach(function (w) {
        var open = Ent.wordOpen(w), st = S.get().words[w.id], lvl = st ? st.box : 0;
        html += '<button class="word' + (open ? '' : ' locked') + '" data-act="' + (open ? 'say' : 'paywall') + '" data-id="' + w.id + '"><span class="w-em">' + w.em + '</span><span class="w-mid"><span class="w-zh">' + zhHtml(w) + '</span><span class="w-py">' + pyHtml(w) + '</span></span>' +
          '<span class="w-it">' + esc(w.it) + '</span>' + (open ? '<span class="w-lvl">' + '●'.repeat(lvl) + '<em>' + '●'.repeat(5 - lvl) + '</em></span><span class="w-sp">🔊</span>' : '<span class="w-lock">💎</span>') + '</button>';
      });
      return html + '</div>';
    },

    tones: function () {
      var items = Ut.toneItems(openWords()), html = '<button class="back" data-act="nav" data-id="arcade">‹ Dojo</button><h2 class="page">I 4 toni</h2><p class="lead">In cinese la stessa sillaba cambia significato col tono. Tocca una carta per ascoltare, poi prova a ripetere!</p><div class="tone-cards">';
      TONES.slice(0, 4).forEach(function (t) {
        var ex = items.filter(function (x) { return x.t === t.n; });
        html += '<div class="tcard" style="--c:' + t.color + '"><button data-act="tonesample" data-id="' + t.n + '" class="tc-main"><svg viewBox="0 0 60 40" class="tsvg">' + toneSvg(t.n) + '</svg>' +
          '<b>' + t.name + '</b><small>' + t.hint + '</small></button></div>';
      });
      html += '</div><h3 class="sec">Parole da provare</h3>';
      [1, 2, 3, 4].forEach(function (n) {
        var ex = items.filter(function (x) { return x.t === n; }).slice(0, 10);
        html += '<div class="tone-ex" style="color:' + toneColor(n) + '"><b>' + n + '°</b>' + ex.map(function (x) {
          return '<button data-act="sayzh" data-text="' + x.zh + '" style="color:' + toneColor(n) + '">' + x.zh + ' ' + x.py + '</button>'; }).join('') + '</div>';
      });
      var pairs = window.TONE_PAIRS.filter(function (p) { return BYZH[p.a] && BYZH[p.b] && Ent.wordOpen(BYZH[p.a]) && Ent.wordOpen(BYZH[p.b]); });
      if (pairs.length) {
        html += '<h3 class="sec">Stessa sillaba, tono diverso</h3><div class="tone-pairs">' + pairs.map(function (p) {
          return '<div class="tpair"><div class="row"><button data-act="sayzh" data-text="' + p.a + '"><b>' + p.a + '</b>' + p.pa + '<small>' + p.ita + '</small></button><button data-act="sayzh" data-text="' + p.b + '"><b>' + p.b + '</b>' + p.pb + '<small>' + p.itb + '</small></button></div></div>';
        }).join('') + '</div>';
      }
      html += '<h3 class="sec">Allenati</h3><div class="acts">' +
        act('tone-listen', 'x', '👂', 'Che tono è?', 'Ascolta e scegli') + act('tone-record', 'x', '🎤', 'Ripeti il tono', 'Analisi della tua voce') + '</div>';
      return html + '<p class="lead">Miglior punteggio: <b>' + S.get().tones.best + '</b>/100</p>';
    },

    stats: function () {
      var s = S.get(), acc = s.stats.answered ? Math.round(100 * s.stats.correct / s.stats.answered) : 0, ow = openWords();
      var learned = ow.filter(function (w) { return s.words[w.id] && s.words[w.id].box >= 3; }).length;
      var seen = ow.filter(function (w) { return s.words[w.id] && s.words[w.id].seen > 0; }).length;
      var html = '<h2 class="page">Statistiche</h2><div class="kpis">' +
        kpi('🔥', s.streak, 'Giorni di fila') + kpi('⭐', s.xp, 'XP totali') + kpi('🪙', s.coins, 'Monete') +
        kpi('🎯', acc + '%', 'Risposte giuste') + kpi('👀', seen + '/' + ow.length, 'Parole viste') + kpi('📚', learned + '/' + ow.length, 'Parole imparate') + kpi('🐉', doneCount() + '/' + N, 'Lezioni del corso') + '</div>';
      html += '<h3 class="sec">Progresso per tema</h3><div class="card">';
      UNITS.forEach(function (u) {
        var uw = u.words.filter(Ent.wordOpen.bind(Ent)); if (!uw.length) return;
        var p = S.unitProgress(u, uw), st = (s.units[u.id] || {}).stars || 0;
        html += '<div class="prow"><span>' + u.emoji + ' ' + u.title + '</span><span class="stars">' + stars(st) + '</span><span class="bar sm"><i style="width:' + p + '%;background:' + u.color + '"></i></span><b>' + p + '%</b></div>';
      });
      html += '</div>';
      var weak = ow.filter(function (w) { return s.words[w.id] && s.words[w.id].ko > 0; }).sort(function (a, b) { return s.words[b.id].ko - s.words[a.id].ko; }).slice(0, 5);
      if (weak.length) { html += '<h3 class="sec">Da ripassare</h3><div class="words">' + weak.map(wordRow).join('') + '</div>'; }
      return html;
    },

    profile: function () {
      var p = S.get().profile, prem = Ent.isPremium();
      var html = '<h2 class="page">Profilo</h2><div class="card form"><label>Nome<input id="pName" type="text" maxlength="14" value="' + esc(p.name) + '"></label><div class="lbl">Avatar</div><div class="chips">';
      window.AVATARS.forEach(function (a) { html += '<button class="chip' + (a === p.avatar ? ' on' : '') + '" data-act="avatar" data-id="' + a + '">' + a + '</button>'; });
      html += '</div><div class="lbl">Obiettivo giornaliero</div><div class="chips">';
      [1, 3, 5].forEach(function (g) { html += '<button class="chip wide' + (g === p.goal ? ' on' : '') + '" data-act="goal" data-id="' + g + '">' + g + ' attività</button>'; });
      html += '</div><div class="lbl">Voce</div><div class="chips"><button class="chip wide' + (p.voice === 'FEMALE' ? ' on' : '') + '" data-act="voice" data-id="FEMALE">👩 Xiaoxiao</button>' +
        '<button class="chip wide' + (p.voice === 'MALE' ? ' on' : '') + '" data-act="voice" data-id="MALE">👨 Yunxi</button></div></div>';

      html += '<h3 class="sec">Piano</h3><div class="card form">' + (prem
        ? '<p class="lead">💎 Piano completo attivo: ' + N + ' lezioni e ' + ALL.length + ' parole.</p><button class="btn soft" data-act="deactivate">Torna al piano gratuito (prova)</button>'
        : '<p class="lead">Piano gratuito: ' + FREE_N + ' lezioni e ' + total() + ' parole. Il piano completo ha tutte le ' + N + ' lezioni e le ' + ALL.length + ' parole del nuovo HSK 1.</p><button class="btn primary" data-act="paywall">💎 Sblocca il piano completo</button>') + '</div>';

      html += '<h3 class="sec">Salvataggio sul telefono</h3><div class="card form"><p class="lead">I progressi di ' + esc(p.name) + ' sono salvati su questo telefono, anche senza internet. ' +
        'Per non perderli se cambi telefono o se il browser pulisce i dati, scarica ogni tanto un backup.</p><p class="lead" id="persistTxt"></p>' +
        '<button class="btn primary" data-act="backup">💾 Scarica il backup</button><button class="btn soft" data-act="restore">📂 Ripristina da un backup</button>' +
        '<input type="file" id="restoreFile" accept="application/json,.json" hidden></div>';
      html += '<h3 class="sec">La mia voce</h3><div class="card form"><p class="lead">Sei madrelingua? Registra le parole con la tua voce: l\'app prova subito se riconosce toni e suoni, e puoi usarle al posto della voce sintetica. Le registrazioni restano sul telefono.</p><p class="lead" id="voiceTxt"></p>' +
        '<button class="btn primary" data-act="voicestudio">🎙️ Registra la mia voce</button><button class="btn soft" data-act="voiceuse">' + (p.useMyVoice ? '✓ Uso la mia voce (tocca per spegnere)' : 'Usa la mia voce per l\'ascolto') + '</button></div>';
      html += '<h3 class="sec">Account</h3><div class="card form" id="acctCard">' + accountInner() + '</div>';

      html += '<h3 class="sec">Usare l\'app senza internet</h3><div class="card form dl">' +
        '<p class="lead" id="swState">Controllo…</p>' +
        '<div class="dl-row"><span>🔊 Audio e caratteri (<span id="dlPack">' + (prem ? 'tutto' : 'lezioni gratuite') + '</span>)</span><b id="dlTxt">…</b></div>' +
        '<div class="bar"><i id="dlBar" style="width:0%"></i></div>' +
        '<button class="btn primary" id="dlBtn" data-act="download">⬇️ Scarica per usare offline</button>' +
        '<button class="btn soft" data-act="dlclear">Elimina i file scaricati</button>' +
        '<p class="lead" id="dlMsg"></p></div>';

      html += '<h3 class="sec">Per i genitori</h3><div class="card form">' +
        '<button class="btn soft" data-act="unlock">' + (p.unlockAll ? '🔓 Lezioni in qualsiasi ordine (tocca per bloccare)' : '🔒 Sblocca l\'ordine delle lezioni del piano') + '</button>' +
        '<button class="btn soft" data-act="testaudio">🔊 Prova l\'audio</button><p id="audioDiag" class="lead"></p>' +
        '<button class="btn soft" data-act="testmic">🎤 Prova il microfono</button><p id="micDiag" class="lead"></p>' +
        '<button class="btn soft" data-act="testicon">🖼️ Controlla l\'icona dell\'app</button><p id="iconDiag" class="lead diag"></p>' +
        '<button class="btn danger" data-act="reset">Azzera i progressi</button></div>' +
        '<p class="lead" style="text-align:center;opacity:.6">Versione ' + (window.APP_VERSION || '?') + '</p>';
      return html;
    }
  };

  function render() {
    updateHeader(); $('#view').innerHTML = views[state.name](state.id);
    if (state.name === 'profile') { refreshOffline(); showPersist(); showVoiceCount(); }
  }
  function showVoiceCount() {
    if (!window.Voice) return;
    Voice.init().then(function () { var el = $('#voiceTxt'); if (el) el.textContent = Voice.count() ? '🎙️ Parole registrate: ' + Voice.count() + ' / ' + (window.VOCAB || []).length : 'Nessuna parola registrata.'; });
  }
  function showPersist() {
    var el = $('#persistTxt'); if (!el || !navigator.storage || !navigator.storage.persisted) return;
    navigator.storage.persisted().then(function (ok) { var e2 = $('#persistTxt'); if (e2) e2.textContent = ok ? '🔒 Il telefono ha promesso di non cancellare questi dati da solo.' : '⚠️ Il telefono potrebbe cancellare questi dati se ha poco spazio: scarica un backup.'; }).catch(function () { /* ignora */ });
  }

  /* ---------- finestra attività ---------- */
  var sheet = { again: null, cleanup: null };
  function openSheet(title) {
    runCleanup(); $('#sheet').hidden = false; document.body.classList.add('lock');
    $('#sTitle').textContent = title; $('#sProg').style.width = '0%'; $('#sBody').innerHTML = ''; $('#sBody').onclick = null;
    $('#sBody').scrollTop = 0; return $('#sBody');
  }
  function runCleanup() { if (sheet.cleanup) { try { sheet.cleanup(); } catch (e) { /* ignora */ } sheet.cleanup = null; } }
  function closeSheet() { A.stop(); runCleanup(); $('#sheet').hidden = true; document.body.classList.remove('lock'); render(); }
  function setProg(f) { $('#sProg').style.width = Math.round(100 * Math.max(0, Math.min(1, f))) + '%'; }
  function mkCtl(onDone, base, span) {
    return { progress: function (i, n) { setProg(base + span * (n ? i / n : 0)); }, done: onDone, cleanup: function (fn) { sheet.cleanup = fn; } };
  }

  /* risultato di un'attività arcade */
  function finish(o) {
    var acc = o.total ? o.correct / o.total : 0, st = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1;
    var xp = o.correct * 10 + 5, coins = st * 2;
    S.addReward(xp, coins); S.activityDone();
    if (o.unit) S.setUnitResult(o.unit, st);
    if (o.daily) { S.get().dailyDone = S.today(); S.addReward(20, 5); xp += 20; coins += 5; }
    setProg(1); sheet.again = o.again;
    $('#sBody').onclick = null;
    $('#sBody').innerHTML = '<div class="result"><div class="big-stars">' + stars(st) + '</div><h2>' + ['Continua così!', 'Molto bene!', 'Fantastico!'][st - 1] + '</h2><p>' + o.correct + ' su ' + o.total + ' giuste</p>' +
      '<div class="rew"><span>⭐ +' + xp + ' XP</span><span>🪙 +' + coins + '</span></div>' +
      '<button class="btn primary" data-act="close">Fine</button><button class="btn soft" data-act="again">Ancora</button></div>';
    updateHeader();
  }

  /* ---------- arcade ---------- */
  function arcadeRun(title, runner, cfg, unit, daily) {
    var body = openSheet(title);
    sheet.again = function () { arcadeRun(title, runner, cfg, unit, daily); };
    var again = sheet.again;
    runner(body, typeof cfg === 'function' ? cfg() : cfg, mkCtl(function (r) { finish({ correct: r.correct, total: r.total, unit: unit, daily: daily, again: again }); }, 0, 1));
  }

  function toneTargets() {
    var items = Ut.toneItems(openWords());
    return shuffle([1, 2, 3, 4]).map(function (t) { return pick(items.filter(function (x) { return x.t === t; })); });
  }

  function start(kind, id) {
    var u = UBYID[id], T = u ? u.title : '', uw = u ? u.words.filter(Ent.wordOpen.bind(Ent)) : [];
    if (u && uw.length < 2) { showPaywall(); return; }
    if (kind === 'flash') return arcadeRun('Schede · ' + T, Steps.flash, { words: uw }, id);
    if (kind === 'listen') return arcadeRun('Ascolta · ' + T, Steps.quiz, { words: uw, kinds: ['listen'], n: 8 }, id);
    if (kind === 'listenzh') return arcadeRun('Ascolta e leggi · ' + T, Steps.quiz, { words: uw, kinds: ['listenzh'], n: 8 }, id);
    if (kind === 'mean') return arcadeRun('Significato · ' + T, Steps.quiz, { words: uw, kinds: ['mean'], n: 8 }, id);
    if (kind === 'rev') return arcadeRun('Inverso · ' + T, Steps.quiz, { words: uw, kinds: ['rev'], n: 8 }, id);
    if (kind === 'match') return arcadeRun('Abbina · ' + T, Steps.match, function () { return { words: shuffle(uw).slice(0, 6), mode: 'it' }; }, id);
    if (kind === 'puzzle') return arcadeRun('Puzzle pinyin · ' + T, Steps.match, function () { return { words: shuffle(uw).slice(0, 6), mode: 'py' }; }, id);
    if (kind === 'repeat') return arcadeRun('Ripeti · ' + T, Steps.repeat, function () { return { words: shuffle(uw).slice(0, 6) }; }, id);
    if (kind === 'write') return arcadeRun('Scrivi · ' + T, Steps.write, function () { return { words: shuffle(uw.filter(function (w) { return Array.from(w.zh).length <= 2; })), max: 4 }; }, id);
    if (kind === 'tone-listen') return arcadeRun('Che tono è?', Steps.quiz, function () { var ow = openWords(); return { words: ow, kinds: ['tone'], n: 8, toneItems: Ut.toneItems(ow) }; });
    if (kind === 'tone-record') return arcadeRun('Ripeti il tono', Steps.repeat, function () { return { words: toneTargets() }; });
  }
  function startDaily() {
    var pool = learnedWords();
    if (pool.length < 4) { toast('Completa prima qualche lezione del corso!'); return; }
    arcadeRun('🎯 Sfida del giorno', Steps.quiz, { words: pool, kinds: ['listen', 'listenzh', 'mean', 'rev', 'tone'], n: 8, toneItems: Ut.toneItems(pool) }, null, true);
  }
  function startReview() {
    var due = dueWords();
    if (!due.length) { toast('Nessuna parola da ripassare ora. Fai prima qualche lezione!'); return; }
    var words = due.length >= 4 ? due : due.concat(shuffle(learnedWords()).slice(0, 4));
    arcadeRun('🔁 Ripasso', Steps.quiz, { words: words, kinds: ['listen', 'mean', 'rev'], n: Math.min(10, Math.max(5, due.length)) });
  }

  /* ---------- corso: lezioni ---------- */
  function buildPages(L) {
    var pages = [{ k: 'say', t: L.intro }];
    if (L.boss) pages.push({ k: 'recap' });
    else if (L.words.length) pages.push({ k: 'words' });
    if (L.tip) pages.push({ k: 'tip', t: L.tip });
    if (L.scene) pages.push({ k: 'scene' });
    if (!L.boss && L.s && L.s.length) pages.push({ k: 'sents' });
    return pages;
  }

  function wordCard(w) {
    return '<button class="word" data-l="hear" data-zh="' + esc(w.zh) + '"><span class="w-em">' + w.em + '</span><span class="w-mid"><span class="w-zh">' + zhHtml(w) + '</span><span class="w-py">' + pyHtml(w) + '</span></span><span class="w-it">' + esc(w.it) + '</span><span class="w-sp">🔊</span></button>';
  }

  function pageHtml(L, pg, idx) {
    if (pg.k === 'say') {
      return '<div class="mascot"><div class="m-dragon">🐉</div><div class="m-bubble">' + esc(pg.t) + '</div></div>' +
        (idx === 0 ? '<div class="lesson-head"><span>' + L.e + '</span><b>Lezione ' + L.n + '</b><small>' + esc(L.t) + '</small></div>' : '');
    }
    if (pg.k === 'words') {
      return '<h3 class="pg-t">Parole nuove</h3><p class="lead">Tocca ogni parola per ascoltarla. Guarda i colori: sono i toni!</p><div class="words">' +
        L.words.map(wordCard).join('') + '</div><button class="btn soft" data-l="all">🔊 Ascolta tutte</button>';
    }
    if (pg.k === 'recap') {
      return '<h3 class="pg-t">Ripassiamo le parole</h3><p class="lead">Queste sono le parole di questa parte. Tocca per riascoltarle.</p><div class="words">' +
        L.review.map(wordCard).join('') + '</div>';
    }
    if (pg.k === 'tip') return '<div class="tipcard"><div class="t-ico">💡</div><p>' + esc(pg.t) + '</p></div>';
    if (pg.k === 'sents') {
      return '<h3 class="pg-t">Prova a leggere</h3><p class="lead">Tocca una frase per ascoltarla.</p>' +
        L.s.map(function (s) { return '<button class="sent-card" data-l="hear" data-zh="' + esc(s.zh + s.p) + '">' + sentHtml(s) + '<span class="s-it">' + esc(s.it) + '</span></button>'; }).join('');
    }
    if (pg.k === 'scene') {
      return '<h3 class="pg-t">' + esc(L.scene.title) + '</h3><p class="lead">Tocca ogni fumetto per ascoltare.</p><div class="chat">' +
        L.scene.lines.map(function (l, i) { var s = l[1]; return '<button class="bub ' + (i % 2 ? 'r' : 'l') + '" data-l="hear" data-zh="' + esc(s.zh + s.p) + '"><span class="b-av">' + l[0] + '</span><span class="b-tx">' + sentHtml(s) + '<span class="s-it">' + esc(s.it) + '</span></span></button>'; }).join('') +
        '</div><button class="btn soft" data-l="allscene">▶️ Ascolta il dialogo</button>';
    }
    return '';
  }

  /* 听说读写: le quattro abilità della pratica */
  var SECT = {
    listen: { zh: '听', pin: 'tīng', name: 'Ascoltare', color: '#5aa9ff', text: 'Ascolta con attenzione e scegli la risposta giusta.' },
    speak: { zh: '说', pin: 'shuō', name: 'Parlare', color: '#ff7a8a', text: 'Ripeti ogni parola: 龙龙 ascolta i tuoi toni sillaba per sillaba!' },
    read: { zh: '读', pin: 'dú', name: 'Leggere', color: '#5cc98a', text: 'Abbina i suoni, leggi e costruisci le frasi.' },
    write: { zh: '写', pin: 'xiě', name: 'Scrivere', color: '#ffb347', text: 'Traccia i caratteri con il dito, un tratto alla volta.' }
  };
  var SECT_ORDER = ['listen', 'speak', 'read', 'write'];

  function lessonPlan(L, idx) {
    var before = wordsBefore(idx), ws = L.boss ? shuffle(L.review).slice(0, 8) : L.words;
    var review = L.boss ? [] : shuffle(before).slice(0, 3);
    var pool = ws.concat(before.length ? shuffle(before).slice(0, 6) : []);
    var ss = L.boss ? shuffle(L.pool).slice(0, 4) : shuffle(L.s).slice(0, 3);
    var steps = [];
    var tonePool = ws.filter(function (w) { return Array.from(w.zh).length === 1; });
    var lk = ['listen', 'listenzh'];
    if (tonePool.length) lk.push('tone');
    steps.push({ sec: 'listen', name: 'Ascolta', fn: 'quiz', cfg: { words: ws.concat(review), pool: pool, kinds: lk, n: L.boss ? 10 : Math.min(9, Math.max(6, ws.length * 2)), toneItems: tonePool.length ? Ut.toneItems(tonePool) : [] } });
    steps.push({ sec: 'speak', name: 'Ripeti', fn: 'repeat', cfg: { words: L.boss ? ws.slice(0, 6) : ws } });
    if (ws.length >= 2) steps.push({ sec: 'read', name: 'Puzzle pinyin', fn: 'match', cfg: { words: shuffle(ws).slice(0, 6), mode: 'py' } });
    steps.push({ sec: 'read', name: 'Leggi', fn: 'quiz', cfg: { words: ws.concat(review), pool: pool, kinds: ['mean', 'rev'], n: L.boss ? 8 : Math.min(8, Math.max(5, ws.length * 2)) } });
    if (ss.length) steps.push({ sec: 'read', name: 'Costruisci la frase', fn: 'build', cfg: { sentences: ss } });
    var wr = shuffle(ws.filter(function (w) { return Array.from(w.zh).length <= 2; }));
    if (wr.length) steps.push({ sec: 'write', name: 'Scrivi', fn: 'write', cfg: { words: wr, max: L.boss ? 4 : 3 } });
    return steps;
  }

  function runLesson(idx) {
    var L = LESSONS[idx], pages = buildPages(L), steps = lessonPlan(L, idx);
    var total = pages.length + steps.length, pi = 0, score = { c: 0, t: 0 }, lastSec = '';
    var body = openSheet('Lezione ' + L.n + ' · ' + L.t);
    sheet.again = function () { runLesson(idx); };

    function showPage(i) {
      pi = i; setProg(i / total);
      var last = i === pages.length - 1;
      body.innerHTML = '<div class="pg">' + pageHtml(L, pages[i], i) + '</div><div class="pg-btns">' +
        (i > 0 ? '<button class="btn soft" data-l="prev">‹</button>' : '') +
        '<button class="btn primary" data-l="next">' + (last ? 'Alla pratica! ✍️' : 'Avanti') + '</button></div>';
      body.scrollTop = 0;
    }
    body.onclick = function (e) {
      var t = e.target.closest('[data-l]'); if (!t) return; var a = t.dataset.l;
      if (a === 'hear') say(t.dataset.zh);
      else if (a === 'all') Ut.sayAll(L.words.map(function (w) { return w.zh; }));
      else if (a === 'allscene') Ut.sayAll(L.scene.lines.map(function (l) { return l[1].zh + l[1].p; }));
      else if (a === 'prev') { A.stop(); showPage(Math.max(0, pi - 1)); }
      else if (a === 'next') { A.stop(); if (pi >= pages.length - 1) runStep(0); else showPage(pi + 1); }
    };

    function splash(sec, then) {
      var d = SECT[sec];
      runCleanup();
      body.innerHTML = '<div class="sect" style="--c:' + d.color + '"><div class="sect-steps">' + SECT_ORDER.map(function (k) {
        var cls = k === sec ? 'on' : SECT_ORDER.indexOf(k) < SECT_ORDER.indexOf(sec) ? 'past' : '';
        return '<i class="' + cls + '" style="--c:' + SECT[k].color + '">' + SECT[k].zh + '</i>'; }).join('') + '</div>' +
        '<div class="sect-zh">' + d.zh + '</div><h2>' + d.name + '</h2><small>' + d.pin + '</small><p>' + d.text + '</p>' +
        '<button class="btn primary" data-l="go">Via!</button></div>';
      body.scrollTop = 0;
      body.onclick = function (e) { if (e.target.closest('[data-l=go]')) then(); };
    }

    function runStep(k) {
      if (k >= steps.length) return lessonFinish(idx, score);
      var st = steps[k];
      if (st.sec !== lastSec) { lastSec = st.sec; $('#sTitle').textContent = 'Lezione ' + L.n + ' · ' + SECT[st.sec].zh + ' ' + SECT[st.sec].name; setProg((pages.length + k) / total); return splash(st.sec, function () { exec(k); }); }
      exec(k);
    }
    function exec(k) {
      var st = steps[k];
      $('#sTitle').textContent = 'Lezione ' + L.n + ' · ' + SECT[st.sec].zh + ' ' + st.name + ' (' + (k + 1) + '/' + steps.length + ')';
      var ctl = mkCtl(function (r) { score.c += r.correct; score.t += r.total; runStep(k + 1); }, (pages.length + k) / total, 1 / total);
      runCleanup();
      body.innerHTML = ''; body.scrollTop = 0;
      if ((st.fn === 'build' && !st.cfg.sentences.length) || (st.fn === 'match' && !st.cfg.words.length) || (st.fn === 'write' && !st.cfg.words.length)) return ctl.done({ correct: 0, total: 0 });
      Steps[st.fn](body, st.cfg, ctl);
    }
    showPage(0);
  }

  function lessonFinish(idx, score) {
    var L = LESSONS[idx], acc = score.t ? score.c / score.t : 1, st = acc >= 0.85 ? 3 : acc >= 0.65 ? 2 : 1;
    var xp = score.c * 10 + 30, coins = st * 3 + 3;
    S.addReward(xp, coins); S.activityDone(); S.lessonDone(L.id, st);
    setProg(1); $('#sTitle').textContent = 'Lezione ' + L.n + ' completata'; $('#sBody').onclick = null;
    var hasNext = idx + 1 < N, finale = idx === N - 1, nextOpen = hasNext && lessonOpen(idx + 1);
    $('#sBody').innerHTML = '<div class="result"><div class="big-stars">' + stars(st) + '</div>' +
      '<h2>' + (finale ? '🏆 Corso completato!' : ['Ben fatto!', 'Molto bene!', 'Fantastico!'][st - 1]) + '</h2>' +
      '<p>' + (finale ? 'Hai finito tutte le ' + N + ' lezioni e le ' + ALL.length + ' parole del nuovo HSK 1. 龙龙 è fierissimo di te!' : score.c + ' risposte giuste su ' + score.t) + '</p>' +
      '<div class="rew"><span>⭐ +' + xp + ' XP</span><span>🪙 +' + coins + '</span></div>' +
      (nextOpen ? '<button class="btn primary" data-act="nextlesson" data-id="' + (idx + 1) + '">Prossima lezione ›</button>' : '') +
      (hasNext && !nextOpen ? '<p class="lead">Hai finito le lezioni gratuite! 🎉</p><button class="btn primary" data-act="paywall">💎 Sblocca le altre ' + (N - idx - 1) + ' lezioni</button>' : '') +
      '<button class="btn soft" data-act="tocourse">Torna al corso</button>' +
      (st < 3 ? '<button class="btn soft" data-act="again">Rifai questa lezione</button>' : '') + '</div>';
    updateHeader();
  }

  /* ---------- account nel cloud (genitore) ---------- */
  function ago(t) {
    if (!t) return 'mai';
    var m = Math.round((Date.now() - t) / 60000);
    return m < 1 ? 'adesso' : m < 60 ? m + ' min fa' : m < 1440 ? Math.round(m / 60) + ' h fa' : Math.round(m / 1440) + ' giorni fa';
  }
  function accountInner() {
    if (!window.Cloud) return '<p class="lead">⚠️ Il file js/cloud.js non è stato caricato: aggiorna i file del sito.</p>';
    if (!Cloud.configured()) return '<p class="lead">Account non ancora attivo: in <b>config.js</b> mancano <b>SUPABASE_URL</b> e <b>SUPABASE_KEY</b> (vedi README).</p>';
    if (Cloud.signedIn()) {
      return '<p class="lead">☁️ I progressi di ' + esc(S.get().profile.name) + ' sono salvati nell\'account <b>' + esc(Cloud.email()) + '</b>.<br>Ultimo salvataggio: ' + ago(Cloud.lastSync()) +
        (Cloud.lastError() ? '<br><span class="err">Non riesco a sincronizzare: ' + esc(Cloud.lastError()) + '</span>' : '') + '</p>' +
        '<button class="btn soft" data-act="account">Gestisci account</button>';
    }
    return '<p class="lead">Con un account i progressi non si perdono se cambi telefono, e il piano completo ti segue. Serve l\'email di un genitore.</p>' +
      '<button class="btn primary" data-act="account">☁️ Accedi o crea account</button>';
  }
  function showAccount() {
    var body = openSheet('Account'), a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4), email = '', armed = false;
    sheet.again = null;
    function err(m) { var e = $('#acErr'); if (e) e.textContent = m || ''; }
    function managed() {
      armed = false;
      body.innerHTML = '<div class="paywall"><div class="gem">☁️</div><h2>Account</h2><p class="lead">' + esc(Cloud.email()) + '<br>Ultimo salvataggio: ' + ago(Cloud.lastSync()) + '</p>' +
        '<div class="err" id="acErr"></div><button class="btn primary" data-ac="sync">Sincronizza ora</button><button class="btn soft" data-ac="out">Esci</button>' +
        '<button class="btn danger" data-ac="del">Elimina account e dati</button><button class="btn soft" data-act="close">Chiudi</button></div>';
    }
    function gate() {
      body.innerHTML = '<div class="paywall"><div class="gem">☁️</div><h2>Account del genitore</h2><p class="lead">Per i genitori: per continuare risolvi questa operazione.</p>' +
        '<div class="gate">' + a + ' × ' + b + ' = ?</div><input id="acGate" inputmode="numeric" placeholder="Risposta" autocomplete="off"><div class="err" id="acErr"></div>' +
        '<button class="btn primary" data-ac="gate">Continua</button><button class="btn soft" data-act="close">Non ora</button></div>';
    }
    function askEmail() {
      body.innerHTML = '<div class="paywall"><div class="gem">✉️</div><h2>La tua email</h2><p class="lead">Ti mandiamo un codice a 6 cifre: niente password da ricordare. Usiamo l\'email solo per riconoscere l\'account.</p>' +
        '<input id="acEmail" type="email" inputmode="email" placeholder="nome@esempio.it" autocomplete="email" autocapitalize="off"><div class="err" id="acErr"></div>' +
        '<button class="btn primary" data-ac="send">Invia il codice</button><button class="btn soft" data-act="close">Annulla</button></div>';
    }
    function askCode() {
      body.innerHTML = '<div class="paywall"><div class="gem">🔢</div><h2>Inserisci il codice</h2><p class="lead">Abbiamo scritto a <b>' + esc(email) + '</b>. Apri l\'email <b>su questo telefono</b> e tocca il link <b>Sign in</b>: entri da solo. Se nell\'email c\'è un codice, scrivilo qui sotto. Controlla anche la posta indesiderata.</p>' +
        '<input id="acCode" inputmode="numeric" maxlength="10" placeholder="Codice" autocomplete="one-time-code"><div class="err" id="acErr"></div>' +
        '<button class="btn primary" data-ac="verify">Entra con il codice</button><button class="btn soft" data-ac="back">Cambia email</button></div>';
    }
    if (Cloud.signedIn()) managed(); else gate();
    body.onclick = function (e) {
      var c = e.target.closest('[data-act="close"]'); if (c) return closeSheet();
      var t = e.target.closest('[data-ac]'); if (!t) return; var k = t.dataset.ac;
      if (k === 'gate') { if (parseInt($('#acGate').value, 10) !== a * b) return err('Non è giusto, riprova.'); askEmail(); }
      else if (k === 'send') {
        email = ($('#acEmail').value || '').trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err('Scrivi un\'email valida.');
        t.disabled = true; err('');
        Cloud.sendCode(email).then(askCode).catch(function (er) { t.disabled = false; err(er && er.status ? 'Supabase risponde: ' + er.message : 'Non riesco a raggiungere Supabase (' + esc((window.CONFIG && CONFIG.supabaseUrl) || 'indirizzo mancante') + '). Controlla SUPABASE_URL in config.js: deve essere tipo https://xxxx.supabase.co, senza altro dopo.'); });
      }
      else if (k === 'back') askEmail();
      else if (k === 'verify') {
        var code = ($('#acCode').value || '').trim(); if (code.length < 6) return err('Il codice ha 6 cifre.');
        t.disabled = true; err('');
        Cloud.verify(email, code).then(function () { toast('☁️ Account collegato!'); closeSheet(); })
          .catch(function (er) { t.disabled = false; err('Codice non valido o scaduto. ' + (er.message || '')); });
      }
      else if (k === 'sync') { t.disabled = true; Cloud.sync().then(function () { t.disabled = false; if (Cloud.lastError()) err('Errore: ' + Cloud.lastError()); else { toast('✅ Sincronizzato'); managed(); } }); }
      else if (k === 'out') { Cloud.signOut().then(function () { toast('Disconnesso. I progressi restano su questo telefono.'); closeSheet(); }); }
      else if (k === 'del') {
        if (!armed) { armed = true; t.textContent = 'Tocca ancora: cancella account e dati nel cloud'; return; }
        t.disabled = true;
        Cloud.deleteAccount().then(function () { toast('Account eliminato.'); closeSheet(); }).catch(function (er) { t.disabled = false; armed = false; err('Non riesco a eliminarlo: ' + er.message); });
      }
    };
  }

  /* ---------- piano completo ---------- */
  function showPaywall() {
    var body = openSheet('Piano completo'), a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4);
    sheet.again = null;
    body.innerHTML = '<div class="paywall"><div class="gem">💎</div><h2>Il corso completo</h2><ul>' +
      '<li>🐉 Tutte le ' + N + ' lezioni, con teoria e pratica</li><li>📚 Tutte le ' + ALL.length + ' parole del nuovo HSK 1</li><li>🥋 Tutto il Dojo e le sfide</li><li>📴 Funziona anche senza internet</li></ul>' +
      '<p class="lead">Per i genitori: per continuare risolvi questa operazione.</p><div class="gate">' + a + ' × ' + b + ' = ?</div>' +
      '<input id="gateIn" inputmode="numeric" placeholder="Risposta" autocomplete="off"><div class="err" id="pwErr"></div><button class="btn primary" data-pw="gate">Continua</button><button class="btn soft" data-act="close">Non ora</button></div>';
    body.onclick = function (e) {
      var t = e.target.closest('[data-pw]'), c = e.target.closest('[data-act="close"]');
      if (c) return closeSheet();
      if (!t) return;
      if (t.dataset.pw === 'gate') {
        if (parseInt($('#gateIn').value, 10) !== a * b) { $('#pwErr').textContent = 'Non è giusto, riprova.'; return; }
        var C = window.CONFIG || {};
        if (window.Billing && Billing.available()) return showBuy(body);
        body.innerHTML = '<div class="paywall"><div class="gem">🔑</div><h2>Codice di attivazione</h2><p class="lead">Inserisci il codice del piano completo.</p>' +
          '<input id="codeIn" placeholder="CODICE" autocomplete="off" autocapitalize="characters"><div class="err" id="pwErr"></div>' +
          '<button class="btn primary" data-pw="code">Attiva</button>' +
          (C.buyUrl ? '<a class="btn soft" style="text-decoration:none;text-align:center" href="' + esc(C.buyUrl) + '" target="_blank" rel="noopener">Acquista il codice</a>' : '') +
          '<button class="btn soft" data-act="close">Annulla</button></div>';
      } else if (t.dataset.pw === 'code') {
        if (Ent.activate($('#codeIn').value)) { toast('💎 Piano completo attivato!'); closeSheet(); }
        else $('#pwErr').textContent = 'Codice non valido.';
      }
    };
  }

  /* acquisto dentro l'app (versione degli store) */
  function showBuy(body) {
    Billing.init().then(function () {
      body.innerHTML = '<div class="paywall"><div class="gem">💎</div><h2>Piano completo</h2><p class="lead">Un solo acquisto: tutte le lezioni e tutte le parole, anche senza internet.</p>' +
        '<div class="err" id="pwErr"></div><button class="btn primary" data-pw="buy">Acquista' + (Billing.price() ? ' · ' + esc(Billing.price()) : '') + '</button>' +
        '<button class="btn soft" data-pw="restore">Ho già acquistato</button><button class="btn soft" data-act="close">Annulla</button></div>';
    });
    body.onclick = function (e) {
      var t = e.target.closest('[data-pw]'), c = e.target.closest('[data-act="close"]');
      if (c) return closeSheet();
      if (!t) return;
      var fn = t.dataset.pw === 'buy' ? Billing.buy : Billing.restore;
      t.disabled = true;
      fn().then(function (ok) {
        if (!ok) { t.disabled = false; $('#pwErr').textContent = t.dataset.pw === 'buy' ? 'Acquisto non completato.' : 'Nessun acquisto trovato.'; return; }
        Ent.set(true); closeSheet(); toast('💎 Piano completo attivato! Scarico le lezioni…');
        Off.download('full', S.get().profile.voice, function () {}).then(function (r) { toast(r.failed ? '⚠️ Alcuni file non scaricati: riprova da Profilo' : '✅ Tutto scaricato'); }).catch(function (er) { toast('⚠️ ' + er.message); });
      }).catch(function (er) { t.disabled = false; $('#pwErr').textContent = 'Errore: ' + (er && er.message ? er.message : er); });
    };
  }

  /* ---------- offline ---------- */
  function refreshOffline() {
    var swEl = $('#swState'); if (!swEl) return;
    var voice = S.get().profile.voice, pack = Ent.isPremium() ? 'full' : 'free';
    var sw = 'serviceWorker' in navigator && navigator.serviceWorker.controller;
    swEl.textContent = sw ? '✅ Le pagine e il programma sono già salvati: l\'app si apre anche senza internet.'
      : (/^https?:/.test(location.protocol) ? 'Riapri l\'app una volta con internet: poi si salverà da sola.' : 'Per l\'uso offline apri l\'app da un sito (https), non da un file.');
    Off.status(pack, voice).then(function (s) {
      if (!$('#dlTxt')) return;
      if (!s.info.hasManifest) { $('#dlTxt').textContent = 'audio non presenti'; $('#dlMsg').textContent = 'I file audio non sono ancora stati creati: serve eseguire una volta tools/make-audio.cjs (vedi README). Nel frattempo la voce arriva da internet.'; $('#dlBtn').disabled = true; return; }
      $('#dlTxt').textContent = s.have + ' / ' + s.total;
      $('#dlBar').style.width = Math.round(100 * s.have / Math.max(1, s.total)) + '%';
      $('#dlBtn').textContent = s.have >= s.total ? '✅ Tutto scaricato (aggiorna)' : '⬇️ Scarica per usare offline';
    });
  }

  var downloading = false;
  function doDownload() {
    if (downloading) return;
    var voice = S.get().profile.voice, pack = Ent.isPremium() ? 'full' : 'free', btn = $('#dlBtn');
    downloading = true; btn.disabled = true;
    Off.download(pack, voice, function (done, tot) {
      var b = $('#dlBar'), t = $('#dlTxt'); if (b) b.style.width = Math.round(100 * done / Math.max(1, tot)) + '%'; if (t) t.textContent = done + ' / ' + tot;
    }).then(function (r) {
      downloading = false; var m = $('#dlMsg'); if ($('#dlBtn')) $('#dlBtn').disabled = false;
      if (m) m.textContent = r.failed ? r.failed + ' file non scaricati: controlla la connessione e riprova.' : '✅ Fatto! Ora l\'audio e i caratteri funzionano anche senza internet.';
      var s = S.get(); s.offline = { voice: voice, pack: pack, at: Date.now() }; S.save(); refreshOffline();
    }).catch(function (e) {
      downloading = false; if ($('#dlBtn')) $('#dlBtn').disabled = false; var m = $('#dlMsg'); if (m) m.textContent = '✗ ' + e.message;
    });
  }

  /* ---------- eventi ---------- */
  var resetArmed = false;
  var H = {
    nav: function (t) { go(t.dataset.id); },
    unit: function (t) { var u = UBYID[t.dataset.id]; if (u.words.filter(Ent.wordOpen.bind(Ent)).length < 2) return showPaywall(); go('unit', t.dataset.id); },
    say: function (t) { var w = BYID[t.dataset.id]; if (w) say(w.zh); },
    sayzh: function (t) { say(t.dataset.text); },
    tonesample: function (t) {
      var items = Ut.toneItems(openWords()).filter(function (x) { return x.t === +t.dataset.id; });
      if (items.length) say(pick(items).zh);
    },
    start: function (t) { start(t.dataset.kind, t.dataset.id); },
    daily: startDaily, review: startReview,
    paywall: showPaywall,
    startcourse: function () {
      var i = nextIndex(); if (i < 0) return go('course');
      if (!lessonOpen(i)) return showPaywall();
      runLesson(i);
    },
    lesson: function (t) {
      var i = +t.dataset.id;
      if (!lessonOpen(i)) return showPaywall();
      if (!lessonUnlocked(i)) { toast('Prima completa la lezione ' + i + '!'); return; }
      runLesson(i);
    },
    nextlesson: function (t) { var i = +t.dataset.id; closeSheet(); if (!lessonOpen(i)) return showPaywall(); runLesson(i); },
    tocourse: function () { closeSheet(); go('course'); },
    close: closeSheet,
    again: function () { if (sheet.again) sheet.again(); },
    avatar: function (t) { S.get().profile.avatar = t.dataset.id; S.save(); render(); },
    goal: function (t) { S.get().profile.goal = +t.dataset.id; S.save(); render(); },
    voice: function (t) { S.get().profile.voice = t.dataset.id; S.save(); render(); say('你好'); },
    backup: function () {
      var data = { app: 'longlong', version: 1, savedAt: new Date().toISOString(), data: S.exportData() };
      var blob = new Blob([JSON.stringify(data)], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'longlong-backup-' + S.today() + '.json';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      toast('💾 Backup scaricato: tienilo in un posto sicuro');
    },
    restore: function () { var f = $('#restoreFile'); if (f) f.click(); },
    account: function () { showAccount(); },
    voicestudio: function () {
      var body = openSheet('La mia voce'); sheet.again = null;
      Voice.studio(body, { close: closeSheet, who: S.get().profile.name }).then(function (fn) { sheet.cleanup = fn; });
    },
    voiceuse: function () {
      var p = S.get().profile;
      if (!p.useMyVoice && !(window.Voice && Voice.count())) { toast('Prima registra qualche parola'); return; }
      p.useMyVoice = !p.useMyVoice; S.save(); render(); toast(p.useMyVoice ? '🎙️ Userò la tua voce quando c\'è' : 'Voce dell\'app');
    },
    unlock: function () { var p = S.get().profile; p.unlockAll = !p.unlockAll; S.save(); render(); },
    deactivate: function () { Ent.deactivate(); render(); },
    download: doDownload,
    dlclear: function () { Off.clear().then(function () { toast('File scaricati eliminati'); refreshOffline(); }); },
    testaudio: function () {
      var d = $('#audioDiag'); d.textContent = 'Provo…';
      A.speak('你好，我是龙龙', { gender: S.get().profile.voice }).then(function (eng) {
        d.textContent = eng === 'local' ? '✓ Audio dai file dell\'app (funziona anche offline).' : eng === 'azure' ? '✓ Voce Azure funzionante (file locali non trovati).' : eng === 'browser' ? 'Uso la voce del browser (' + A.getError() + ').' : '✗ Nessun audio: ' + A.getError();
      });
    },
    testmic: function () {
      var d = $('#micDiag'); d.textContent = 'Di\' "mā" per 2 secondi…';
      A.record().then(function (r) { setTimeout(function () { r.stop().then(function (x) {
        var res = P.analyze(x.frames, P.targetTones('mā'));
        d.textContent = res.ok ? '✓ Microfono e analisi del tono funzionano (tono rilevato: ' + res.syl[0].detected + ').' : res.speech ? 'Ho sentito la voce ma non l\'intonazione: parla più vicino al microfono.' : 'Microfono attivo, ma non ho sentito la voce. Parla più forte.';
      }); }, 2000); })
        .catch(function (e) { d.textContent = '✗ ' + e.message; });
    },
    testicon: function () {
      var d = $('#iconDiag'); d.className = 'lead diag'; d.textContent = 'Controllo…';
      var checks = [];
      function img(url) {
        return fetch(url + (url.indexOf('?') < 0 ? '?c=' + Date.now() : ''), { cache: 'no-store' }).then(function (r) {
          var ct = r.headers.get('content-type') || '';
          if (!r.ok) return url + ': ✗ non trovato (HTTP ' + r.status + '): il file non è stato caricato sul sito';
          if (ct.indexOf('image') < 0) return url + ': ✗ non è un\'immagine (' + ct + ')';
          return r.blob().then(function (b) { return new Promise(function (res) {
            var im = new Image(); im.onload = function () { res(url + ': ✓ ' + im.naturalWidth + '×' + im.naturalHeight); }; im.onerror = function () { res(url + ': ✗ immagine rovinata'); }; im.src = URL.createObjectURL(b); }); });
        }).catch(function () { return url + ': ✗ non raggiungibile'; });
      }
      var link = document.querySelector('link[rel="apple-touch-icon"]');
      Promise.all([img((link && link.getAttribute('href')) || 'apple-touch-icon.png'), img('icon-192.png'), img('icon-512.png'), img('icon-maskable-512.png')]).then(function (rs) {
        var bad = rs.some(function (x) { return x.indexOf('✗') >= 0; });
        d.className = 'lead diag ' + (bad ? 'ko' : 'ok');
        d.innerHTML = rs.map(esc).join('<br>') + '<br>' + (bad ? 'Carica i file mancanti sul sito, poi togli e rimetti l\'app dalla schermata Home.' : 'Le icone sono a posto. Se sulla Home vedi ancora quella vecchia: elimina il collegamento e aggiungilo di nuovo (il telefono salva l\'icona quando lo aggiungi).');
      });
    },
    reset: function (t) {
      if (!resetArmed) { resetArmed = true; t.textContent = 'Tocca ancora per confermare'; setTimeout(function () { resetArmed = false; if (t.isConnected) t.textContent = 'Azzera i progressi'; }, 3500); return; }
      S.reset(); if (window.Cloud) Cloud.forcePush(); resetArmed = false; go('home'); toast('Progressi azzerati');
    }
  };

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (t && H[t.dataset.act]) H[t.dataset.act](t);
  });
  document.addEventListener('change', function (e) {
    if (e.target.id !== 'restoreFile' || !e.target.files || !e.target.files[0]) return;
    var f = e.target.files[0], rd = new FileReader();
    rd.onload = function () {
      try {
        var j = JSON.parse(rd.result);
        if (!j || j.app !== 'longlong' || !j.data) throw new Error('non è un backup di LongLong');
        S.mergeRemote(j.data); S.save(); render(); toast('✅ Progressi ripristinati');
      } catch (er) { toast('⚠️ Backup non valido: ' + er.message); }
    };
    rd.readAsText(f); e.target.value = '';
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'pName') { S.get().profile.name = e.target.value.trim() || 'Noah'; S.save(); updateHeader(); }
  });

  if (window.Billing && Billing.available()) Billing.check().then(function (ok) { if (ok && !Ent.isPremium()) { Ent.set(true); render(); } });
  if (window.NativeFS) NativeFS.watch();
  if (window.Voice && S.get().profile.useMyVoice) Voice.init();
  A.loadManifest().then(function () { if (state.name === 'profile') refreshOffline(); });
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').then(function () { return navigator.serviceWorker.ready; }).then(function () { if (state.name === 'profile') refreshOffline(); }).catch(function () { /* facoltativo */ });
  }

  if (window.Cloud) Cloud.onChange(function () { var el = $('#acctCard'); if (el) el.innerHTML = accountInner(); updateHeader(); });

  if (window.Cloud) Cloud.fromLink().then(function (ok) { if (ok) { toast('☁️ Account collegato!'); render(); } else if (Cloud.lastError()) toast('⚠️ ' + Cloud.lastError()); });
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () { /* ignora */ });

  window.__app = { go: go, runLesson: runLesson, showPaywall: showPaywall };
  render();
})();
