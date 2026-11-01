/* POST /api/sign-link (admin only) { offer }  ->  { url }
   The offer is sealed with SIGN_SECRET so the customer cannot change price or terms. Valid 30 days. */
const { send, body, isAdmin, seal, env } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Använd POST' });
  if (!isAdmin(req)) return send(res, 401, { error: 'Fel admin-nyckel' });
  if (!env('SIGN_SECRET')) return send(res, 500, { error: 'SIGN_SECRET saknas' });
  const b = await body(req).catch(() => ({}));
  if (!b.offer || !b.offer.customer || !(b.offer.price >= 0)) return send(res, 400, { error: 'Offert saknas' });
  const tok = seal({ o: b.offer, exp: Date.now() + 30 * 864e5 });
  const base = env('SITE_URL') || ('https://' + req.headers.host);
  send(res, 200, { url: base.replace(/\/$/, '') + '/sign/?t=' + tok });
};
