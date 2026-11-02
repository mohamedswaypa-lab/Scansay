/* Shared helpers for ScanSay Vercel functions (Node 18+, no dependencies).
   Environment variables (Vercel → Project → Settings → Environment Variables):
     ADMIN_TOKEN    long random string, also typed into Admin → Inställningar
     SIGN_SECRET    long random string used to seal signing links
     BREVO_API_KEY  e-post via Brevo (EU)       MAIL_FROM  e.g. "ScanSay <hello@scansay.se>"
     ELKS_USER / ELKS_PASS  sms via 46elks (Sverige)   SMS_FROM  e.g. "ScanSay"
     NOTIFY_EMAIL   where signed contracts are copied, e.g. hello@scansay.se
     SITE_URL       e.g. https://scansay.se
     SUPABASE_URL          https://xxxx.supabase.co  (region EU North, Stockholm)
     SUPABASE_SERVICE_KEY  service_role key (server only, never in the browser)
     SUPABASE_ANON_KEY     anon key (used for password login)
     OTP_SECRET            long random string used to hash one-time codes and contacts
     STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET  card payments (optional) */
const crypto = require('crypto');

const env = k => String(process.env[k] || '').trim().replace(/^["']|["']$/g, '');   // tolerate spaces or quotes pasted around a value
function send(res, status, obj) { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); }
async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((ok, bad) => { let d = ''; req.on('data', c => { d += c; if (d.length > 2e5) { bad(new Error('too large')); req.destroy(); } }); req.on('end', () => { try { ok(d ? JSON.parse(d) : {}); } catch (e) { bad(e); } }); });
}
function isAdmin(req) {
  const t = String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''), a = env('ADMIN_TOKEN');
  return !!a && t.length === a.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(a));
}
const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
function seal(obj) { const p = b64u(JSON.stringify(obj)); const sig = b64u(crypto.createHmac('sha256', env('SIGN_SECRET')).update(p).digest()); return p + '.' + sig; }
function unseal(tok) {
  const [p, sig] = String(tok || '').split('.'); if (!p || !sig || !env('SIGN_SECRET')) return null;
  const want = b64u(crypto.createHmac('sha256', env('SIGN_SECRET')).update(p).digest());
  if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  try { return JSON.parse(unb64u(p).toString('utf8')); } catch (e) { return null; }
}
const escH = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function sendEmail({ to, subject, text, html, replyTo }) {
  if (!env('BREVO_API_KEY')) throw new Error('BREVO_API_KEY saknas');
  if (html && html.includes('<!--FOOTER-->')) { try { html = html.replace('<!--FOOTER-->', await footerHtml()); } catch (e) { html = html.replace('<!--FOOTER-->', ''); } }
  else if (!html) { html = mailHtml(escH(subject), `<div style="white-space:pre-wrap">${escH(text)}</div>`); try { html = html.replace('<!--FOOTER-->', await footerHtml()); } catch (e) {} }
  const from = env('MAIL_FROM') || 'ScanSay <hello@scansay.se>'; const m = from.match(/^(.*)<(.+)>$/);
  const r = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': env('BREVO_API_KEY'), 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: m ? { name: m[1].trim(), email: m[2].trim() } : { email: from }, to: [].concat(to).map(e => ({ email: e })), subject, textContent: text, htmlContent: html || `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0A0F1C;white-space:pre-wrap">${escH(text)}</div>`, replyTo: replyTo ? { email: replyTo } : undefined }) });
  if (!r.ok) throw new Error('E-post misslyckades: ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return true;
}
async function sendSms({ to, text }) {
  if (!env('ELKS_USER')) throw new Error('ELKS_USER saknas');
  let n = String(to).replace(/[\s-]/g, ''); if (n.startsWith('00')) n = '+' + n.slice(2); if (n.startsWith('0')) n = '+46' + n.slice(1);
  if (!/^\+\d{8,15}$/.test(n)) throw new Error('Ogiltigt nummer');
  const r = await fetch('https://api.46elks.com/a1/sms', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(env('ELKS_USER') + ':' + env('ELKS_PASS')).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ from: env('SMS_FROM') || 'ScanSay', to: n, message: String(text).slice(0, 600) }) });
  if (!r.ok) throw new Error('Sms misslyckades: ' + r.status);
  return true;
}

/* ---------- database (Supabase REST, service key) ---------- */
const SB = () => { const v = env('SUPABASE_URL'); const d = v.match(/project\/([a-z0-9]{10,})/i); if (d) return 'https://' + d[1].toLowerCase() + '.supabase.co'; const m = v.match(/https?:\/\/[a-z0-9-]+\.supabase\.(co|in)/i); try { return m ? m[0].replace(/^http:/i, 'https:') : new URL(v).origin; } catch (e) { return v.replace(/\/$/, ''); } };   // accepts https://xxxx.supabase.co, a longer API link, or the dashboard link
function sbOn() { return !!(env('SUPABASE_URL') && env('SUPABASE_SERVICE_KEY')); }
async function sb(method, path, data, prefer) {
  if (!sbOn()) throw Object.assign(new Error('Databasen är inte ansluten (SUPABASE_URL saknas)'), { status: 503 });
  const k = env('SUPABASE_SERVICE_KEY'), h = { apikey: k, 'Content-Type': 'application/json', Prefer: prefer || 'return=representation' }; if (!k.startsWith('sb_')) h.Authorization = 'Bearer ' + k;
  let r; try { r = await fetch(SB() + '/rest/v1/' + path, { method, headers: h, body: data === undefined ? undefined : JSON.stringify(data) }); }
  catch (e) { const c = e.cause && (e.cause.code || e.cause.message) || e.message; throw Object.assign(new Error('Kan inte nå ' + SB() + ' (' + c + '). Kontrollera SUPABASE_URL.'), { status: 502 }); }
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = t; }
  if (!r.ok) throw Object.assign(new Error('DB ' + r.status + ': ' + (j && j.message || t).toString().slice(0, 200)), { status: 500 });
  return j;
}
const q = encodeURIComponent;
async function authApi(method, path, data, token) {
  const svc = env('SUPABASE_SERVICE_KEY'), anon = env('SUPABASE_ANON_KEY') || svc, admin = /^admin\//.test(path);
  const h = { 'Content-Type': 'application/json', apikey: admin ? svc : anon };          // works with legacy keys (JWT) and new keys (sb_publishable_/sb_secret_)
  if (token) h.Authorization = 'Bearer ' + token; else if (admin && !svc.startsWith('sb_')) h.Authorization = 'Bearer ' + svc;
  const r = await fetch(SB() + '/auth/v1/' + path, { method, headers: h, body: data ? JSON.stringify(data) : undefined });
  const t = await r.text(); let j = {}; try { j = t ? JSON.parse(t) : {}; } catch (e) {}
  return { ok: r.ok, status: r.status, data: j };
}
/* the logged-in customer: returns { user, member, account } or throws 401 */
async function member(req, accountId) {
  const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!tok) throw Object.assign(new Error('auth'), { status: 401 });
  const u = await authApi('GET', 'user', null, tok);
  if (!u.ok || !u.data.id) throw Object.assign(new Error('auth'), { status: 401 });
  const ms = await sb('GET', 'members?user_id=eq.' + q(u.data.id) + '&select=*');
  const m = (accountId && ms.find(x => x.account_id === accountId)) || ms[0];
  if (!m) throw Object.assign(new Error('noaccount'), { status: 403 });
  const [a] = await sb('GET', 'accounts?id=eq.' + q(m.account_id) + '&select=*');
  if (!a) throw Object.assign(new Error('noaccount'), { status: 403 });
  if (a.locked) throw Object.assign(new Error('locked'), { status: 423 });
  return { user: u.data, member: m, account: a };
}
async function limited(bucket, max, winMs) {
  if (!sbOn()) return false;
  const since = new Date(Date.now() - winMs).toISOString();
  const rows = await sb('GET', 'hits?bucket=eq.' + q(bucket) + '&ts=gte.' + q(since) + '&select=ts&limit=' + (max + 1));
  if (rows.length >= max) return true;
  await sb('POST', 'hits', { bucket }, 'return=minimal');
  return false;
}
const ipOf = req => String(req.headers['x-forwarded-for'] || req.socket && req.socket.remoteAddress || '').split(',')[0].trim();
const hmac = s => crypto.createHmac('sha256', env('OTP_SECRET') || env('SIGN_SECRET') || 'scansay').update(String(s)).digest('hex');
const site = () => (env('SITE_URL') || 'https://scansay.se').replace(/\/$/, '');

/* ---------- branded email ---------- */
/* Company details in every email footer (e-handelslagen 8 §): taken from Admin → Inställningar → Företagsuppgifter,
   or the variables COMPANY_NAME, COMPANY_ORG, COMPANY_ADDRESS. */
let SELLER = null, SELLER_AT = 0;
async function seller() {
  if (SELLER && Date.now() - SELLER_AT < 10 * 60e3) return SELLER;
  let s = {};
  try { if (sbOn()) { const [r] = await sb('GET', 'admin_state?id=eq.1&select=doc'); s = (r && r.doc && r.doc.settings && r.doc.settings.seller) || {}; } } catch (e) {}
  const ok = v => v && !/[\[\]]|XXX|X{3,}/.test(String(v)) ? String(v) : '';
  SELLER = { name: ok(s.name) || env('COMPANY_NAME') || 'ScanSay', org: ok(s.org) || env('COMPANY_ORG'), address: ok(s.address) || env('COMPANY_ADDRESS'), email: ok(s.email) || env('NOTIFY_EMAIL') || 'hello@scansay.se', vat: ok(s.vat) };
  SELLER_AT = Date.now(); return SELLER;
}
const BTN = (label, url, alt) => `<a href="${url}" style="display:inline-block;background:${alt ? '#FFFFFF' : '#1D4ED8'};color:${alt ? '#0A0F1C' : '#FFFFFF'};border:1px solid ${alt ? '#D1D5DB' : '#1D4ED8'};text-decoration:none;font-weight:700;font-size:15px;padding:12px 20px;border-radius:10px;margin:0 8px 8px 0">${label}</a>`;
/* mailHtml(title, bodyHtml, button?, opts?) · button = [label,url] or a list of them (first is the main one) */
function mailHtml(title, bodyHtml, btn, opts) {
  opts = opts || {}; const btns = !btn ? [] : Array.isArray(btn[0]) ? btn : [btn];
  return `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"><title>${escH(String(title).replace(/<[^>]+>/g, ''))}</title></head>
<body style="margin:0;padding:0;background:#F3F5F9">${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden">${escH(opts.preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F5F9"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;font-family:Inter,'Segoe UI',Arial,sans-serif;color:#0A0F1C">
<tr><td style="padding:0 6px 18px"><a href="${site()}"><img src="${site()}/brand/email-logo.png" width="152" height="40" alt="ScanSay" style="display:block;border:0"></a></td></tr>
<tr><td style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:18px;padding:34px 34px 30px">
<div style="height:4px;width:44px;background:#C8F542;border-radius:4px;margin-bottom:18px"></div>
<h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;letter-spacing:-.02em;color:#0A0F1C">${title}</h1>
<div style="font-size:15.5px;line-height:1.65;color:#1F2937">${bodyHtml}</div>
${btns.length ? `<div style="margin-top:22px">${btns.map((x, i) => BTN(x[0], x[1], i > 0)).join('')}</div>` : ''}
${btns.length ? `<p style="font-size:12.5px;color:#6B7280;margin:14px 0 0">Fungerar inte knappen? Kopiera länken: <span style="word-break:break-all;color:#1D4ED8">${escH(btns[0][1])}</span></p>` : ''}
</td></tr>
<tr><td style="padding:18px 10px 0;font-size:12px;line-height:1.6;color:#6B7280">
${opts.reason ? `<p style="margin:0 0 8px">${opts.reason}</p>` : ''}
<!--FOOTER-->
<p style="margin:8px 0 0"><a href="${site()}/#privacy-policy" style="color:#6B7280">Integritetspolicy</a> · <a href="${site()}/legal/villkor.html" style="color:#6B7280">Villkor</a> · <a href="${site()}/legal/pub-avtal.html" style="color:#6B7280">Biträdesavtal</a></p>
</td></tr></table></td></tr></table></body></html>`;
}
async function footerHtml() {
  const s = await seller();
  return `<p style="margin:0"><b style="color:#374151">${escH(s.name)}</b>${s.org ? ' · Org.nr ' + escH(s.org) : ''}${s.vat ? ' · Momsreg.nr ' + escH(s.vat) : ''}${s.address ? '<br>' + escH(s.address) : ''}<br><a href="mailto:${escH(s.email)}" style="color:#6B7280">${escH(s.email)}</a> · <a href="${site()}" style="color:#6B7280">${site().replace(/^https?:\/\//, '')}</a></p>`;
}
async function brandMail(title, body, btns, opts) { return mailHtml(title, body, btns, opts); }
const PLAN_N = { start: 'Liten', pro: 'Mellan', business: 'Stor', enterprise: 'Företag' };
const krf = n => Math.round(+n || 0).toLocaleString('sv-SE').replace(/ /g, ' ') + ' kr';
function subTable(o) {
  const per = o.interval === 'year' ? 'år' : 'månad', vat = +o.vat || 25, p = +o.price || 0;
  const rows = [['Paket', 'ScanSay ' + (PLAN_N[o.plan] || o.plan || '')], ['Pris', krf(p) + ' per ' + per + ' exkl. moms (' + krf(p * (1 + vat / 100)) + ' inkl. ' + vat + ' % moms)'], ['Betalsätt', o.method === 'stripe' ? 'Kort, dras automatiskt i förskott varje ' + per : 'Faktura, ' + (o.invoiceDays || 30) + ' dagar netto, i förskott']];
  if (o.places) rows.push(['Omfattning', o.places + ' ' + (o.unit || 'platser') + ' (en QR-kod per plats)' + (o.agents ? ', ' + o.agents + ' inloggningar' : '')]);
  if (o.start) rows.push(['Start', new Date(o.start).toLocaleDateString('sv-SE')]);
  rows.push(['Avtalstid', o.termMonths ? o.termMonths + ' månader' : 'Löpande per ' + per]);
  rows.push(['Förlängning och uppsägning', o.autoRenew === false ? 'Upphör vid periodens slut' : 'Förlängs automatiskt med samma period. Uppsägning senast ' + (o.noticeDays || 30) + ' dagar före periodens slut till ' + 'hello@scansay.se']);
  rows.push(['Moduler', (o.staff ? 'Personalmodul ingår. ' : '') + (o.ai === false ? 'AI-funktioner avstängda.' : 'AI-sammanfattningar ingår.')]);
  return '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:16px 0;font-size:14px">' + rows.map(([k, v]) => `<tr><td style="padding:9px 12px;border:1px solid #E5E7EB;background:#F9FAFB;color:#4B5563;width:38%;vertical-align:top">${escH(k)}</td><td style="padding:9px 12px;border:1px solid #E5E7EB;color:#0A0F1C">${escH(v)}</td></tr>`).join('') + '</table>';
}
async function offerMail(o, url, note, version) {
  const c = o.customer || {};
  return mailHtml((version > 1 ? 'Uppdaterad offert' : 'Er offert') + ' från ScanSay', `<p>Hej ${escH(String(c.contact || '').split(' ')[0] || '')}!</p><p>${version > 1 ? 'Här är den uppdaterade offerten' : 'Tack för er registrering. Här är offerten'} för <b>${escH(c.name || '')}</b>.</p>${note ? `<blockquote style="border-left:4px solid #C8F542;margin:12px 0;padding:8px 14px;background:#F7FEE7;white-space:pre-wrap">${escH(note)}</blockquote>` : ''}${subTable(o)}
<p><b>Så går det till:</b></p><ol style="padding-left:20px;margin:6px 0"><li>Öppna offerten och läs avtal och villkor.</li><li>Signera direkt, eller tryck på <b>Jag vill ändra något</b> om ni vill justera pris eller innehåll.</li><li>När ni har signerat aktiverar vi kontot och skickar inloggningen.</li></ol><p style="font-size:13.5px;color:#4B5563">Offertnummer ${escH(o.no || '')}. Länken gäller i 30 dagar.</p>`,
    [['Öppna och signera offerten', url]], { preheader: 'Offert för ' + (c.name || '') + ' – signera eller be om ändringar', reason: 'Du får det här mejlet eftersom ' + escH(c.name || 'ert företag') + ' har registrerat sig hos ScanSay och vill ha en offert.' });
}
async function welcomeMail(acc, link, sub, role) {
  const owner = role === 'Ägare';
  return mailHtml(owner ? 'Välkommen till ScanSay, ' + escH(acc.name) + '!' : 'Du har fått en inloggning till ScanSay', `<p>${owner ? 'Ert konto är aktiverat. Så kommer ni igång:' : 'Du har fått en inloggning till <b>' + escH(acc.name) + '</b> som <b>' + escH(role) + '</b>.'}</p>
<ol style="padding-left:20px;margin:8px 0 4px"><li><b>Välj ditt lösenord</b> med knappen nedan. Länken gäller i 24 timmar.</li><li><b>Logga in</b> på ${site().replace(/^https?:\/\//, '')} med din e-post och ditt lösenord.</li>${owner ? '<li><b>Lägg in era platser</b> under QR-koder och skriv ut dekalerna.</li>' : ''}</ol>
<p style="font-size:14px;color:#4B5563">Har länken gått ut eller glömt lösenordet? Använd <b>Glömt lösenord</b> så får du en ny länk direkt.</p>
${owner && sub ? '<h2 style="font-size:17px;margin:22px 0 4px">Er prenumeration</h2>' + subTable(sub) + '<p style="font-size:13.5px;color:#4B5563">Fullständiga villkor finns i ert avtal och i <a href="' + site() + '/legal/villkor.html">de allmänna villkoren</a>. Biträdesavtalet hittar ni <a href="' + site() + '/legal/pub-avtal.html">här</a>. Frågor om fakturor och uppsägning: hello@scansay.se.</p>' : ''}`,
    [['Välj lösenord', link], ['Logga in', site() + '/#login'], ['Glömt lösenord', site() + '/?reset=1#login']],
    { preheader: owner ? 'Ert ScanSay-konto är klart – välj lösenord och logga in' : 'Välj lösenord och logga in', reason: 'Du får det här mejlet eftersom ett konto har skapats åt dig hos ScanSay. Det är ett servicemeddelande om ditt konto.' });
}

/* ---------- alarms: email, SMS, Teams, Slack, webhook ---------- */
async function routeAlarm(account, fb, opts) {
  opts = opts || {};
  const st = account.state || {}, chs = (st.channels || []).filter(c => c.on), cfg = st.chcfg || {};
  const sent = [], failed = [];
  const low = fb.urgent || (fb.type === 'c' && (fb.rating || 5) <= 2);
  const head = (fb.urgent ? '⚠ AKUT: ' : fb.type === 'c' ? 'Nytt klagomål: ' : 'Nytt meddelande: ') + (fb.sec_name ? fb.sec_name + ' › ' : '') + (fb.place || '');
  const text = head + '\n' + (fb.topic ? 'Ämne: ' + fb.topic + '\n' : '') + (fb.rating ? 'Betyg: ' + fb.rating + ' av 5\n' : '') + (fb.message ? '"' + fb.message + '"\n' : '') + 'Öppna: ' + site() + '/app/#inbox';
  for (const c of chs) {
    const cf = cfg[c.id] || {}; if (!cf.v) continue;
    if (opts.only && opts.only !== c.id) continue;
    const lv = cf.lv || 'low';
    if (!opts.test && (lv === 'urgent' && !fb.urgent || lv === 'low' && !low)) continue;
    if (!opts.test && cf.sec && fb.sec_name && cf.sec !== fb.sec_name && !fb.urgent) continue;
    try {
      if (c.id === 'email') await sendEmail({ to: cf.v.split(',').map(x => x.trim()).filter(Boolean), subject: head + ' · ' + account.name, text, html: mailHtml(escH(head), `<p>${fb.topic ? '<b>Ämne:</b> ' + escH(fb.topic) + '<br>' : ''}${fb.rating ? '<b>Betyg:</b> ' + fb.rating + ' av 5<br>' : ''}</p>${fb.message ? `<blockquote style="border-left:4px solid ${fb.urgent ? '#B91C1C' : '#1D4ED8'};margin:0;padding:8px 12px;background:#F5F7FB">${escH(fb.message)}</blockquote>` : ''}`, ['Öppna ärendet', site() + '/app/#inbox']) });
      else if (c.id === 'sms') { for (const n of cf.v.split(',').map(x => x.trim()).filter(Boolean)) await sendSms({ to: n, text: text.slice(0, 450) }); }
      else if (c.id === 'teams') { const r = await fetch(cf.v, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'message', text: text.replace(/\n/g, '\n\n'), attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: { type: 'AdaptiveCard', version: '1.4', $schema: 'http://adaptivecards.io/schemas/adaptive-card.json', body: [{ type: 'TextBlock', text: head, weight: 'Bolder', size: 'Medium', wrap: true, color: fb.urgent ? 'Attention' : 'Default' }, { type: 'TextBlock', text: (fb.topic ? 'Ämne: ' + fb.topic + '  ' : '') + (fb.rating ? 'Betyg: ' + fb.rating + '/5' : ''), wrap: true }, { type: 'TextBlock', text: fb.message || '', wrap: true }], actions: [{ type: 'Action.OpenUrl', title: 'Öppna ärendet', url: site() + '/app/#inbox' }] } }] }) }); if (!r.ok) throw new Error('Teams ' + r.status); }
      else if (c.id === 'slack') { const r = await fetch(cf.v, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }); if (!r.ok) throw new Error('Slack ' + r.status); }
      else if (c.id === 'hook') { const r = await fetch(cf.v, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-ScanSay-Signature': hmac(JSON.stringify({ id: fb.id })) }, body: JSON.stringify({ event: fb.urgent ? 'urgent' : 'feedback', account: account.name, id: fb.id, place: fb.place, section: fb.sec_name, topic: fb.topic, rating: fb.rating, type: fb.type, message: fb.message, time: fb.created_at || new Date().toISOString(), url: site() + '/app/#inbox' }) }); if (!r.ok) throw new Error('Webhook ' + r.status); }
      sent.push(c.n || c.id);
    } catch (e) { failed.push((c.n || c.id) + ' (' + e.message + ')'); }
  }
  return { sent, failed };
}
/* security events go to Vercel → Logs as one JSON line each (search for "sec") */
function secLog(event, req, extra) { try { console.warn(JSON.stringify(Object.assign({ sec: event, t: new Date().toISOString(), ip: req ? hmac(ipOf(req)).slice(0, 12) : null, path: req ? String(req.url || '').split('?')[0] : null }, extra || {}))); } catch (e) {} }
async function recent(bucket, winMs) { if (!sbOn()) return 0; const since = new Date(Date.now() - winMs).toISOString(); const rows = await sb('GET', 'hits?bucket=eq.' + q(bucket) + '&ts=gte.' + q(since) + '&select=ts&limit=50'); return rows.length; }
/* admin check with lockout: 20 wrong keys in 15 minutes from one address blocks that address for 15 minutes */
async function adminGate(req, res) {
  const b = 'admfail:' + hmac(ipOf(req));
  try { if (await recent(b, 15 * 60e3) >= 20) { secLog('admin_locked', req); send(res, 429, { error: 'rate' }); return false; } } catch (e) {}
  if (isAdmin(req)) return true;
  secLog('admin_bad_key', req);
  try { if (sbOn()) await sb('POST', 'hits', { bucket: b }, 'return=minimal'); } catch (e) {}
  send(res, 401, { error: 'auth' }); return false;
}
/* errors: details only to the admin; everyone else gets a short code, the details go to the log */
function fail(res, e, req) {
  const st = e.status || 500; if (st >= 500) console.error(e);
  const admin = req && isAdmin(req);
  send(res, st, { error: st === 401 ? 'auth' : st >= 500 && !admin ? 'server' : e.message });
}

module.exports = { brandMail, offerMail, welcomeMail, subTable, seller, secLog, recent, adminGate, env, send, body, isAdmin, seal, unseal, sendEmail, sendSms, escH, crypto, sb, sbOn, q, authApi, member, limited, ipOf, hmac, site, mailHtml, routeAlarm, fail };
