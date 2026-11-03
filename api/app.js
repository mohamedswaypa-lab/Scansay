/* Customer dashboard (needs login). All calls send "Authorization: Bearer <access_token>".
   GET  /api/app?a=state                      → account, my role, dashboard settings and the latest messages
   POST /api/app?a=save     {state}           → saves sections, places, alarms… and updates the QR codes
   POST /api/app?a=reply    {id,text,fix}     → sends the reply to the guest (email or SMS) and updates the case
   POST /api/app?a=status   {id,status}       → new | prog | fix
   POST /api/app?a=alarm    {only}            → sends a test alarm to the channels that are on
   POST /api/app?a=invite   {email,name,role} → invites a colleague (counts against the number of agents)
   POST /api/app?a=remove   {user_id}         → removes a colleague
   POST /api/app?a=push_sub {sub,level,secs,device} → turns on notifications on this phone/computer
   POST /api/app?a=push_off {endpoint}        → turns them off
   POST /api/app?a=push_test                  → sends a test notification to my own devices
   POST /api/app?a=forward  {id,user_id,note} → sends a case to a colleague (email + phone notification)
   Parent company (kind=group): GET state returns statistics for every daughter company, never the messages.
   POST /api/app?a=child_create {name,org,city,ind,manager,email} → creates a daughter company and invites its manager
   POST /api/app?a=child_invite {id}          → sends the daughter manager's invitation again
   Roles: Ägare/Gruppadmin = manager (everything), Handläggare = inbox + replies, Medarbetare = inbox for own sections,
   status only, Läsare = statistics only. Every limit is checked here on the server. */
const L = require('./_lib');
const ADMIN_ROLES = ['Ägare', 'Gruppadmin'], REPLY_ROLES = ['Ägare', 'Gruppadmin', 'Handläggare'], STATUS_ROLES = REPLY_ROLES.concat('Medarbetare');
const ROLES = ['Ägare', 'Gruppadmin', 'Handläggare', 'Medarbetare', 'Läsare'];
const mySecs = m => Array.isArray(m.secs) ? m.secs : [];
/* a Medarbetare only sees cases from their own sections (urgent alarms always) */
const canSee = (m, f) => m.role !== 'Medarbetare' || f.urgent || !mySecs(m).length || mySecs(m).includes(f.sec_name);
/* settings only managers may read (phone numbers, webhook addresses, staff lists) */
const MANAGER_ONLY = ['channels', 'chcfg', 'staff', 'roster', 'alerts', 'alertLog', 'invites', 'mbl', 'esc', 'chat'];
/* what a parent company may see about a daughter's messages: numbers only, no text, no contact details */
/* is there a free login for this role? Uses the per-role numbers from the package, otherwise the total number of logins */
async function quotaOk(acc, role, exceptUser) {
  const mem = (await L.sb('GET', 'members?account_id=eq.' + L.q(acc.id) + '&select=user_id,role')).filter(m => m.user_id !== exceptUser);
  const q = acc.roles || {};
  if (Object.keys(q).length && role !== 'Ägare') return mem.filter(m => m.role === role).length < (q[role] || 0);
  return mem.length < (acc.seats || 3);
}
const statRow = f => ({ ts: Date.parse(f.created_at), type: f.type, rating: f.rating, status: f.status, sec: f.sec_name, topic: f.topic, urgent: f.urgent, fix: f.fixed_at ? Date.parse(f.fixed_at) - Date.parse(f.created_at) : null, rep: (f.replies || []).length > 0, rev: !!f.review_invited_at, revc: !!f.review_clicked_at });
const mask = (c, via) => !c ? '' : via === 'sms' ? c.slice(0, 3) + ' ••• ' + c.slice(-4) : c.replace(/^(.).*?(.{0,3})@/, (m, a, b) => a + '***' + b + '@');
const mapFb = f => ({ id: f.id, g: f.group_id, sec: f.sec_key, secName: f.sec_name, code: f.code, place: f.place, ts: Date.parse(f.created_at), type: f.type, topic: f.topic, rating: f.rating, quick: f.quick, msg: f.message, name: f.name,
  email: f.via === 'email' ? mask(f.contact, 'email') : '', phone: f.via === 'sms' ? mask(f.contact, 'sms') : '', via: f.via, verified: true, live: true, urgent: f.urgent, status: f.status, fixTs: f.fixed_at ? Date.parse(f.fixed_at) : null, replies: f.replies || [], img: f.image || null, revInv: f.review_invited_at ? Date.parse(f.review_invited_at) : null, revClick: f.review_clicked_at ? Date.parse(f.review_clicked_at) : null });
const STATE_KEYS = ['reviews', 'groups', 'staff', 'roster', 'alerts', 'alertLog', 'invites', 'mbl', 'retention', 'channels', 'chcfg', 'urgent', 'esc', 'chat', 'pub', 'certSettings', 'qd'];

module.exports = async (req, res) => {
  const u = new URL(req.url, 'http://x'), a = (req.query && req.query.a) || u.searchParams.get('a');
  try {
    const M = await L.member(req, u.searchParams.get('acc'));
    const acc = M.account, role = M.member.role;

    if (req.method === 'GET' && a === 'state') {
      const since = new Date(Date.now() - 365 * 864e5).toISOString();
      const mem = await L.sb('GET', 'members?account_id=eq.' + L.q(acc.id) + '&select=user_id,role,name,email,secs,created_at');
      let push = { key: null, mine: [] };
      try { push.key = require('./_push').publicKey(); push.mine = (await L.sb('GET', 'push_subs?user_id=eq.' + L.q(M.user.id) + '&account_id=eq.' + L.q(acc.id) + '&select=endpoint,level,secs,device,created_at')); } catch (e) { console.error('push state', e.message); }
      const accInfo = { id: acc.id, name: acc.name, org: acc.org, ind: acc.ind, seats: acc.seats, plan: acc.plan, mods: acc.mods || {}, city: acc.city, kind: acc.kind || 'site', max_children: acc.max_children || 0, parent: null, roles: acc.roles || {} };
      if (acc.parent_id) { const [pa] = await L.sb('GET', 'accounts?id=eq.' + L.q(acc.parent_id) + '&select=name'); accInfo.parent = pa ? pa.name : null; }
      const me = { id: M.user.id, email: M.user.email, role, name: M.member.name, secs: mySecs(M.member) };
      const base = { account: accInfo, me, members: ADMIN_ROLES.includes(role) ? mem : mem.map(x => ({ user_id: x.user_id, role: x.role, name: x.name })), push, accounts: M.all };
      if (ADMIN_ROLES.includes(role)) { try { base.messages = await L.sb('GET', 'messages?account_id=eq.' + L.q(acc.id) + '&select=id,created_at,thread,subject,sender,by_name,body,read_company&order=created_at.asc&limit=500'); } catch (e) { base.messages = []; } }
      if ((acc.kind || 'site') === 'group') {
        const kids = await L.sb('GET', 'accounts?parent_id=eq.' + L.q(acc.id) + '&select=id,name,city,ind,org,email,locked,created_at&order=name.asc');
        const ids = kids.map(k => '"' + k.id + '"');
        const fb = ids.length ? await L.sb('GET', 'feedback?account_id=in.(' + encodeURIComponent(ids.join(',')) + ')&created_at=gte.' + L.q(since) + '&select=account_id,created_at,type,rating,status,sec_name,topic,urgent,fixed_at,replies,review_invited_at,review_clicked_at&order=created_at.desc&limit=20000') : [];
        const km = ids.length ? await L.sb('GET', 'members?account_id=in.(' + encodeURIComponent(ids.join(',')) + ')&select=account_id,user_id,role,email,name,secs') : [];
        const children = kids.map(k => ({ id: k.id, name: k.name, city: k.city, ind: k.ind, locked: k.locked, created: Date.parse(k.created_at),
          manager: (km.find(x => x.account_id === k.id && x.role === 'Ägare') || {}).email || k.email || null, users: km.filter(x => x.account_id === k.id).length,
          members: ADMIN_ROLES.includes(role) ? km.filter(x => x.account_id === k.id).map(x => ({ user_id: x.user_id, role: x.role, email: x.email, name: x.name })) : [],
          fb: fb.filter(f => f.account_id === k.id).map(statRow) }));
        return L.send(res, 200, Object.assign(base, { group: true, children }));
      }
      if (role === 'Läsare') {   // statistics only
        const fb = await L.sb('GET', 'feedback?account_id=eq.' + L.q(acc.id) + '&created_at=gte.' + L.q(since) + '&select=*&order=created_at.desc&limit=3000');
        const st = Object.assign({}, acc.state || {}); MANAGER_ONLY.forEach(k => delete st[k]);
        return L.send(res, 200, Object.assign(base, { state: st, feedback: fb.map(f => Object.assign(mapFb(f), { msg: null, email: '', phone: '', img: null, name: null, replies: [] })) }));
      }
      const fb = await L.sb('GET', 'feedback?account_id=eq.' + L.q(acc.id) + '&created_at=gte.' + L.q(since) + '&select=*&order=created_at.desc&limit=3000');
      const st = Object.assign({}, acc.state || {});
      if (!ADMIN_ROLES.includes(role)) MANAGER_ONLY.forEach(k => delete st[k]);
      return L.send(res, 200, Object.assign(base, { state: st, feedback: fb.filter(f => canSee(M.member, f)).map(mapFb) }));
    }
    if (req.method !== 'POST') return L.send(res, 405, { error: 'method' });
    const b = await L.body(req);

    if (a === 'save') {
      if (!ADMIN_ROLES.includes(role) || (acc.kind || 'site') === 'group') return L.send(res, 403, { error: 'role' });
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

    if (a === 'reply' || a === 'status' || a === 'forward') {
      if (!(a === 'status' ? STATUS_ROLES : REPLY_ROLES).includes(role)) return L.send(res, 403, { error: 'role' });
      const [f] = await L.sb('GET', 'feedback?id=eq.' + L.q(String(b.id || '')) + '&account_id=eq.' + L.q(acc.id) + '&select=*');
      if (!f || !canSee(M.member, f)) return L.send(res, 404, { error: 'notfound' });
      if (a === 'forward') {
        const [to] = await L.sb('GET', 'members?account_id=eq.' + L.q(acc.id) + '&user_id=eq.' + L.q(String(b.user_id || '')) + '&select=*');
        if (!to || !to.email) return L.send(res, 404, { error: 'nouser' });
        const note = String(b.note || '').trim().slice(0, 500), from = M.member.name || M.user.email;
        await L.sendEmail({ to: to.email, replyTo: M.user.email, subject: 'Ärende till dig: ' + (f.sec_name ? f.sec_name + ' › ' : '') + (f.place || '') + ' · ' + acc.name,
          text: from + ' skickade ett ärende till dig.' + (note ? '\n\n"' + note + '"' : '') + '\n\nGästens meddelande: "' + (f.message || '') + '"\nÖppna: ' + L.site() + '/app/#inbox',
          html: L.mailHtml('Ärende till dig', `<p><b>${L.escH(from)}</b> skickade ett ärende till dig.</p>${note ? `<p style="background:#FFFBEB;border-radius:10px;padding:10px 12px">${L.escH(note)}</p>` : ''}<p style="color:#6B7280;font-size:13px">${L.escH(f.sec_name ? f.sec_name + ' › ' : '')}${L.escH(f.place || '')}${f.topic ? ' · ' + L.escH(f.topic) : ''}${f.rating ? ' · ' + f.rating + ' av 5' : ''}</p><blockquote style="border-left:4px solid ${f.urgent ? '#B91C1C' : '#1D4ED8'};margin:0;padding:8px 12px;background:#F5F7FB">${L.escH(f.message || '')}</blockquote>`, ['Öppna ärendet', L.site() + '/app/#inbox'], { preheader: from + ' skickade ett ärende till dig' }) });
        try { await L.pushAccount(acc, { id: f.id, urgent: f.urgent, type: 'c', sec_name: f.sec_name, place: f.place, topic: 'Skickat till dig av ' + from, message: note || f.message }, { test: true, user: to.user_id }, 'Ärende till dig: ' + (f.place || '')); } catch (e) {}
        const replies = (f.replies || []).concat({ txt: 'Skickat vidare till ' + (to.name || to.email) + (note ? ': ' + note : ''), ts: Date.now(), by: from, internal: true });
        await L.sb('PATCH', 'feedback?id=eq.' + L.q(f.id), { replies, status: f.status === 'new' ? 'prog' : f.status }, 'return=minimal');
        return L.send(res, 200, { ok: true });
      }
      const patch = {};
      if (a === 'reply') {
        const text = String(b.text || '').trim().slice(0, 1500);
        if (text.length < 3) return L.send(res, 400, { error: 'text' });
        if (!f.contact) return L.send(res, 400, { error: 'nocontact' });
        const inv = b.fix ? L.reviewInvite(acc, f) : null;   // same invitation for every closed case, never by rating
        const gl = L.guestLink(f);                              // the guest answers on a web page, so the answer lands in this case
        if (f.via === 'sms') { await L.sendSms({ to: f.contact, text: acc.name + ': ' + text + (b.fix ? '' : '\nSvara: ' + gl) }); if (inv) await L.sendSms({ to: f.contact, text: acc.name + ': ' + inv.sms }); }
        else await L.sendEmail({ to: f.contact, replyTo: M.user.email, subject: 'Svar från ' + acc.name + ' om ditt meddelande', text: text + '\n\n— ' + acc.name + '\n\nSvara här: ' + gl + '\n\nDitt meddelande: "' + (f.message || '') + '"' + (inv ? '\n\n' + inv.text : ''),
          html: L.mailHtml('Svar från ' + L.escH(acc.name), `<p style="white-space:pre-wrap">${L.escH(text)}</p><p style="color:#6B7280;font-size:13px;margin-top:18px">Ditt meddelande om ${L.escH(f.sec_name ? f.sec_name + ' › ' : '')}${L.escH(f.place || '')}:</p><blockquote style="border-left:4px solid #E5E7EB;margin:0;padding:6px 12px;color:#4B5563">${L.escH(f.message || '')}</blockquote>` + (inv ? inv.html : ''), ['Svara ' + L.escH(acc.name), gl], { preheader: text.slice(0, 90) }) });
        if (inv) patch.review_invited_at = new Date().toISOString();
        patch.replies = (f.replies || []).concat({ txt: text, ts: Date.now(), by: M.member.name || M.user.email, email: M.user.email });
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
      const rl = ['Gruppadmin', 'Handläggare', 'Medarbetare', 'Läsare'].includes(b.role) ? b.role : 'Handläggare';
      if ((acc.kind || 'site') === 'group' && !['Gruppadmin', 'Läsare'].includes(rl)) return L.send(res, 400, { error: 'role' });
      if (!(await quotaOk(acc, rl))) return L.send(res, 402, { error: 'seats', role: rl, seats: acc.seats, roles: acc.roles || {} });
      const secs = rl === 'Medarbetare' && Array.isArray(b.secs) ? b.secs.map(x => String(x).slice(0, 80)).slice(0, 40) : [];
      const r = await invite(email, b.name, acc, rl, null, secs);
      return L.send(res, 200, r);
    }
    if (a === 'member') {   // change a colleague's role or sections
      if (!ADMIN_ROLES.includes(role)) return L.send(res, 403, { error: 'role' });
      if (b.user_id === M.user.id) return L.send(res, 400, { error: 'self' });
      const patch = {};
      if (b.role !== undefined) { if (!['Gruppadmin', 'Handläggare', 'Medarbetare', 'Läsare'].includes(b.role)) return L.send(res, 400, { error: 'role' }); if (!(await quotaOk(acc, b.role, String(b.user_id || '')))) return L.send(res, 402, { error: 'seats', role: b.role }); patch.role = b.role; }
      if (Array.isArray(b.secs)) patch.secs = b.secs.map(x => String(x).slice(0, 80)).slice(0, 40);
      await L.sb('PATCH', 'members?account_id=eq.' + L.q(acc.id) + '&user_id=eq.' + L.q(String(b.user_id || '')) + '&role=neq.' + L.q('Ägare'), patch, 'return=minimal');
      return L.send(res, 200, { ok: true });
    }
    if (a === 'push_sub') {
      const sub = b.sub || {}, k = sub.keys || {}, ep = String(sub.endpoint || '');
      if (!/^https:\/\/[^\s]{10,900}$/.test(ep) || !/^[A-Za-z0-9_-]{80,100}$/.test(k.p256dh || '') || !/^[A-Za-z0-9_-]{16,30}$/.test(k.auth || '')) return L.send(res, 400, { error: 'sub' });
      const mine = await L.sb('GET', 'push_subs?user_id=eq.' + L.q(M.user.id) + '&select=endpoint');
      if (mine.length >= 10 && !mine.some(x => x.endpoint === ep)) return L.send(res, 400, { error: 'devices' });
      if (role === 'Läsare' || (acc.kind || 'site') === 'group') return L.send(res, 403, { error: 'role' });
      let secs = Array.isArray(b.secs) ? b.secs.map(x => String(x).slice(0, 80)).slice(0, 30) : [];
      if (role === 'Medarbetare' && mySecs(M.member).length) secs = secs.length ? secs.filter(x => mySecs(M.member).includes(x)) : mySecs(M.member);
      await L.sb('POST', 'push_subs?on_conflict=endpoint', { endpoint: ep, p256dh: k.p256dh, auth: k.auth, account_id: acc.id, user_id: M.user.id, level: ['urgent', 'c', 'all'].includes(b.level) ? b.level : 'c', secs, device: String(b.device || '').slice(0, 60) || null }, 'resolution=merge-duplicates,return=minimal');
      return L.send(res, 200, { ok: true });
    }
    if (a === 'push_off') {
      await L.sb('DELETE', 'push_subs?endpoint=eq.' + L.q(String(b.endpoint || '')) + '&user_id=eq.' + L.q(M.user.id), undefined, 'return=minimal');
      return L.send(res, 200, { ok: true });
    }
    if (a === 'push_test') {
      const r = await L.pushAccount(acc, { id: 'test', urgent: false, type: 'c', rating: 5, sec_name: 'Test', place: 'Testnotis', topic: 'Test', message: 'Notiserna fungerar på den här enheten.' }, { test: true, user: M.user.id }, 'Testnotis från ScanSay');
      return L.send(res, 200, r);
    }
    if (a === 'child_member' || a === 'child_member_remove') {   // the parent company gives a person a role in one of its daughters
      if ((acc.kind || 'site') !== 'group' || !ADMIN_ROLES.includes(role)) return L.send(res, 403, { error: 'role' });
      const [k] = await L.sb('GET', 'accounts?id=eq.' + L.q(String(b.child_id || '')) + '&parent_id=eq.' + L.q(acc.id) + '&select=*');
      if (!k) return L.send(res, 404, { error: 'notfound' });
      if (a === 'child_member_remove') { await L.sb('DELETE', 'members?account_id=eq.' + L.q(k.id) + '&user_id=eq.' + L.q(String(b.user_id || '')) + '&role=neq.' + L.q('Ägare'), undefined, 'return=minimal'); return L.send(res, 200, { ok: true }); }
      const email = String(b.email || '').trim().toLowerCase(), rl = ['Gruppadmin', 'Handläggare', 'Medarbetare', 'Läsare'].includes(b.role) ? b.role : null;
      if (!rl) return L.send(res, 400, { error: 'role' });
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return L.send(res, 400, { error: 'format' });
      if (!(await quotaOk(k, rl))) return L.send(res, 402, { error: 'seats', role: rl, child: k.name });
      const secs = rl === 'Medarbetare' && Array.isArray(b.secs) ? b.secs.map(x => String(x).slice(0, 80)).slice(0, 40) : [];
      return L.send(res, 200, await invite(email, String(b.name || '').slice(0, 80) || null, k, rl, null, secs));
    }
    if (a === 'msg_new' || a === 'msg_reply' || a === 'msg_read') {   // conversation with ScanSay
      if (!ADMIN_ROLES.includes(role)) return L.send(res, 403, { error: 'role' });
      if (a === 'msg_read') { await L.sb('PATCH', 'messages?account_id=eq.' + L.q(acc.id) + '&thread=eq.' + L.q(String(b.thread || '')), { read_company: true }, 'return=minimal'); return L.send(res, 200, { ok: true }); }
      const text = String(b.text || '').trim().slice(0, 5000); if (text.length < 2) return L.send(res, 400, { error: 'text' });
      let thread = String(b.thread || ''), subject = String(b.subject || '').trim().slice(0, 160);
      if (a === 'msg_reply') { const [t] = await L.sb('GET', 'messages?account_id=eq.' + L.q(acc.id) + '&thread=eq.' + L.q(thread) + '&select=subject&limit=1'); if (!t) return L.send(res, 404, { error: 'notfound' }); subject = t.subject; }
      else thread = L.crypto.randomUUID();
      const by = M.member.name || M.user.email;
      await L.sb('POST', 'messages', { account_id: acc.id, thread, subject: subject || 'Meddelande', sender: 'company', by_name: by, body: text, read_company: true }, 'return=minimal');
      if (L.env('NOTIFY_EMAIL')) await L.sendEmail({ to: L.env('NOTIFY_EMAIL'), replyTo: M.user.email, subject: 'Meddelande från ' + acc.name + ': ' + (subject || ''), text: by + ' (' + acc.name + ') skriver:\n\n' + text + '\n\nSvara i admin: ' + L.site() + '/admin/',
        html: L.mailHtml('Meddelande från ' + L.escH(acc.name), `<p><b>${L.escH(by)}</b> skriver om <b>${L.escH(subject || '')}</b>:</p><p style="white-space:pre-wrap">${L.escH(text)}</p>`, ['Öppna admin', L.site() + '/admin/']) }).catch(e => console.error('msg mail', e.message));
      return L.send(res, 200, { ok: true, thread });
    }
    if (a === 'child_create' || a === 'child_invite') {
      if ((acc.kind || 'site') !== 'group' || !ADMIN_ROLES.includes(role)) return L.send(res, 403, { error: 'role' });
      if (a === 'child_invite') {
        const [k] = await L.sb('GET', 'accounts?id=eq.' + L.q(String(b.id || '')) + '&parent_id=eq.' + L.q(acc.id) + '&select=*');
        if (!k) return L.send(res, 404, { error: 'notfound' });
        const [ow] = await L.sb('GET', 'members?account_id=eq.' + L.q(k.id) + '&role=eq.' + L.q('Ägare') + '&select=email,name');
        const em = (ow && ow.email) || k.email; if (!em) return L.send(res, 400, { error: 'format' });
        return L.send(res, 200, await invite(em, ow && ow.name, k, 'Ägare'));
      }
      const name = String(b.name || '').trim().slice(0, 120), email = String(b.email || '').trim().toLowerCase();
      if (name.length < 2) return L.send(res, 400, { error: 'name' });
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return L.send(res, 400, { error: 'format' });
      const kids = await L.sb('GET', 'accounts?parent_id=eq.' + L.q(acc.id) + '&select=id');
      if (kids.length >= (acc.max_children || 0)) return L.send(res, 402, { error: 'children', max: acc.max_children || 0 });
      const ind = /^[a-z]{2,20}$/.test(b.ind || '') ? b.ind : acc.ind;
      const [k] = await L.sb('POST', 'accounts', { name, org: String(b.org || '').slice(0, 20) || null, city: String(b.city || '').slice(0, 60) || null, ind, email, plan: acc.plan, seats: acc.seats || 3, roles: acc.roles || {}, mods: acc.mods || {}, kind: 'site', parent_id: acc.id, billing: { via: 'parent' } });
      const r = await invite(email, String(b.manager || '').slice(0, 80) || null, k, 'Ägare');
      return L.send(res, 200, { ok: true, id: k.id, invited: r.ok });
    }
    if (a === 'remove') {
      if (!ADMIN_ROLES.includes(role)) return L.send(res, 403, { error: 'role' });
      if (b.user_id === M.user.id) return L.send(res, 400, { error: 'self' });
      await L.sb('DELETE', 'members?account_id=eq.' + L.q(acc.id) + '&user_id=eq.' + L.q(String(b.user_id || '')) + '&role=neq.' + L.q('Ägare'), undefined, 'return=minimal');
      await L.sb('DELETE', 'push_subs?account_id=eq.' + L.q(acc.id) + '&user_id=eq.' + L.q(String(b.user_id || '')), undefined, 'return=minimal').catch(() => {});
      return L.send(res, 200, { ok: true });
    }
    return L.send(res, 400, { error: 'action' });
  } catch (e) { L.fail(res, e, req); }
};

/* create or find the login, link it to the company and email a link to choose a password */
async function invite(email, name, acc, role, sub, secs) {
  let r = await L.authApi('POST', 'admin/generate_link', { type: 'invite', email, redirect_to: L.site() + '/app/' });
  if (!r.ok) r = await L.authApi('POST', 'admin/generate_link', { type: 'recovery', email, redirect_to: L.site() + '/app/' });
  if (!r.ok) throw new Error('Kunde inte skapa inloggning: ' + JSON.stringify(r.data).slice(0, 160));
  const user = r.data.user || r.data, link = r.data.action_link || (r.data.properties && r.data.properties.action_link);
  await L.sb('POST', 'members?on_conflict=user_id,account_id', { user_id: user.id, account_id: acc.id, role, name: name || null, email, secs: secs || [] }, 'resolution=merge-duplicates,return=minimal');
  await L.sendEmail({ to: email, subject: role === 'Ägare' ? 'Välkommen till ScanSay – välj lösenord · ' + acc.name : 'Din inloggning till ScanSay · ' + acc.name,
    text: 'Välkommen till ScanSay (' + acc.name + '). Välj lösenord här (gäller i 24 timmar): ' + link + '\nLogga in: ' + L.site() + '/#login\nGlömt lösenord: ' + L.site() + '/?reset=1#login',
    html: await L.welcomeMail(acc, link, sub, role) });
  return { ok: true, user_id: user.id };
}
module.exports.invite = invite;
