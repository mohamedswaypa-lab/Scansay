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
   Roles (each role manages the roles below it):
     parent company: Ägare (owner of the chain) → creates hotels and their managers, sees statistics, chats with the managers.
     hotel:  Ägare/Gruppadmin (Chef) → statistics incl. the team's results, settings, adds agents/staff/readers. No inbox
             (unless the hotel has no Handläggare yet). Handläggare (agent) → inbox, replies to guests, sends tasks to staff,
             closes cases. Medarbetare → only the tasks sent to them, presses "Klart". Läsare → statistics only.
   Case flow: new → reply/assign → Pågående → closed earliest CASE_MIN_MINUTES (30) after it became Pågående.
   POST /api/app?a=assign    {id,user_id,note} → sends the case to a colleague as a task (email + phone notification)
   POST /api/app?a=task_done {id}              → the staff member marks the task done (earliest 30 min after it was sent)
   GET  /api/app?a=chat                        → team chat, direct messages and (parent company) chat with the managers
   POST /api/app?a=chat_send {scope,channel,text}
   Every limit is checked here on the server. */
const L = require('./_lib');
const ADMIN_ROLES = ['Ägare', 'Gruppadmin'], REPLY_ROLES = ['Ägare', 'Gruppadmin', 'Handläggare'], STATUS_ROLES = REPLY_ROLES.concat('Medarbetare');
const ROLES = ['Ägare', 'Gruppadmin', 'Handläggare', 'Medarbetare', 'Läsare'];
const RANK = { 'Ägare': 5, 'Gruppadmin': 4, 'Handläggare': 3, 'Medarbetare': 1, 'Läsare': 1 };
/* who may add, change or remove whom: managers everyone below them, agents only staff (Medarbetare) */
const canManage = (me, target) => (ADMIN_ROLES.includes(me) && RANK[target] < RANK[me]) || (me === 'Handläggare' && target === 'Medarbetare');
const WAIT = () => Math.max(0, parseFloat(L.env('CASE_MIN_MINUTES') || '30')) * 60e3;
/* who works with the cases: agents; managers only while the hotel has no agent */
const canWork = (role, hasAgents) => role === 'Handläggare' || (ADMIN_ROLES.includes(role) && !hasAgents);
const mySecs = m => Array.isArray(m.secs) ? m.secs : [];
/* a Medarbetare only sees cases from their own sections (urgent alarms always) */
const canSee = (m, f) => m.role !== 'Medarbetare' || f.assigned_to === m.user_id || (f.urgent && (!mySecs(m).length || mySecs(m).includes(f.sec_name)));
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
const statRow = f => ({ ts: Date.parse(f.created_at), type: f.type, rating: f.rating, status: f.status, sec: f.sec_name, topic: f.topic, urgent: f.urgent, fix: f.fixed_at ? Date.parse(f.fixed_at) - Date.parse(f.created_at) : null, rep: (f.replies || []).some(r => !r.internal && !r.guest), rev: !!f.review_invited_at, revc: !!f.review_clicked_at, asp: f.aspects || null });
const mask = (c, via) => !c ? '' : via === 'sms' ? c.slice(0, 3) + ' ••• ' + c.slice(-4) : c.replace(/^(.).*?(.{0,3})@/, (m, a, b) => a + '***' + b + '@');
const mapFb = f => ({ id: f.id, g: f.group_id, sec: f.sec_key, secName: f.sec_name, code: f.code, place: f.place, ts: Date.parse(f.created_at), type: f.type, topic: f.topic, rating: f.rating, quick: f.quick, msg: f.message, name: f.name,
  email: f.via === 'email' ? mask(f.contact, 'email') : '', phone: f.via === 'sms' ? mask(f.contact, 'sms') : '', via: f.via, verified: true, live: true, urgent: f.urgent, status: f.status, fixTs: f.fixed_at ? Date.parse(f.fixed_at) : null, replies: f.replies || [], img: f.image || null, revInv: f.review_invited_at ? Date.parse(f.review_invited_at) : null, revClick: f.review_clicked_at ? Date.parse(f.review_clicked_at) : null,
  progTs: f.prog_at ? Date.parse(f.prog_at) : null, fixedBy: f.fixed_by || null, assignedTo: f.assigned_to || null, assignedName: f.assigned_name || null, assignedTs: f.assigned_at ? Date.parse(f.assigned_at) : null, taskDoneTs: f.task_done_at ? Date.parse(f.task_done_at) : null, aspects: f.aspects || null });
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
      const accInfo = { id: acc.id, name: acc.name, org: acc.org, ind: acc.ind, seats: acc.seats, plan: acc.plan, mods: acc.mods || {}, city: acc.city, email: ADMIN_ROLES.includes(role) ? acc.email : null, phone: ADMIN_ROLES.includes(role) ? acc.phone : null, kind: acc.kind || 'site', max_children: acc.max_children || 0, parent: null, roles: acc.roles || {} };
      if (acc.parent_id) { const [pa] = await L.sb('GET', 'accounts?id=eq.' + L.q(acc.parent_id) + '&select=name'); accInfo.parent = pa ? pa.name : null; }
      const hasAgents = mem.some(x => x.role === 'Handläggare');
      const me = { id: M.user.id, email: M.user.email, role, name: M.member.name, secs: mySecs(M.member), works: canWork(role, hasAgents), waitMin: WAIT() / 60e3 };
      const base = { account: accInfo, me, hasAgents, members: (ADMIN_ROLES.includes(role) || role === 'Handläggare') ? mem : mem.map(x => ({ user_id: x.user_id, role: x.role, name: x.name })), push, accounts: M.all };
      if (ADMIN_ROLES.includes(role)) { try { base.messages = await L.sb('GET', 'messages?account_id=eq.' + L.q(acc.id) + '&select=id,created_at,thread,subject,sender,by_name,body,read_company&order=created_at.asc&limit=500'); } catch (e) { base.messages = []; } }
      if ((acc.kind || 'site') === 'group') {
        const kids = await L.sb('GET', 'accounts?parent_id=eq.' + L.q(acc.id) + '&select=id,name,city,ind,org,email,locked,created_at&order=name.asc');
        const ids = kids.map(k => '"' + k.id + '"');
        const fb = ids.length ? await L.sb('GET', 'feedback?account_id=in.(' + encodeURIComponent(ids.join(',')) + ')&created_at=gte.' + L.q(since) + '&select=account_id,created_at,type,rating,status,sec_name,topic,urgent,fixed_at,replies,review_invited_at,review_clicked_at,aspects&order=created_at.desc&limit=20000') : [];
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
      const strip = (ADMIN_ROLES.includes(role) && hasAgents) || role === 'Medarbetare';   // managers with agents get the numbers and texts, not the guests' contact details
      return L.send(res, 200, Object.assign(base, { state: st, feedback: fb.filter(f => canSee(M.member, f)).map(f => strip ? Object.assign(mapFb(f), { email: '', phone: '' }) : mapFb(f)) }));
    }
    if (req.method !== 'POST' && a !== 'chat') return L.send(res, 405, { error: 'method' });
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

    if (['reply', 'status', 'forward', 'assign', 'task_done'].includes(a)) {
      const mem = await L.sb('GET', 'members?account_id=eq.' + L.q(acc.id) + '&select=user_id,role,name,email');
      const works = canWork(role, mem.some(x => x.role === 'Handläggare')), me = M.member.name || M.user.email;
      const [f] = await L.sb('GET', 'feedback?id=eq.' + L.q(String(b.id || '')) + '&account_id=eq.' + L.q(acc.id) + '&select=*');
      if (!f || !canSee(M.member, f)) return L.send(res, 404, { error: 'notfound' });
      const now = Date.now(), nowIso = new Date().toISOString(), patch = {};
      if (a === 'task_done') {   // the staff member says the task is done
        if (f.assigned_to !== M.user.id) return L.send(res, 403, { error: 'role' });
        const left = (f.assigned_at ? Date.parse(f.assigned_at) : now) + WAIT() - now;
        if (left > 0) return L.send(res, 409, { error: 'wait', minutes: Math.ceil(left / 60e3) });
        const by = (f.replies || []).filter(r => r.assign).pop();
        patch.task_done_at = nowIso;
        patch.replies = (f.replies || []).concat({ txt: me + ' markerade uppdraget som klart.' + (b.note ? ' ' + String(b.note).slice(0, 300) : ''), ts: now, by: me, internal: true, done: true });
        await L.sb('PATCH', 'feedback?id=eq.' + L.q(f.id), patch, 'return=minimal');
        if (by && by.email) {
          await L.sendEmail({ to: by.email, subject: 'Klart: ' + (f.sec_name ? f.sec_name + ' › ' : '') + (f.place || '') + ' · ' + acc.name, text: me + ' har markerat uppdraget som klart. Kontrollera och avsluta ärendet: ' + L.site() + '/app/#inbox',
            html: L.mailHtml('Uppdraget är klart', `<p><b>${L.escH(me)}</b> har markerat uppdraget som klart.</p><p style="color:#6B7280;font-size:13px">${L.escH((f.sec_name ? f.sec_name + ' › ' : '') + (f.place || ''))}</p><p>Kontrollera och avsluta ärendet i inkorgen.</p>`, ['Öppna ärendet', L.site() + '/app/#inbox']) }).catch(() => {});
          const bu = mem.find(x => x.email === by.email); if (bu) await L.pushAccount(acc, { id: f.id, type: 'c', sec_name: f.sec_name, place: f.place, topic: 'Klart av ' + me, message: f.message }, { test: true, user: bu.user_id }, 'Klart: ' + (f.place || '')).catch(() => {});
        }
        return L.send(res, 200, { ok: true });
      }
      if (a === 'status' && role === 'Medarbetare') {   // staff may only say they have started their own task
        if (f.assigned_to !== M.user.id || b.status !== 'prog') return L.send(res, 403, { error: 'role' });
        await L.sb('PATCH', 'feedback?id=eq.' + L.q(f.id), { status: f.status === 'fix' ? 'fix' : 'prog', prog_at: f.prog_at || nowIso, replies: (f.replies || []).concat({ txt: me + ' har påbörjat uppdraget.', ts: now, by: me, internal: true }) }, 'return=minimal');
        return L.send(res, 200, { ok: true });
      }
      if (!works) return L.send(res, 403, { error: 'role' });
      if (a === 'forward' || a === 'assign') {   // send the case to a colleague (usually a Medarbetare) as a task
        const to = mem.find(x => x.user_id === String(b.user_id || ''));
        if (!to || !to.email || to.role === 'Läsare') return L.send(res, 404, { error: 'nouser' });
        const note = String(b.note || '').trim().slice(0, 500);
        await L.sendEmail({ to: to.email, replyTo: M.user.email, subject: 'Uppdrag till dig: ' + (f.sec_name ? f.sec_name + ' › ' : '') + (f.place || '') + ' · ' + acc.name,
          text: me + ' skickade ett uppdrag till dig.' + (note ? '\n\n"' + note + '"' : '') + '\n\nGästens meddelande: "' + (f.message || '') + '"\nÖppna: ' + L.site() + '/app/#inbox',
          html: L.mailHtml('Uppdrag till dig', `<p><b>${L.escH(me)}</b> skickade ett uppdrag till dig.</p>${note ? `<p style="background:#FFFBEB;border-radius:10px;padding:10px 12px">${L.escH(note)}</p>` : ''}<p style="color:#6B7280;font-size:13px">${L.escH(f.sec_name ? f.sec_name + ' › ' : '')}${L.escH(f.place || '')}${f.topic ? ' · ' + L.escH(f.topic) : ''}${f.rating ? ' · ' + f.rating + ' av 5' : ''}</p><blockquote style="border-left:4px solid ${f.urgent ? '#B91C1C' : '#1D4ED8'};margin:0;padding:8px 12px;background:#F5F7FB">${L.escH(f.message || '')}</blockquote><p style="color:#6B7280;font-size:13px">Tryck på <b>Klart</b> i appen när det är åtgärdat.</p>`, ['Öppna uppdraget', L.site() + '/app/#inbox'], { preheader: me + ' skickade ett uppdrag till dig' }) });
        try { await L.pushAccount(acc, { id: f.id, urgent: f.urgent, type: 'c', sec_name: f.sec_name, place: f.place, topic: 'Uppdrag från ' + me, message: note || f.message }, { test: true, user: to.user_id }, 'Uppdrag: ' + (f.place || '')); } catch (e) {}
        Object.assign(patch, { assigned_to: to.user_id, assigned_name: to.name || to.email, assigned_at: nowIso, task_done_at: null, status: f.status === 'fix' ? 'fix' : 'prog', prog_at: f.prog_at || nowIso,
          replies: (f.replies || []).concat({ txt: 'Uppdrag till ' + (to.name || to.email) + (note ? ': ' + note : ''), ts: now, by: me, email: M.user.email, internal: true, assign: true }) });
        await L.sb('PATCH', 'feedback?id=eq.' + L.q(f.id), patch, 'return=minimal');
        return L.send(res, 200, { ok: true });
      }
      if (a === 'reply') {   // answer the guest; the case moves to Pågående (never straight to solved)
        const text = String(b.text || '').trim().slice(0, 1500);
        if (text.length < 3) return L.send(res, 400, { error: 'text' });
        if (!f.contact) return L.send(res, 400, { error: 'nocontact' });
        const gl = L.guestLink(f);
        if (f.via === 'sms') await L.sendSms({ to: f.contact, text: acc.name + ': ' + text + '\nSvara: ' + gl });
        else await L.sendEmail({ to: f.contact, replyTo: L.replyTo(f, M.user.email), subject: 'Svar från ' + acc.name + ' om ditt meddelande', text: text + '\n\n— ' + acc.name + '\n\nSvara här: ' + gl + '\n\nDitt meddelande: "' + (f.message || '') + '"',
          html: L.mailHtml('Svar från ' + L.escH(acc.name), `<p style="white-space:pre-wrap">${L.escH(text)}</p><p style="color:#6B7280;font-size:13px;margin-top:18px">Ditt meddelande om ${L.escH(f.sec_name ? f.sec_name + ' › ' : '')}${L.escH(f.place || '')}:</p><blockquote style="border-left:4px solid #E5E7EB;margin:0;padding:6px 12px;color:#4B5563">${L.escH(f.message || '')}</blockquote>`, ['Svara ' + L.escH(acc.name), gl], { preheader: text.slice(0, 90) }) });
        patch.replies = (f.replies || []).concat({ txt: text, ts: now, by: me, email: M.user.email });
        if (f.status !== 'fix') { patch.status = 'prog'; patch.prog_at = f.prog_at || nowIso; }
        await L.sb('PATCH', 'feedback?id=eq.' + L.q(f.id), patch, 'return=minimal');
        return L.send(res, 200, { ok: true, progTs: Date.parse(f.prog_at || nowIso) });
      }
      // status
      if (!['new', 'prog', 'fix'].includes(b.status)) return L.send(res, 400, { error: 'status' });
      if (b.status === 'prog') { patch.status = 'prog'; patch.prog_at = f.prog_at || nowIso; patch.fixed_at = null; }
      if (b.status === 'new') { patch.status = 'new'; patch.fixed_at = null; patch.prog_at = null; patch.fixed_by = null; }
      if (b.status === 'fix') {   // only from Pågående, and only after the waiting time, so the fix can be checked first
        if (f.status !== 'prog' || !f.prog_at) return L.send(res, 409, { error: 'notprog' });
        const left = Date.parse(f.prog_at) + WAIT() - now;
        if (left > 0) return L.send(res, 409, { error: 'wait', minutes: Math.ceil(left / 60e3) });
        Object.assign(patch, { status: 'fix', fixed_at: nowIso, fixed_by: me });
        // the guest hears it is solved (once), with the answer link and – if the company uses it – the same review
        // invitation every closed case gets (never chosen by rating)
        if (f.contact && !(f.replies || []).some(r => r.closed)) {
          const inv = L.reviewInvite(acc, f), gl = L.guestLink(f), what = (f.sec_name ? f.sec_name + ' › ' : '') + (f.place || '');
          const msg = f.type === 'p' ? 'Tack för ditt fina meddelande! Vi har delat det med teamet.' : f.type === 'i' ? 'Tack för din idé! Vi har tagit med den.' : 'Ditt ärende om ' + what + ' är nu åtgärdat. Tack för att du sa till!';
          try {
            if (f.via === 'sms') { await L.sendSms({ to: f.contact, text: acc.name + ': ' + msg + '\nSvara: ' + gl }); if (inv) await L.sendSms({ to: f.contact, text: acc.name + ': ' + inv.sms }); }
            else await L.sendEmail({ to: f.contact, replyTo: L.replyTo(f, M.user.email), subject: (f.type === 'c' || f.type === 'q' ? 'Ditt ärende är löst · ' : 'Tack från ') + acc.name, text: msg + '\n\nSvara här: ' + gl + (inv ? '\n\n' + inv.text : ''),
              html: L.mailHtml(L.escH(f.type === 'c' || f.type === 'q' ? 'Ditt ärende är löst' : 'Tack från ' + acc.name), `<p>${L.escH(msg)}</p><p style="color:#6B7280;font-size:13px;margin-top:14px">Ditt meddelande:</p><blockquote style="border-left:4px solid #E5E7EB;margin:0;padding:6px 12px;color:#4B5563">${L.escH(f.message || '')}</blockquote>` + (inv ? inv.html : ''), ['Svara ' + L.escH(acc.name), gl]) });
            patch.replies = (f.replies || []).concat({ txt: 'Gästen fick besked om att ärendet är avslutat' + (inv ? ' och en inbjudan att recensera' : '') + '.', ts: now, by: me, internal: true, closed: true });
            if (inv) patch.review_invited_at = nowIso;
          } catch (e) { console.error('close notice', e.message); }
        }
      }
      await L.sb('PATCH', 'feedback?id=eq.' + L.q(f.id), patch, 'return=minimal');
      return L.send(res, 200, { ok: true });
    }

    if (a === 'chat' || a === 'chat_send') {
      const C = await chatScope(M, acc, role);
      if (a === 'chat') {
        const since = new Date(Date.now() - 180 * 864e5).toISOString(), mine = m => !/^k?dm:/.test(m.channel) || m.channel.includes(M.user.id);
        let msgs = (await L.sb('GET', 'chat?account_id=eq.' + L.q(acc.id) + '&created_at=gte.' + L.q(since) + '&select=id,created_at,channel,user_id,by_name,body&order=created_at.asc&limit=3000')).filter(m => /^(team|dm:)/.test(m.channel) && mine(m)).map(m => Object.assign(m, { scope: 'own' }));
        if (C.group) msgs = msgs.concat((await L.sb('GET', 'chat?account_id=eq.' + L.q(C.group.id) + '&created_at=gte.' + L.q(since) + '&select=id,created_at,channel,user_id,by_name,body&order=created_at.asc&limit=3000')).filter(m => /^(koncern|kdm:)/.test(m.channel) && mine(m)).map(m => Object.assign(m, { scope: 'k' })));
        return L.send(res, 200, { me: M.user.id, people: C.people, koncern: C.group ? C.group.name : null, msgs });
      }
      const text = String(b.text || '').trim().slice(0, 4000), ch = String(b.channel || '');
      if (!text) return L.send(res, 400, { error: 'text' });
      const k = b.scope === 'k';
      if (k && !C.group) return L.send(res, 403, { error: 'role' });
      const okCh = k ? (ch === 'koncern' || /^kdm:/.test(ch)) : (ch === 'team' || /^dm:/.test(ch));
      if (!okCh) return L.send(res, 400, { error: 'channel' });
      let other = null;
      if (/^k?dm:/.test(ch)) { const ids = ch.replace(/^k?dm:/, '').split('|'); if (ids.length !== 2 || !ids.includes(M.user.id)) return L.send(res, 403, { error: 'role' }); other = ids.find(x => x !== M.user.id) || M.user.id;
        if (!C.people.some(p => p.user_id === other && (k ? p.scope === 'k' : p.scope === 'own'))) return L.send(res, 403, { error: 'role' }); }
      await L.sb('POST', 'chat', { account_id: k ? C.group.id : acc.id, channel: ch, user_id: M.user.id, by_name: M.member.name || M.user.email, body: text }, 'return=minimal');
      if (other) { const op = C.people.find(p => p.user_id === other); try { await L.pushAccount({ id: op.account_id }, { id: 'chat', type: 'c', place: 'Meddelande', topic: M.member.name || M.user.email, message: text }, { test: true, user: other }, 'Meddelande från ' + (M.member.name || M.user.email)); } catch (e) {} }
      return L.send(res, 200, { ok: true });
    }

    if (a === 'alarm') {
      if (!ADMIN_ROLES.includes(role)) return L.send(res, 403, { error: 'role' });
      const r = await L.routeAlarm(acc, { id: 'test', urgent: true, type: 'c', rating: 1, sec_name: 'Test', place: 'Testlarm', topic: 'Test', message: 'Det här är ett testlarm från ScanSay. Allt fungerar.' }, { test: true, only: b.only || null });
      return L.send(res, 200, r);
    }

    if (a === 'invite') {
      const email = String(b.email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return L.send(res, 400, { error: 'format' });
      const rl = ['Gruppadmin', 'Handläggare', 'Medarbetare', 'Läsare'].includes(b.role) ? b.role : 'Handläggare';
      if (!canManage(role, rl)) return L.send(res, 403, { error: 'role' });
      if ((acc.kind || 'site') === 'group' && !['Gruppadmin', 'Läsare'].includes(rl)) return L.send(res, 400, { error: 'role' });
      if (!(await quotaOk(acc, rl))) return L.send(res, 402, { error: 'seats', role: rl, seats: acc.seats, roles: acc.roles || {} });
      const secs = rl === 'Medarbetare' && Array.isArray(b.secs) ? b.secs.map(x => String(x).slice(0, 80)).slice(0, 40) : [];
      const r = await invite(email, b.name, acc, rl, null, secs);
      return L.send(res, 200, r);
    }
    if (a === 'account_update' || a === 'child_update') {   // company name and contact details (owner/manager), or a daughter's (parent)
      if (!ADMIN_ROLES.includes(role)) return L.send(res, 403, { error: 'role' });
      let target = acc;
      if (a === 'child_update') { if ((acc.kind || 'site') !== 'group') return L.send(res, 403, { error: 'role' }); [target] = await L.sb('GET', 'accounts?id=eq.' + L.q(String(b.id || '')) + '&parent_id=eq.' + L.q(acc.id) + '&select=*'); if (!target) return L.send(res, 404, { error: 'notfound' }); }
      const p = {};
      if (b.name !== undefined) { const n = String(b.name).trim().slice(0, 120); if (n.length < 2) return L.send(res, 400, { error: 'name' }); p.name = n; }
      if (b.city !== undefined) p.city = String(b.city).trim().slice(0, 60) || null;
      if (b.org !== undefined) p.org = String(b.org).trim().slice(0, 20) || null;
      if (b.phone !== undefined) p.phone = String(b.phone).trim().slice(0, 30) || null;
      if (b.email !== undefined) { const e = String(b.email).trim().toLowerCase(); if (e && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e)) return L.send(res, 400, { error: 'format' }); p.email = e || null; }
      await L.sb('PATCH', 'accounts?id=eq.' + L.q(target.id), p, 'return=minimal');
      if (p.name) await L.sb('PATCH', 'codes?account_id=eq.' + L.q(target.id), { company: p.name }, 'return=minimal').catch(() => {});   // the QR form shows the new name
      return L.send(res, 200, { ok: true });
    }
    if (a === 'member') {   // change a colleague's role, sections or name
      const [tm] = await L.sb('GET', 'members?account_id=eq.' + L.q(acc.id) + '&user_id=eq.' + L.q(String(b.user_id || '')) + '&select=role');
      if (!tm) return L.send(res, 404, { error: 'nouser' });
      const onlyName = b.role === undefined && b.secs === undefined;
      if (!(b.user_id === M.user.id && onlyName) && !canManage(role, tm.role)) return L.send(res, 403, { error: 'role' });
      if (b.role !== undefined && !canManage(role, b.role)) return L.send(res, 403, { error: 'role' });
      if (b.user_id === M.user.id && !onlyName) return L.send(res, 400, { error: 'self' });
      const patch = {};
      if (b.role !== undefined) { if (!['Gruppadmin', 'Handläggare', 'Medarbetare', 'Läsare'].includes(b.role)) return L.send(res, 400, { error: 'role' }); if (!(await quotaOk(acc, b.role, String(b.user_id || '')))) return L.send(res, 402, { error: 'seats', role: b.role }); patch.role = b.role; }
      if (Array.isArray(b.secs)) patch.secs = b.secs.map(x => String(x).slice(0, 80)).slice(0, 40);
      if (b.name !== undefined) patch.name = String(b.name).trim().slice(0, 80) || null;
      await L.sb('PATCH', 'members?account_id=eq.' + L.q(acc.id) + '&user_id=eq.' + L.q(String(b.user_id || '')) + (onlyName ? '' : '&role=neq.' + L.q('Ägare')), patch, 'return=minimal');
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
      if (a === 'child_member_remove') { const uid = String(b.user_id || ''); await L.sb('DELETE', 'members?account_id=eq.' + L.q(k.id) + '&user_id=eq.' + L.q(uid), undefined, 'return=minimal'); await forget(k.id, uid); return L.send(res, 200, { ok: true }); }
      const email = String(b.email || '').trim().toLowerCase(), rl = ['Ägare', 'Gruppadmin', 'Handläggare', 'Medarbetare', 'Läsare'].includes(b.role) ? b.role : null;
      if (rl === 'Ägare') {   // new manager for the hotel: the old manager's login to this hotel is removed
        if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return L.send(res, 400, { error: 'format' });
        const old = await L.sb('GET', 'members?account_id=eq.' + L.q(k.id) + '&role=eq.' + L.q('Ägare') + '&select=user_id,email');
        const r = await invite(email, String(b.name || '').slice(0, 80) || null, k, 'Ägare');
        for (const o of old) if (o.user_id !== r.user_id) { await L.sb('DELETE', 'members?account_id=eq.' + L.q(k.id) + '&user_id=eq.' + L.q(o.user_id), undefined, 'return=minimal'); await forget(k.id, o.user_id); }
        await L.sb('PATCH', 'accounts?id=eq.' + L.q(k.id), { email }, 'return=minimal');
        return L.send(res, 200, r);
      }
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
      if (b.user_id === M.user.id) return L.send(res, 400, { error: 'self' });
      const uid = String(b.user_id || ''), [tm] = await L.sb('GET', 'members?account_id=eq.' + L.q(acc.id) + '&user_id=eq.' + L.q(uid) + '&select=role');
      if (!tm) return L.send(res, 404, { error: 'nouser' });
      if (!canManage(role, tm.role)) return L.send(res, 403, { error: 'role' });
      await L.sb('DELETE', 'members?account_id=eq.' + L.q(acc.id) + '&user_id=eq.' + L.q(uid) + '&role=neq.' + L.q('Ägare'), undefined, 'return=minimal');
      await forget(acc.id, uid);
      return L.send(res, 200, { ok: true });
    }
    return L.send(res, 400, { error: 'action' });
  } catch (e) { L.fail(res, e, req); }
};

/* who can be reached in the chat: everyone in the company; plus, for a parent company and its hotel managers, the koncern chat */
async function chatScope(M, acc, role) {
  const own = (await L.sb('GET', 'members?account_id=eq.' + L.q(acc.id) + '&select=user_id,name,email,role')).map(x => ({ user_id: x.user_id, name: x.name || x.email, role: x.role, scope: 'own', account_id: acc.id, company: acc.name }));
  let group = null;
  if ((acc.kind || 'site') === 'group') group = acc;
  else if (acc.parent_id && ADMIN_ROLES.includes(role)) { const [g] = await L.sb('GET', 'accounts?id=eq.' + L.q(acc.parent_id) + '&select=id,name'); group = g || null; }
  let people = group && group.id === acc.id ? [] : own;
  if (group) {
    const gm = (await L.sb('GET', 'members?account_id=eq.' + L.q(group.id) + '&select=user_id,name,email,role')).map(x => ({ user_id: x.user_id, name: x.name || x.email, role: x.role, scope: 'k', account_id: group.id, company: group.name }));
    const kids = await L.sb('GET', 'accounts?parent_id=eq.' + L.q(group.id) + '&select=id,name');
    const km = kids.length ? await L.sb('GET', 'members?account_id=in.(' + encodeURIComponent(kids.map(k => '"' + k.id + '"').join(',')) + ')&select=user_id,name,email,role,account_id') : [];
    people = people.concat(gm, km.filter(x => ADMIN_ROLES.includes(x.role)).map(x => ({ user_id: x.user_id, name: x.name || x.email, role: x.role, scope: 'k', account_id: x.account_id, company: (kids.find(k => k.id === x.account_id) || {}).name })));
  }
  return { people, group };
}
/* GDPR when someone leaves: their open tasks go back to the inbox, private chats with them are deleted and their name is removed from other chat messages */
async function forget(accId, uid) {
  const open = await L.sb('GET', 'feedback?account_id=eq.' + L.q(accId) + '&assigned_to=eq.' + L.q(uid) + '&select=id,status,replies');
  for (const f of open) await L.sb('PATCH', 'feedback?id=eq.' + L.q(f.id), { assigned_to: null, assigned_name: null, assigned_at: null, replies: (f.replies || []).concat({ txt: 'Personen som hade uppdraget finns inte längre i företaget. Skicka uppdraget till någon annan.', ts: Date.now(), by: 'ScanSay', internal: true }) }, 'return=minimal').catch(() => {});
  await L.sb('DELETE', 'chat?channel=like.' + encodeURIComponent('*' + uid + '*'), undefined, 'return=minimal').catch(() => {});
  await L.sb('PATCH', 'chat?user_id=eq.' + L.q(uid), { user_id: null, by_name: 'Tidigare användare' }, 'return=minimal').catch(() => {});
  await L.sb('DELETE', 'push_subs?account_id=eq.' + L.q(accId) + '&user_id=eq.' + L.q(uid), undefined, 'return=minimal').catch(() => {});
}

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
