/* Customer dashboard (needs login). All calls send "Authorization: Bearer <access_token>".
   GET  /api/app?a=state                      → account, my role, dashboard settings and the latest messages
   POST /api/app?a=save     {state}           → saves sections, places, alarms… and updates the QR codes
   POST /api/app?a=reply    {id,text,fix}     → sends the reply to the guest (email or SMS) and updates the case
   POST /api/app?a=status   {id,status}       → new | prog | fix
   POST /api/app?a=alarm    {only}            → sends a test alarm to the channels that are on
   POST /api/app?a=invite   {email,name,role} → invites a colleague (counts against the number of agents)
   POST /api/app?a=remove   {user_id}         → removes a colleague */
const L = require('./_lib');
const ADMIN_ROLES = ['Ägare', 'Gruppadmin'], REPLY_ROLES = ['Ägare', 'Gruppadmin', 'Handläggare'];
const mask = (c, via) => !c ? '' : via === 'sms' ? c.slice(0, 3) + ' ••• ' + c.slice(-4) : c.replace(/^(.).*?(.{0,3})@/, (m, a, b) => a + '***' + b + '@');
const mapFb = f => ({ id: f.id, g: f.group_id, sec: f.sec_key, secName: f.sec_name, code: f.code, place: f.place, ts: Date.parse(f.created_at), type: f.type, topic: f.topic, rating: f.rating, quick: f.quick, msg: f.message, name: f.name,
  email: f.via === 'email' ? mask(f.contact, 'email') : '', phone: f.via === 'sms' ? mask(f.contact, 'sms') : '', via: f.via, verified: true, live: true, urgent: f.urgent, status: f.status, fixTs: f.fixed_at ? Date.parse(f.fixed_at) : null, replies: f.replies || [], img: f.image || null });
const STATE_KEYS = ['groups', 'staff', 'roster', 'alerts', 'alertLog', 'invites', 'mbl', 'retention', 'channels', 'chcfg', 'urgent', 'esc', 'chat', 'pub', 'certSettings', 'qd'];

module.exports = async (req, res) => {
  const u = new URL(req.url, 'http://x'), a = (req.query && req.query.a) || u.searchParams.get('a');
  try {
    const M = await L.member(req, u.searchParams.get('acc'));
    const acc = M.account, role = M.member.role;

    if (req.method === 'GET' && a === 'state') {
      const since = new Date(Date.now() - 365 * 864e5).toISOString();
      const fb = await L.sb('GET', 'feedback?account_id=eq.' + L.q(acc.id) + '&created_at=gte.' + L.q(since) + '&select=*&order=created_at.desc&limit=3000');
      const mem = await L.sb('GET', 'members?account_id=eq.' + L.q(acc.id) + '&select=user_id,role,name,email,created_at');
      return L.send(res, 200, { account: { id: acc.id, name: acc.name, org: acc.org, ind: acc.ind, seats: acc.seats, plan: acc.plan, mods: acc.mods || {}, city: acc.city },
        me: { id: M.user.id, email: M.user.email, role, name: M.member.name }, state: acc.state || {}, feedback: fb.map(mapFb), members: mem });
    }
    if (req.method !== 'POST') return L.send(res, 405, { error: 'method' });
    const b = await L.body(req);

    if (a === 'save') {
      if (!ADMIN_ROLES.includes(role)) return L.send(res, 403, { error: 'role' });
      const inS = b.state || {}, st = {};
      STATE_KEYS.forEach(k => { if (inS[k] !== undefined) st[k] = inS[k]; });
      if (acc.mods && acc.mods.staff === false) { delete st.staff; delete st.roster; }
      if (JSON.stringify(st).length > 900000) return L.send(res, 413, { error: 'size' });
      // QR codes: every place code must belong to this account
      const want = [];
      (st.groups || []).forEach(g => (g.secs || []).forEach(s => (s.places || []).forEach(p => {
        const code = String(p.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (code) want.push({ code, account_id: acc.id, group_id: g.id, group_name: g.name, company: acc.name, ind: g.ind || acc.ind, sec_key: s.k, sec_name: s.name, place: p.name, active: true, updated_at: new Date().toISOString() });
      })));
      if (want.length > 5000) return L.send(res, 413, { error: 'toomany' });
      if (want.length) {
        const list = want.map(w => '"' + w.code + '"').join(',');
        const taken = await L.sb('GET', 'codes?code=in.(' + encodeURIComponent(list) + ')&account_id=neq.' + L.q(acc.id) + '&select=code');
        if (taken.length) return L.send(res, 409, { error: 'taken', codes: taken.map(t => t.code) });
        await L.sb('POST', 'codes?on_conflict=code', want, 'resolution=merge-duplicates,return=minimal');
      }
      const keep = new Set(want.map(w => w.code));
      const mine = await L.sb('GET', 'codes?account_id=eq.' + L.q(acc.id) + '&active=eq.true&select=code');
      const gone = mine.filter(m => !keep.has(m.code)).map(m => '"' + m.code + '"');
      if (gone.length) await L.sb('PATCH', 'codes?code=in.(' + encodeURIComponent(gone.join(',')) + ')', { active: false }, 'return=minimal');
      await L.sb('PATCH', 'accounts?id=eq.' + L.q(acc.id), { state: Object.assign({}, acc.state || {}, st) }, 'return=minimal');
      return L.send(res, 200, { ok: true, codes: want.length });
    }

    if (a === 'reply' || a === 'status') {
      if (!REPLY_ROLES.includes(role)) return L.send(res, 403, { error: 'role' });
      const [f] = await L.sb('GET', 'feedback?id=eq.' + L.q(String(b.id || '')) + '&account_id=eq.' + L.q(acc.id) + '&select=*');
      if (!f) return L.send(res, 404, { error: 'notfound' });
      const patch = {};
      if (a === 'reply') {
        const text = String(b.text || '').trim().slice(0, 1500);
        if (text.length < 3) return L.send(res, 400, { error: 'text' });
        if (!f.contact) return L.send(res, 400, { error: 'nocontact' });
        if (f.via === 'sms') await L.sendSms({ to: f.contact, text: acc.name + ': ' + text });
        else await L.sendEmail({ to: f.contact, replyTo: M.user.email, subject: 'Svar från ' + acc.name + ' om ditt meddelande', text: text + '\n\n— ' + acc.name + '\n\nDitt meddelande: "' + (f.message || '') + '"',
          html: L.mailHtml('Svar från ' + L.escH(acc.name), `<p style="white-space:pre-wrap">${L.escH(text)}</p><p style="color:#6B7280;font-size:13px;margin-top:18px">Ditt meddelande om ${L.escH(f.sec_name ? f.sec_name + ' › ' : '')}${L.escH(f.place || '')}:</p><blockquote style="border-left:4px solid #E5E7EB;margin:0;padding:6px 12px;color:#4B5563">${L.escH(f.message || '')}</blockquote>`) });
        patch.replies = (f.replies || []).concat({ txt: text, ts: Date.now(), by: M.member.name || M.user.email });
        if (b.fix) { patch.status = 'fix'; patch.fixed_at = new Date().toISOString(); } else if (f.status === 'new') patch.status = 'prog';
      } else {
        if (!['new', 'prog', 'fix'].includes(b.status)) return L.send(res, 400, { error: 'status' });
        patch.status = b.status; patch.fixed_at = b.status === 'fix' ? new Date().toISOString() : null;
      }
      await L.sb('PATCH', 'feedback?id=eq.' + L.q(f.id), patch, 'return=minimal');
      return L.send(res, 200, { ok: true });
    }

    if (a === 'alarm') {
      if (!ADMIN_ROLES.includes(role)) return L.send(res, 403, { error: 'role' });
      const r = await L.routeAlarm(acc, { id: 'test', urgent: true, type: 'c', rating: 1, sec_name: 'Test', place: 'Testlarm', topic: 'Test', message: 'Det här är ett testlarm från ScanSay. Allt fungerar.' }, { test: true, only: b.only || null });
      return L.send(res, 200, r);
    }

    if (a === 'invite') {
      if (!ADMIN_ROLES.includes(role)) return L.send(res, 403, { error: 'role' });
      const email = String(b.email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return L.send(res, 400, { error: 'format' });
      const mem = await L.sb('GET', 'members?account_id=eq.' + L.q(acc.id) + '&select=user_id');
      if (mem.length >= (acc.seats || 3)) return L.send(res, 402, { error: 'seats', seats: acc.seats });
      const r = await invite(email, b.name, acc, ['Gruppadmin', 'Handläggare', 'Läsare'].includes(b.role) ? b.role : 'Handläggare');
      return L.send(res, 200, r);
    }
    if (a === 'remove') {
      if (!ADMIN_ROLES.includes(role)) return L.send(res, 403, { error: 'role' });
      if (b.user_id === M.user.id) return L.send(res, 400, { error: 'self' });
      await L.sb('DELETE', 'members?account_id=eq.' + L.q(acc.id) + '&user_id=eq.' + L.q(String(b.user_id || '')), undefined, 'return=minimal');
      return L.send(res, 200, { ok: true });
    }
    return L.send(res, 400, { error: 'action' });
  } catch (e) { L.fail(res, e, req); }
};

/* create or find the login, link it to the company and email a link to choose a password */
async function invite(email, name, acc, role, sub) {
  let r = await L.authApi('POST', 'admin/generate_link', { type: 'invite', email, redirect_to: L.site() + '/app/' });
  if (!r.ok) r = await L.authApi('POST', 'admin/generate_link', { type: 'recovery', email, redirect_to: L.site() + '/app/' });
  if (!r.ok) throw new Error('Kunde inte skapa inloggning: ' + JSON.stringify(r.data).slice(0, 160));
  const user = r.data.user || r.data, link = r.data.action_link || (r.data.properties && r.data.properties.action_link);
  await L.sb('POST', 'members?on_conflict=user_id,account_id', { user_id: user.id, account_id: acc.id, role, name: name || null, email }, 'resolution=merge-duplicates,return=minimal');
  await L.sendEmail({ to: email, subject: role === 'Ägare' ? 'Välkommen till ScanSay – välj lösenord · ' + acc.name : 'Din inloggning till ScanSay · ' + acc.name,
    text: 'Välkommen till ScanSay (' + acc.name + '). Välj lösenord här (gäller i 24 timmar): ' + link + '\nLogga in: ' + L.site() + '/#login\nGlömt lösenord: ' + L.site() + '/?reset=1#login',
    html: await L.welcomeMail(acc, link, sub, role) });
  return { ok: true, user_id: user.id };
}
module.exports.invite = invite;
