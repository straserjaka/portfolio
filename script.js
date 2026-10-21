(function () {
  'use strict';

  var root = document.documentElement;
  var motion = root.classList.contains('motion');
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Hero: ime razdelimo na črke ---------- */
  var letters = 0;
  Array.prototype.forEach.call(document.querySelectorAll('.name__line'), function (line) {
    var text = line.textContent;
    line.textContent = '';
    line.setAttribute('aria-label', text);
    for (var i = 0; i < text.length; i++) {
      var s = document.createElement('span');
      s.className = 'ch';
      s.setAttribute('aria-hidden', 'true');
      s.style.setProperty('--i', letters++);
      s.textContent = text[i];
      line.appendChild(s);
    }
  });

  /* ---------- Nalaganje: števec, nato zavesa ---------- */
  var loader = document.querySelector('.loader');
  var count = loader && loader.querySelector('.loader__count span');
  var started = performance.now();
  var MIN = 2100;                       /* dovolj, da se monogram nariše do konca */
  var finished = false;

  function ready() {
    if (finished) return;
    finished = true;
    root.classList.add('ready');
    root.classList.remove('loading');
    if (loader) {
      loader.classList.add('is-done');
      setTimeout(function () { loader.classList.add('is-gone'); }, 1200);
    }
  }

  if (motion && loader) {
    var assetsReady = false;
    var fontsDone = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    var loaded = new Promise(function (res) {
      if (document.readyState === 'complete') res(); else window.addEventListener('load', res);
    });
    Promise.all([fontsDone, loaded]).then(function () { assetsReady = true; });

    (function step(now) {
      var t = clamp((now - started) / MIN, 0, 1);
      var e = 1 - Math.pow(1 - t, 3);
      var p = Math.round(e * (assetsReady ? 100 : 96));
      loader.style.setProperty('--load', (p / 100).toFixed(3));
      count.textContent = ('00' + p).slice(-3);
      if (t < 1 || !assetsReady) {
        if (now - started > 6000) { ready(); return; }   /* varovalka pri počasni povezavi */
        requestAnimationFrame(step);
      } else {
        count.textContent = '100';
        setTimeout(ready, 250);
      }
    })(started);
  } else {
    ready();
  }

  /* ---------- Globina herou: kazalec in drsenje ---------- */
  var hero = document.querySelector('.hero');
  function depth() {
    var y = window.scrollY;
    if (y < window.innerHeight * 1.2) hero.style.setProperty('--sy', y.toFixed(0));
    var max = document.documentElement.scrollHeight - window.innerHeight;
    root.style.setProperty('--prog', max > 0 ? (y / max).toFixed(4) : 0);
  }
  if (motion) {
    window.addEventListener('scroll', function () { requestAnimationFrame(depth); }, { passive: true });
    depth();
    if (fine) {
      hero.addEventListener('pointermove', function (e) {
        var r = hero.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        hero.style.setProperty('--px', (x - 0.5).toFixed(3));
        hero.style.setProperty('--py', (y - 0.5).toFixed(3));
        hero.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        hero.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      });
    }
  }

  /* ---------- Akt: besede se prižgejo, pika požre stran ---------- */
  var act = document.querySelector('.act');
  var stage = act.querySelector('.act__stage');
  var words = Array.prototype.slice.call(act.querySelectorAll('.w, .dot'));
  var flood = act.querySelector('.flood');
  var title = act.querySelector('.act__title');
  var dot = act.querySelector('.dot');
  var geo = { cx: 0, cy: 0, r0: 1, rMax: 1 };

  function measure() {
    var s = stage.getBoundingClientRect();
    var d = dot.getBoundingClientRect();
    geo.cx = d.left - s.left + d.width / 2;
    geo.cy = d.top - s.top + d.height / 2;
    geo.r0 = Math.max(d.width / 2, 1);
    geo.rMax = Math.hypot(Math.max(geo.cx, s.width - geo.cx), Math.max(geo.cy, s.height - geo.cy)) + 4;
  }

  function ease(t) { return t * t * (3 - 2 * t); }

  function paintAct() {
    var r = act.getBoundingClientRect();
    var total = r.height - window.innerHeight;
    var p = total > 0 ? clamp(-r.top / total, 0, 1) : 0;

    /* 0.04 do 0.46: besede */
    var span = (p - 0.04) / 0.42 * words.length;
    for (var i = 0; i < words.length; i++) {
      words[i].style.setProperty('--l', clamp(span - i, 0, 1).toFixed(3));
    }

    /* 0.58 do 0.88: pika raste, eksponentno, da se zdi kot približevanje */
    var t = clamp((p - 0.58) / 0.30, 0, 1);
    var radius = t <= 0 ? 0 : geo.r0 * Math.pow(geo.rMax / geo.r0, t);
    flood.style.clipPath = 'circle(' + radius.toFixed(1) + 'px at ' + geo.cx.toFixed(1) + 'px ' + geo.cy.toFixed(1) + 'px)';

    /* 0.86 do 0.95: naslov */
    var tt = ease(clamp((p - 0.86) / 0.09, 0, 1));
    title.style.opacity = tt.toFixed(3);
    title.style.transform = 'translateY(' + ((1 - tt) * 0.12).toFixed(3) + 'em)';
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; paintAct(); });
  }

  function layout() {
    if (motion) { measure(); paintAct(); }
  }

  if (motion) window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', layout);
  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

  /* ---------- Projekti: vrstica počrni na sredini zaslona (tudi na dotik) ---------- */
  var rows = document.querySelectorAll('.work__item');
  if (motion && 'IntersectionObserver' in window && !fine) {
    var tone = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.classList.toggle('is-on', e.isIntersecting); });
    }, { rootMargin: '-42% 0px -42% 0px' });
    rows.forEach(function (el) { tone.observe(el); });
  }

  /* ---------- Vrstice se pokažejo ob vstopu ---------- */
  var items = document.querySelectorAll('[data-reveal]');
  if (motion && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }
})();
