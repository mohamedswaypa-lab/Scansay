/* Stripe webhook: https://<din-domän>/api/stripe
   Stripe → Developers → Webhooks → Add endpoint, events: checkout.session.completed, invoice.paid,
   invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted. */
const L = require('./_lib');
function verify(raw, header) {
  const parts = Object.fromEntries(String(header || '').split(',').map(s => s.split('=')));
  if (!parts.t || !parts.v1 || Math.abs(Date.now() / 1000 - +parts.t) > 300) return false;
  const sig = L.crypto.createHmac('sha256', L.env('STRIPE_WEBHOOK_SECRET')).update(parts.t + '.' + raw).digest('hex');
  return sig.length === parts.v1.length && L.crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(parts.v1));
}
module.exports = async (req, res) => {
  if (req.method !== 'POST') return L.send(res, 405, { error: 'method' });
  try {
    let raw = ''; for await (const c of req) raw += c;
    if (!raw && req.body) raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!verify(raw, req.headers['stripe-signature'])) { L.secLog('stripe_bad_signature', req); return L.send(res, 400, { error: 'signature' }); }
    const ev = JSON.parse(raw);
    const seen = await L.sb('GET', 'stripe_events?id=eq.' + L.q(ev.id) + '&select=id'); if (seen.length) return L.send(res, 200, { ok: true });
    await L.sb('POST', 'stripe_events', { id: ev.id }, 'return=minimal');
    const o = ev.data.object, accId = (o.metadata && o.metadata.scansay_account) || (o.subscription_details && o.subscription_details.metadata && o.subscription_details.metadata.scansay_account);
    if (!accId) return L.send(res, 200, { ok: true });
    const [acc] = await L.sb('GET', 'accounts?id=eq.' + L.q(accId) + '&select=id,billing,name'); if (!acc) return L.send(res, 200, { ok: true });
    const bl = Object.assign({}, acc.billing || {}), log = (bl.log || []).slice(-30);
    if (ev.type === 'checkout.session.completed') { bl.subscriptionId = o.subscription; bl.status = 'active'; log.push([Date.now(), 'Kortbetalning startad']); }
    if (ev.type === 'invoice.paid') { bl.status = 'active'; bl.lastPaid = Date.now(); log.push([Date.now(), 'Betald ' + (o.amount_paid / 100) + ' kr · ' + (o.number || '')]); }
    if (ev.type === 'invoice.payment_failed') { bl.status = 'past_due'; log.push([Date.now(), 'Betalning misslyckades · ' + (o.number || '')]); if (L.env('NOTIFY_EMAIL')) L.sendEmail({ to: L.env('NOTIFY_EMAIL'), subject: 'Betalning misslyckades: ' + acc.name, text: 'Stripe försöker igen automatiskt. Faktura ' + (o.number || '') }).catch(() => {}); }
    if (ev.type === 'customer.subscription.updated') bl.status = o.cancel_at_period_end ? 'canceling' : o.status;
    if (ev.type === 'customer.subscription.deleted') bl.status = 'canceled';
    bl.log = log;
    await L.sb('PATCH', 'accounts?id=eq.' + L.q(accId), { billing: bl }, 'return=minimal');
    return L.send(res, 200, { ok: true });
  } catch (e) { L.fail(res, e, req); }
};
