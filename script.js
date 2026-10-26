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
     Interaktivno ozadje: konturne črte
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

  /* Valujoče konturne črte: počasi dihajo, kazalec jih razmakne in osvetli,
     klik sproži val, drsenje jih premakne. Zelo subtilno, da ne moti branja. */
  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    var spacing = W < 700 ? 30 : 36;
    var step = W < 700 ? 16 : 12;
    var R = W < 700 ? 130 : 210;
    var t = motion ? now * 0.001 : 0;
    var off = -((scrollSm * 0.22) % spacing);
    var lines = Math.ceil(H / spacing) + 3;
    var pOn = ptr.son > 0.01;

    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';

    for (var j = -1; j < lines; j++) {
      var by = j * spacing + off;
      var near = 0;
      if (pOn) {
        var ldy = by - ptr.sy;
        near = Math.exp(-(ldy * ldy) / (R * R * 0.55)) * ptr.son;
      }
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.065 + near * 0.3).toFixed(3) + ')';
      ctx.beginPath();

      for (var x = -step; x <= W + step; x += step) {
        var y = by
          + Math.sin(x * 0.0055 + t * 0.45 + j * 0.33) * 10
          + Math.sin(x * 0.012 - t * 0.3 + j * 0.21) * 5;

        if (pOn) {
          var dx = x - ptr.sx, dy = y - ptr.sy;
          var g = Math.exp(-(dx * dx + dy * dy) / (R * R));
          y += (dy / (Math.abs(dy) + 30)) * g * ptr.son * 26;
        }

        for (var k = 0; k < ripples.length; k++) {
          var rp = ripples[k];
          var age = now - rp.t;
          var rdx = x - rp.x, rdy = y - rp.y;
          var band = Math.abs(Math.sqrt(rdx * rdx + rdy * rdy) - age * 0.55);
          if (band < 90) {
            var w = (1 - band / 90) * Math.exp(-age / 1100);
            y += (rdy / (Math.abs(rdy) + 30)) * w * 22;
          }
        }

        if (x === -step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
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

  /* Označi razdelek, v katerem si */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.menu a'));
  if ('IntersectionObserver' in window && navLinks.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        navLinks.forEach(function (a) {
          if (a.getAttribute('href') === '#' + en.target.id) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['delo', 'projekti', 'pot', 'kontakt'].forEach(function (id) {
      var s = document.getElementById(id);
      if (s) spy.observe(s);
    });
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
