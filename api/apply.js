/* POST /api/apply  (public, from the website form)
   E-mails the application to NOTIFY_EMAIL and a confirmation to the applicant. Basic spam checks. */
const { send, body, sendEmail, env, escH, sb, sbOn, mailHtml, limited, hmac, secLog } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Använd POST' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  try { if (await limited('apply:' + hmac(ip), 5, 36e5)) { secLog('apply_rate', req); return send(res, 429, { error: 'För många försök' }); } } catch (e) {}
  const b = await body(req).catch(() => ({}));
  const f = k => String(b[k] || '').trim().slice(0, 2000);
  if (!f('company') || !/^\S+@\S+\.\S+$/.test(f('email')) || f('name').length < 2) return send(res, 400, { error: 'Fyll i namn, företag och e-post' });
  if (b.website) return send(res, 200, { ok: true }); // honeypot
  const rows = { Företag: f('company'), Namn: f('name'), 'E-post': f('email'), Telefon: f('phone'), Bransch: f('ind'), Paket: f('tier'), 'Antal platser': f('size'), 'Anläggningar': (b.counts || {}).units || '', 'Rum/platser': (b.counts || {}).rooms || '', 'Restauranger': (b.counts || {}).rest || 0, Gym: (b.counts || {}).gym || 0, Spa: (b.counts || {}).spa || 0, Konferens: (b.counts || {}).conf || 0, Parkering: (b.counts || {}).park || 0, 'Övriga platser': (b.counts || {}).other || 0, 'Anställda': (b.counts || {}).emp || '', Inloggningar: Object.entries(b.roles || {}).filter(([, v]) => +v > 0).map(([k, v]) => v + ' ' + k).join(', ') || '–', Koncern: b.group ? 'Ja' : 'Nej', Sektioner: [].concat(b.secs || []).join(', '), Meddelande: f('msg'), 'Org.nr': f('org'), Personalmodul: b.staff ? 'Ja' : 'Nej', Språk: f('lang'), IP: ip };
  const html = `<h2 style="font-family:Arial">Ny ansökan: ${escH(rows.Företag)}</h2><table style="border-collapse:collapse;font-family:Arial;font-size:14px">${Object.entries(rows).map(([k, v]) => `<tr><td style="border:1px solid #ddd;padding:6px 8px"><b>${k}</b></td><td style="border:1px solid #ddd;padding:6px 8px">${escH(v)}</td></tr>`).join('')}</table>`;
  try {
    if (sbOn()) await sb('POST', 'applications', { data: Object.assign({}, b, { ip }) }, 'return=minimal').catch(e => console.error('app db', e.message));
    if (env('NOTIFY_EMAIL')) await sendEmail({ to: env('NOTIFY_EMAIL'), subject: `Ny ansökan: ${rows.Företag}`, text: JSON.stringify(rows, null, 2), html, replyTo: rows['E-post'] });
    const en = rows.Språk === 'en';
    await sendEmail({ to: rows['E-post'], subject: en ? 'We have received your application · ScanSay' : 'Vi har tagit emot er ansökan · ScanSay',
      text: en ? `Hi ${rows.Namn.split(' ')[0]}!\n\nThanks for applying to ScanSay. We will get back to you with an offer within one working day.\n\nBest regards\nScanSay · hello@scansay.se` : `Hej ${rows.Namn.split(' ')[0]}!\n\nTack för er ansökan till ScanSay. Vi återkommer med en offert inom en arbetsdag.\n\nVänliga hälsningar\nScanSay · hello@scansay.se`,
      html: mailHtml(en ? 'Thanks, we have received your application' : 'Tack, vi har tagit emot er ansökan', en ? `<p>Hi ${escH(rows.Namn.split(' ')[0])}! We will send an offer within one working day. You sign it electronically and we open your account the same day.</p>` : `<p>Hej ${escH(rows.Namn.split(' ')[0])}! Vi skickar en offert inom en arbetsdag. Ni signerar den elektroniskt och vi öppnar kontot samma dag.</p><p>Ni får signera: huvudavtal med villkor och biträdesavtal${b.staff ? ', samt bilaga för personalmodulen' : ''}.</p>`) });
  } catch (e) { console.error('apply', e.message); return send(res, 502, { error: 'Kunde inte skicka just nu. Försök igen eller mejla hello@scansay.se.' }); }
  send(res, 200, { ok: true });
};
