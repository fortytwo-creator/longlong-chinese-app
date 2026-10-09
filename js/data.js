/* Dati di base: toni, temi del dojo, avatar. Il vocabolario è in vocab.js (nuovo HSK 1, 300 parole). */
(function () {
  var ALL = window.VOCAB.slice();
  ALL.forEach(function (w) { w.free = false; });

  var THEMES = [
    { id: 'nu', title: 'Numeri e soldi', emoji: '🔢', color: '#ffd9a0', desc: 'Contare e comprare' },
    { id: 'sg', title: 'Saluti e gentilezza', emoji: '👋', color: '#ffb3c7', desc: 'Dire ciao e farsi capire' },
    { id: 'pe', title: 'Persone e famiglia', emoji: '👨‍👩‍👧', color: '#c9b8ff', desc: 'Chi siamo' },
    { id: 'ci', title: 'Cibo e bevande', emoji: '🍜', color: '#ffc6a8', desc: 'Mangiare e bere' },
    { id: 'sc', title: 'Scuola', emoji: '🏫', color: '#a8d4ff', desc: 'Studiare e imparare' },
    { id: 'te', title: 'Tempo', emoji: '🕒', color: '#f5e1a0', desc: 'Giorni, ore e date' },
    { id: 'az', title: 'Azioni', emoji: '🏃', color: '#a8dfc8', desc: 'Cosa facciamo' },
    { id: 'lu', title: 'Luoghi', emoji: '🗺️', color: '#ffb8a0', desc: 'Dove siamo' },
    { id: 'co', title: 'Cose di ogni giorno', emoji: '🎒', color: '#d6c9ff', desc: 'Oggetti e mezzi' },
    { id: 'de', title: 'Com\'è?', emoji: '🌈', color: '#ffd1ea', desc: 'Grande, piccolo, bello…' },
    { id: 'pa', title: 'Parole utili', emoji: '🧩', color: '#cfe8ff', desc: 'Domande, particelle, contatori' },
    { id: 'na', title: 'Animali e meteo', emoji: '🐱', color: '#bfe8d4', desc: 'Cani, gatti, pioggia, neve' },
    { id: 'sl', title: 'Salute', emoji: '🩺', color: '#ffc9c9', desc: 'Stare bene e stare male' }
  ];
  THEMES.forEach(function (t) { t.words = ALL.filter(function (w) { return w.th === t.id; }); });

  window.ALLWORDS = ALL;
  var BYZH = {}, BYID = {};
  ALL.forEach(function (w) { if (!BYZH[w.zh]) BYZH[w.zh] = w; BYID[w.id] = w; });
  window.WORDBYZH = BYZH; window.WORDBYID = BYID;
  window.UNITS = THEMES;

  window.TONES = [
    { n: 1, name: 'Primo tono', hint: 'Alto e piatto, come cantare una nota sola.', color: '#ff7a8a', mark: 'ˉ' },
    { n: 2, name: 'Secondo tono', hint: 'Sale, come quando chiedi "eh?".', color: '#ffb347', mark: 'ˊ' },
    { n: 3, name: 'Terzo tono', hint: 'Scende e poi risale, come un "mmh, vediamo".', color: '#5cc98a', mark: 'ˇ' },
    { n: 4, name: 'Quarto tono', hint: 'Cade deciso, come un ordine: "No!".', color: '#5aa9ff', mark: 'ˋ' },
    { n: 5, name: 'Tono neutro', hint: 'Leggero e breve, senza accento.', color: '#b0a8b9', mark: '·' }
  ];

  /* Sillabe di allenamento (non fanno parte del corso): servono quando mancano parole di un certo tono */
  window.TONE_SETS = [
    { syl: 'ma', items: [
      { zh: '妈', py: 'mā', t: 1, it: 'mamma' }, { zh: '麻', py: 'má', t: 2, it: 'canapa' },
      { zh: '马', py: 'mǎ', t: 3, it: 'cavallo' }, { zh: '骂', py: 'mà', t: 4, it: 'sgridare' }] },
    { syl: 'yi', items: [
      { zh: '衣', py: 'yī', t: 1, it: 'vestito' }, { zh: '姨', py: 'yí', t: 2, it: 'zia materna' },
      { zh: '椅', py: 'yǐ', t: 3, it: 'sedia' }, { zh: '意', py: 'yì', t: 4, it: 'significato' }] },
    { syl: 'tang', items: [
      { zh: '汤', py: 'tāng', t: 1, it: 'zuppa' }, { zh: '糖', py: 'táng', t: 2, it: 'zucchero' },
      { zh: '躺', py: 'tǎng', t: 3, it: 'sdraiarsi' }, { zh: '烫', py: 'tàng', t: 4, it: 'scottante' }] },
    { syl: 'shu', items: [
      { zh: '书', py: 'shū', t: 1, it: 'libro' }, { zh: '熟', py: 'shú', t: 2, it: 'cotto' },
      { zh: '鼠', py: 'shǔ', t: 3, it: 'topo' }, { zh: '树', py: 'shù', t: 4, it: 'albero' }] }
  ];

  /* Coppie di parole HSK 1 che cambiano solo per il tono */
  window.TONE_PAIRS = [
    { a: '买', b: '卖', pa: 'mǎi', pb: 'mài', ita: 'comprare', itb: 'vendere' },
    { a: '水', b: '睡', pa: 'shuǐ', pb: 'shuì', ita: 'acqua', itb: 'dormire' },
    { a: '哪', b: '那', pa: 'nǎ', pb: 'nà', ita: 'quale', itb: 'quello' },
    { a: '会', b: '回', pa: 'huì', pb: 'huí', ita: 'saper fare', itb: 'tornare' }
  ];

  window.AVATARS = ['🐉', '🐼', '🐯', '🐰', '🦊', '🐸', '🦄', '🐙', '🌸', '⭐'];
})();
