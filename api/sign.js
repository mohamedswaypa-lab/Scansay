/* POST /api/sign  { t, name, title, email, orgNr, accepts:{terms,pub,payment,business} }
   Verifies the sealed offer, records the signature (name, title, e-mail, IP, time, browser, contract version, SHA-256 of the contract text)
   and e-mails a signed copy to the customer and to NOTIFY_EMAIL. The e-mails are the durable record; keep them (or add a database). */
const { send, body, unseal, sendEmail, env, escH, crypto, sb, sbOn, limited, hmac, ipOf, secLog } = require('./_lib');
const C = require('../legal/contract.js');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Använd POST' });
  try { if (await limited('sign:' + hmac(ipOf(req)), 10, 36e5)) return send(res, 429, { error: 'För många försök. Vänta en stund.' }); } catch (e) {}
  const b = await body(req).catch(() => ({}));
  const s = unseal(b.t);
  if (!s) secLog('sign_bad_token', req);
  if (!s) return send(res, 400, { error: 'Länken är ogiltig. Be ScanSay om en ny.' });
  if (s.exp < Date.now()) return send(res, 410, { error: 'Länken har gått ut. Be ScanSay om en ny.' });
  const a = b.accepts || {};
  if (!a.terms || !a.pub || !a.payment || !a.business) return send(res, 400, { error: 'Alla rutor måste kryssas i.' });
  const name = String(b.name || '').trim().slice(0, 120), title = String(b.title || '').trim().slice(0, 120), email = String(b.email || '').trim().slice(0, 200);
  if (name.length < 3 || title.length < 2 || !/^\S+@\S+\.\S+$/.test(email)) return send(res, 400, { error: 'Fyll i namn, titel och e-post.' });
  let row = null, o = s.o;
  if (s.oid) { [row] = await sb('GET', 'offers?id=eq.' + encodeURIComponent(s.oid) + '&select=*'); if (!row) return send(res, 404, { error: 'Offerten finns inte längre.' });
    if (row.status === 'superseded') return send(res, 410, { error: 'Den här offerten har ersatts av en nyare. Använd länken i det senaste mejlet.' });
    if (row.status === 'signed') return send(res, 409, { error: 'Offerten är redan signerad.' });
    if (row.status !== 'sent') return send(res, 409, { error: 'Ni har redan svarat på den här offerten. Vänta på en uppdaterad offert från ScanSay.' });
    o = row.data; }
  if (b.orgNr) o.customer.org = String(b.orgNr).slice(0, 20);
  const html = C.offer(o), text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const record = { id: 'SIG-' + crypto.randomBytes(5).toString('hex').toUpperCase(), ts: new Date().toISOString(), name, title, email,
    ip: String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(), ua: String(req.headers['user-agent'] || '').slice(0, 300),
    version: C.VERSION, sha256: crypto.createHash('sha256').update(text).digest('hex'), offerNo: o.no, ref: o.ref || '' };
  const log = `<table style="border-collapse:collapse;font-family:Arial;font-size:13px">${Object.entries({ 'Signerings-id': record.id, 'Tidpunkt (UTC)': record.ts, 'Namn': name, 'Titel': title, 'E-post': email, 'IP-adress': record.ip, 'Webbläsare': record.ua, 'Avtalsversion': record.version, 'Kontrollsumma SHA-256': record.sha256 }).map(([k, v]) => `<tr><td style="border:1px solid #ddd;padding:6px 8px"><b>${k}</b></td><td style="border:1px solid #ddd;padding:6px 8px">${escH(v)}</td></tr>`).join('')}</table>`;
  const doc = `<!doctype html><meta charset="utf-8"><style>${C.CSS}</style><div style="font-family:Arial,sans-serif;max-width:860px;margin:auto"><p>Avtalet nedan har signerats elektroniskt. Spara mejlet som kvitto.</p>${log}<br>${html.replace('data-sign-slot>Signeras elektroniskt', 'data-sign-slot><span class="ctr-signed">' + escH(name) + '</span>').replace('Namn, titel och datum fylls i vid signering', escH(name + ', ' + title + ' · ' + record.ts.slice(0, 10)))}</div>`;
  if (sbOn()) await sb('POST', 'signatures', { ref: record.ref, company: o.customer.name, org: o.customer.org || null, name, title, email, ip: record.ip, user_agent: record.ua, version: record.version, hash: record.sha256, data: { record, offer: o } }, 'return=minimal').catch(e => console.error('sig db', e.message));
  try {
    await sendEmail({ to: email, subject: `Signerat avtal ${o.no}: ScanSay`, text: `Tack! Avtalet ${o.no} är signerat. Signerings-id ${record.id}.`, html: doc });
    if (env('NOTIFY_EMAIL')) await sendEmail({ to: env('NOTIFY_EMAIL'), subject: `SIGNERAT ${o.no} · ${o.customer.name}`, text: JSON.stringify(record, null, 2), html: doc });
  } catch (e) { console.error('sign mail', e.message); return send(res, 502, { error: 'Avtalet är signerat men mejlet kunde inte skickas. Kontakta hello@scansay.se.' }); }
  if (row) { try { await sb('PATCH', 'offers?id=eq.' + encodeURIComponent(row.id), { status: 'signed', reply: { record }, replied_at: record.ts }, 'return=minimal'); if (row.app_id) await sb('PATCH', 'applications?id=eq.' + encodeURIComponent(row.app_id), { status: 'signed' }, 'return=minimal'); } catch (e) { console.error('sign status', e.message); } }
  send(res, 200, { ok: true, record });
};
