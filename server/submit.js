/* ScanSay: server side of the feedback form (Node 18+, no dependencies).

   Every message must be confirmed with a one-time code sent by email or SMS before it is accepted.
   Flow:
     1. POST /api/verify/start   { method:'email'|'sms', contact, code:<place code>, guard }
        -> checks spam guards, sends a 6-digit code, returns { verifyId, resendIn, expiresIn }
     2. POST /api/feedback       { verifyId, otp, code, message, rating, topic, ..., guard }
        -> checks the code (10 min, max 5 tries, single use), then stores the message.
   The browser checks (guard.js) are repeated here, because anything in the browser can be bypassed.

   Environment variables:
     MAIL_API_KEY     key for an EU email provider with an HTTP API (example: Brevo, France)
     SMS_USER/SMS_PASS  API credentials for an EU SMS provider (example: 46elks, Sweden)
     SMS_FROM         sender name shown on the SMS, max 11 letters, e.g. ScanSay
     SECRET           long random string used to hash codes and contacts
     PUBLIC_URL       https://scansay.se
   Start: node submit.js   (listens on :8080)

   Storage: the Maps below are for a single process. In production use Redis or the database (EU region),
   so that limits and codes survive restarts and work across several servers.                              */
const http = require('http'), crypto = require('crypto');
const SECRET = process.env.SECRET || 'change-me', URL_ = process.env.PUBLIC_URL || 'http://localhost:8080';
if (SECRET === 'change-me') console.warn('WARNING: set SECRET before running in production');

const CODE_TTL = 10 * 60e3, MAX_TRIES = 5, RESEND_AFTER = 30e3, ONE_PER_PLACE = 24 * 3600e3;
const DISPOSABLE = new Set(('mailinator.com guerrillamail.com sharklasers.com 10minutemail.com temp-mail.org tempmail.com yopmail.com trashmail.com getnada.com dispostable.com maildrop.cc throwawaymail.com fakeinbox.com emailondeck.com burnermail.io 1secmail.com dropmail.me minuteinbox.com example.com test.com').split(' '));

const pending = new Map();   // verifyId -> { hash, contactKey, method, contact, place, exp, tries, sentAt }
const hits = new Map();      // bucket -> timestamps (rate limits)
const sentFrom = new Map();  // contactKey|place -> time of last accepted message

const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const hmac = s => crypto.createHmac('sha256', SECRET).update(s).digest();
const sameBytes = (a, b) => a.length === b.length && crypto.timingSafeEqual(a, b);

function limited(bucket, max, win) {
  const now = Date.now(), a = (hits.get(bucket) || []).filter(t => now - t < win);
  a.push(now); hits.set(bucket, a); return a.length > max;
}

/* ---------- input checks ---------- */
function normEmail(e) {
  e = String(e || '').trim().toLowerCase();
  if (!/^[a-z0-9._%+'-]{1,64}@[a-z0-9.-]+\.[a-z]{2,24}$/.test(e)) return [null, 'format'];
  if (DISPOSABLE.has(e.split('@')[1])) return [null, 'disposable'];
  return [e, null];
}
async function hasMx(domain) {           // the domain must be able to receive email
  try { return (await require('dns').promises.resolveMx(domain)).length > 0; } catch { return false; }
}
function normPhone(p) {                  // Swedish mobiles (07x) or international E.164
  let s = String(p || '').replace(/[\s\-().]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (/^07[02369]\d{7}$/.test(s)) s = '+46' + s.slice(1);
  if (/^\+467[02369]\d{7}$/.test(s) || /^\+(?!46)[1-9]\d{7,14}$/.test(s)) return [s, null];
  return [null, 'phone'];
}
function checkGuard(body) {
  if (body.website) return 'bot';                                          // honeypot filled
  const g = body.guard;
  if (!g || g.ms < 4000) return 'fast';                                    // filled in under 4 s
  if (!sha(String(g.challenge) + String(g.nonce)).startsWith('0000')) return 'pow';  // proof of work
  return null;
}
function checkName(n) {
  n = String(n || '').trim(); if (!n) return null;
  if (n.length < 2 || n.length > 60 || /[0-9@#$%^*_=+<>{}\[\]|\\\/]|https?:/i.test(n)) return 'name';
  return null;
}

/* ---------- step 1: send a code ---------- */
async function startVerify(body, ip) {
  const gErr = checkGuard(body); if (gErr) return [400, { error: gErr }];
  if (limited('ip:' + ip, 5, 10 * 60e3)) return [429, { error: 'rate' }];
  const method = body.method === 'sms' ? 'sms' : 'email';
  const [contact, cErr] = method === 'sms' ? normPhone(body.contact) : normEmail(body.contact);
  if (cErr) return [400, { error: cErr }];
  if (method === 'email' && !(await hasMx(contact.split('@')[1]))) return [400, { error: 'nomx' }];
  const contactKey = hmac('contact:' + contact).toString('hex');
  if (limited('c:' + contactKey, 3, 60 * 60e3)) return [429, { error: 'rate' }];   // max 3 codes per hour per contact
  const place = String(body.code || '').toUpperCase().slice(0, 12);
  const last = sentFrom.get(contactKey + '|' + place);
  if (last && Date.now() - last < ONE_PER_PLACE) return [429, { error: 'already' }];  // one message per person, place and day

  const verifyId = crypto.randomBytes(16).toString('hex');
  const otp = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
  pending.set(verifyId, { hash: hmac(verifyId + ':' + otp), contactKey, method, contact, place, exp: Date.now() + CODE_TTL, tries: 0, sentAt: Date.now() });
  try { method === 'sms' ? await sendSms(contact, otp) : await sendCodeMail(contact, otp); }
  catch (e) { pending.delete(verifyId); console.error('send failed', e.message); return [502, { error: 'send' }]; }
  return [200, { verifyId, resendIn: RESEND_AFTER / 1000, expiresIn: CODE_TTL / 1000 }];
}

/* ---------- step 2: check the code and accept the message ---------- */
async function handleFeedback(body, ip) {
  const gErr = checkGuard(body); if (gErr) return [400, { error: gErr }];
  if (limited('fb:' + ip, 10, 10 * 60e3)) return [429, { error: 'rate' }];
  const v = pending.get(String(body.verifyId || ''));
  if (!v) return [400, { error: 'nocode' }];
  if (Date.now() > v.exp) { pending.delete(body.verifyId); return [400, { error: 'expired' }]; }
  if (++v.tries > MAX_TRIES) { pending.delete(body.verifyId); return [429, { error: 'tries' }]; }
  const otp = String(body.otp || '').replace(/\D/g, '');
  if (!sameBytes(hmac(body.verifyId + ':' + otp), v.hash)) return [400, { error: 'wrong', triesLeft: MAX_TRIES - v.tries }];
  pending.delete(body.verifyId);                                           // single use

  if (checkName(body.name)) return [400, { error: 'name' }];
  const msg = String(body.message || '').trim();
  if (msg.length < 3 || msg.length > 2000 || /https?:\/\/|www\./i.test(msg)) return [400, { error: 'text' }];

  const id = crypto.randomUUID();
  sentFrom.set(v.contactKey + '|' + v.place, Date.now());
  // TODO: save { id, ...body, verified:true, via:v.method, contact:v.contact } in the database (EU region) and route alerts.
  // Staff never see v.contact; only the person handling the case can reply through ScanSay.
  if (v.method === 'email' && body.copy) await sendCopy(v.contact, { ...body, message: msg }).catch(e => console.error('copy failed', e.message));
  return [200, { ok: true, id }];
}

/* ---------- delivery ---------- */
const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
async function sendCodeMail(to, otp) {
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;color:#17302C">
    <h2 style="color:#0B2B27">Din kod: <span style="letter-spacing:4px">${otp}</span></h2>
    <p>Skriv in koden i formuläret för att skicka ditt meddelande. Koden gäller i 10 minuter.</p>
    <p style="font-size:12px;color:#4A615C">Har du inte bett om en kod? Ignorera mejlet, inget skickas utan koden.</p></div>`;
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: { 'api-key': process.env.MAIL_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ sender: { name: 'ScanSay', email: 'no-reply@scansay.se' }, to: [{ email: to }],
      subject: `${otp} är din ScanSay-kod`, htmlContent: html })
  });
  if (!r.ok) throw new Error('mail ' + r.status);
}
async function sendSms(to, otp) {
  const auth = Buffer.from(`${process.env.SMS_USER}:${process.env.SMS_PASS}`).toString('base64');
  const r = await fetch('https://api.46elks.com/a1/sms', {
    method: 'POST', headers: { authorization: 'Basic ' + auth, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ from: process.env.SMS_FROM || 'ScanSay', to, message: `${otp} är din ScanSay-kod. Den gäller i 10 minuter.` })
  });
  if (!r.ok) throw new Error('sms ' + r.status);
}
async function sendCopy(to, r) {
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;color:#17302C">
    <h2 style="color:#0B2B27">Tack för ditt meddelande${r.name ? ', ' + esc(String(r.name).split(' ')[0]) : ''}</h2>
    <p>Här är en kopia av det du skickade till ${esc(r.company)} (${esc(r.place)}).</p>
    <blockquote style="border-left:4px solid #C93C1B;padding:8px 12px;background:#FFF8EE;margin:0">${esc(r.message)}</blockquote>
    <p style="font-size:12px;color:#4A615C">Ditt meddelande är verifierat. Du får svar här när det är löst.</p></div>`;
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: { 'api-key': process.env.MAIL_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ sender: { name: 'ScanSay', email: 'no-reply@scansay.se' }, to: [{ email: to }],
      subject: `Kopia: ditt meddelande till ${r.company || 'företaget'}`, htmlContent: html })
  });
}

/* clean up expired codes every minute */
setInterval(() => { const now = Date.now(); for (const [k, v] of pending) if (now > v.exp) pending.delete(k); }, 60e3).unref();

async function readJson(req) {
  let raw = ''; for await (const c of req) { raw += c; if (raw.length > 3e6) throw new Error('size'); }
  return JSON.parse(raw);
}
http.createServer(async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const u = new URL(req.url, 'http://x');
  const reply = (code, obj) => res.writeHead(code, { 'content-type': 'application/json' }).end(JSON.stringify(obj));
  if (req.method === 'POST' && (u.pathname === '/api/verify/start' || u.pathname === '/api/feedback')) {
    let body; try { body = await readJson(req); } catch { return reply(400, { error: 'json' }); }
    const [code, out] = u.pathname === '/api/feedback' ? await handleFeedback(body, ip) : await startVerify(body, ip);
    return reply(code, out);
  }
  res.writeHead(404).end();
}).listen(8080, () => console.log('ScanSay feedback API on :8080'));

module.exports = { normPhone, normEmail };
