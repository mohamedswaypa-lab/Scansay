/* Offer page API (public, the sealed link is the key)
   GET  /api/offer?t=TOKEN                       → the offer and where it stands
   POST /api/offer {t, action:'changes'|'decline', message, price}  → the customer asks for changes or says no */
const L = require('./_lib');
const MSG = { superseded: 'Den här offerten har ersatts av en nyare. Använd länken i det senaste mejlet från ScanSay.' };
async function load(t) {
  const s = L.unseal(t); if (!s) return [400, { error: 'Länken är ogiltig. Be ScanSay om en ny.' }];
  if (s.exp < Date.now()) return [410, { error: 'Länken har gått ut. Be ScanSay om en ny.' }];
  if (!s.oid) return [200, { offer: s.o, exp: s.exp, status: 'sent', legacy: true }];
  const [row] = await L.sb('GET', 'offers?id=eq.' + L.q(s.oid) + '&select=*'); if (!row) return [404, { error: 'Offerten finns inte längre.' }];
  if (row.status === 'superseded') return [410, { error: MSG.superseded }];
  return [200, { offer: row.data, exp: s.exp, status: row.status, version: row.version, note: row.note, reply: row.status === 'signed' ? { ts: row.replied_at } : row.reply, row }];
}
module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const t = new URL(req.url, 'http://x').searchParams.get('t'); const [st, out] = await load(t); delete out.row; return L.send(res, st, out);
    }
    if (req.method !== 'POST') return L.send(res, 405, { error: 'method' });
    const b = await L.body(req);
    if (await L.limited('offer:' + L.hmac(L.ipOf(req)), 10, 36e5)) return L.send(res, 429, { error: 'För många försök. Vänta en stund.' });
    const [st, out] = await load(b.t); if (st !== 200) return L.send(res, st, out);
    if (out.legacy) return L.send(res, 400, { error: 'Svara på mejlet från ScanSay i stället.' });
    const row = out.row; if (row.status !== 'sent') return L.send(res, 409, { error: row.status === 'signed' ? 'Offerten är redan signerad.' : 'Ni har redan svarat på den här offerten. Vi återkommer.' });
    const action = b.action === 'decline' ? 'decline' : 'changes';
    const message = String(b.message || '').trim().slice(0, 3000), price = b.price ? String(b.price).slice(0, 40) : null;
    if (action === 'changes' && message.length < 5) return L.send(res, 400, { error: 'Skriv vad ni vill ändra.' });
    const reply = { action, message, price, ts: new Date().toISOString() };
    await L.sb('PATCH', 'offers?id=eq.' + L.q(row.id), { status: action === 'decline' ? 'declined' : 'changes', reply, replied_at: reply.ts }, 'return=minimal');
    if (row.app_id) await L.sb('PATCH', 'applications?id=eq.' + L.q(row.app_id), { status: action === 'decline' ? 'not_interested' : 'changes' }, 'return=minimal');
    const c = row.data.customer || {};
    if (L.env('NOTIFY_EMAIL')) await L.sendEmail({ to: L.env('NOTIFY_EMAIL'), replyTo: c.email, subject: (action === 'decline' ? 'Inte intresserad: ' : 'Vill ändra offerten: ') + c.name, text: (message || '(inget meddelande)') + (price ? '\nÖnskat pris: ' + price : '') + '\nÖppna admin: ' + L.site() + '/admin/#apps',
      html: await L.brandMail(action === 'decline' ? L.escH(c.name) + ' är inte intresserad' : L.escH(c.name) + ' vill ändra offerten', `<p><b>Offert:</b> ${L.escH(row.data.no || '')} (version ${row.version})</p>${price ? `<p><b>Önskat pris:</b> ${L.escH(price)}</p>` : ''}<blockquote style="border-left:4px solid #1D4ED8;margin:0;padding:8px 12px;background:#F5F7FB;white-space:pre-wrap">${L.escH(message || '(inget meddelande)')}</blockquote><p>Svara genom att skicka samma eller en ny offert, eller markera som inte intresserad.</p>`, [['Öppna i admin', L.site() + '/admin/#apps']]) }).catch(e => console.error('notify', e.message));
    if (c.email) L.sendEmail({ to: c.email, subject: action === 'decline' ? 'Tack för beskedet · ScanSay' : 'Vi har fått era önskemål · ScanSay', text: action === 'decline' ? 'Tack för att ni meddelade oss. Hör gärna av er om ni ändrar er.' : 'Tack! Vi har fått era önskemål om ändringar och återkommer med en uppdaterad offert, oftast inom en arbetsdag.',
      html: await L.brandMail(action === 'decline' ? 'Tack för beskedet' : 'Vi har fått era önskemål', action === 'decline' ? '<p>Tack för att ni tog er tid att titta på offerten. Hör gärna av er om ni ändrar er – erbjudandet kan alltid uppdateras.</p>' : '<p>Tack! Vi går igenom era önskemål och skickar en uppdaterad offert, oftast inom en arbetsdag.</p>' + (message ? `<blockquote style="border-left:4px solid #E5E7EB;margin:0;padding:6px 12px;color:#4B5563;white-space:pre-wrap">${L.escH(message)}</blockquote>` : '')) }).catch(() => {});
    return L.send(res, 200, { ok: true, status: action === 'decline' ? 'declined' : 'changes' });
  } catch (e) { L.fail(res, e, req); }
};
