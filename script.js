(function () {
  'use strict';

  var root = document.documentElement;
  var motion = root.classList.contains('motion');
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var smooth = function (a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* ==========================================================
     Nalaganje: logotip se nariše, nato se zavesa dvigne.
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

  setTimeout(ready, 7000);   /* varovalka: nalagalnik se nikoli ne zatakne */

  if (motion && loader) {
    var started = performance.now();
    var MIN = 2000;
    var assetsReady = false;
    var fontsDone = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    var loaded = new Promise(function (res) {
      if (document.readyState === 'complete') res(); else window.addEventListener('load', res);
    });
    Promise.all([fontsDone, loaded]).then(function () { assetsReady = true; });

    (function step(now) {
      var t = clamp((now - started) / MIN, 0, 1);
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
     VRHUNEC: ime se sestavi iz bajtov v črke.
     Vsaka črka ima tri sloje: bajti (baza), niz (strežnik),
     črka (vmesnik). Napredek drsenja preliva sloje; črke si
     sledijo z zamikom, zato se ime sestavlja od leve proti desni.
     ========================================================== */
  var compile = document.querySelector('.compile');
  var buildEl = document.querySelector('[data-compile]');
  var layers = Array.prototype.slice.call(document.querySelectorAll('.layer'));
  var cells = [];

  function utf8hex(ch) {
    var bytes = unescape(encodeURIComponent(ch)), out = '';
    for (var i = 0; i < bytes.length; i++) out += ('0' + bytes.charCodeAt(i).toString(16)).slice(-2);
    return out.toUpperCase();
  }

  if (motion && compile && buildEl) {
    var full = Array.prototype.map.call(buildEl.querySelectorAll('.build__line'), function (l) { return l.textContent; }).join(' ');
    buildEl.setAttribute('aria-label', full);
    Array.prototype.forEach.call(buildEl.querySelectorAll('.build__line'), function (line) {
      var text = line.textContent;
      line.textContent = '';
      line.setAttribute('aria-hidden', 'true');
      for (var i = 0; i < text.length; i++) {
        var c = text.charAt(i);
        var cell = document.createElement('span');
        cell.className = 'g';
        cell.innerHTML = '<span class="g__glyph"></span><span class="g__hex"></span><span class="g__code"></span>';
        cell.children[0].textContent = c;
        cell.children[1].textContent = utf8hex(c);
        cell.children[2].textContent = '"' + c + '"';
        line.appendChild(cell);
        cells.push({ glyph: cell.children[0], hex: cell.children[1], code: cell.children[2] });
      }
    });
    var sr = document.createElement('span');
    sr.className = 'sr';
    sr.textContent = full;
    buildEl.appendChild(sr);
  }

  var SPREAD = 0.3;
  function paintCompile() {
    var r = compile.getBoundingClientRect();
    var total = r.height - window.innerHeight;
    var p = total > 0 ? clamp(-r.top / total, 0, 1) : 0;
    var t = clamp((p - 0.06) / 0.84, 0, 1);          /* držanje na začetku in koncu */
    var n = cells.length;
    cells.forEach(function (c, i) {
      var d = n > 1 ? (i / (n - 1)) * SPREAD : 0;
      var u = clamp((t - d) / (1 - SPREAD), 0, 1);
      var toCode = smooth(0.2, 0.36, u);
      var toGlyph = smooth(0.6, 0.78, u);
      c.hex.style.opacity = (1 - toCode).toFixed(3);
      c.code.style.opacity = (toCode * (1 - toGlyph)).toFixed(3);
      c.glyph.style.opacity = toGlyph.toFixed(3);
    });
    var active = t < 0.34 ? 0 : (t < 0.67 ? 1 : 2);
    layers.forEach(function (l, i) { l.classList.toggle('on', i === active && p > 0 && p < 1 || (p >= 1 && i === 2)); });
  }

  /* ==========================================================
     Drsenje (en rAF na okvir)
     ========================================================== */
  var queued = false;
  function onScroll() {
    queued = false;
    if (motion && cells.length) paintCompile();
  }
  window.addEventListener('scroll', function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(onScroll);
  }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ==========================================================
     Naslovi projektov se odkrijejo ob vstopu
     ========================================================== */
  var items = document.querySelectorAll('[data-reveal]');
  if (motion && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.3 });
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
})();
