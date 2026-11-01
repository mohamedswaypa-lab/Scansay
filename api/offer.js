/* GET /api/offer?t=TOKEN  ->  { offer }  (verifies the seal so the signing page shows exactly what was sent) */
const { send, unseal } = require('./_lib');
module.exports = async (req, res) => {
  const t = new URL(req.url, 'http://x').searchParams.get('t');
  const s = unseal(t);
  if (!s) return send(res, 400, { error: 'Länken är ogiltig. Be ScanSay om en ny.' });
  if (s.exp < Date.now()) return send(res, 410, { error: 'Länken har gått ut. Be ScanSay om en ny.' });
  send(res, 200, { offer: s.o, exp: s.exp });
};
