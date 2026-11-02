(function () {
  'use strict';

  var root = document.documentElement;
  var motion = root.classList.contains('motion');
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var NS = 'http://www.w3.org/2000/svg';
  var svgEl = function (name, attrs) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };

  /* ==========================================================
     Nalaganje: kratko, nikoli ne zaklene drsenja
     ========================================================== */
  $$('.status, .name, .hero__row').forEach(function (el) { el.setAttribute('data-in', ''); });
  var loader = $('.loader');
  var done = false;
  function ready() {
    if (done) return;
    done = true;
    root.classList.remove('loading');
    root.classList.add('ready');
    if (loader) loader.classList.add('is-done');
    $$('[data-in]').forEach(function (el, i) { setTimeout(function () { el.classList.add('in'); }, 60 * i); });
  }
  setTimeout(ready, 1800);                         /* varovalka */
  if (motion && loader) setTimeout(ready, 900); else ready();

  /* ==========================================================
     Napredek plošče: 0 ob vstopu, 1 ob izstopu
     ========================================================== */
  function plateProgress(el) {
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight;
    var span = r.height - vh * 0.5;
    return span > 0 ? clamp((vh * 0.5 - r.top) / span, 0, 1) : clamp((vh - r.top) / (vh + r.height), 0, 1);
  }

  var specs = [];

  /* ==========================================================
     1. TripPlaner: višinski profil
     ========================================================== */
  (function () {
    var plate = $('#tripplaner'); if (!plate) return;
    var svg = $('.route', plate), line = $('.route__line', svg), area = $('.route__area', svg);
    var rule = $('.route__rule', svg), dot = $('.route__dot', svg), grid = $('.route__grid', svg);
    var rKm = $('[data-r="km"]', plate), rAlt = $('[data-r="alt"]', plate), rUp = $('[data-r="up"]', plate);
    var N = 56, W = 800, H = 330, TOP = 24, BOT = 300, KM = 9.4;
    var h = [];
    for (var i = 0; i < N; i++) {
      var x = i / (N - 1);
      h.push(620 + 880 * Math.pow(x, 1.12) + 38 * Math.sin(i * .9) + 24 * Math.sin(i * 2.3));
    }
    var min = Math.min.apply(null, h) - 30, max = Math.max.apply(null, h) + 30;
    var X = function (t) { return t * W; };
    var Y = function (v) { return BOT - (v - min) / (max - min) * (BOT - TOP); };
    var d = '';
    h.forEach(function (v, i) { d += (i ? 'L' : 'M') + X(i / (N - 1)).toFixed(1) + ' ' + Y(v).toFixed(1); });
    line.setAttribute('d', d);
    area.setAttribute('d', d + 'L' + W + ' ' + BOT + 'L0 ' + BOT + 'Z');
    for (var g = 0; g < 4; g++) {
      var gy = TOP + g * (BOT - TOP) / 3;
      grid.appendChild(svgEl('line', { x1: 0, x2: W, y1: gy, y2: gy }));
    }
    var upTo = [0];
    for (var j = 1; j < N; j++) upTo.push(upTo[j - 1] + Math.max(0, h[j] - h[j - 1]));
    var manual = null;

    function fmt(n, dec) { return n.toFixed(dec).replace('.', ','); }
    function set(p) {
      if (manual !== null) p = manual;
      var f = p * (N - 1), i0 = Math.floor(f), i1 = Math.min(N - 1, i0 + 1), k = f - i0;
      var alt = h[i0] + (h[i1] - h[i0]) * k, up = upTo[i0] + (upTo[i1] - upTo[i0]) * k;
      var x = X(p), y = Y(alt);
      line.style.strokeDashoffset = (1 - p).toFixed(4);
      rule.setAttribute('x1', x); rule.setAttribute('x2', x);
      dot.setAttribute('cx', x); dot.setAttribute('cy', y);
      rKm.textContent = fmt(p * KM, 1) + ' km';
      rAlt.textContent = Math.round(alt) + ' m';
      rUp.textContent = Math.round(up) + ' m';
    }
    function pointer(e) {
      var r = svg.getBoundingClientRect();
      manual = clamp((e.clientX - r.left) / r.width, 0, 1);
      set(0);
    }
    svg.addEventListener('pointermove', pointer);
    svg.addEventListener('pointerdown', pointer);
    svg.addEventListener('pointerleave', function () { manual = null; set(plateProgress(plate)); });
    svg.style.touchAction = 'pan-y';
    specs.push({ el: plate, set: function (p) { set(clamp(p * 1.25, 0, 1)); } });
    set(motion ? 0 : 1);
  })();

  /* ==========================================================
     2. BookWithStraser: izbira termina (vrhunec)
     ========================================================== */
  (function () {
    var plate = $('#bookwithstraser'); if (!plate) return;
    var box = $('[data-book]', plate), msg = $('[data-book-msg]', plate), ok = $('[data-book-confirm]', plate);
    var days = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet'];
    var times = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00'];
    var taken = [[0, 0], [1, 2], [2, 1], [3, 4], [4, 0], [0, 3], [2, 4], [3, 1], [1, 5], [4, 3], [0, 5], [2, 2], [3, 3], [4, 5], [1, 0]];
    var cells = {}, chosen = null, booked = false;

    box.appendChild(document.createElement('span'));
    days.forEach(function (d) { var s = document.createElement('span'); s.className = 'book__day'; s.textContent = d; box.appendChild(s); });
    times.forEach(function (t, r) {
      var tl = document.createElement('span'); tl.className = 'book__time'; tl.textContent = t; box.appendChild(tl);
      days.forEach(function (dn, c) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'slot'; b.setAttribute('aria-pressed', 'false');
        b.setAttribute('aria-label', dn + ' ' + t);
        b.textContent = t.slice(0, 2);
        b.addEventListener('click', function () { choose(c, r); });
        box.appendChild(b); cells[c + ',' + r] = b;
      });
    });

    function choose(c, r) {
      if (booked) return;
      if (chosen) cells[chosen.c + ',' + chosen.r].setAttribute('aria-pressed', 'false');
      chosen = { c: c, r: r };
      cells[c + ',' + r].setAttribute('aria-pressed', 'true');
      msg.textContent = 'Izbrano: ' + days[c] + ' ob ' + times[r] + '.';
      ok.disabled = false; ok.textContent = 'Potrdi';
    }
    ok.addEventListener('click', function () {
      if (booked) {
        booked = false; var key = chosen && chosen.c + ',' + chosen.r;
        if (key) cells[key].setAttribute('aria-pressed', 'false');
        chosen = null; ok.disabled = true; ok.textContent = 'Potrdi';
        msg.textContent = 'Izberi prost termin.'; return;
      }
      if (!chosen) return;
      booked = true;
      msg.textContent = 'Rezervirano: ' + days[chosen.c] + ' ob ' + times[chosen.r] + '. V pravi aplikaciji bi sledilo potrdilo po e-pošti.';
      ok.textContent = 'Prekliči';
    });

    function set(p) {
      var n = Math.round(clamp(p * 1.15, 0, 1) * taken.length);
      taken.forEach(function (t, i) {
        var b = cells[t[0] + ',' + t[1]];
        var isChosen = chosen && chosen.c === t[0] && chosen.r === t[1];
        var on = i < n && !isChosen;
        if (b.disabled !== on) { b.disabled = on; b.setAttribute('aria-label', days[t[0]] + ' ' + times[t[1]] + (on ? ', zasedeno' : '')); }
      });
    }
    specs.push({ el: plate, set: set });
    set(motion ? 0 : 1);
  })();

  /* ==========================================================
     3. Road Alert: opozorila prihajajo
     ========================================================== */
  (function () {
    var plate = $('#roadalert'); if (!plate) return;
    var list = $('.alerts__list', plate), pins = $('.alerts__pins', plate), count = $('[data-alert-count]', plate);
    var data = [
      { road: 'A1', kind: 'Zastoj', where: 'Maribor, proti Ljubljani', x: 210, y: 96, t: '12 min' },
      { road: 'A4', kind: 'Delo na cesti', where: 'Ptuj, en pas zaprt', x: 232, y: 36, t: '3 km' },
      { road: 'H2', kind: 'Opozorilo', where: 'Hitrost omejena zaradi vetra', x: 120, y: 218, t: '30 min' },
      { road: 'A1', kind: 'Nesreča', where: 'Celje, počasna vožnja', x: 170, y: 118, t: '8 min' },
      { road: 'R1', kind: 'Delo na cesti', where: 'Krožišče, izmenično enosmerno', x: 250, y: 232, t: '10 min' }
    ];
    var items = [], marks = [], on = -1, hot = -1;
    data.forEach(function (a, i) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'alert';
      b.innerHTML = '<b></b><span></span>';
      b.firstChild.textContent = a.road;
      var span = b.lastChild; span.textContent = a.kind;
      var sm = document.createElement('small'); sm.textContent = a.where + ' · ' + a.t; span.appendChild(sm);
      b.addEventListener('click', function () { focus(i); });
      li.appendChild(b); list.appendChild(li); items.push(b);
      var m = svgEl('circle', { class: 'pin', cx: a.x, cy: a.y, r: 9 });
      pins.appendChild(m); marks.push(m);
    });
    function focus(i) {
      hot = i;
      items.forEach(function (b, k) { b.classList.toggle('is-hot', k === i); });
      marks.forEach(function (m, k) { m.classList.toggle('is-hot', k === i); });
    }
    function set(p) {
      var n = Math.round(clamp(p * 1.2, 0, 1) * data.length);
      if (n === on) return; on = n;
      items.forEach(function (b, k) { b.classList.toggle('is-on', k < n); });
      marks.forEach(function (m, k) { m.classList.toggle('is-on', k < n); });
      count.textContent = n + (n === 1 ? ' opozorilo' : (n === 2 ? ' opozorili' : (n < 5 ? ' opozorila' : ' opozoril')));
      if (n > 0 && (hot < 0 || hot >= n)) focus(n - 1);
    }
    specs.push({ el: plate, set: set });
    set(motion ? 0 : 1);
    if (!motion) { on = -1; set(1); }
  })();

  /* ==========================================================
     4. metaCleaner: vrstice se brišejo
     ========================================================== */
  (function () {
    var plate = $('#metacleaner'); if (!plate) return;
    var body = $('[data-meta]', plate), count = $('[data-meta-count]', plate), msg = $('[data-meta-msg]', plate), btn = $('[data-meta-toggle]', plate);
    var rows = [['Naprava', 'Apple iPhone 14'], ['Čas posnetka', '2025-06-14 08:42:17'], ['Lokacija (GPS)', '46.42 N, 15.87 E'], ['Objektiv', 'f/1.5, 26 mm'], ['Programska oprema', 'iOS 17.5'], ['Serijska številka', 'F2LXK0Q4N6']];
    var trs = rows.map(function (r) {
      var tr = document.createElement('tr');
      var th = document.createElement('th'); th.scope = 'row'; th.textContent = r[0];
      var td = document.createElement('td'), sp = document.createElement('span'); sp.textContent = r[1]; td.appendChild(sp);
      tr.appendChild(th); tr.appendChild(td); body.appendChild(tr); return tr;
    });
    var manual = null, last = -1;
    function paint(n) {
      if (n === last) return; last = n;
      trs.forEach(function (tr, i) { tr.classList.toggle('is-gone', i < n); });
      count.textContent = 'Odstranjeno ' + n + ' / ' + rows.length;
      msg.textContent = n === rows.length ? 'Slika je čista, ostali so samo slikovni podatki.' : (n ? 'Metapodatki se brišejo.' : 'Metapodatki so še v sliki.');
      btn.textContent = n === rows.length ? 'Obnovi' : 'Očisti';
    }
    btn.addEventListener('click', function () { manual = last === rows.length ? 0 : rows.length; paint(manual); });
    specs.push({ el: plate, set: function (p) { if (manual !== null) return; paint(Math.round(clamp(p * 1.25, 0, 1) * rows.length)); } });
    paint(0);
    if (!motion) paint(0);
  })();

  /* ==========================================================
     Drsenje: en rAF na okvir
     ========================================================== */
  var indexLinks = $$('.index__nav a');
  var anchors = indexLinks.map(function (a) { return $(a.getAttribute('href')); });
  var queued = false;
  function onScroll() {
    queued = false;
    var y = window.scrollY, vh = window.innerHeight;
    var max = document.documentElement.scrollHeight - vh;
    root.style.setProperty('--prog', max > 0 ? (y / max).toFixed(4) : 0);

    if (motion) specs.forEach(function (s) {
      var r = s.el.getBoundingClientRect();
      if (r.bottom < -vh * 0.5 || r.top > vh * 1.5) return;
      s.set(plateProgress(s.el));
    });

    var cur = -1;
    anchors.forEach(function (el, i) {
      if (el && el.getBoundingClientRect().top < vh * 0.45 && !el.classList.contains('index__grp')) {
        if (indexLinks[i].classList.contains('index__grp')) return;
        cur = i;
      }
    });
    indexLinks.forEach(function (a, i) { if (i === cur) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  }
  window.addEventListener('scroll', function () {
    if (queued) return; queued = true; requestAnimationFrame(onScroll);
  }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();


  /* ==========================================================
     Kontaktni obrazec: vrstična validacija, napredek, uspeh
     ========================================================== */
  var form = document.getElementById('contact-form');
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (form) {
    var statusEl = form.querySelector('.form__status');
    var submitBtn = form.querySelector('button[type="submit"]');
    var submitLabel = submitBtn.querySelector('.form__label');
    var idleLabel = submitLabel.textContent;
    var doneEl = form.querySelector('.form__done');
    var fieldEls = Array.prototype.slice.call(form.querySelectorAll('.field'));
    var counter = form.querySelector('[data-count]');

    var say = function (msg, kind) {
      statusEl.textContent = msg;
      statusEl.className = 'form__status' + (kind ? ' is-' + kind : '');
    };

    var problem = function (ctl) {
      var v = ctl.value.trim();
      if (ctl.name === 'name') return v ? '' : 'Vnesite svoje ime.';
      if (ctl.name === 'email') {
        if (!v) return 'Vnesite svoj e-mail.';
        return EMAIL_RE.test(v) ? '' : 'Vnesite veljaven e-mail, npr. ime@domena.si.';
      }
      return v ? '' : 'Napišite kratko sporočilo.';
    };

    /* show = true: prikaži napako; sicer samo označi veljavnost */
    var check = function (field, show) {
      var ctl = field.querySelector('input, textarea');
      var err = field.querySelector('.field__err');
      var p = problem(ctl);
      field.classList.toggle('is-valid', !p);
      if (show) {
        field.classList.toggle('is-invalid', !!p);
        ctl.setAttribute('aria-invalid', p ? 'true' : 'false');
        err.textContent = p;
        err.hidden = !p;
      }
      return p;
    };

    var progress = function () {
      var ok = fieldEls.filter(function (f) { return f.classList.contains('is-valid'); }).length;
      form.style.setProperty('--fill', (ok / fieldEls.length).toFixed(3));
    };

    var updateCount = function () {
      var n = form.elements.message.value.length;
      counter.textContent = n + ' / 5000';
      counter.classList.toggle('is-near', n > 4500);
    };

    fieldEls.forEach(function (f) {
      var ctl = f.querySelector('input, textarea');
      ctl.addEventListener('input', function () {
        check(f, f.classList.contains('is-invalid'));   /* napaka izgine takoj, ko jo popraviš */
        progress();
        if (ctl.name === 'message') updateCount();
      });
      ctl.addEventListener('blur', function () {
        if (ctl.value !== '') check(f, true); else check(f, false);
        progress();
      });
    });

    /* Ctrl/Cmd + Enter v sporočilu pošlje obrazec */
    form.elements.message.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (form.requestSubmit) form.requestSubmit(); else submitBtn.click();
      }
    });

    var resetTurnstile = function () {
      if (window.turnstile) { try { window.turnstile.reset(); } catch (err) { /* widget še ni pripravljen */ } }
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submitBtn.disabled) return;

      var firstBad = null;
      fieldEls.forEach(function (f) {
        if (check(f, true) && !firstBad) firstBad = f;
      });
      progress();
      if (firstBad) {
        say('Preverite označena polja.', 'err');
        firstBad.querySelector('input, textarea').focus();
        return;
      }

      var who = form.elements.name.value.trim();
      submitBtn.disabled = true;
      submitLabel.textContent = 'Pošiljam …';
      say('', '');

      fetch('/api/contact', { method: 'POST', body: new FormData(form) })
        .then(function (res) {
          return res.json().catch(function () { return null; }).then(function (data) {
            return { res: res, data: data };
          });
        })
        .then(function (r) {
          if (r.data && r.data.ok) {
            form.reset();
            fieldEls.forEach(function (f) {
              f.classList.remove('is-valid', 'is-invalid');
              f.querySelector('.field__err').hidden = true;
            });
            updateCount(); progress();
            say('Hvala, ' + who + '. Sporočilo je poslano, odgovorim v kratkem.', 'ok');
            form.classList.add('is-sent');
            doneEl.hidden = false;
            doneEl.focus({ preventScroll: true });
          } else {
            say((r.data && r.data.error) || 'Pošiljanje ni uspelo. Poskusite znova.', 'err');
          }
        })
        .catch(function () {
          say('Povezava ni uspela. Preverite internet in poskusite znova.', 'err');
        })
        .then(function () {
          submitBtn.disabled = false;
          submitLabel.textContent = idleLabel;
          resetTurnstile();
        });
    });

    var again = form.querySelector('[data-again]');
    if (again) {
      again.addEventListener('click', function () {
        form.classList.remove('is-sent');
        doneEl.hidden = true;
        say('', '');
        form.elements.name.focus();
      });
    }
  }

  /* Turnstile ni na voljo: razumljivo sporočilo namesto Cloudflarove napake */
  window.onTurnstileError = function () {
    var s = document.querySelector('.form__status');
    if (s) {
      s.textContent = 'Preverjanje robota trenutno ni na voljo. Osvežite stran ali mi pišite na jaka@jastra.si.';
      s.className = 'form__status is-err';
    }
  };

  /* Kopiraj e-mail */
  Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (b) {
    var label = b.querySelector('span');
    var orig = label.textContent;
    b.addEventListener('click', function () {
      var done = function (t) {
        label.textContent = t;
        setTimeout(function () { label.textContent = orig; }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(b.getAttribute('data-copy')).then(
          function () { done('Kopirano ✓'); },
          function () { done('Ni uspelo'); }
        );
      } else { done('Ni uspelo'); }
    });
  });
})();
