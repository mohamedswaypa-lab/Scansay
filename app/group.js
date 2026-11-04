/* ScanSay · parent company views, drawn inside the normal dashboard (same header, menu and cards).
   Numbers for every daughter company – never the guests' messages or contact details. The parent creates
   daughter companies and gives people roles in them, within the numbers in the package. */
(function () {
  var D = SSLIVE.data, KIDS = D.children || [], GPER = 30, SORT = 'n';
  var fmt = function (n) { return Math.round(n).toLocaleString('sv-SE'); };
  var IND = { hotel: 'Hotell', restaurant: 'Restaurang', cafe: 'Kafé', gym: 'Gym', taxi: 'Taxi', bus: 'Buss', shop: 'Butik', office: 'Kontor' };
  var RN = { 'Gruppadmin': 'Chef', 'Handläggare': 'Handläggare', 'Medarbetare': 'Medarbetare', 'Läsare': 'Läsare', 'Ägare': 'Ägare' };
  var full = SSLIVE.full;
  function dur(ms) { if (ms == null) return '–'; var h = ms / 36e5; return h < 1 ? Math.max(1, Math.round(ms / 6e4)) + ' min' : h < 48 ? (Math.round(h * 10) / 10).toString().replace('.', ',') + ' tim' : Math.round(h / 24) + ' dagar'; }
  function med(a) { if (!a.length) return null; a = a.slice().sort(function (x, y) { return x - y; }); var m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
  function stats(rows) {
    var r = rows.filter(function (f) { return f.rating; }), c = rows.filter(function (f) { return f.type === 'c'; }), fixed = c.filter(function (f) { return f.status === 'fix'; });
    var tp = {}; c.forEach(function (f) { if (f.topic) tp[f.topic] = (tp[f.topic] || 0) + 1; });
    return { n: rows.length, avg: r.length ? r.reduce(function (s, f) { return s + f.rating; }, 0) / r.length : null, sat: r.length ? Math.round(r.filter(function (f) { return f.rating >= 4; }).length / r.length * 100) : null,
      c: c.length, praise: rows.filter(function (f) { return f.type === 'p'; }).length, res: c.length ? Math.round(fixed.length / c.length * 100) : null,
      med: med(fixed.map(function (f) { return f.fix; }).filter(function (x) { return x != null && x >= 0; })), urg: rows.filter(function (f) { return f.urgent; }).length,
      rev: rows.filter(function (f) { return f.rev; }).length, revc: rows.filter(function (f) { return f.revc; }).length, top: Object.keys(tp).sort(function (a, b) { return tp[b] - tp[a]; })[0] || '–' };
  }
  var now = Date.now();
  function inPer(f, back) { return f.ts > now - (back + 1) * GPER * 864e5 && f.ts <= now - back * GPER * 864e5; }
  function quotaLeft(k, role) { var q = D.account.roles || {}; if (!(role in q)) return null; return (q[role] || 0) - (k.members || []).filter(function (m) { return m.role === role; }).length; }

  function overview() {
    var hello = '<div class="hello"><div><small class="hg">' + greet() + '</small><h1>Koncernöversikt</h1><div class="sub">' + esc(D.account.name) + ' · ' + KIDS.length + ' dotterbolag · bara siffror, inga meddelanden</div></div>' +
      '<div class="seg">' + [[7, '7 dagar'], [30, '30 dagar'], [90, '90 dagar'], [365, '12 mån']].map(function (x) { return '<button class="' + (GPER === x[0] ? 'on' : '') + '" onclick="GV.per(' + x[0] + ')">' + x[1] + '</button>'; }).join('') + '</div></div>';
    if (!KIDS.length) return hello + '<div class="note info" style="margin-bottom:14px">Lägg till ert första hotell och dess chef under Hotell och chefer. Statistiken visas på den här sidan så fort gästerna börjar skriva.</div>' + kids();
    var all = [], prev = [];
    var rows = KIDS.map(function (k) { var cur = k.fb.filter(function (f) { return inPer(f, 0); }), pv = k.fb.filter(function (f) { return inPer(f, 1); }); all = all.concat(cur); prev = prev.concat(pv); return { k: k, s: stats(cur), p: stats(pv) }; });
    var S0 = stats(all), P0 = stats(prev);
    var dl = function (a, b, unit, inv) { if (a == null || b == null || !b && !a) return '<em class="sub">föregående period: –</em>'; var d = a - b; var good = inv ? d <= 0 : d >= 0; return '<em class="' + (good ? 'up' : 'dn') + '">' + (d >= 0 ? '▲ ' : '▼ ') + Math.abs(Math.round(d)) + unit + ' mot förra perioden</em>'; };
    var W = 12, wk = []; for (var i = W - 1; i >= 0; i--) { var a = now - (i + 1) * 7 * 864e5, b = now - i * 7 * 864e5, c = 0; KIDS.forEach(function (k) { k.fb.forEach(function (f) { if (f.ts > a && f.ts <= b) c++; }); }); wk.push(c); }
    var kpi = function (ki, l, v, extra) { return '<div class="card kpi">' + KI[ki] + '<small>' + l + '</small><b>' + v + '</b>' + extra + '</div>'; };
    var sortKey = { n: function (r) { return -r.s.n; }, sat: function (r) { return -(r.s.sat || 0); }, res: function (r) { return -(r.s.res || 0); }, med: function (r) { return r.s.med == null ? 1e15 : r.s.med; } }[SORT];
    rows.sort(function (a, b) { return sortKey(a) - sortKey(b); });
    var mx = Math.max(1, Math.max.apply(null, rows.map(function (r) { return r.s.n; })));
    return hello +
      '<div class="grid g5" style="margin-bottom:14px">' +
        kpi(4, 'Meddelanden', fmt(S0.n), dl(S0.n, P0.n, '') + spark(wk, '#2563EB')) +
        kpi(1, 'Nöjda gäster', S0.sat == null ? '–' : S0.sat + ' %', '<em class="sub">betyg 4–5' + (S0.avg ? ' · snitt ' + S0.avg.toFixed(1).replace('.', ',') : '') + '</em><div class="kbar g"><i style="width:' + (S0.sat || 0) + '%"></i></div>') +
        kpi(3, 'Lösta klagomål', S0.res == null ? '–' : S0.res + ' %', '<em class="sub">av ' + fmt(S0.c) + ' klagomål</em><div class="kbar"><i style="width:' + (S0.res || 0) + '%"></i></div>') +
        kpi(2, 'Tid till löst', dur(S0.med), '<em class="sub">median</em>') +
        kpi(0, 'Akuta larm', fmt(S0.urg), dl(S0.urg, P0.urg, '', true)) + '</div>' +
      '<div class="grid g2" style="margin-bottom:14px"><div class="card"><h2>Mest meddelanden</h2>' + rows.slice().sort(function (a, b) { return b.s.n - a.s.n; }).slice(0, 8).map(function (r) { return '<div class="row" style="gap:10px;margin:8px 0"><span style="width:38%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.k.name) + '</span><div class="kbar" style="flex:1;margin:0"><i style="width:' + Math.max(2, r.s.n / mx * 100) + '%"></i></div><b style="width:40px;text-align:right">' + fmt(r.s.n) + '</b></div>'; }).join('') + '</div>' +
        '<div class="card"><h2>Recensioner och beröm</h2><div class="grid g2" style="gap:10px"><div><b style="font-size:26px">' + fmt(S0.rev) + '</b><div class="sub">inbjudningar att recensera</div></div><div><b style="font-size:26px">' + fmt(S0.revc) + '</b><div class="sub">klickade vidare till Google/Tripadvisor</div></div><div><b style="font-size:26px">' + fmt(S0.praise) + '</b><div class="sub">beröm från gäster</div></div><div><b style="font-size:26px">' + fmt(S0.c) + '</b><div class="sub">klagomål</div></div></div></div></div>' +
      analysis(all) +
      '<div class="card" style="overflow-x:auto"><div class="row between" style="margin-bottom:8px"><h2 style="margin:0">Jämförelse mellan hotellen</h2><div class="seg">' + [['n', 'Flest meddelanden'], ['sat', 'Nöjdast'], ['res', 'Flest lösta'], ['med', 'Snabbast']].map(function (x) { return '<button class="' + (SORT === x[0] ? 'on' : '') + '" onclick="GV.sort(\'' + x[0] + '\')">' + x[1] + '</button>'; }).join('') + '</div></div>' +
      '<table><thead><tr><th>Hotell</th><th>Meddelanden</th><th>Nöjda</th><th>Snittbetyg</th><th>Klagomål</th><th>Lösta</th><th>Tid till löst</th><th>Akuta</th><th>Vanligaste ämne</th></tr></thead><tbody>' +
      rows.map(function (r) { var s = r.s; return '<tr><td><b>' + esc(r.k.name) + '</b><div class="sub">' + esc([IND[r.k.ind] || r.k.ind, r.k.city].filter(Boolean).join(' · ')) + '</div></td><td>' + fmt(s.n) + '</td><td>' + (s.sat == null ? '–' : '<span class="tag ' + (s.sat >= 80 ? 't-fix' : s.sat >= 60 ? 't-prog' : 't-new') + '">' + s.sat + ' %</span>') + '</td><td>' + (s.avg ? s.avg.toFixed(1).replace('.', ',') : '–') + '</td><td>' + fmt(s.c) + '</td><td>' + (s.res == null ? '–' : s.res + ' %') + '</td><td>' + dur(s.med) + '</td><td>' + (s.urg ? '<b style="color:#B91C1C">' + s.urg + '</b>' : '0') + '</td><td>' + esc(s.top) + '</td></tr>'; }).join('') +
      '</tbody></table><div class="sub" style="margin-top:8px">Nöjda = andel betyg 4–5 av 5. Tid till löst = median från meddelande till att ärendet markerades som löst.</div></div>';
  }

  var PAL = ['#1D4ED8', '#65A30D', '#EA580C', '#7C3AED', '#0D9488', '#DB2777', '#B45309', '#0EA5E9'];
  function analysis(all) {
    // weekly messages per daughter (lines), topics, departments and kinds of message
    var W = 12, w0 = now - W * 7 * 864e5, cw = 640, ch = 190, st = cw / (W - 1);
    var series = KIDS.slice(0, 8).map(function (k, ix) { var v = []; for (var i = 0; i < W; i++) { var a = w0 + i * 7 * 864e5, b = a + 7 * 864e5; v.push(k.fb.filter(function (f) { return f.ts > a && f.ts <= b; }).length); } return { k: k, v: v, c: PAL[ix % PAL.length] }; });
    var mx = Math.max(1, Math.max.apply(null, series.map(function (x) { return Math.max.apply(null, x.v); })));
    var grid = (mx >= 4 ? [0, .5, 1] : [0, 1]).map(function (g) { var y = 10 + (ch - 30) * (1 - g); return '<line x1="0" x2="' + cw + '" y1="' + y + '" y2="' + y + '" stroke="#EEF1F6"/><text x="0" y="' + (y - 3) + '" font-size="10" fill="#9CA3AF">' + Math.round(mx * g) + '</text>'; }).join('');
    var lines = series.map(function (x) { return '<polyline fill="none" stroke="' + x.c + '" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" points="' + x.v.map(function (n, i) { return (i * st).toFixed(1) + ',' + (10 + (ch - 30) * (1 - n / mx)).toFixed(1); }).join(' ') + '"/>'; }).join('');
    var legend = series.map(function (x) { return '<span style="display:inline-flex;align-items:center;gap:5px;margin-right:12px;font-size:12.5px"><i style="width:10px;height:10px;border-radius:3px;background:' + x.c + '"></i>' + esc(x.k.name) + '</span>'; }).join('');
    var tp = {}, sc = {}; all.forEach(function (f) { if (f.type === 'c' && f.topic) tp[f.topic] = (tp[f.topic] || 0) + 1; if (f.sec) { var o = sc[f.sec] = sc[f.sec] || { n: 0, r: 0, rn: 0, c: 0 }; o.n++; if (f.rating) { o.r += f.rating; o.rn++; } if (f.type === 'c') o.c++; } });
    var tops = Object.keys(tp).sort(function (a, b) { return tp[b] - tp[a]; }).slice(0, 7), tmx = Math.max(1, tp[tops[0]] || 1);
    var secs = Object.keys(sc).sort(function (a, b) { return sc[b].n - sc[a].n; }).slice(0, 7);
    var kinds = [['c', 'Klagomål', '#DC2626'], ['p', 'Beröm', '#65A30D'], ['q', 'Frågor', '#7C3AED'], ['i', 'Idéer', '#0EA5E9']].map(function (k) { return [k[1], all.filter(function (f) { return f.type === k[0]; }).length, k[2]]; }), kt = Math.max(1, kinds.reduce(function (a, k) { return a + k[1]; }, 0));
    return '<div class="grid g2" style="margin-bottom:14px"><div class="card"><h2>Utveckling per hotell</h2><div class="sub" style="margin-bottom:6px">Meddelanden per vecka, 12 veckor</div><svg viewBox="-2 0 ' + (cw + 4) + ' ' + ch + '" width="100%" role="img" aria-label="Meddelanden per vecka per dotterbolag">' + grid + lines + '</svg><div style="margin-top:6px">' + legend + '</div></div>' +
      '<div class="card"><h2>Vad gästerna skriver om</h2><div style="display:flex;height:14px;border-radius:8px;overflow:hidden;margin:6px 0 6px">' + kinds.map(function (k) { return k[1] ? '<i title="' + k[0] + '" style="width:' + (k[1] / kt * 100) + '%;background:' + k[2] + '"></i>' : ''; }).join('') + '</div><div class="sub" style="margin-bottom:10px">' + kinds.map(function (k) { return '<span style="margin-right:12px"><i style="display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;background:' + k[2] + '"></i>' + k[0] + ' ' + fmt(k[1]) + '</span>'; }).join('') + '</div>' +
        '<b style="font-size:13px">Vanligaste ämnen i klagomålen</b>' + (tops.map(function (t, i) { return '<div class="row" style="gap:10px;margin:6px 0"><span style="width:38%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(t) + '</span><div class="kbar" style="flex:1;margin:0"><i style="width:' + Math.max(3, tp[t] / tmx * 100) + '%;background:' + PAL[i % PAL.length] + '"></i></div><b style="width:34px;text-align:right">' + tp[t] + '</b></div>'; }).join('') || '<div class="sub">Inga klagomål i perioden.</div>') + '</div></div>' +
      '<div class="card" style="margin-bottom:14px;overflow-x:auto"><h2>Avdelningar i hela koncernen</h2><table><thead><tr><th>Avdelning</th><th>Meddelanden</th><th>Snittbetyg</th><th>Klagomål</th></tr></thead><tbody>' + (secs.map(function (k) { var o = sc[k], av = o.rn ? o.r / o.rn : null; return '<tr><td><b>' + esc(k) + '</b></td><td>' + fmt(o.n) + '</td><td>' + (av ? '<span class="tag ' + (av >= 4 ? 't-fix' : av >= 3 ? 't-prog' : 't-new') + '">' + av.toFixed(1).replace('.', ',') + '</span>' : '–') + '</td><td>' + fmt(o.c) + '</td></tr>'; }).join('') || '<tr><td colspan="4" class="sub">Inga meddelanden i perioden.</td></tr>') + '</tbody></table></div>';
  }
  function kidStat(k) { return stats(k.fb.filter(function (f) { return f.ts > now - 30 * 864e5; })); }
  function kids() {
    var used = KIDS.length, max = D.account.max_children || 0, left = Math.max(0, max - used), q = D.account.roles || {};
    var per = ['Handläggare', 'Medarbetare', 'Läsare'].filter(function (r) { return q[r] > 0; }).map(function (r) { return q[r] + ' ' + RN[r].toLowerCase(); }).join(', ');
    var mgr = function (k) { var m = (k.members || []).find(function (x) { return x.role === 'Ägare'; }); return m ? (m.name || m.email) + (m.name ? '<div class="sub">' + esc(m.email || '') + '</div>' : '') : esc(k.manager || '–'); };
    return '<h1>Hotell och chefer</h1><div class="sub" style="margin-bottom:12px">Ni lägger till en chef per hotell. Chefen lägger själv till sina handläggare, medarbetare och läsare.' + (per ? ' Varje hotell får ' + per + '.' : '') + '</div>' +
      '<div class="qrow"><span class="qpill' + (left ? '' : ' full') + '"><b>' + used + '/' + max + '</b> hotell med chef</span></div><div class="grid g32">' +
      '<div class="card" style="overflow-x:auto"><table><thead><tr><th>Hotell</th><th>Chef</th><th>Personal</th><th>30 dagar</th><th></th></tr></thead><tbody>' +
      (KIDS.map(function (k) { var s = kidStat(k), c = { 'Handläggare': 0, 'Medarbetare': 0, 'Läsare': 0 }; (k.members || []).forEach(function (x) { if (x.role in c) c[x.role]++; });
        return '<tr><td><b>' + esc(k.name) + '</b><div class="sub">' + esc([IND[k.ind] || k.ind, k.city].filter(Boolean).join(' · ')) + (k.locked ? ' · <b style="color:#B91C1C">pausad</b>' : '') + '</div></td><td>' + mgr(k) + '</td>' +
          '<td><span class="tag" style="background:#EDE9FE!important;color:#6D28D9!important">' + c['Handläggare'] + ' handl.</span> <span class="tag" style="background:#CCFBF1!important;color:#0F766E!important">' + c['Medarbetare'] + ' medarb.</span></td>' +
          '<td>' + fmt(s.n) + ' medd.' + (s.sat != null ? ' · <b style="color:' + (s.sat >= 80 ? '#15803D' : s.sat >= 60 ? '#B45309' : '#B91C1C') + '">' + s.sat + ' % nöjda</b>' : '') + '</td>' +
          '<td style="white-space:nowrap">' + (full ? '<button class="btn sm pri" onclick="GV.swap(\'' + k.id + '\')">Byt chef</button> <button class="btn sm line" onclick="GV.rename(\'' + k.id + '\')">✎</button> <button class="btn sm line" title="Skicka inbjudan igen" onclick="GV.reinvite(\'' + k.id + '\')">✉</button>' : '') + '</td></tr>'; }).join('') || '<tr><td colspan="5" class="sub">Inga hotell ännu.</td></tr>') + '</tbody></table></div>' +
      (full ? '<div class="card"><h2>Lägg till hotell och chef</h2>' + (left ? '<div class="sub" style="margin-bottom:10px">Ni kan lägga till ' + left + ' till. Chefen får ett mejl och väljer sitt lösenord.</div><div class="grid" style="gap:8px"><input id="k_n" type="text" placeholder="Hotellets namn, t.ex. Hotell Norra"><input id="k_o" type="text" placeholder="Org.nr (valfritt)"><input id="k_c" type="text" placeholder="Ort"><select id="k_i">' + Object.keys(IND).map(function (k) { return '<option value="' + k + '"' + (k === D.account.ind ? ' selected' : '') + '>' + IND[k] + '</option>'; }).join('') + '</select><input id="k_m" type="text" placeholder="Chefens namn"><input id="k_e" type="email" placeholder="chef@hotell.se"><button class="btn pri" id="k_b" onclick="GV.create()">Lägg till och skicka inbjudan</button></div>'
        : '<div class="note warn">Alla ' + max + ' platser för chefer i paketet används. Kontakta ScanSay för fler.</div>') + '</div>' : '') + '</div>';
  }

  function certOf(k, months) { return SSC.compute(k.fb.map(function (f) { return { ts: f.ts, type: f.type, status: f.status, rating: f.rating, secName: f.sec, fixTs: f.fix != null ? f.ts + f.fix : null }; }), { company: k.name, group: k.name, industry: k.ind, months: months || 12, lang: 'sv', now: Date.now() }); }
  var CM = 12, LV = { gold: ['Guld', '#B8860B', '#FFF6DD'], silver: ['Silver', '#6B7280', '#F1F5F9'], bronze: ['Brons', '#9A5B2E', '#FDEBDD'] };
  function certs() {
    if (!window.SSC) return '<h1>Intyg</h1><div class="card sub">Intyget kunde inte laddas.</div>';
    var list = KIDS.map(function (k) { return { k: k, d: certOf(k, CM) }; });
    var ok = list.filter(function (x) { return x.d.level; }).length;
    return '<div class="row between" style="margin-bottom:12px"><div><h1>Intyg för alla hotell</h1><div class="sub">ScanSay-intyget räknas fram per hotell från hur gästernas meddelanden tas emot och löses.</div></div><div class="seg">' + [[3, '3 mån'], [6, '6 mån'], [12, '12 mån']].map(function (x) { return '<button class="' + (CM === x[0] ? 'on' : '') + '" onclick="GV.cm(' + x[0] + ')">' + x[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="grid g4" style="margin-bottom:14px">' + ['gold', 'silver', 'bronze'].map(function (l) { var n = list.filter(function (x) { return x.d.level === l; }).length; return '<div class="card kpi" style="border-top:4px solid ' + LV[l][1] + '"><small>' + LV[l][0] + '</small><b>' + n + '</b><em class="sub">hotell</em></div>'; }).join('') + '<div class="card kpi" style="border-top:4px solid #DC2626"><small>Inte ännu</small><b>' + (list.length - ok) + '</b><em class="sub">hotell</em></div></div>' +
      '<div class="card" style="overflow-x:auto"><div class="row between" style="margin-bottom:8px"><h2 style="margin:0">Hotellen</h2>' + (ok ? '<button class="btn lime" onclick="GV.printAll()">Skriv ut alla intyg (ett per sida)</button>' : '') + '</div><table><thead><tr><th>Hotell</th><th>Nivå</th><th>Meddelanden</th><th>Lästa</th><th>Klagomål lösta</th><th>Mediantid</th><th></th></tr></thead><tbody>' +
      list.map(function (x) { var d = x.d, lv = LV[d.level]; return '<tr><td><b>' + esc(x.k.name) + '</b></td><td>' + (lv ? '<span class="tag" style="background:' + lv[2] + '!important;color:' + lv[1] + '!important">' + lv[0] + '</span>' : '<span class="tag t-new">Inte ännu</span>') + '</td><td>' + fmt(d.n) + '</td><td>' + d.read + ' %</td><td>' + d.res + ' %</td><td>' + (d.comp ? SSC.dur(d.medH, 'sv') : '–') + '</td><td>' + (lv ? '<button class="btn sm pri" onclick="GV.print(\'' + x.k.id + '\')">Skriv ut</button> <button class="btn sm line" onclick="GV.dl(\'' + x.k.id + '\')">Ladda ner</button>' : '<span class="sub">' + (d.n < 50 ? 'Minst 50 meddelanden behövs' : 'Lös fler klagomål') + '</span>') + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<div class="sub" style="margin-top:10px">Guld: minst 90 % lösta, 95 % lästa och mediantid under 12 timmar. Silver: 80 % lösta och 90 % lästa. Brons: 65 % lösta. Minst 50 meddelanden och 5 klagomål under perioden.</div></div>';
  }
  function printCerts(arr) { var pa = document.getElementById('printArea'); if (!pa) return; pa.className = 'one'; pa.innerHTML = arr.map(function (d) { return '<div class="pst" style="page-break-after:always;break-after:page">' + SSC.svg(d, { url: 'https://scansay.se/intyg/' + d.slug }) + '</div>'; }).join(''); var st = document.createElement('style'); st.textContent = '@page{size:A4;margin:0}'; document.head.appendChild(st); try { window.print(); } catch (e) { toast('Utskrift blockeras här. Ladda ner i stället.'); } setTimeout(function () { st.remove(); }, 1500); }

  function users() {
    var m = D.members || [];
    return '<h1>Koncernens team</h1><div class="sub" style="margin-bottom:12px">Personer som arbetar på koncernnivå. Hotellens personal läggs till av respektive chef.</div><div class="grid g32">' +
      '<div class="card" style="overflow-x:auto"><table><thead><tr><th>Namn</th><th>Roll</th><th></th></tr></thead><tbody>' +
      m.map(function (x) { return '<tr><td><b>' + esc(x.name || '–') + '</b><div class="sub">' + esc(x.email || '') + '</div></td><td><span class="tag t-p">' + (x.role === 'Läsare' ? 'Läsare' : x.role === 'Ägare' ? 'Ägare' : 'Koncernadmin') + '</span></td><td>' + (full && x.role !== 'Ägare' && x.user_id !== D.me.id ? '<button class="btn sm red" onclick="GV.remove(\'' + x.user_id + '\')">Ta bort</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      (full ? '<div class="card"><h2>Lägg till en person</h2><div class="grid" style="gap:8px"><input id="u_n" type="text" placeholder="Namn"><input id="u_e" type="email" placeholder="namn@foretag.se"><select id="u_m"><option value="Gruppadmin">Koncernadmin – samma som ägaren</option><option value="Läsare">Läsare – bara statistik</option></select><button class="btn pri" onclick="GV.assign()">Skicka inbjudan</button></div></div>' : '') + '</div>';
  }

  async function reload() { var d = await SSLIVE.call('GET', 'state'); D = SSLIVE.data = d; KIDS = d.children || []; render(); }
  window.GV = {
    tabs: function () { var t = [['koncern', 'Koncernöversikt', 'overview'], ['kids', 'Hotell och chefer', 'places'], ['gcert', 'Intyg', 'cert'], ['team', 'Chatt', 'team', SSLIVE.chatUnread ? SSLIVE.chatUnread() : 0], ['gusers', 'Koncernens team', 'users']]; if (full) { t.push(['settings', 'Företaget', 'gdpr']); t.push(['msgs', 'Meddelanden', 'msgs', SSLIVE.unread()]); } return t; },
    view: function (t) { return t === 'kids' ? kids() : t === 'gcert' ? certs() : t === 'team' ? SSLIVE.teamV() : t === 'gusers' ? users() : t === 'msgs' ? SSLIVE.msgsV() : t === 'settings' ? SSLIVE.settingsV() : overview(); },
    cm: function (m) { CM = m; render(); },
    print: function (id) { var k = KIDS.find(function (x) { return x.id === id; }); printCerts([certOf(k, CM)]); },
    printAll: function () { printCerts(KIDS.map(function (k) { return certOf(k, CM); }).filter(function (d) { return d.level; })); },
    dl: function (id) { var k = KIDS.find(function (x) { return x.id === id; }), d = certOf(k, CM); var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['<?xml version="1.0" encoding="UTF-8"?>' + SSC.svg(d, { url: 'https://scansay.se/intyg/' + d.slug })], { type: 'image/svg+xml' })); a.download = 'scansay-intyg-' + d.slug + '.svg'; a.click(); },
    swap: async function (id) { var k = KIDS.find(function (x) { return x.id === id; }); var n = prompt('Ny chef för ' + k.name + ': namn'); if (n === null) return; var e = prompt('Den nya chefens e-post'); if (!e) return; if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e.trim())) return toast('Skriv en giltig e-post.'); if (!confirm('Byta chef för ' + k.name + '? Den nuvarande chefen förlorar sin inloggning och sina privata chattar raderas.')) return; try { await SSLIVE.call('POST', 'child_member', { child_id: id, email: e.trim(), name: n.trim(), role: 'Ägare' }); toast('Ny chef inbjuden'); await reload(); } catch (x) { toast(x.message); } },
    per: function (p) { GPER = p; render(); }, sort: function (k) { SORT = k; render(); },
    create: async function () {
      var v = function (id) { return document.getElementById(id).value.trim(); }, b = document.getElementById('k_b');
      if (v('k_n').length < 2) return toast('Skriv företagets namn.'); if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v('k_e'))) return toast('Skriv chefens e-post.');
      b.disabled = true; b.textContent = 'Skapar…';
      try { await SSLIVE.call('POST', 'child_create', { name: v('k_n'), org: v('k_o'), city: v('k_c'), ind: v('k_i'), manager: v('k_m'), email: v('k_e') }); toast('Hotellet är tillagt och inbjudan skickad till ' + v('k_e')); await reload(); }
      catch (e) { toast(e.message); b.disabled = false; b.textContent = 'Skapa och skicka inbjudan'; }
    },
    rename: async function (id) { var k = KIDS.find(function (x) { return x.id === id; }); var n = prompt('Nytt namn på hotellet', k ? k.name : ''); if (!n) return; try { await SSLIVE.call('POST', 'child_update', { id: id, name: n }); toast('Namnet är ändrat'); await reload(); } catch (e) { toast(e.message); } },
    reinvite: async function (id) { try { await SSLIVE.call('POST', 'child_invite', { id: id }); toast('Inbjudan skickad igen'); } catch (e) { toast(e.message); } },
    assign: async function () {
      var e = document.getElementById('u_e').value.trim(), n = document.getElementById('u_n').value.trim(), mr = document.getElementById('u_m').value;
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e)) return toast('Skriv en giltig e-post.');
      try { await SSLIVE.call('POST', 'invite', { email: e, name: n, role: mr }); toast('Inbjudan skickad'); await reload(); } catch (x) { toast(x.message); }
    },
    unassign: async function (k, uid) { if (!confirm('Ta bort personens roll i dotterbolaget?')) return; try { await SSLIVE.call('POST', 'child_member_remove', { child_id: k, user_id: uid }); toast('Borttagen'); await reload(); } catch (x) { toast(x.message); } },
    remove: async function (uid) { if (!confirm('Ta bort personens inloggning till moderbolaget?')) return; try { await SSLIVE.call('POST', 'remove', { user_id: uid }); toast('Borttagen'); await reload(); } catch (x) { toast(x.message); } }
  };
  if (typeof TAB !== 'undefined' && !GV.tabs().some(function (t) { return t[0] === TAB; })) TAB = /msgs/.test(location.hash) ? 'msgs' : 'koncern';
  render();
})();
