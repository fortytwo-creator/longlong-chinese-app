/* Stato e progressi, salvati in localStorage. */
(function () {
  var KEY = 'longlong.v3', OLD = 'longlong.v2';
  var INTERVALS = [0, 0, 1, 3, 7, 14]; // giorni per box 1..5

  function today() { return new Date().toISOString().slice(0, 10); }
  function yesterday() { return new Date(Date.now() - 864e5).toISOString().slice(0, 10); }

  function fresh() {
    return {
      profile: { name: 'Noah', avatar: '🐉', goal: 3, voice: 'FEMALE', unlockAll: false, premium: false },
      offline: {},
      course: { done: {} },
      xp: 0, coins: 0, streak: 0, lastDay: null,
      todayDate: today(), todayActs: 0, dailyDone: null,
      words: {},   // id -> {box, due, seen, ok, ko}
      units: {},   // id -> {stars, best}
      tones: { best: 0, tries: 0 },
      stats: { answered: 0, correct: 0 }
    };
  }

  var S = fresh();
  try {
    var raw = JSON.parse(localStorage.getItem(KEY));
    if (!raw) { /* prima volta con la versione HSK 1: si tiene solo il profilo della versione precedente */
      var prev = JSON.parse(localStorage.getItem(OLD));
      if (prev && prev.profile) raw = { profile: prev.profile };
    }
    if (raw) {
      var f = fresh();
      S = Object.assign(f, raw);
      S.profile = Object.assign(f.profile, raw.profile || {});
      S.tones = Object.assign(f.tones, raw.tones || {});
      S.course = Object.assign(f.course, raw.course || {});
      if (!S.course.done) S.course.done = {};
      S.stats = Object.assign(f.stats, raw.stats || {});
      if (!S.offline) S.offline = {};
    }
  } catch (e) { /* primo avvio */ }
  rollDay();

  var listeners = [], quiet = false;
  function save() {
    S.savedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignora */ }
    if (!quiet) listeners.forEach(function (fn) { try { fn(); } catch (e) { /* ignora */ } });
  }

  /* Dati da mandare al cloud: i progressi, senza il piano a pagamento (quello lo decide solo il server) e senza lo stato dei file offline */
  function exportData() {
    var c = JSON.parse(JSON.stringify(S));
    delete c.offline; if (c.profile) delete c.profile.premium; if (c.profile) delete c.profile.unlockAll;
    return c;
  }

  /* Unisce i progressi del cloud con quelli del telefono senza perdere nulla: per ogni cosa vale il valore migliore o più recente */
  function mergeRemote(r) {
    if (!r || typeof r !== 'object') return false;
    var before = JSON.stringify(exportData());
    var rNewer = (r.savedAt || 0) > (S.savedAt || 0);
    if (r.profile && rNewer) ['name', 'avatar', 'goal', 'voice'].forEach(function (k) { if (r.profile[k] !== undefined) S.profile[k] = r.profile[k]; });
    Object.keys(r.words || {}).forEach(function (id) {
      var a = S.words[id], b = r.words[id];
      if (!a || (b.seen || 0) > (a.seen || 0)) S.words[id] = b;
    });
    Object.keys(r.units || {}).forEach(function (id) {
      var a = S.units[id], b = r.units[id];
      S.units[id] = a ? { stars: Math.max(a.stars || 0, b.stars || 0), best: Math.max(a.best || 0, b.best || 0) } : b;
    });
    Object.keys((r.course && r.course.done) || {}).forEach(function (id) { S.course.done[id] = Math.max(S.course.done[id] || 0, r.course.done[id] || 0); });
    S.xp = Math.max(S.xp || 0, r.xp || 0); S.coins = Math.max(S.coins || 0, r.coins || 0);
    if (r.lastDay && (!S.lastDay || r.lastDay > S.lastDay)) { S.lastDay = r.lastDay; S.streak = r.streak || 0; }
    else if (r.lastDay && r.lastDay === S.lastDay) S.streak = Math.max(S.streak || 0, r.streak || 0);
    if (r.todayDate === S.todayDate) S.todayActs = Math.max(S.todayActs || 0, r.todayActs || 0);
    if (r.dailyDone && (!S.dailyDone || r.dailyDone > S.dailyDone)) S.dailyDone = r.dailyDone;
    if (r.tones) { S.tones.best = Math.max(S.tones.best || 0, r.tones.best || 0); S.tones.tries = Math.max(S.tones.tries || 0, r.tones.tries || 0); }
    if (r.stats) { S.stats.answered = Math.max(S.stats.answered || 0, r.stats.answered || 0); S.stats.correct = Math.max(S.stats.correct || 0, r.stats.correct || 0); }
    rollDay();
    var changed = JSON.stringify(exportData()) !== before;
    quiet = true; save(); quiet = false;
    return changed;
  }


  function rollDay() {
    if (S.todayDate !== today()) { S.todayDate = today(); S.todayActs = 0; }
    if (S.lastDay && S.lastDay !== today() && S.lastDay !== yesterday()) S.streak = 0;
  }

  window.Store = {
    get: function () { rollDay(); return S; },
    save: save,
    onSave: function (fn) { listeners.push(fn); },
    exportData: exportData,
    mergeRemote: mergeRemote,
    today: today,
    addReward: function (xp, coins) { S.xp += xp; S.coins += coins; save(); },
    /* Chiamata quando si completa un'attività: aggiorna serie e obiettivo del giorno */
    activityDone: function () {
      rollDay();
      S.todayActs += 1;
      if (S.lastDay !== today()) {
        S.streak = (S.lastDay === yesterday()) ? S.streak + 1 : 1;
        S.lastDay = today();
      }
      save();
    },
    markWord: function (id, ok) {
      var w = S.words[id] || { box: 1, due: 0, seen: 0, ok: 0, ko: 0 };
      w.seen++; S.stats.answered++;
      if (ok) { w.ok++; S.stats.correct++; w.box = Math.min(5, w.box + 1); }
      else { w.ko++; w.box = Math.max(1, w.box - 1); }
      w.due = Date.now() + INTERVALS[w.box] * 864e5;
      S.words[id] = w; save();
    },
    isDue: function (id) { var w = S.words[id]; return w && w.due <= Date.now(); },
    unitProgress: function (unit, list) {
      var words = list || unit.words, n = 0;
      if (!words.length) return 0;
      words.forEach(function (w) { if (S.words[w.id] && S.words[w.id].box >= 3) n++; });
      return Math.round(100 * n / words.length);
    },
    setUnitResult: function (id, stars) {
      var u = S.units[id] || { stars: 0, best: 0 };
      u.stars = Math.max(u.stars, stars); S.units[id] = u; save();
    },
    lessonStars: function (id) { return S.course.done[id] || 0; },
    lessonDone: function (id, stars) { S.course.done[id] = Math.max(S.course.done[id] || 0, stars); save(); },
    reset: function () { S = fresh(); save(); }
  };
})();
