/* Shared helpers for ScanSay Vercel functions (Node 18+, no dependencies).
   Environment variables (Vercel → Project → Settings → Environment Variables):
     ADMIN_TOKEN    long random string, also typed into Admin → Inställningar
     SIGN_SECRET    long random string used to seal signing links
     BREVO_API_KEY  e-post via Brevo (EU)       MAIL_FROM  e.g. "ScanSay <hello@scansay.se>"
     ELKS_USER / ELKS_PASS  sms via 46elks (Sverige)   SMS_FROM  e.g. "ScanSay"
     NOTIFY_EMAIL   where signed contracts are copied, e.g. hello@scansay.se
     SITE_URL       e.g. https://scansay.se */
const crypto = require('crypto');

const env = k => process.env[k] || '';
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
module.exports = { env, send, body, isAdmin, seal, unseal, sendEmail, sendSms, escH, crypto };
