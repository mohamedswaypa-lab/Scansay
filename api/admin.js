/* Admin console (Bearer ADMIN_TOKEN).
   GET  /api/admin?a=state                        → saved admin data, new applications, live accounts
   POST /api/admin?a=save     {doc}               → saves the admin's working data
   POST /api/admin?a=approve  {app_id, account}   → creates the company, invites the owner, starts billing
   POST /api/admin?a=account  {id, patch}         → change modules, lock/unlock, agents, plan, contact
   POST /api/admin?a=app      {id, status}        → application status
   POST /api/admin?a=delete   {id}                → deletes a company and all its data */
const L = require('./_lib');
const { invite } = require('./app');
module.exports = async (req, res) => {
  if (!L.isAdmin(req)) return L.send(res, 401, { error: 'auth' });
  const a = (req.query && req.query.a) || new URL(req.url, 'http://x').searchParams.get('a');
  try {
    if (req.method === 'GET' && a === 'state') {
      const [st] = await L.sb('GET', 'admin_state?id=eq.1&select=doc');
      const apps = await L.sb('GET', 'applications?select=*&order=created_at.desc&limit=200');
      const accs = await L.sb('GET', 'accounts?select=id,name,org,ind,city,email,phone,plan,seats,places,mods,locked,billing,created_at&order=created_at.desc');
      const mem = await L.sb('GET', 'members?select=account_id,user_id,role,name,email');
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const fb = await L.sb('GET', 'feedback?created_at=gte.' + L.q(since) + '&select=account_id,type,status');
      return L.send(res, 200, { doc: st ? st.doc : null, apps, accounts: accs, members: mem, fb30: fb });
    }
    if (req.method !== 'POST') return L.send(res, 405, { error: 'method' });
    const b = await L.body(req);
    if (a === 'save') { await L.sb('POST', 'admin_state?on_conflict=id', { id: 1, doc: b.doc || {}, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=minimal'); return L.send(res, 200, { ok: true }); }
    if (a === 'approve') {
      const x = b.account || {};
      if (!x.name || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(x.email || '')) return L.send(res, 400, { error: 'Företagsnamn och e-post krävs' });
      const [acc] = await L.sb('POST', 'accounts', { name: x.name, org: x.org || null, ind: x.ind || 'hotel', city: x.city || null, email: x.email, phone: x.phone || null, plan: x.plan || null, seats: Math.max(1, +x.seats || 3), places: +x.places || null,
        mods: { staff: !!(x.mods && x.mods.staff), ai: !(x.mods && x.mods.ai === false) }, billing: x.billing || {}, state: { channels: [{ id: 'email', n: 'E-post', on: true, to: 'Ägaren' }, { id: 'sms', n: 'SMS', on: false, to: 'Den som har skift' }, { id: 'teams', n: 'Microsoft Teams', on: false, to: 'Kanal' }, { id: 'slack', n: 'Slack', on: false, to: 'Kanal' }, { id: 'hook', n: 'Webhook till eget system', on: false, to: 'Eget system' }], chcfg: { email: { v: x.email, to: 'Ägaren', lv: 'low' } }, urgent: { on: true } } });
      const inv = await invite(x.email, x.contact, acc, 'Ägare');
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
      await L.sb('PATCH', 'accounts?id=eq.' + L.q(String(b.id || '')), allow, 'return=minimal');
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
  } catch (e) { L.fail(res, e); }
};
