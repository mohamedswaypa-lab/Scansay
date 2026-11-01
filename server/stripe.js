/*
 * ScanSay · Stripe billing (Node 18+, no dependencies)
 *
 * What it does
 *   POST /billing/subscribe   Admin approves an account → creates a Stripe customer + subscription.
 *                             method "stripe":  card, charged automatically and renewed every month/year.
 *                             method "invoice": Stripe sends an invoice (30 days) that you mark as paid
 *                                               yourself, or you skip Stripe and handle it in the admin.
 *   POST /billing/change      Change plan, price or interval on an existing subscription.
 *   POST /billing/cancel      Cancel at period end.
 *   POST /stripe/webhook      Stripe tells us what happened: paid, failed, cancelled.
 *
 * Environment
 *   STRIPE_SECRET_KEY=sk_live_...        (never in the browser)
 *   STRIPE_WEBHOOK_SECRET=whsec_...
 *   ADMIN_TOKEN=long-random-string       (the admin console sends this as a Bearer token)
 *   PORT=8788
 *
 * Run:  node server/stripe.js
 * In Stripe: Developers → Webhooks → add https://api.scansay.se/stripe/webhook with events
 *   invoice.paid, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted
 */
const http = require('http');
const crypto = require('crypto');

const KEY = process.env.STRIPE_SECRET_KEY || '';
const WH = process.env.STRIPE_WEBHOOK_SECRET || '';
const ADMIN = process.env.ADMIN_TOKEN || '';
const PORT = +process.env.PORT || 8788;

/* Replace with your database. Keyed by ScanSay account id. */
const DB = { accounts: new Map(), events: new Set() };

/* ---------- Stripe REST helper (form-encoded, like the official API) ---------- */
function form(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') form(v, key, out);
    else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(v));
  }
  return out.join('&');
}
async function stripe(method, path, body, idem) {
  const res = await fetch('https://api.stripe.com/v1' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(idem ? { 'Idempotency-Key': idem } : {}),
    },
    body: body ? form(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json.error?.message || 'Stripe error'), { status: res.status, stripe: json.error });
  return json;
}

/* ---------- business logic ---------- */
async function subscribe(a) {
  // a = { accountId, company, email, orgNr, plan, interval: 'month'|'year', price (SEK, ex VAT), method: 'stripe'|'invoice', places, agents:[], start }
  if (!['month', 'year'].includes(a.interval)) throw httpErr(400, 'interval must be month or year');
  if (!(a.price > 0)) throw httpErr(400, 'price required');
  const customer = await stripe('POST', '/customers', {
    name: a.company, email: a.email,
    metadata: { scansay_account: a.accountId, org_nr: a.orgNr || '', agents: (a.agents || []).join(',') },
    preferred_locales: { 0: 'sv' },
  }, 'cus-' + a.accountId);

  const product = await stripe('POST', '/products', { name: `ScanSay ${a.plan}`, metadata: { plan: a.plan } }, 'prod-' + a.plan);
  const price = await stripe('POST', '/prices', {
    currency: 'sek', unit_amount: Math.round(a.price * 100), product: product.id,
    recurring: { interval: a.interval },
    tax_behavior: 'exclusive',
    metadata: { places: a.places },
  });

  const base = {
    customer: customer.id,
    items: { 0: { price: price.id } },
    metadata: { scansay_account: a.accountId, plan: a.plan, places: a.places },
    automatic_tax: { enabled: false },
  };
  let sub, checkoutUrl = null;
  if (a.method === 'stripe') {
    // Card: send the customer a hosted Checkout link. After payment Stripe renews automatically.
    const session = await stripe('POST', '/checkout/sessions', {
      mode: 'subscription', customer: customer.id,
      line_items: { 0: { price: price.id, quantity: 1 } },
      subscription_data: { metadata: base.metadata },
      success_url: 'https://scansay.se/#login?paid=1', cancel_url: 'https://scansay.se/#packages',
      locale: 'sv',
    });
    checkoutUrl = session.url;
  } else {
    // Invoice: Stripe e-mails an invoice each period with 30 days to pay (bankgiro/card via hosted page).
    sub = await stripe('POST', '/subscriptions', { ...base, collection_method: 'send_invoice', days_until_due: 30 }, 'sub-' + a.accountId);
  }
  DB.accounts.set(a.accountId, { ...a, customerId: customer.id, subscriptionId: sub?.id || null, status: sub ? 'active' : 'pending_payment' });
  return { customerId: customer.id, subscriptionId: sub?.id || null, checkoutUrl };
}

async function change(accountId, { price, interval, plan, places }) {
  const acc = need(accountId);
  const sub = await stripe('GET', `/subscriptions/${acc.subscriptionId}`);
  const product = await stripe('POST', '/products', { name: `ScanSay ${plan || acc.plan}` }, 'prod-' + (plan || acc.plan));
  const p = await stripe('POST', '/prices', { currency: 'sek', unit_amount: Math.round((price || acc.price) * 100), product: product.id, recurring: { interval: interval || acc.interval } });
  await stripe('POST', `/subscriptions/${acc.subscriptionId}`, {
    items: { 0: { id: sub.items.data[0].id, price: p.id } },
    proration_behavior: 'create_prorations',
    metadata: { plan: plan || acc.plan, places: places || acc.places },
  });
  Object.assign(acc, { price: price || acc.price, interval: interval || acc.interval, plan: plan || acc.plan, places: places || acc.places });
  return { ok: true };
}

async function cancel(accountId) {
  const acc = need(accountId);
  await stripe('POST', `/subscriptions/${acc.subscriptionId}`, { cancel_at_period_end: 'true' });
  acc.status = 'canceling';
  return { ok: true };
}

/* ---------- webhooks ---------- */
function verify(raw, header) {
  // Stripe-Signature: t=timestamp,v1=signature
  const parts = Object.fromEntries(String(header || '').split(',').map(s => s.split('=')));
  if (!parts.t || !parts.v1) return false;
  if (Math.abs(Date.now() / 1000 - +parts.t) > 300) return false;
  const sig = crypto.createHmac('sha256', WH).update(parts.t + '.' + raw).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(parts.v1.padEnd(sig.length).slice(0, sig.length)));
}
function onEvent(ev) {
  if (DB.events.has(ev.id)) return; // idempotent
  DB.events.add(ev.id);
  const o = ev.data.object;
  const accId = o.metadata?.scansay_account || o.subscription_details?.metadata?.scansay_account;
  const acc = accId && DB.accounts.get(accId);
  switch (ev.type) {
    case 'checkout.session.completed':
      if (acc) { acc.subscriptionId = o.subscription; acc.status = 'active'; }
      break;
    case 'invoice.paid':
      if (acc) { acc.status = 'active'; acc.lastPaid = Date.now(); acc.renewsAt = o.lines?.data?.[0]?.period?.end * 1000; }
      log(accId, `Paid ${o.amount_paid / 100} kr · ${o.number}`);
      break;
    case 'invoice.payment_failed':
      if (acc) acc.status = 'past_due';
      log(accId, `Payment failed · ${o.number}. Stripe retries automatically.`);
      break;
    case 'customer.subscription.updated':
      if (acc) acc.status = o.cancel_at_period_end ? 'canceling' : o.status;
      break;
    case 'customer.subscription.deleted':
      if (acc) acc.status = 'canceled';
      break;
  }
}
function log(acc, msg) { console.log(new Date().toISOString(), acc || '-', msg); }

/* ---------- HTTP ---------- */
function httpErr(status, msg) { return Object.assign(new Error(msg), { status }); }
function need(id) { const a = DB.accounts.get(id); if (!a) throw httpErr(404, 'unknown account'); return a; }
function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://scansay.se', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' });
  res.end(JSON.stringify(obj));
}
http.createServer((req, res) => {
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 1e6) req.destroy(); });
  req.on('end', async () => {
    try {
      if (req.method === 'OPTIONS') return send(res, 204, {});
      if (req.url === '/stripe/webhook' && req.method === 'POST') {
        if (!verify(raw, req.headers['stripe-signature'])) return send(res, 400, { error: 'bad signature' });
        onEvent(JSON.parse(raw));
        return send(res, 200, { received: true });
      }
      const tok = (req.headers.authorization || '').replace(/^Bearer /, '');
      if (!ADMIN || tok.length !== ADMIN.length || !crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(ADMIN))) return send(res, 401, { error: 'unauthorized' });
      const body = raw ? JSON.parse(raw) : {};
      if (req.url === '/billing/subscribe' && req.method === 'POST') return send(res, 200, await subscribe(body));
      if (req.url === '/billing/change' && req.method === 'POST') return send(res, 200, await change(body.accountId, body));
      if (req.url === '/billing/cancel' && req.method === 'POST') return send(res, 200, await cancel(body.accountId));
      if (req.url === '/billing/accounts' && req.method === 'GET') return send(res, 200, [...DB.accounts.values()]);
      send(res, 404, { error: 'not found' });
    } catch (e) {
      send(res, e.status || 500, { error: e.message });
    }
  });
}).listen(PORT, () => console.log('ScanSay billing on :' + PORT + (KEY ? '' : ' (no STRIPE_SECRET_KEY set)')));

module.exports = { subscribe, change, cancel, verify, onEvent };
