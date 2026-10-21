(function () {
  'use strict';

  var root = document.documentElement;
  var motion = root.classList.contains('motion');
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  /* ==========================================================
     Ime v herou: razdelimo na črke (za učinek ob kazalcu)
     ========================================================== */
  var letters = [];
  Array.prototype.forEach.call(document.querySelectorAll('[data-split]'), function (line) {
    var text = line.textContent;
    line.textContent = '';
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

  /* ==========================================================
     Nalaganje: ime, črta, števec. Nato se zavesa dvigne.
     ========================================================== */
  var loader = document.querySelector('.loader');
  var finished = false;

  function ready() {
    if (finished) return;
    finished = true;
    root.classList.add('ready');
    root.classList.remove('loading');
    if (loader) {
      loader.classList.add('is-done');
      setTimeout(function () { loader.classList.add('is-gone'); }, 1100);
    }
  }

  if (motion && loader) {
    var count = loader.querySelector('.loader__count');
    var started = performance.now();
    var MIN = 1500;
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
        if (now - started > 6000) { ready(); return; }       /* varovalka pri počasni povezavi */
        requestAnimationFrame(step);
      } else {
        setTimeout(ready, 200);
      }
    })(started);
  } else {
    ready();
  }

  /* ==========================================================
     Interaktivno ozadje: mreža pik
     - kazalec jih odrine in poveča
     - klik/dotik sproži valovanje
     - drsenje premakne mrežo
     - v mirovanju diha (da je živo tudi na telefonu)
     ========================================================== */
  var cvs = document.querySelector('.bg');
  var ctx = cvs.getContext('2d');
  var W = 0, H = 0, dpr = 1, gap = 30, cols = 0, rows = 0;
  var ptr = { x: -9999, y: -9999, sx: -9999, sy: -9999, on: 0, son: 0 };
  var ripples = [];
  var scrollY = window.scrollY, scrollSm = scrollY;

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cvs.width = Math.round(W * dpr); cvs.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gap = W < 700 ? 26 : 32;
    cols = Math.ceil(W / gap) + 2;
    rows = Math.ceil(H / gap) + 2;
    if (!motion) draw(0);
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    var R = W < 700 ? 120 : 190;
    var offY = -((scrollSm * 0.18) % gap);
    var t = now * 0.001;

    for (var j = -1; j < rows; j++) {
      for (var i = -1; i < cols; i++) {
        var bx = i * gap + (j & 1 ? gap / 2 : 0) - gap / 2;
        var by = j * gap + offY;
        var x = bx, y = by;

        var amb = motion ? Math.sin(bx * 0.012 + t * 0.9) * Math.cos(by * 0.014 - t * 0.7) : 0;
        var infl = 0, ring = 0;

        var dx = bx - ptr.sx, dy = by - ptr.sy;
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (ptr.son > 0.01 && d < R * 2) {
          infl = Math.exp(-(d * d) / (R * R)) * ptr.son;
          var push = infl * 22;
          x += (dx / d) * push; y += (dy / d) * push;
        }

        for (var k = 0; k < ripples.length; k++) {
          var rp = ripples[k];
          var age = now - rp.t;
          var rr = age * 0.55;
          var rdx = bx - rp.x, rdy = by - rp.y;
          var rd = Math.sqrt(rdx * rdx + rdy * rdy) || 1;
          var band = Math.abs(rd - rr);
          if (band < 90) {
            var w = (1 - band / 90) * Math.exp(-age / 1100);
            ring += w;
            x += (rdx / rd) * w * 14; y += (rdy / rd) * w * 14;
          }
        }

        var r = 1 + infl * 2.6 + ring * 2.2 + amb * 0.25;
        var a = 0.13 + infl * 0.75 + ring * 0.6 + amb * 0.05;
        ctx.fillStyle = 'rgba(255,255,255,' + clamp(a, 0, 1).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(x, y, Math.max(r, 0.5), 0, 6.2832);
        ctx.fill();
      }
    }
  }

  if (motion) {
    size();
    window.addEventListener('resize', size);

    window.addEventListener('pointermove', function (e) {
      ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = 1;
      if (ptr.sx < -999) { ptr.sx = ptr.x; ptr.sy = ptr.y; }
    }, { passive: true });
    window.addEventListener('pointerdown', function (e) {
      ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = 1;
      if (ptr.sx < -999) { ptr.sx = ptr.x; ptr.sy = ptr.y; }
      ripples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (ripples.length > 4) ripples.shift();
    }, { passive: true });
    document.addEventListener('pointerleave', function () { ptr.on = 0; });
    window.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') ptr.on = 0; }, { passive: true });
    window.addEventListener('scroll', function () { scrollY = window.scrollY; }, { passive: true });

    (function frame(now) {
      ptr.sx += (ptr.x - ptr.sx) * 0.16;
      ptr.sy += (ptr.y - ptr.sy) * 0.16;
      ptr.son += (ptr.on - ptr.son) * 0.08;
      scrollSm += (scrollY - scrollSm) * 0.12;
      while (ripples.length && now - ripples[0].t > 2600) ripples.shift();
      if (!document.hidden) draw(now);
      requestAnimationFrame(frame);
    })(performance.now());
  } else {
    size();
    window.addEventListener('resize', size);
  }

  /* ==========================================================
     Hero: črke odgovorijo kazalcu (le transform in opacity)
     ========================================================== */
  var hero = document.querySelector('.hero');
  if (motion && fine && letters.length) {
    var hp = null, hraf = 0, taken = false, gl = 0;
    var hv = letters.map(function () { return 0; });

    var htick = function () {
      var moving = false;
      gl += ((hp ? 1 : 0) - gl) * 0.1;
      if (Math.abs((hp ? 1 : 0) - gl) > 0.002) moving = true;
      for (var i = 0; i < letters.length; i++) {
        var r = letters[i].getBoundingClientRect();
        var target = 0;
        if (hp) {
          var d = Math.hypot(hp.x - (r.left + r.width / 2), hp.y - (r.top + r.height / 2));
          target = clamp(1 - d / (r.height * 1.25), 0, 1);
          target = target * target;
        }
        hv[i] += (target - hv[i]) * 0.14;
        if (Math.abs(target - hv[i]) > 0.002) moving = true; else hv[i] = target;
        letters[i].style.transform = 'translateY(' + (-hv[i] * 0.06).toFixed(4) + 'em) scale(' + (1 + hv[i] * 0.035).toFixed(4) + ')';
        letters[i].style.opacity = (1 - gl * 0.38 * (1 - hv[i])).toFixed(3);
      }
      hraf = moving ? requestAnimationFrame(htick) : 0;
    };
    var hkick = function () { if (!hraf) hraf = requestAnimationFrame(htick); };

    hero.addEventListener('pointermove', function (e) {
      if (!root.classList.contains('ready')) return;
      /* po vstopni animaciji prevzamemo transform in opacity */
      if (!taken) {
        taken = true;
        letters.forEach(function (l) { l.style.opacity = "1"; l.style.transform = "none"; l.style.animation = "none"; });
      }
      hp = { x: e.clientX, y: e.clientY };
      hkick();
    });
    hero.addEventListener('pointerleave', function () {
      hp = null;
      hkick();
    });
  }

  /* ==========================================================
     Ura v Ptuju
     ========================================================== */
  var clockEl = document.querySelector('[data-clock]');
  function tickClock() {
    try {
      clockEl.textContent = new Intl.DateTimeFormat('sl-SI', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Ljubljana'
      }).format(new Date());
    } catch (e) { /* ura ostane prazna */ }
  }
  if (clockEl) { tickClock(); setInterval(tickClock, 20000); }

  /* ==========================================================
     Drsenje: napredek strani, trije sloji, časovnica
     ========================================================== */
  var flow = document.querySelector('.flow');
  var steps = Array.prototype.slice.call(document.querySelectorAll('.step'));
  var stepsBox = document.querySelector('.flow__steps');
  var timeline = document.querySelector('.timeline');
  var desktopFlow = window.matchMedia('(min-width: 801px)');

  function onScroll() {
    var y = window.scrollY;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    root.style.setProperty('--prog', max > 0 ? (y / max).toFixed(4) : 0);

    if (motion && desktopFlow.matches) {
      var r = flow.getBoundingClientRect();
      var total = r.height - window.innerHeight;
      var p = total > 0 ? clamp(-r.top / total, 0, 1) : 0;
      var q = clamp((p - 0.06) / 0.84, 0, 1);
      stepsBox.style.setProperty('--fp', q.toFixed(4));
      steps.forEach(function (s, i) { s.classList.toggle('on', q >= i / 3 - 0.001 && p > 0.02); });
    } else if (motion) {
      steps.forEach(function (s) { s.classList.add('on'); });
    }

    if (motion && timeline) {
      var tr = timeline.getBoundingClientRect();
      var tp = clamp((window.innerHeight * 0.6 - tr.top) / tr.height, 0, 1);
      timeline.style.setProperty('--tp', tp.toFixed(4));
    }
  }

  var sticking = false;
  window.addEventListener('scroll', function () {
    if (sticking) return;
    sticking = true;
    requestAnimationFrame(function () { sticking = false; onScroll(); });
  }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ==========================================================
     Vrstice se pokažejo ob vstopu
     ========================================================== */
  var items = document.querySelectorAll('[data-reveal]');
  if (motion && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }

  /* ==========================================================
     Magnetni gumbi
     ========================================================== */
  if (motion && fine) {
    Array.prototype.forEach.call(document.querySelectorAll('.magnet'), function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        var x = (e.clientX - (r.left + r.width / 2)) / r.width;
        var y = (e.clientY - (r.top + r.height / 2)) / r.height;
        b.style.transform = 'translate(' + (x * 12).toFixed(1) + 'px,' + (y * 10).toFixed(1) + 'px)';
      });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; });
    });
  }
})();
