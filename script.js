(function () {
  'use strict';

  var root = document.documentElement;
  var motion = root.classList.contains('motion');
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  /* ---------- Hero: ime razdelimo na črke, velikost prilagodimo širini ---------- */
  var body = document.querySelector('.hero__body');
  var lines = Array.prototype.slice.call(document.querySelectorAll('.name__line'));
  var letters = [];

  lines.forEach(function (line) {
    var text = line.textContent;
    line.textContent = '';
    line.setAttribute('aria-label', text);
    for (var i = 0; i < text.length; i++) {
      var s = document.createElement('span');
      s.className = 'ch';
      s.setAttribute('aria-hidden', 'true');
      s.style.setProperty('--i', letters.length);
      s.textContent = text[i];
      line.appendChild(s);
      letters.push(s);
    }
  });

  var BASE = 780, PEAK = 900;

  function fitName() {
    var b = lines[1];
    var avail = body.clientWidth * 0.96;
    var cur = parseFloat(getComputedStyle(b).fontSize);
    var w = b.getBoundingClientRect().width;
    if (w > 0) body.style.setProperty('--fs', (cur * avail / w).toFixed(2) + 'px');
  }

  /* ---------- Podpis: pri kazalcu črke postanejo težje ---------- */
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var pointer = null, raf = 0, weights = letters.map(function () { return BASE; });

  function tick() {
    var moving = false;
    for (var i = 0; i < letters.length; i++) {
      var r = letters[i].getBoundingClientRect();
      var target = BASE;
      if (pointer) {
        var d = Math.hypot(pointer.x - (r.left + r.width / 2), pointer.y - (r.top + r.height / 2));
        var k = clamp(1 - d / (r.height * 1.1), 0, 1);
        target = BASE + (PEAK - BASE) * k * k;
      }
      weights[i] += (target - weights[i]) * 0.16;
      if (Math.abs(target - weights[i]) > 0.5) moving = true; else weights[i] = target;
      letters[i].style.fontWeight = Math.round(weights[i]);
    }
    raf = moving ? requestAnimationFrame(tick) : 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }

  if (motion && fine) {
    var hero = document.querySelector('.hero');
    hero.addEventListener('pointermove', function (e) { pointer = { x: e.clientX, y: e.clientY }; kick(); });
    hero.addEventListener('pointerleave', function () { pointer = null; kick(); });
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
    fitName();
    if (motion) { measure(); paintAct(); }
  }

  if (motion) {
    window.addEventListener('scroll', onScroll, { passive: true });
  }
  window.addEventListener('resize', layout);
  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);


  /* ---------- Globina herou: kazalec in drsenje premikata ravnine različno hitro ---------- */
  var heroEl = document.querySelector('.hero');
  var prog = 0;
  function depth() {
    var y = window.scrollY;
    if (y < window.innerHeight * 1.2) heroEl.style.setProperty('--sy', y.toFixed(0));
    var max = document.documentElement.scrollHeight - window.innerHeight;
    root.style.setProperty('--prog', max > 0 ? (y / max).toFixed(4) : 0);
  }
  if (motion) {
    window.addEventListener('scroll', function () { requestAnimationFrame(depth); }, { passive: true });
    depth();
    if (fine) {
      heroEl.addEventListener('pointermove', function (e) {
        var r = heroEl.getBoundingClientRect();
        heroEl.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
        heroEl.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      });
    }
  }

  /* ---------- Projekti: ton se prižge na sredini zaslona (tudi na dotik) ---------- */
  var rows = document.querySelectorAll('.work__item');
  if (motion && 'IntersectionObserver' in window) {
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
