/* Guest feedback form (public).
   GET  /api/form?a=code&k=ABCDE          → place, company, topics settings for a printed QR code
   POST /api/form?a=start  {method,contact,code,guard}           → sends a 6-digit code (email or SMS)
   POST /api/form?a=feedback {verifyId,otp,code,message,...}     → checks the code, saves, sends alarms and a copy */
const L = require('./_lib');
const TTL = 10 * 60e3, TRIES = 5;
const DISPOSABLE = new Set('mailinator.com guerrillamail.com sharklasers.com 10minutemail.com temp-mail.org tempmail.com yopmail.com trashmail.com getnada.com dispostable.com maildrop.cc throwawaymail.com fakeinbox.com emailondeck.com burnermail.io 1secmail.com mintemail.com mohmal.com tempail.com spamgourmet.com'.split(' '));

function normEmail(e) { e = String(e || '').trim().toLowerCase(); if (!/^[a-z0-9._%+'-]{1,64}@[a-z0-9.-]+\.[a-z]{2,24}$/.test(e)) return [null, 'format']; if (DISPOSABLE.has(e.split('@')[1])) return [null, 'disposable']; return [e, null]; }
function normPhone(p) { let s = String(p || '').replace(/[\s\-().]/g, ''); if (s.startsWith('00')) s = '+' + s.slice(2); if (/^07\d{8}$/.test(s)) s = '+46' + s.slice(1); if (/^\+467\d{8}$/.test(s) || /^\+(?!46)[1-9]\d{7,14}$/.test(s)) return [s, null]; return [null, 'phone']; }
async function hasMx(d) { try { return (await require('dns').promises.resolveMx(d)).length > 0; } catch (e) { return false; } }
function guard(b) {
  if (b.website) return 'bot';
  const g = b.guard; if (!g || (g.ms || 0) < 3000) return 'fast';
  const h = L.crypto.createHash('sha256').update(String(g.challenge) + String(g.nonce)).digest('hex');
  if (!h.startsWith('0000')) return 'nohuman';
  return null;
}
async function codeRow(k) { k = String(k || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12); if (!k) return null; const [c] = await L.sb('GET', 'codes?code=eq.' + L.q(k) + '&active=eq.true&select=*'); return c || null; }

module.exports = async (req, res) => {
  const a = (req.query && req.query.a) || new URL(req.url, 'http://x').searchParams.get('a');
  try {
    if (req.method === 'GET' && a === 'code') {
      const k = (req.query && req.query.k) || new URL(req.url, 'http://x').searchParams.get('k');
      const c = await codeRow(k); if (!c) return L.send(res, 404, { error: 'nocode' });
      const [acc] = await L.sb('GET', 'accounts?id=eq.' + L.q(c.account_id) + '&select=name,locked,state,mods');
      if (!acc || acc.locked) return L.send(res, 410, { error: 'paused' });
      const st = acc.state || {}; const g = (st.groups || []).find(x => x.id === c.group_id) || {};
      const sec = (g.secs || []).find(x => x.k === c.sec_key) || {};
      return L.send(res, 200, { code: c.code, c: acc.name, g: c.group_name || g.name || '', i: c.ind || g.ind || 'hotel', s: c.sec_key, sn: c.sec_name || sec.name || '', p: c.place, topics: sec.topics || null, quick: sec.quick || null, urgent: st.urgent || { on: true }, sms: !!(L.env('ELKS_USER') && L.env('ELKS_PASS')) });
    }
    if (req.method === 'GET' && a === 'certs') {
      const rows = await L.sb('GET', 'accounts?locked=eq.false&select=state');
      const list = []; rows.forEach(r => { const p = (r.state && r.state.pub) || {}; Object.values(p).forEach(x => list.push(x)); });
      res.setHeader('Cache-Control', 'public, max-age=300');
      return L.send(res, 200, { certs: list });
    }
    if (req.method !== 'POST') return L.send(res, 405, { error: 'method' });
    const b = await L.body(req), ip = L.ipOf(req);

    if (a === 'start') {
      const ge = guard(b); if (ge) return L.send(res, 400, { error: ge });
      if (await L.limited('vip:' + L.hmac(ip), 6, 10 * 60e3)) { L.secLog('otp_rate', req); return L.send(res, 429, { error: 'rate' }); }
      const method = b.method === 'sms' && L.env('ELKS_USER') ? 'sms' : 'email';
      const [contact, ce] = method === 'sms' ? normPhone(b.contact) : normEmail(b.contact);
      if (ce) return L.send(res, 400, { error: ce });
      if (method === 'email' && !(await hasMx(contact.split('@')[1]))) return L.send(res, 400, { error: 'fake' });
      const c = await codeRow(b.code); if (!c) return L.send(res, 404, { error: 'nocode' });
      const ck = L.hmac('contact:' + contact);
      if (await L.limited('vc:' + ck, 3, 60 * 60e3)) return L.send(res, 429, { error: 'rate' });
      const since = new Date(Date.now() - 864e5).toISOString();
      const dup = await L.sb('GET', 'feedback?contact_key=eq.' + L.q(ck) + '&code=eq.' + L.q(c.code) + '&created_at=gte.' + L.q(since) + '&urgent=eq.false&select=id&limit=1');
      if (dup.length && !b.urgent) return L.send(res, 429, { error: 'already' });
      const id = L.crypto.randomBytes(16).toString('hex'), otp = String(L.crypto.randomInt(0, 1e6)).padStart(6, '0');
      await L.sb('POST', 'otps', { id, hash: L.hmac(id + ':' + otp), contact_key: ck, method, contact, code: c.code, expires_at: new Date(Date.now() + TTL).toISOString() }, 'return=minimal');
      try {
        if (method === 'sms') await L.sendSms({ to: contact, text: otp + ' är din kod till ScanSay. Den gäller i 10 minuter. / ' + otp + ' is your ScanSay code.' });
        else await L.sendEmail({ to: contact, subject: otp + ' är din ScanSay-kod', text: 'Din kod: ' + otp + '\nSkriv in koden i formuläret för att skicka ditt meddelande. Koden gäller i 10 minuter.\n\nYour code: ' + otp, html: L.mailHtml('Din kod: <span style="letter-spacing:4px">' + otp + '</span>', '<p>Skriv in koden i formuläret för att skicka ditt meddelande till ' + L.escH(c.company || '') + '. Koden gäller i 10 minuter.</p><p style="color:#6B7280;font-size:13px">Your code is ' + otp + '. Har du inte bett om en kod? Ignorera mejlet. Inget skickas utan koden.</p>') });
      } catch (e) { console.error('otp send', e.message); return L.send(res, 502, { error: 'send' }); }
      return L.send(res, 200, { verifyId: id, resendIn: 30, expiresIn: TTL / 1000 });
    }

    if (a === 'feedback') {
      const ge = guard(b); if (ge) return L.send(res, 400, { error: ge });
      if (await L.limited('fip:' + L.hmac(ip), 12, 10 * 60e3)) return L.send(res, 429, { error: 'rate' });
      const [v] = await L.sb('GET', 'otps?id=eq.' + L.q(String(b.verifyId || '')) + '&select=*');
      if (!v) return L.send(res, 400, { error: 'expired' });
      if (Date.now() > Date.parse(v.expires_at)) { await L.sb('DELETE', 'otps?id=eq.' + L.q(v.id), undefined, 'return=minimal'); return L.send(res, 400, { error: 'expired' }); }
      if (v.tries + 1 > TRIES) { L.secLog('otp_too_many_tries', req); await L.sb('DELETE', 'otps?id=eq.' + L.q(v.id), undefined, 'return=minimal'); return L.send(res, 429, { error: 'tries' }); }
      const otp = String(b.otp || '').replace(/\D/g, '');
      if (L.hmac(v.id + ':' + otp) !== v.hash) { await L.sb('PATCH', 'otps?id=eq.' + L.q(v.id), { tries: v.tries + 1 }, 'return=minimal'); return L.send(res, 400, { error: 'wrong', triesLeft: TRIES - v.tries - 1 }); }
      await L.sb('DELETE', 'otps?id=eq.' + L.q(v.id), undefined, 'return=minimal');
      const c = await codeRow(v.code); if (!c) return L.send(res, 404, { error: 'nocode' });
      const msg = String(b.message || '').trim().slice(0, 2000);
      if (!b.urgent && msg.length < 3) return L.send(res, 400, { error: 'text' });
      if (/https?:\/\/|www\./i.test(msg)) return L.send(res, 400, { error: 'text' });
      const name = String(b.name || '').trim().slice(0, 60) || null;
      if (name && /[0-9@#$%^*_=+<>{}\[\]|\\\/]|https?:/i.test(name)) return L.send(res, 400, { error: 'name' });
      let img = typeof b.image === 'string' && b.image.length < 600000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/]+=*$/.test(b.image) ? b.image : null;   // only a real base64 picture, nothing else
      const row = { account_id: c.account_id, code: c.code, group_id: c.group_id, sec_key: c.sec_key, sec_name: c.sec_name, place: c.place,
        type: ['c', 'p', 'i'].includes(b.type) ? b.type : 'c', topic: String(b.topic || '').slice(0, 80), rating: Math.min(5, Math.max(1, +b.rating || 1)), quick: ['yes', 'no'].includes(b.quick) ? b.quick : null,
        urgent: !!b.urgent, message: msg, name, via: v.method, contact: v.contact, contact_key: v.contact_key, image: img };
      const [saved] = await L.sb('POST', 'feedback', row);
      const [acc] = await L.sb('GET', 'accounts?id=eq.' + L.q(c.account_id) + '&select=*');
      try { if (acc) await L.routeAlarm(acc, saved); } catch (e) { console.error('alarm', e.message); }
      if (v.method === 'email' && b.copy !== false) {
        L.sendEmail({ to: v.contact, subject: 'Kopia: ditt meddelande till ' + (acc && acc.name || 'företaget'), text: 'Tack för ditt meddelande.\n\n' + msg, html: L.mailHtml('Tack för ditt meddelande' + (name ? ', ' + L.escH(name.split(' ')[0]) : ''), `<p>Här är en kopia av det du skickade till <b>${L.escH(acc && acc.name || '')}</b> (${L.escH(c.place || '')}).</p>${msg ? `<blockquote style="border-left:4px solid #1D4ED8;margin:0;padding:8px 12px;background:#F5F7FB">${L.escH(msg)}</blockquote>` : ''}<p>Ditt meddelande är verifierat. Du får svar till den här adressen.</p><p style="color:#6B7280;font-size:12px">Meddelandet raderas efter 12 månader. Ärende ${saved.id.slice(0, 8).toUpperCase()}.</p>`) }).catch(e => console.error('copy', e.message));
      }
      return L.send(res, 200, { ok: true, id: saved.id, ref: c.code + '-' + saved.id.slice(0, 5).toUpperCase() });
    }
    return L.send(res, 400, { error: 'action' });
  } catch (e) { L.fail(res, e, req); }
};
