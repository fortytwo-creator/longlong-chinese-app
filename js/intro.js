/* Introduzione al primo avvio: spiega i toni, fa sentire e ripetere i 4 toni, fa provare la scrittura.
   Usa le stesse attività del corso (Steps.quiz / repeat / write), ma in modalità "strict":
   nella pronuncia non si va avanti finché non è giusta; "Salta" compare solo dopo alcuni errori. */
(function () {
  'use strict';
  var U = window.Util, TONES = window.TONES, esc = U.esc, say = U.say, toneColor = U.toneColor, toneSvg = U.toneSvg;
  var MA = window.TONE_SETS[0].items;                       // 妈 麻 马 骂: gli stessi audio dei toni nel Dojo
  var MA_EM = ['👩', '🌿', '🐴', '😠'];
  var SKIP_AFTER = 3;                                        // errori prima che compaia "Salta"

  var SKILL = {
    listen: { zh: '听', pin: 'tīng', name: 'Ascoltare', color: '#5aa9ff', text: 'Ascolta il suono e scegli il tono giusto.' },
    speak: { zh: '说', pin: 'shuō', name: 'Parlare', color: '#ff7a8a', text: 'Ora tocca a te! Ripeti il suono. Se non è giusto, riprova: 龙龙 ti dice cosa correggere. Se proprio non ti viene, dopo qualche tentativo puoi saltare.' },
    read: { zh: '读', pin: 'dú', name: 'Leggere', color: '#5cc98a', text: '' },
    write: { zh: '写', pin: 'xiě', name: 'Scrivere', color: '#ffb347', text: 'Traccia i caratteri con il dito, un tratto alla volta. Se sbagli, ti aiuto io.' }
  };
  var ORDER = ['listen', 'speak', 'read', 'write'];

  function repeatWords() {
    var w = MA.map(function (it, k) { return { zh: it.zh, py: it.py, it: it.it, em: MA_EM[k] }; });
    w.push({ zh: '你好', py: 'nǐ hǎo', it: 'Ciao', em: '👋' });
    return w;
  }
  function writeWords() { return [{ zh: '中', py: 'zhōng', it: 'mezzo', em: '🎯' }, { zh: '文', py: 'wén', it: 'scrittura', em: '✍️' }]; }

  /* Ordine dei tratti: l'animazione di Hanzi Writer, con frecce e numeri che compaiono uno alla volta */
  var NS = 'http://www.w3.org/2000/svg', W = 240, PAD = 12, SC = (W - 2 * PAD) / 1024;
  function el(tag, attrs, parent) { var e = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); }); if (parent) parent.appendChild(e); return e; }
  function px(pt) { return [PAD + pt[0] * SC, W - PAD - SC * (pt[1] + 124)]; }   // stesse coordinate di Hanzi Writer (1024 x 1024, y verso l'alto)

  function strokeDemo(host, ch) {
    var token = 0, writer = null, arrows = [], dead = false, svgEl = null, layer = null;
    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function setup(d) {
      try {
        writer = HanziWriter.create(host, ch, { width: W, height: W, padding: PAD, showOutline: true, showCharacter: false, strokeColor: '#ff6b9d', outlineColor: '#e6dcd6',
          strokeAnimationSpeed: 1.1, delayBetweenStrokes: 200, charDataLoader: function (c, ok) { ok(d); } });
      } catch (e) { return; }
      var svg = host.querySelector('svg'); if (!svg) return;
      var g = el('g', { 'pointer-events': 'none' }, svg); svgEl = svg; layer = g;
      d.medians.forEach(function (med, i) {
        var pts = med.map(px), a = el('g', { style: 'opacity:0;transition:opacity .35s' }, g);
        var dd = 'M' + pts.map(function (q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' L');
        el('path', { d: dd, fill: 'none', stroke: '#fff', 'stroke-width': 10, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-opacity': 0.85 }, a);
        el('path', { d: 'M' + pts.map(function (q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' L'), fill: 'none', stroke: '#2f6fed', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-opacity': 1 }, a);
        var e = pts[pts.length - 1], b = pts[Math.max(0, pts.length - 2)], dx = e[0] - b[0], dy = e[1] - b[1], L = Math.sqrt(dx * dx + dy * dy) || 1; dx /= L; dy /= L;
        var tip = [e[0] + dx * 7, e[1] + dy * 7], base = [e[0] - dx * 7, e[1] - dy * 7];
        el('polygon', { points: tip.join(',') + ' ' + [base[0] - dy * 8, base[1] + dx * 8].join(',') + ' ' + [base[0] + dy * 8, base[1] - dx * 8].join(','), fill: '#2f6fed', stroke: '#fff', 'stroke-width': 2 }, a);
        el('circle', { cx: pts[0][0], cy: pts[0][1], r: 9, fill: '#ff6b9d' }, a);
        var t = el('text', { x: pts[0][0], y: pts[0][1] + 4, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 800, fill: '#fff' }, a); t.textContent = String(i + 1);
        arrows.push(a);
      });
      play();
    }
    function strokeAnim(i) { return new Promise(function (res) { try { writer.animateStroke(i, { onComplete: res }); } catch (e) { res(); } }); }
    function play() {
      if (!writer || dead) return; var my = ++token;
      arrows.forEach(function (a) { a.style.opacity = 0; }); writer.hideCharacter();
      var chain = wait(450);
      arrows.forEach(function (a, i) {
        chain = chain.then(function () { if (my !== token || dead) throw 0; if (svgEl && layer) svgEl.appendChild(layer); a.style.opacity = 1; return wait(350); })
          .then(function () { if (my !== token || dead) throw 0; return strokeAnim(i); }).then(function () { if (svgEl && layer) svgEl.appendChild(layer); return wait(250); });
      });
      chain.catch(function () { /* interrotta */ });
    }
    fetch('strokes/' + encodeURIComponent(ch) + '.json').then(function (r) { if (!r.ok) throw new Error('no'); return r.json(); }).then(function (d) { if (!dead) setup(d); })
      .catch(function () { host.innerHTML = '<p style="font-size:90px;text-align:center;margin:30px 0">' + esc(ch) + '</p>'; });
    return { play: play, stop: function () { dead = true; token++; } };
  }

  function mascot(html) { return '<div class="mascot"><div class="m-dragon">🐉</div><div class="m-bubble">' + html + '</div></div>'; }

  function run(body, api) {
    var nodes = [
      { page: 'welcome' }, { page: 'song' }, { page: 'tones' },
      { splash: 'listen' }, { step: 'quiz', title: '👂 Che tono è?', cfg: { words: MA, pool: MA, kinds: ['tone'], n: 4, toneItems: MA, seqTones: true } },
      { splash: 'speak' }, { step: 'repeat', title: '🎤 Ripeti', cfg: { words: repeatWords(), strict: true, skipAfter: SKIP_AFTER } },
      { splash: 'write' }, { page: 'order' }, { page: 'zhongwen' },
      { step: 'write', title: '✍️ Scrivi', cfg: { words: writeWords(), max: 2, strict: true, skipAfter: SKIP_AFTER, silent: true } },
      { page: 'end' }
    ];
    var k = 0, ended = false, heard = {};
    var foot = document.createElement('div');
    foot.id = 'introFoot'; foot.innerHTML = '<button class="linkbtn" data-i="skipall">Salta l\'introduzione</button>';
    document.getElementById('sheet').appendChild(foot);
    foot.onclick = function (e) { if (e.target.closest('[data-i=skipall]')) exit(true); };

    function exit(skipped) {
      if (ended) return; ended = true;
      if (foot.parentNode) foot.parentNode.removeChild(foot);
      api.onExit(skipped);
    }
    function show() {
      if (ended) return;
      api.cleanup(); body.onclick = null; body.innerHTML = ''; body.scrollTop = 0;
      api.setProg(k / nodes.length);
      var n = nodes[k]; if (!n) return exit(false);
      if (n.page) return page(n.page);
      if (n.splash) return splash(n.splash);
      api.title(n.title);
      var ctl = api.ctl(function () { k++; show(); }, k / nodes.length, 1 / nodes.length);
      window.Steps[n.step](body, n.cfg, ctl);
    }
    function btns(label, extra) { return '<div class="pg-btns"><button class="btn primary" data-i="next"' + (extra || '') + '>' + label + '</button></div>'; }

    function splash(sec) {
      var d = SKILL[sec]; api.title('龙龙中文');
      body.innerHTML = '<div class="sect" style="--c:' + d.color + '"><div class="sect-steps">' + ORDER.map(function (s) {
        var cls = s === sec ? 'on' : ORDER.indexOf(s) < ORDER.indexOf(sec) ? 'past' : '';
        return '<i class="' + cls + '" style="--c:' + SKILL[s].color + '">' + SKILL[s].zh + '</i>'; }).join('') + '</div>' +
        '<div class="sect-zh">' + d.zh + '</div><h2>' + d.name + '</h2><small>' + d.pin + '</small><p>' + d.text + '</p>' +
        '<button class="btn primary" data-i="next">Via!</button></div>';
      body.onclick = function (e) { if (e.target.closest('[data-i=next]')) { api.stop(); k++; show(); } };
    }

    function page(name) {
      api.title('龙龙中文'); var h = '';
      if (name === 'welcome') {
        h = mascot('Ciao! Io sono <b>龙龙</b>, il tuo drago. Ti insegno il cinese, ed è più facile di quanto pensi. Prima proviamo insieme le <b>cose che farai nel corso</b>: ascoltare, parlare, leggere e scrivere.') +
          '<div class="i-skills">' + ORDER.map(function (s) { var d = SKILL[s]; return '<div style="--c:' + d.color + '"><b>' + d.zh + '</b><small>' + d.name + '</small></div>'; }).join('') + '</div>' +
          '<p class="lead" style="text-align:center">Ci vogliono pochi minuti. Tieni il microfono pronto!</p>' + btns('Cominciamo!');
      } else if (name === 'song') {
        h = mascot('In cinese ogni sillaba ha una <b>melodia</b>: si chiama <b>tono</b>. Cambia la melodia e cambia il significato!') +
          '<p class="lead" style="text-align:center">Prendi la sillaba <b>ma</b>. Con quattro melodie diverse significa:</p>' +
          '<div class="i-ma">' + MA.map(function (it, j) { return '<div style="--c:' + toneColor(it.t) + '"><span>' + MA_EM[j] + '</span><b>' + esc(it.zh) + '</b><small>' + esc(it.py) + '</small><i>' + esc(it.it) + '</i></div>'; }).join('') + '</div>' + btns('Ascoltiamoli');
      } else if (name === 'tones') {
        h = '<h3 class="pg-t">I 4 toni</h3><p class="lead">Tocca ogni carta per ascoltare. Ascolta tutti e 4!</p><div class="tone-cards">' +
          MA.map(function (it) {
            var t = TONES[it.t - 1];
            return '<button class="tcard i-tc" data-i="tone" data-n="' + it.t + '" style="--c:' + t.color + '"><svg viewBox="0 0 60 40" class="tsvg">' + toneSvg(it.t) + '</svg>' +
              '<div class="i-zh">' + esc(it.zh) + '</div><b>' + esc(it.py) + '</b><small>' + esc(it.it) + '</small><small>' + esc(t.hint) + '</small><span class="i-ck">✓</span></button>'; }).join('') +
          '</div><button class="btn soft" data-i="all">🔊 Ascolta uno dopo l\'altro</button>' + btns('Ascolta tutti e 4', ' disabled id="iNext"');
        heard = {};
      } else if (name === 'order') {
        h = mascot('I caratteri si scrivono con un <b>ordine preciso</b>, sempre lo stesso.') +
          '<div class="i-rules"><div><b>⬇️</b><span>dall\'alto verso il basso</span></div><div><b>➡️</b><span>da sinistra verso destra</span></div></div>' +
          '<div class="i-hzwrap"><div id="iHz" class="hz"></div></div>' +
          '<p class="lead" style="text-align:center">Guarda <b>中</b>: i numeri dicono l\'ordine dei tratti, le frecce la direzione. Prima il quadrato (lato sinistro, poi in alto e a destra, poi in basso), per ultima la riga in mezzo, dall\'alto verso il basso.</p>' +
          '<button class="btn soft" data-i="show">▶️ Mostra</button>' + btns('Ho capito');
      } else if (name === 'zhongwen') {
        h = mascot('Ora scriviamo due caratteri: <b>中</b> (<b>zhōng</b>) vuol dire <b>mezzo</b>, <b>文</b> (<b>wén</b>) vuol dire <b>scrittura</b>. Insieme fanno…') +
          '<div class="i-zw"><div><span style="color:' + toneColor(1) + '">中</span><span style="color:' + toneColor(2) + '">文</span></div><small><span style="color:' + toneColor(1) + '">zhōng</span> <span style="color:' + toneColor(2) + '">wén</span></small></div>' +
          '<p class="lead" style="text-align:center"><b>Zhōngwén</b> = la lingua cinese! Ora proviamo a scriverlo.</p>' + btns('Proviamo! ✍️');
      } else if (name === 'end') {
        h = mascot('Bravissimo! Hai provato ad <b>ascoltare</b>, <b>parlare</b> e <b>scrivere</b>.') +
          '<div class="tipcard"><div class="t-ico">🐉</div><p>Nel corso troverai anche il <b>leggere</b>, il <b>ripasso intelligente</b> (le parole difficili tornano più spesso) e il <b>Dojo</b>, con giochi e sfide. Si comincia dalla lezione 1, quando vuoi tu.</p></div>' + btns('Inizia! 🎉');
      }
      body.innerHTML = '<div class="pg">' + h + '</div>';
      var demo = null;
      if (name === 'order') { demo = strokeDemo(body.querySelector('#iHz'), '中'); api.onLeave(function () { demo.stop(); }); }
      body.onclick = function (e) {
        var t = e.target.closest('[data-i]'); if (!t || t.disabled) return; var a = t.dataset.i;
        if (a === 'next') { api.stop(); k++; show(); }
        else if (a === 'show') { if (demo) demo.play(); }
        else if (a === 'tone') { markHeard(+t.dataset.n); say(MA[+t.dataset.n - 1].zh); }
        else if (a === 'all') {
          var list = MA.map(function (it) { return it.zh; }), j = 0;
          (function step() { if (ended || nodes[k].page !== 'tones' || j >= list.length) return; markHeard(j + 1); say(list[j]).then(function () { j++; setTimeout(step, 150); }); })();
        }
      };
    }
    function markHeard(n) {
      heard[n] = 1;
      var c = body.querySelector('.i-tc[data-n="' + n + '"]'); if (c) c.classList.add('heard');
      var nx = body.querySelector('#iNext'); if (!nx) return;
      var all = [1, 2, 3, 4].every(function (x) { return heard[x]; });
      nx.disabled = !all; nx.textContent = all ? 'Avanti' : 'Ascolta tutti e 4';
    }
    show();
  }

  window.Intro = { run: run };
})();
