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
function mailHtml(title, bodyHtml, btn) {
  return `<div style="background:#F5F7FB;padding:24px 12px;font-family:Inter,Arial,sans-serif"><div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #E5E7EB;border-radius:16px;padding:28px">
  <div style="font-weight:800;font-size:20px;color:#0A0F1C;margin-bottom:18px">Scan<span style="color:#1D4ED8">Say</span></div>
  <h1 style="font-size:22px;line-height:1.3;color:#0A0F1C;margin:0 0 12px">${title}</h1><div style="font-size:15px;line-height:1.6;color:#1F2937">${bodyHtml}</div>
  ${btn ? `<p style="margin:22px 0 6px"><a href="${btn[1]}" style="display:inline-block;background:#1D4ED8;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">${btn[0]}</a></p>` : ''}
  <p style="font-size:12px;color:#6B7280;margin-top:26px;border-top:1px solid #E5E7EB;padding-top:12px">ScanSay · Skanna. Säg det. · ${site().replace(/^https?:\/\//, '')}</p></div></div>`;
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
function fail(res, e) { const st = e.status || 500; if (st >= 500) console.error(e); send(res, st, { error: st === 401 ? 'auth' : e.message }); }

module.exports = { env, send, body, isAdmin, seal, unseal, sendEmail, sendSms, escH, crypto, sb, sbOn, q, authApi, member, limited, ipOf, hmac, site, mailHtml, routeAlarm, fail };
