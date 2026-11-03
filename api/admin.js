/* Admin console (Bearer ADMIN_TOKEN).
   GET  /api/admin?a=state                        → saved admin data, new applications, live accounts
   POST /api/admin?a=save     {doc}               → saves the admin's working data
   POST /api/admin?a=approve  {app_id, account}   → creates the company, invites the owner, starts billing
   POST /api/admin?a=account  {id, patch}         → change modules, lock/unlock, agents, plan, contact
   POST /api/admin?a=app      {id, status}        → application status
   POST /api/admin?a=delete   {id}                → deletes a company and all its data
   POST /api/admin?a=msg_send {account_id|account_ids, thread?, subject, text} → message to one or more companies (dashboard + email)
   POST /api/admin?a=msg_read {thread}            → marks a conversation as read */
const L = require('./_lib');
const { invite } = require('./app');
module.exports = async (req, res) => {
  if (!(await L.adminGate(req, res))) return;
  const a = (req.query && req.query.a) || new URL(req.url, 'http://x').searchParams.get('a');
  try {
    if (req.method === 'GET' && a === 'state') {
      const [st] = await L.sb('GET', 'admin_state?id=eq.1&select=doc');
      const apps = await L.sb('GET', 'applications?select=*&order=created_at.desc&limit=200');
      const accs = await L.sb('GET', 'accounts?select=id,name,org,ind,city,email,phone,plan,seats,places,mods,locked,billing,created_at,kind,parent_id,max_children,roles&order=created_at.desc');
      const mem = await L.sb('GET', 'members?select=account_id,user_id,role,name,email');
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const fb = await L.sb('GET', 'feedback?created_at=gte.' + L.q(since) + '&select=account_id,type,status');
      let offers = []; try { offers = await L.sb('GET', 'offers?select=id,app_id,version,status,note,reply,replied_at,created_at,data&order=created_at.desc&limit=1000'); } catch (e) { offers = null; }
      let messages = []; try { messages = await L.sb('GET', 'messages?select=*&order=created_at.asc&limit=3000'); } catch (e) { messages = null; }
      return L.send(res, 200, { doc: st ? st.doc : null, apps, accounts: accs, members: mem, fb30: fb, offers, messages });
    }
    if (req.method !== 'POST') return L.send(res, 405, { error: 'method' });
    const b = await L.body(req);
    if (a === 'save') { await L.sb('POST', 'admin_state?on_conflict=id', { id: 1, doc: b.doc || {}, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=minimal'); return L.send(res, 200, { ok: true }); }
    if (a === 'approve') {
      const x = b.account || {};
      if (!x.name || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(x.email || '')) return L.send(res, 400, { error: 'Företagsnamn och e-post krävs' });
      const [acc] = await L.sb('POST', 'accounts', { name: x.name, org: x.org || null, ind: x.ind || 'hotel', city: x.city || null, email: x.email, phone: x.phone || null, plan: x.plan || null, seats: Math.max(1, +x.seats || 3), places: +x.places || null, roles: L.cleanRoles(x.roles), kind: x.kind === 'group' ? 'group' : 'site', max_children: x.kind === 'group' ? Math.max(0, Math.min(500, parseInt(x.max_children) || 0)) : 0,
        mods: { staff: !!(x.mods && x.mods.staff), ai: !(x.mods && x.mods.ai === false) }, billing: x.billing || {}, state: { channels: [{ id: 'email', n: 'E-post', on: true, to: 'Ägaren' }, { id: 'sms', n: 'SMS', on: false, to: 'Den som har skift' }, { id: 'teams', n: 'Microsoft Teams', on: false, to: 'Kanal' }, { id: 'slack', n: 'Slack', on: false, to: 'Kanal' }, { id: 'hook', n: 'Webhook till eget system', on: false, to: 'Eget system' }], chcfg: { email: { v: x.email, to: 'Ägaren', lv: 'low' } }, urgent: { on: true } } });
      const b0 = x.billing || {};
      const inv = await invite(x.email, x.contact, acc, 'Ägare', { plan: x.plan, price: b0.price, interval: b0.interval, method: b0.method, invoiceDays: b0.invoiceDays, vat: 25, places: x.places, unit: x.unit, agents: x.seats, start: b0.start || Date.now(), termMonths: b0.termMonths, autoRenew: b0.autoRenew, staff: !!(x.mods && x.mods.staff), ai: !(x.mods && x.mods.ai === false) });
      let pay = null;
      if (x.billing && x.billing.useStripe && L.env('STRIPE_SECRET_KEY')) {
        try { pay = await require('./_stripe').subscribe({ accountId: acc.id, company: acc.name, email: acc.email, org: acc.org, plan: x.plan, interval: x.billing.interval, price: x.billing.price, method: x.billing.method, places: x.places, invoiceDays: x.billing.invoiceDays });
          await L.sb('PATCH', 'accounts?id=eq.' + L.q(acc.id), { billing: Object.assign({}, x.billing, { customerId: pay.customerId, subscriptionId: pay.subscriptionId, status: pay.checkoutUrl ? 'pending_payment' : 'active' }) }, 'return=minimal');
          if (pay.checkoutUrl) await L.sendEmail({ to: acc.email, subject: 'Betala och starta ScanSay', text: 'Starta betalningen här: ' + pay.checkoutUrl, html: L.mailHtml('Starta er prenumeration', '<p>Tryck på knappen för att lägga in kortet. Betalningen förnyas automatiskt enligt avtalet. Kvitto skickas till den här adressen.</p>', ['Betala med kort', pay.checkoutUrl]) });
        } catch (e) { pay = { error: e.message }; }
      }
      if (b.app_id) await L.sb('PATCH', 'applications?id=eq.' + L.q(b.app_id), { status: 'approved' }, 'return=minimal').catch(() => {});
      return L.send(res, 200, { ok: true, account_id: acc.id, invited: inv.ok, pay });
    }
    if (a === 'account') {
      const p = b.patch || {}, allow = {};
      ['name', 'org', 'city', 'email', 'phone', 'plan', 'seats', 'places', 'mods', 'locked', 'billing', 'ind'].forEach(k => { if (p[k] !== undefined) allow[k] = p[k]; });
      if (p.roles !== undefined) { allow.roles = L.cleanRoles(p.roles); allow.seats = Math.max(1, 1 + Object.values(allow.roles).reduce((x, y) => x + y, 0)); }
      if (p.kind !== undefined) allow.kind = p.kind === 'group' ? 'group' : 'site';
      if (p.max_children !== undefined) allow.max_children = Math.max(0, Math.min(500, parseInt(p.max_children) || 0));
      if (p.parent_id !== undefined) {
        if (!p.parent_id) allow.parent_id = null;
        else { const [pa] = await L.sb('GET', 'accounts?id=eq.' + L.q(String(p.parent_id)) + '&kind=eq.group&select=id'); if (!pa || pa.id === b.id) return L.send(res, 400, { error: 'Moderbolaget finns inte' }); allow.parent_id = pa.id; }
      }
      await L.sb('PATCH', 'accounts?id=eq.' + L.q(String(b.id || '')), allow, 'return=minimal');
      return L.send(res, 200, { ok: true });
    }

    if (a === 'msg_send') {
      const ids = [].concat(b.account_ids || b.account_id || []).map(String).filter(x => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 500);
      const text = String(b.text || '').trim().slice(0, 5000), subject = String(b.subject || 'Meddelande från ScanSay').trim().slice(0, 160);
      if (!ids.length || !text) return L.send(res, 400, { error: 'Mottagare och text krävs' });
      let sent = 0;
      for (const id of ids) {
        const [acc] = await L.sb('GET', 'accounts?id=eq.' + L.q(id) + '&select=id,name,email'); if (!acc) continue;
        const thread = ids.length === 1 && b.thread && /^[0-9a-f-]{36}$/i.test(b.thread) ? b.thread : L.crypto.randomUUID();
        await L.sb('POST', 'messages', { account_id: acc.id, thread, subject, sender: 'admin', by_name: 'ScanSay', body: text, read_admin: true }, 'return=minimal');
        const mgr = await L.sb('GET', 'members?account_id=eq.' + L.q(acc.id) + '&role=in.(' + encodeURIComponent('"Ägare","Gruppadmin"') + ')&select=email');
        const to = [...new Set(mgr.map(m => m.email).concat(acc.email || []).filter(Boolean))];
        if (to.length) await L.sendEmail({ to, subject: subject + ' · ScanSay', text: text + '\n\nSvara i översikten: ' + L.site() + '/app/#msgs',
          html: L.mailHtml(L.escH(subject), `<p style="white-space:pre-wrap">${L.escH(text)}</p><p style="color:#6B7280;font-size:13px">Meddelandet finns också under <b>Meddelanden</b> i er översikt, där ni kan svara.</p>`, ['Svara i översikten', L.site() + '/app/#msgs'], { preheader: text.slice(0, 90) }) }).catch(e => console.error('msg mail', e.message));
        sent++;
      }
      return L.send(res, 200, { ok: true, sent });
    }
    if (a === 'msg_read') { await L.sb('PATCH', 'messages?thread=eq.' + L.q(String(b.thread || '')), { read_admin: true }, 'return=minimal'); return L.send(res, 200, { ok: true }); }
    if (a === 'offer_send') {
      const o = b.offer || {}; if (!o.customer || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(o.customer.email || '')) return L.send(res, 400, { error: 'Kundens e-post saknas i offerten' });
      if (!(+o.price > 0)) return L.send(res, 400, { error: 'Pris saknas' });
      let appId = b.app_id && /^[0-9a-f-]{36}$/i.test(b.app_id) ? b.app_id : null;
      if (!appId) { const [ap] = await L.sb('POST', 'applications', { data: { company: o.customer.name, email: o.customer.email, name: o.customer.contact, phone: o.customer.phone, created_by: 'admin' }, status: 'new' }); appId = ap.id; }
      const prev = await L.sb('GET', 'offers?app_id=eq.' + L.q(appId) + '&select=id,status,version&order=version.desc');
      const open = prev.filter(x => x.status === 'sent' || x.status === 'changes').map(x => '"' + x.id + '"');
      if (open.length) await L.sb('PATCH', 'offers?id=in.(' + encodeURIComponent(open.join(',')) + ')', { status: 'superseded' }, 'return=minimal');
      const version = (prev[0] ? prev[0].version : 0) + 1;
      o.no = 'OFF-' + appId.slice(0, 6).toUpperCase() + '-' + version; o.date = Date.now();
      const [row] = await L.sb('POST', 'offers', { app_id: appId, version, data: o, note: String(b.note || '').slice(0, 2000) || null });
      const url = L.site() + '/sign/?t=' + encodeURIComponent(L.seal({ oid: row.id, exp: Date.now() + 30 * 864e5 }));
      await L.sb('PATCH', 'applications?id=eq.' + L.q(appId), { status: 'offer_sent' }, 'return=minimal');
      await L.sendEmail({ to: o.customer.email, replyTo: L.env('NOTIFY_EMAIL') || undefined, subject: (version > 1 ? 'Uppdaterad offert' : 'Offert') + ' från ScanSay · ' + o.customer.name, text: 'Hej! Här är ' + (version > 1 ? 'den uppdaterade ' : '') + 'offerten för ' + o.customer.name + ': ' + url + '\nNi kan signera direkt eller be om ändringar via länken. Länken gäller i 30 dagar.',
        html: await L.offerMail(o, url, b.note, version) });
      return L.send(res, 200, { ok: true, url, offer_id: row.id, version, app_id: appId });
    }
    if (a === 'info_request') {
      const [ap] = await L.sb('GET', 'applications?id=eq.' + L.q(String(b.app_id || '')) + '&select=*'); if (!ap) return L.send(res, 404, { error: 'notfound' });
      const to = (ap.data || {}).email, msg = String(b.message || '').slice(0, 4000); if (!to || msg.length < 5) return L.send(res, 400, { error: 'Meddelande eller e-post saknas' });
      await L.sendEmail({ to, replyTo: L.env('NOTIFY_EMAIL') || undefined, subject: b.subject || 'Några frågor om er registrering hos ScanSay', text: msg, html: await L.brandMail('Några frågor innan vi skickar offerten', '<p style="white-space:pre-wrap">' + L.escH(msg) + '</p><p>Svara gärna direkt på det här mejlet.</p>') });
      await L.sb('PATCH', 'applications?id=eq.' + L.q(ap.id), { status: 'info' }, 'return=minimal');
      return L.send(res, 200, { ok: true });
    }
    if (a === 'app') { await L.sb('PATCH', 'applications?id=eq.' + L.q(String(b.id || '')), { status: String(b.status || 'new') }, 'return=minimal'); return L.send(res, 200, { ok: true }); }
    if (a === 'delete') {
      const id = String(b.id || ''); const mem = await L.sb('GET', 'members?account_id=eq.' + L.q(id) + '&select=user_id');
      await L.sb('DELETE', 'accounts?id=eq.' + L.q(id), undefined, 'return=minimal');
      for (const m of mem) { const other = await L.sb('GET', 'members?user_id=eq.' + L.q(m.user_id) + '&select=account_id'); if (!other.length) await L.authApi('DELETE', 'admin/users/' + m.user_id); }
      return L.send(res, 200, { ok: true });
    }
    return L.send(res, 400, { error: 'action' });
  } catch (e) { L.fail(res, e, req); }
};
