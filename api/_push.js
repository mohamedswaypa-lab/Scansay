/* Web Push without extra packages (RFC 8291 aes128gcm + RFC 8292 VAPID).
   Keys: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (base64url) if set in Vercel,
   otherwise a stable key pair is derived from SIGN_SECRET, so nothing extra has to be configured. */
const crypto = require('crypto');
const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const env = k => String(process.env[k] || '').trim().replace(/^["']|["']$/g, '');
const N = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');

let KEYS = null;
function keys() {
  if (KEYS) return KEYS;
  let d;
  if (env('VAPID_PRIVATE_KEY')) d = unb64u(env('VAPID_PRIVATE_KEY'));
  else {
    const seed = env('SIGN_SECRET') || env('OTP_SECRET');
    if (!seed) throw new Error('Push needs SIGN_SECRET or VAPID_PRIVATE_KEY');
    for (let i = 0; ; i++) { d = crypto.createHmac('sha256', seed).update('scansay-vapid-' + i).digest(); const v = BigInt('0x' + d.toString('hex')); if (v > 0n && v < N) break; }
  }
  const ec = crypto.createECDH('prime256v1'); ec.setPrivateKey(d); const pub = ec.getPublicKey();
  const key = crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: b64u(d), x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: 'jwk' });
  return (KEYS = { pub, pubB64: b64u(pub), key });
}
const publicKey = () => keys().pubB64;

function vapid(endpoint) {
  const K = keys(), aud = new URL(endpoint).origin;
  const h = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const p = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env('VAPID_SUBJECT') || 'mailto:hello@scansay.se' }));
  const sig = crypto.sign('sha256', Buffer.from(h + '.' + p), { key: K.key, dsaEncoding: 'ieee-p1363' });
  return 'vapid t=' + h + '.' + p + '.' + b64u(sig) + ', k=' + K.pubB64;
}

function encrypt(sub, payload) {
  const uaPub = unb64u(sub.p256dh), authSecret = unb64u(sub.auth);
  const as = crypto.createECDH('prime256v1'); as.generateKeys(); const asPub = as.getPublicKey();
  const shared = as.computeSecret(uaPub);
  const hm = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
  const prkKey = hm(authSecret, shared);
  const ikm = hm(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub, Buffer.from([1])]));
  const salt = crypto.randomBytes(16), prk = hm(salt, ikm);
  const cek = hm(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = hm(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, ct]);
}

/* sub = {endpoint, p256dh, auth}; msg = {title, body, url, tag, urgent}
   → {ok} or {gone:true} when the phone has turned notifications off (delete the row) */
async function sendPush(sub, msg) {
  if (!/^https:\/\//.test(sub.endpoint)) return { ok: false, gone: true };
  const r = await fetch(sub.endpoint, { method: 'POST', headers: { Authorization: vapid(sub.endpoint), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String(msg.urgent ? 3600 : 24 * 3600), Urgency: msg.urgent ? 'high' : 'normal' }, body: encrypt(sub, JSON.stringify(msg).slice(0, 3000)) });
  return { ok: r.ok, gone: r.status === 404 || r.status === 410, status: r.status };
}

module.exports = { publicKey, sendPush, encrypt, b64u, unb64u };
