/* Stripe helpers (no dependencies). STRIPE_SECRET_KEY must be set. */
const L = require('./_lib');
function form(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) { if (v === undefined || v === null) continue; const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') form(v, key, out); else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(v)); }
  return out.join('&');
}
async function stripe(method, path, body, idem) {
  const key = L.env('STRIPE_SECRET_KEY'); if (!key) throw Object.assign(new Error('STRIPE_SECRET_KEY saknas'), { status: 503 });
  const r = await fetch('https://api.stripe.com/v1' + path, { method, headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/x-www-form-urlencoded', ...(idem ? { 'Idempotency-Key': idem } : {}) }, body: body ? form(body) : undefined });
  const j = await r.json(); if (!r.ok) throw Object.assign(new Error((j.error && j.error.message) || 'Stripe'), { status: 502 }); return j;
}
async function vatRate() {
  const list = await stripe('GET', '/tax_rates?active=true&limit=100');
  const f = list.data.find(t => t.percentage === 25 && !t.inclusive && t.country === 'SE'); if (f) return f.id;
  return (await stripe('POST', '/tax_rates', { display_name: 'Moms', percentage: 25, inclusive: 'false', country: 'SE', jurisdiction: 'SE' })).id;
}
/* a = { accountId, company, email, org, plan, interval, price (SEK ex VAT), method:'stripe'|'invoice', places, invoiceDays } */
async function subscribe(a) {
  const customer = await stripe('POST', '/customers', { name: a.company, email: a.email, metadata: { scansay_account: a.accountId, org_nr: a.org || '' }, preferred_locales: { 0: 'sv' } }, 'cus-' + a.accountId);
  const product = await stripe('POST', '/products', { name: 'ScanSay ' + (a.plan || ''), metadata: { plan: a.plan || '' } }, 'prod-' + (a.plan || 'x'));
  const price = await stripe('POST', '/prices', { currency: 'sek', unit_amount: Math.round(a.price * 100), product: product.id, recurring: { interval: a.interval === 'year' ? 'year' : 'month' }, tax_behavior: 'exclusive' });
  const tax = await vatRate(), meta = { scansay_account: a.accountId, plan: a.plan || '', places: a.places || '' };
  if (a.method === 'stripe') {
    const s = await stripe('POST', '/checkout/sessions', { mode: 'subscription', customer: customer.id, line_items: { 0: { price: price.id, quantity: 1, tax_rates: { 0: tax } } }, subscription_data: { metadata: meta }, success_url: L.site() + '/#login', cancel_url: L.site() + '/', locale: 'sv' });
    return { customerId: customer.id, checkoutUrl: s.url, subscriptionId: null };
  }
  const sub = await stripe('POST', '/subscriptions', { customer: customer.id, items: { 0: { price: price.id } }, default_tax_rates: { 0: tax }, collection_method: 'send_invoice', days_until_due: a.invoiceDays || 30, metadata: meta }, 'sub-' + a.accountId);
  return { customerId: customer.id, subscriptionId: sub.id, checkoutUrl: null };
}
module.exports = { stripe, subscribe };
