(function () {
  'use strict';

  var root = document.documentElement;
  var motion = root.classList.contains('motion');

  /* ==========================================================
     Interaktivno ozadje: konturne črte
     Zelo subtilno: kazalec jih rahlo odrine, drsenje jih premakne,
     v mirovanju počasi dihajo.
     ========================================================== */
  var cvs = document.querySelector('.bg');
  var ctx = cvs.getContext('2d');
  var W = 0, H = 0, dpr = 1, gap = 30, cols = 0, rows = 0;
  var ptr = { x: -9999, y: -9999, sx: -9999, sy: -9999, on: 0, son: 0 };
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
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.045 + near * 0.14).toFixed(3) + ')';
      ctx.beginPath();

      for (var x = -step; x <= W + step; x += step) {
        var y = by
          + Math.sin(x * 0.0055 + t * 0.45 + j * 0.33) * 6
          + Math.sin(x * 0.012 - t * 0.3 + j * 0.21) * 3;

        if (pOn) {
          var dx = x - ptr.sx, dy = y - ptr.sy;
          var g = Math.exp(-(dx * dx + dy * dy) / (R * R));
          y += (dy / (Math.abs(dy) + 30)) * g * ptr.son * 12;
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
    }, { passive: true });
    document.addEventListener('pointerleave', function () { ptr.on = 0; });
    window.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') ptr.on = 0; }, { passive: true });
    window.addEventListener('scroll', function () { scrollY = window.scrollY; }, { passive: true });

    (function frame(now) {
      ptr.sx += (ptr.x - ptr.sx) * 0.16;
      ptr.sy += (ptr.y - ptr.sy) * 0.16;
      ptr.son += (ptr.on - ptr.son) * 0.08;
      scrollSm += (scrollY - scrollSm) * 0.12;
      if (!document.hidden) draw(now);
      requestAnimationFrame(frame);
    })(performance.now());
  } else {
    size();
    window.addEventListener('resize', size);
  }


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

})();
