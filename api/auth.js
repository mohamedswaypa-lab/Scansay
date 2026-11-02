/* Customer login (Supabase Auth).
   POST /api/auth?a=login    {email,password}        → {access_token, refresh_token, expires_in}
   POST /api/auth?a=refresh  {refresh_token}         → new tokens
   POST /api/auth?a=reset    {email}                 → emails a link to choose a new password (always answers ok)
   POST /api/auth?a=password {password}  + Bearer    → sets a new password (after invite or reset link) */
const L = require('./_lib');

module.exports = async (req, res) => {
  const a = (req.query && req.query.a) || new URL(req.url, 'http://x').searchParams.get('a');
  if (req.method !== 'POST') return L.send(res, 405, { error: 'method' });
  try {
    const b = await L.body(req), ip = L.ipOf(req);
    if (a === 'login') {
      if (await L.limited('login:' + L.hmac(ip), 10, 15 * 60e3)) { L.secLog('login_rate', req); return L.send(res, 429, { error: 'rate' }); }
      const email = String(b.email || '').trim().toLowerCase(), password = String(b.password || '');
      if (!email || !password) return L.send(res, 400, { error: 'missing' });
      if (await L.limited('loginu:' + L.hmac(email), 8, 15 * 60e3)) return L.send(res, 429, { error: 'rate' });
      const r = await L.authApi('POST', 'token?grant_type=password', { email, password });
      if (!r.ok) { L.secLog('login_failed', req, { user: L.hmac(email).slice(0, 12) }); return L.send(res, 401, { error: 'wrong' }); }
      const ms = await L.sb('GET', 'members?user_id=eq.' + L.q(r.data.user.id) + '&select=account_id');
      if (!ms.length) return L.send(res, 403, { error: 'noaccount' });
      return L.send(res, 200, { access_token: r.data.access_token, refresh_token: r.data.refresh_token, expires_in: r.data.expires_in });
    }
    if (a === 'refresh') {
      const r = await L.authApi('POST', 'token?grant_type=refresh_token', { refresh_token: String(b.refresh_token || '') });
      if (!r.ok) return L.send(res, 401, { error: 'auth' });
      return L.send(res, 200, { access_token: r.data.access_token, refresh_token: r.data.refresh_token, expires_in: r.data.expires_in });
    }
    if (a === 'reset') {
      const email = String(b.email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return L.send(res, 400, { error: 'format' });
      if (await L.limited('reset:' + L.hmac(ip), 5, 60 * 60e3) || await L.limited('resetu:' + L.hmac(email), 3, 60 * 60e3)) return L.send(res, 200, { ok: true });
      const r = await L.authApi('POST', 'admin/generate_link', { type: 'recovery', email, redirect_to: L.site() + '/app/' });
      const link = r.ok && (r.data.action_link || (r.data.properties && r.data.properties.action_link));
      if (link) await L.sendEmail({ to: email, subject: 'Välj ett nytt lösenord till ScanSay', text: 'Öppna länken för att välja ett nytt lösenord: ' + link + '\nLänken gäller i 1 timme. Har du inte bett om det? Ignorera mejlet.', html: L.mailHtml('Välj ett nytt lösenord', '<p>Någon (förhoppningsvis du) bad om ett nytt lösenord till ditt ScanSay-konto. Länken gäller i 1 timme och kan bara användas en gång.</p><p style="color:#6B7280;font-size:13px">Har du inte bett om det? Ignorera mejlet. Ditt nuvarande lösenord fortsätter att fungera.</p>', [['Välj nytt lösenord', link], ['Logga in', L.site() + '/#login']], { preheader: 'Länk för att välja ett nytt lösenord', reason: 'Det här är ett servicemeddelande om ditt konto hos ScanSay.' }) }).catch(e => console.error('reset mail', e.message));
      return L.send(res, 200, { ok: true });   // same answer whether or not the address exists
    }
    if (a === 'password') {
      const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const pw = String(b.password || '');
      if (pw.length < 10 || !/[A-Za-zÅÄÖåäö]/.test(pw) || !/\d/.test(pw)) return L.send(res, 400, { error: 'weak' });
      const r = await L.authApi('PUT', 'user', { password: pw }, tok);
      if (!r.ok) return L.send(res, r.status === 401 ? 401 : 400, { error: r.status === 401 ? 'auth' : 'weak' });
      return L.send(res, 200, { ok: true });
    }
    return L.send(res, 400, { error: 'action' });
  } catch (e) { L.fail(res, e, req); }
};
