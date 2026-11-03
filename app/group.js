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
    if (!KIDS.length) return hello + '<div class="card"><h2>Inga dotterbolag ännu</h2><p class="sub">Skapa ert första dotterbolag under <b>Dotterbolag</b>. Statistiken visas här så fort gästerna börjar skriva.</p><button class="btn pri" onclick="TAB=\'kids\';render()">Skapa dotterbolag</button></div>';
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
      '<div class="card" style="overflow-x:auto"><div class="row between" style="margin-bottom:8px"><h2 style="margin:0">Jämförelse mellan dotterbolagen</h2><div class="seg">' + [['n', 'Flest meddelanden'], ['sat', 'Nöjdast'], ['res', 'Flest lösta'], ['med', 'Snabbast']].map(function (x) { return '<button class="' + (SORT === x[0] ? 'on' : '') + '" onclick="GV.sort(\'' + x[0] + '\')">' + x[1] + '</button>'; }).join('') + '</div></div>' +
      '<table><thead><tr><th>Dotterbolag</th><th>Meddelanden</th><th>Nöjda</th><th>Snittbetyg</th><th>Klagomål</th><th>Lösta</th><th>Tid till löst</th><th>Akuta</th><th>Vanligaste ämne</th></tr></thead><tbody>' +
      rows.map(function (r) { var s = r.s; return '<tr><td><b>' + esc(r.k.name) + '</b><div class="sub">' + esc([IND[r.k.ind] || r.k.ind, r.k.city].filter(Boolean).join(' · ')) + '</div></td><td>' + fmt(s.n) + '</td><td>' + (s.sat == null ? '–' : '<span class="tag ' + (s.sat >= 80 ? 't-fix' : s.sat >= 60 ? 't-prog' : 't-new') + '">' + s.sat + ' %</span>') + '</td><td>' + (s.avg ? s.avg.toFixed(1).replace('.', ',') : '–') + '</td><td>' + fmt(s.c) + '</td><td>' + (s.res == null ? '–' : s.res + ' %') + '</td><td>' + dur(s.med) + '</td><td>' + (s.urg ? '<b style="color:#B91C1C">' + s.urg + '</b>' : '0') + '</td><td>' + esc(s.top) + '</td></tr>'; }).join('') +
      '</tbody></table><div class="sub" style="margin-top:8px">Nöjda = andel betyg 4–5 av 5. Tid till löst = median från meddelande till att ärendet markerades som löst.</div></div>';
  }

  function kids() {
    var used = KIDS.length, max = D.account.max_children || 0, left = Math.max(0, max - used);
    return '<h1>Dotterbolag</h1><div class="sub" style="margin-bottom:12px">' + used + ' av ' + max + ' dotterbolag skapade. Varje dotterbolag har egen inkorg, egna QR-koder och egen personal.</div><div class="grid g32">' +
      '<div class="card" style="overflow-x:auto"><table><thead><tr><th>Namn</th><th>Ansvarig</th><th>Användare</th><th>Skapad</th><th></th></tr></thead><tbody>' +
      (KIDS.map(function (k) { return '<tr><td><b>' + esc(k.name) + '</b><div class="sub">' + esc([IND[k.ind] || k.ind, k.city].filter(Boolean).join(' · ')) + (k.locked ? ' · <b style="color:#B91C1C">pausad</b>' : '') + '</div></td><td>' + esc(k.manager || '–') + '</td><td>' + k.users + '</td><td>' + new Date(k.created).toLocaleDateString('sv-SE') + '</td><td>' + (full ? '<button class="btn sm line" onclick="GV.reinvite(\'' + k.id + '\')">Skicka inbjudan igen</button>' : '') + '</td></tr>'; }).join('') || '<tr><td colspan="5" class="sub">Inga dotterbolag ännu.</td></tr>') + '</tbody></table></div>' +
      (full ? '<div class="card"><h2>Skapa dotterbolag</h2>' + (left ? '<div class="sub" style="margin-bottom:10px">Du kan skapa ' + left + ' till. Den ansvariga chefen får ett mejl för att välja lösenord.</div><div class="grid" style="gap:8px"><input id="k_n" type="text" placeholder="Företagets namn, t.ex. Hotell Norra"><input id="k_o" type="text" placeholder="Org.nr (valfritt)"><input id="k_c" type="text" placeholder="Ort"><select id="k_i">' + Object.keys(IND).map(function (k) { return '<option value="' + k + '"' + (k === D.account.ind ? ' selected' : '') + '>' + IND[k] + '</option>'; }).join('') + '</select><input id="k_m" type="text" placeholder="Ansvarig chef (namn)"><input id="k_e" type="email" placeholder="chef@hotell.se"><button class="btn pri" id="k_b" onclick="GV.create()">Skapa och skicka inbjudan</button></div>'
        : '<div class="note warn">Ni har skapat alla ' + max + ' dotterbolag som ingår. Kontakta ScanSay för fler.</div>') + '</div>' : '') + '</div>';
  }

  function users() {
    var m = D.members || [], roles = ['Gruppadmin', 'Handläggare', 'Medarbetare', 'Läsare'];
    var quota = D.account.roles || {};
    var rowsK = KIDS.map(function (k) { return (k.members || []).map(function (x) { return '<tr><td><b>' + esc(x.name || '–') + '</b><div class="sub">' + esc(x.email || '') + '</div></td><td>' + esc(k.name) + '</td><td><span class="tag t-p">' + esc(RN[x.role] || x.role) + '</span></td><td>' + (full && x.role !== 'Ägare' ? '<button class="btn sm red" onclick="GV.unassign(\'' + k.id + '\',\'' + x.user_id + '\')">Ta bort</button>' : '') + '</td></tr>'; }).join(''); }).join('');
    return '<h1>Användare</h1><div class="sub" style="margin-bottom:12px">Samma person kan ha olika roller i moderbolaget och i flera dotterbolag. Hen byter företag uppe till höger efter inloggning.</div><div class="grid g32">' +
      '<div><div class="card" style="overflow-x:auto"><h2>Moderbolaget</h2><table><thead><tr><th>Namn</th><th>Roll</th><th></th></tr></thead><tbody>' +
      m.map(function (x) { return '<tr><td><b>' + esc(x.name || '–') + '</b><div class="sub">' + esc(x.email || '') + '</div></td><td><span class="tag t-p">' + (x.role === 'Läsare' ? 'Läsare' : x.role === 'Ägare' ? 'Ägare' : 'Koncernadmin') + '</span></td><td>' + (full && x.role !== 'Ägare' && x.user_id !== D.me.id ? '<button class="btn sm red" onclick="GV.remove(\'' + x.user_id + '\')">Ta bort</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="card" style="overflow-x:auto"><h2>I dotterbolagen</h2><table><thead><tr><th>Person</th><th>Dotterbolag</th><th>Roll</th><th></th></tr></thead><tbody>' + (rowsK || '<tr><td colspan="4" class="sub">Inga ännu.</td></tr>') + '</tbody></table>' +
      (Object.keys(quota).length ? '<div class="sub" style="margin-top:8px">Per dotterbolag ingår: ' + roles.filter(function (r) { return quota[r] > 0; }).map(function (r) { return quota[r] + ' ' + RN[r].toLowerCase(); }).join(', ') + '.</div>' : '') + '</div></div>' +
      (full ? '<div class="card"><h2>Ge en person roller</h2><div class="grid" style="gap:8px"><input id="u_n" type="text" placeholder="Namn"><input id="u_e" type="email" placeholder="namn@foretag.se">' +
        '<label class="sub" style="font-weight:700">I moderbolaget<select id="u_m" style="width:100%;margin-top:4px"><option value="">Ingen roll</option><option value="Gruppadmin">Koncernadmin – skapar dotterbolag</option><option value="Läsare">Läsare – bara statistik</option></select></label>' +
        KIDS.map(function (k) { return '<label class="sub" style="font-weight:700">' + esc(k.name) + '<select class="u_k" data-k="' + k.id + '" style="width:100%;margin-top:4px"><option value="">Ingen roll</option>' + roles.map(function (r) { var l = quotaLeft(k, r); return '<option value="' + r + '"' + (l !== null && l <= 0 ? ' disabled' : '') + '>' + RN[r] + (l !== null ? ' (' + Math.max(0, l) + ' kvar)' : '') + '</option>'; }).join('') + '</select></label>'; }).join('') +
        '<button class="btn pri" onclick="GV.assign()">Skicka inbjudan</button><div class="sub">Personen får ett mejl per företag med en länk för att välja lösenord. Medarbetare kopplas till avdelningar av dotterbolagets chef.</div></div></div>' : '') + '</div>';
  }

  async function reload() { var d = await SSLIVE.call('GET', 'state'); D = SSLIVE.data = d; KIDS = d.children || []; render(); }
  window.GV = {
    tabs: function () { var t = [['koncern', 'Koncernöversikt', 'overview'], ['kids', 'Dotterbolag', 'places'], ['gusers', 'Användare', 'users']]; if (full) t.push(['msgs', 'Meddelanden', 'inbox', SSLIVE.unread()]); return t; },
    view: function (t) { return t === 'kids' ? kids() : t === 'gusers' ? users() : t === 'msgs' ? SSLIVE.msgsV() : overview(); },
    per: function (p) { GPER = p; render(); }, sort: function (k) { SORT = k; render(); },
    create: async function () {
      var v = function (id) { return document.getElementById(id).value.trim(); }, b = document.getElementById('k_b');
      if (v('k_n').length < 2) return toast('Skriv företagets namn.'); if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v('k_e'))) return toast('Skriv chefens e-post.');
      b.disabled = true; b.textContent = 'Skapar…';
      try { await SSLIVE.call('POST', 'child_create', { name: v('k_n'), org: v('k_o'), city: v('k_c'), ind: v('k_i'), manager: v('k_m'), email: v('k_e') }); toast('Dotterbolaget är skapat och inbjudan skickad till ' + v('k_e')); await reload(); }
      catch (e) { toast(e.message); b.disabled = false; b.textContent = 'Skapa och skicka inbjudan'; }
    },
    reinvite: async function (id) { try { await SSLIVE.call('POST', 'child_invite', { id: id }); toast('Inbjudan skickad igen'); } catch (e) { toast(e.message); } },
    assign: async function () {
      var e = document.getElementById('u_e').value.trim(), n = document.getElementById('u_n').value.trim(), mr = document.getElementById('u_m').value;
      var picks = [].slice.call(document.querySelectorAll('.u_k')).filter(function (s) { return s.value; }).map(function (s) { return { k: s.getAttribute('data-k'), r: s.value }; });
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e)) return toast('Skriv en giltig e-post.'); if (!mr && !picks.length) return toast('Välj minst en roll.');
      var ok = 0, bad = [];
      if (mr) { try { await SSLIVE.call('POST', 'invite', { email: e, name: n, role: mr }); ok++; } catch (x) { bad.push('moderbolaget: ' + x.message); } }
      for (var i = 0; i < picks.length; i++) { try { await SSLIVE.call('POST', 'child_member', { child_id: picks[i].k, email: e, name: n, role: picks[i].r }); ok++; } catch (x) { bad.push((KIDS.find(function (k) { return k.id === picks[i].k; }) || {}).name + ': ' + x.message); } }
      toast(ok + ' roller tilldelade' + (bad.length ? ' · inte: ' + bad.join('; ') : '')); await reload();
    },
    unassign: async function (k, uid) { if (!confirm('Ta bort personens roll i dotterbolaget?')) return; try { await SSLIVE.call('POST', 'child_member_remove', { child_id: k, user_id: uid }); toast('Borttagen'); await reload(); } catch (x) { toast(x.message); } },
    remove: async function (uid) { if (!confirm('Ta bort personens inloggning till moderbolaget?')) return; try { await SSLIVE.call('POST', 'remove', { user_id: uid }); toast('Borttagen'); await reload(); } catch (x) { toast(x.message); } }
  };
  if (typeof TAB !== 'undefined' && !GV.tabs().some(function (t) { return t[0] === TAB; })) TAB = /msgs/.test(location.hash) ? 'msgs' : 'koncern';
  render();
})();
