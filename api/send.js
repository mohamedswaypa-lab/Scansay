/* POST /api/send  (admin only)
   { email:{to,subject,text}, sms:{to,text} }  or  { test:true } */
const { send, body, isAdmin, sendEmail, sendSms } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Använd POST' });
  if (!isAdmin(req)) return send(res, 401, { error: 'Fel admin-nyckel' });
  let b; try { b = await body(req); } catch (e) { return send(res, 400, { error: 'Ogiltig data' }); }
  if (b.test) return send(res, 200, { ok: true });
  const out = {};
  try {
    if (b.email) { if (!/^\S+@\S+\.\S+$/.test(b.email.to || '')) throw new Error('Ogiltig e-post'); out.email = await sendEmail({ to: b.email.to, subject: String(b.email.subject || 'Meddelande från ScanSay').slice(0, 200), text: String(b.email.text || '').slice(0, 20000), replyTo: process.env.NOTIFY_EMAIL }); }
    if (b.sms) out.sms = await sendSms({ to: b.sms.to, text: b.sms.text });
    if (!b.email && !b.sms) return send(res, 400, { error: 'Inget att skicka' });
    send(res, 200, { ok: true, ...out });
  } catch (e) { send(res, 502, { error: e.message, ...out }); }
};
