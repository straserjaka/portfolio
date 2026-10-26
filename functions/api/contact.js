const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function fail(error, status) {
  return json({ ok: false, error }, status);
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function onRequestPost({ request, env }) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return fail('Neveljavna zahteva.', 400);
  }

  const field = (key) => {
    const v = form.get(key);
    return typeof v === 'string' ? v : '';
  };

  // Honeypot: botu se pretvarjamo, da je uspelo.
  if (field('website').trim() !== '') {
    return json({ ok: true });
  }

  const name = field('name').replace(/[\r\n]+/g, ' ').trim();
  const email = field('email').trim();
  const message = field('message').trim();
  const token = field('cf-turnstile-response');

  if (!name || !email || !message) {
    return fail('Izpolnite vsa polja.', 400);
  }
  if (name.length > 100) {
    return fail('Ime je predolgo (največ 100 znakov).', 400);
  }
  if (email.length > 200 || !EMAIL_RE.test(email)) {
    return fail('Vnesite veljaven e-poštni naslov.', 400);
  }
  if (message.length > 5000) {
    return fail('Sporočilo je predolgo (največ 5000 znakov).', 400);
  }
  if (!token) {
    return fail('Potrdite, da niste robot.', 400);
  }

  if (!env.TURNSTILE_SECRET_KEY || !env.RESEND_API_KEY || !env.CONTACT_TO) {
    console.error('Manjkajo spremenljivke okolja: TURNSTILE_SECRET_KEY, RESEND_API_KEY ali CONTACT_TO.');
    return fail('Strežnik ni pravilno nastavljen.', 500);
  }

  // Turnstile
  let verdict;
  try {
    const body = new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
    });
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip) body.set('remoteip', ip);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    verdict = await res.json();
  } catch (err) {
    console.error('Turnstile siteverify ni uspel:', err);
    return fail('Preverjanja ni bilo mogoče opraviti. Poskusite znova.', 502);
  }
  if (!verdict || !verdict.success) {
    return fail('Preverjanje robota ni uspelo. Poskusite znova.', 403);
  }

  // E-mail prek Resend
  const html =
    '<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#0a0a0a">' +
    `<p><strong>Ime:</strong> ${escapeHtml(name)}</p>` +
    `<p><strong>E-mail:</strong> ${escapeHtml(email)}</p>` +
    '<p><strong>Sporočilo:</strong></p>' +
    `<p style="white-space:pre-wrap">${escapeHtml(message)}</p>` +
    '</div>';
  const text = `Ime: ${name}\nE-mail: ${email}\n\nSporočilo:\n${message}\n`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Portfolio <kontakt@jastra.si>',
        to: [env.CONTACT_TO],
        reply_to: email,
        subject: `Novo sporočilo s portfolija: ${name}`,
        html,
        text,
      }),
    });
    if (!res.ok) {
      console.error('Resend napaka:', res.status, await res.text());
      return fail('Sporočila ni bilo mogoče poslati. Poskusite znova ali mi pišite neposredno.', 502);
    }
  } catch (err) {
    console.error('Resend zahteva ni uspela:', err);
    return fail('Sporočila ni bilo mogoče poslati. Poskusite znova ali mi pišite neposredno.', 502);
  }

  return json({ ok: true });
}
