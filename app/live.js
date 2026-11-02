/* ScanSay customer dashboard · live mode.
   On the real domain the dashboard loads the company's data from /api/app and saves changes back.
   Locally (localhost), in previews and with ?demo=1 it keeps using the demo data in the browser. */
(function () {
  var host = location.hostname, demo = /[?&]demo/.test(location.search);
  var on = /^https?:$/.test(location.protocol) && !/localhost|127\.0\.0\.1|claude\.ai|claudeusercontent/.test(host) && !demo;
  var AK = 'ss-auth';
  function auth() { try { return JSON.parse(localStorage.getItem(AK) || 'null'); } catch (e) { return null; } }
  function setAuth(a) { try { if (a) localStorage.setItem(AK, JSON.stringify(a)); else localStorage.removeItem(AK); } catch (e) {} }
  function toLogin(msg) { setAuth(null); location.replace('../index.html' + (msg ? '?m=' + msg : '') + '#login'); throw new Error('redirect'); }
  function xhr(method, url, body, tok) { var x = new XMLHttpRequest(); x.open(method, url, false); x.setRequestHeader('Content-Type', 'application/json'); if (tok) x.setRequestHeader('Authorization', 'Bearer ' + tok); try { x.send(body ? JSON.stringify(body) : null); } catch (e) { return { status: 0, data: {} }; } var j = {}; try { j = JSON.parse(x.responseText || '{}'); } catch (e) {} return { status: x.status, data: j }; }
  function refreshSync() { var a = auth(); if (!a || !a.refresh_token) return false; var r = xhr('POST', '/api/auth?a=refresh', { refresh_token: a.refresh_token }); if (r.status !== 200) return false; setAuth({ access_token: r.data.access_token, refresh_token: r.data.refresh_token, exp: Date.now() + (r.data.expires_in || 3600) * 1000 }); return true; }
  async function call(method, a, body) {
    var at = auth(); if (!at) toLogin();
    if (at.exp && at.exp - Date.now() < 60e3) { refreshSync(); at = auth(); }
    var r = await fetch('/api/app?a=' + a, { method: method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + at.access_token }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401 && refreshSync()) return call(method, a, body);
    if (r.status === 401) toLogin('expired');
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) { var e = new Error(ERR[j.error] || j.error || ('Fel ' + r.status)); e.data = j; e.status = r.status; throw e; }
    return j;
  }
  var ERR = { role: 'Din roll får inte göra det. Be ägaren om hjälp.', seats: 'Alla agentinloggningar används. Kontakta ScanSay för fler.', nocontact: 'Kunden lämnade ingen e-post eller telefon, så svaret kan inte skickas.', taken: 'En kod var upptagen. Försök igen.', locked: 'Kontot är pausat. Kontakta ScanSay.', size: 'För mycket data på en gång.', format: 'Skriv en giltig e-postadress.' };

  /* invite or password-reset link: #access_token=…&type=invite|recovery */
  var hp = new URLSearchParams((location.hash || '').slice(1));
  var setPw = on && hp.get('access_token') && /invite|recovery|signup|magiclink/.test(hp.get('type') || '');
  if (setPw) {
    setAuth({ access_token: hp.get('access_token'), refresh_token: hp.get('refresh_token'), exp: Date.now() + (+hp.get('expires_in') || 3600) * 1000 });
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
  }

  var SSLIVE = window.SSLIVE = { on: on, setPw: setPw, data: null };
  if (!on) return;
  document.documentElement.classList.add('live');

  SSLIVE.boot = function () {
    if (setPw) { document.addEventListener('DOMContentLoaded', pwScreen); return emptyS(); }
    var a = auth(); if (!a) toLogin();
    var r = xhr('GET', '/api/app?a=state', null, a.access_token);
    if (r.status === 0) { location.replace('/app/offline.html'); return emptyS(); }
    if (r.status === 401 && refreshSync()) r = xhr('GET', '/api/app?a=state', null, auth().access_token);
    if (r.status === 401) toLogin('expired');
    if (r.status === 423) toLogin('locked');
    if (r.status === 403) toLogin('noaccount');
    if (r.status !== 200) { document.addEventListener('DOMContentLoaded', function () { document.body.innerHTML = '<div style="max-width:520px;margin:80px auto;font-family:Inter,Arial;padding:20px"><h1>Översikten kunde inte laddas</h1><p>Försök igen om en stund. Om felet finns kvar, mejla hello@scansay.se.</p><p style="color:#6B7280">' + (r.data.error || r.status) + '</p><button onclick="location.reload()" style="padding:10px 16px;border-radius:10px;border:0;background:#1D4ED8;color:#fff;font-weight:700">Försök igen</button></div>'; }); return emptyS(); }
    var d = SSLIVE.data = r.data, st = d.state || {}, acc = d.account;
    var S = { groups: st.groups || [], staff: st.staff || [], roster: st.roster || [], alerts: st.alerts || [], alertLog: st.alertLog || [], invites: [], companies: [],
      mbl: st.mbl || {}, retention: st.retention || 12, channels: st.channels, chcfg: st.chcfg || {}, urgent: st.urgent, esc: st.esc, pub: st.pub, fb: d.feedback || [], imported: [],
      features: { staff: !!(acc.mods && acc.mods.staff), ai: !(acc.mods && acc.mods.ai === false) } };
    if (!S.groups.length) {
      var ind = (window.TP && TP.IND[acc.ind]) ? acc.ind : 'hotel', secs = (TP.IND[ind].sec || []).slice(0, 4).map(function (t) { return [t.k, []]; });
      S.groups = [mkGroup('g1', acc.name, acc.name, ind, secs, Math.random)]; S.mbl.g1 = { date: '', named: false }; SSLIVE.dirty = true;
    }
    S.groups.forEach(function (g) { g.places = g.secs.flatMap(function (s) { return s.places.map(function (p) { return p.name; }); }); });
    return S;
  };
  function emptyS() { return { groups: [], staff: [], roster: [], alerts: [], alertLog: [], invites: [], companies: [], mbl: {}, retention: 12, fb: [], imported: [], features: {} }; }

  var tmr = null, saving = false;
  SSLIVE.save = function (S) { clearTimeout(tmr); tmr = setTimeout(function () { push(S); }, 800); };
  async function push(S, retry) {
    if (saving) { SSLIVE.save(S); return; } saving = true;
    var st = {}; ['groups', 'staff', 'roster', 'alerts', 'alertLog', 'mbl', 'retention', 'channels', 'chcfg', 'urgent', 'esc', 'pub'].forEach(function (k) { if (S[k] !== undefined) st[k] = S[k]; });
    try { await call('POST', 'save', { state: st }); flag(''); }
    catch (e) {
      if (e.status === 409 && e.data && e.data.codes && !retry) { var bad = new Set(e.data.codes); S.groups.forEach(function (g) { g.secs.forEach(function (s) { s.places.forEach(function (p) { if (bad.has(p.code)) p.code = newCode(Math.random); }); }); }); saving = false; render(); return push(S, true); }
      flag('Kunde inte spara: ' + e.message);
    }
    saving = false;
  }
  function flag(t) { var b = document.getElementById('livebar'); if (!b) return; b.textContent = t; b.style.display = t ? 'block' : 'none'; }

  SSLIVE.reply = function (F, text, fix) { return call('POST', 'reply', { id: F.id, text: text, fix: fix }); };
  SSLIVE.status = function (F, status) { return call('POST', 'status', { id: F.id, status: status }); };
  SSLIVE.flush = function () { clearTimeout(tmr); return push(SSLIVE.getS()); };
  SSLIVE.testAlarm = async function (only) { await SSLIVE.flush(); return call('POST', 'alarm', { only: only || null }); };
  SSLIVE.saveCfg = function () { SSLIVE.save(SSLIVE.getS()); };
  SSLIVE.saveGroup = function () { SSLIVE.save(SSLIVE.getS()); };
  SSLIVE.invite = function (email, name, role) { return call('POST', 'invite', { email: email, name: name, role: role }); };
  SSLIVE.remove = function (uid) { return call('POST', 'remove', { user_id: uid }); };
  SSLIVE.logout = async function () {
    try { if (PS.sub) { var ep = PS.sub.endpoint; await Promise.race([call('POST', 'push_off', { endpoint: ep }), new Promise(function (r) { setTimeout(r, 2500); })]); await PS.sub.unsubscribe(); } } catch (e) {}
    setAuth(null); location.href = '../index.html#login';
  };
  SSLIVE.reload = async function () { var d = await call('GET', 'state'); SSLIVE.getS().fb = d.feedback || []; SSLIVE.data.members = d.members; render(); };

  function pwScreen() {
    document.body.innerHTML = '<div class="pwbox"><div style="font-weight:800;font-size:24px;margin-bottom:18px">Scan<span style="color:#1D4ED8">Say</span></div><h1>Välj ditt lösenord</h1><p>Minst 10 tecken med både bokstäver och siffror.</p><label>Nytt lösenord<input id="pw1" type="password" autocomplete="new-password"></label><label>Skriv lösenordet igen<input id="pw2" type="password" autocomplete="new-password"></label><p id="pwe" class="pwe"></p><button id="pwb">Spara och öppna översikten</button></div>';
    document.getElementById('pwb').onclick = async function () {
      var a = document.getElementById('pw1').value, b = document.getElementById('pw2').value, e = document.getElementById('pwe');
      if (a !== b) { e.textContent = 'Lösenorden är inte lika.'; return; }
      if (a.length < 10 || !/\d/.test(a) || !/[A-Za-zÅÄÖåäö]/.test(a)) { e.textContent = 'Minst 10 tecken med både bokstäver och siffror.'; return; }
      this.disabled = true; this.textContent = 'Sparar…';
      var r = await fetch('/api/auth?a=password', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + auth().access_token }, body: JSON.stringify({ password: a }) });
      if (r.ok) { location.replace(location.pathname); } else { this.disabled = false; this.textContent = 'Spara och öppna översikten'; e.textContent = r.status === 401 ? 'Länken har gått ut. Be om en ny via Glömt lösenord.' : 'Lösenordet godtogs inte. Välj ett längre.'; }
    };
  }

  /* after the dashboard has started: live users view, header, hide demo-only parts */
  document.addEventListener('DOMContentLoaded', function () {
    if (setPw || !SSLIVE.data) return;
    var d = SSLIVE.data;
    var sub = document.querySelector('header .logo small, header .logo .sub2');
    document.querySelectorAll('header .logo div div, header .logo small').forEach(function (el) { if (/Företagsöversikt/.test(el.textContent)) el.textContent = 'Företagsöversikt · ' + d.account.name; });
    var h = document.querySelector('header');
    if (h && !document.getElementById('lo')) h.insertAdjacentHTML('beforeend', '<div class="liveme"><span>' + esc(d.me.email) + ' · ' + esc(d.me.role) + '</span><button id="lo" class="btn sm line" onclick="SSLIVE.logout()">Logga ut</button></div>');
    document.body.insertAdjacentHTML('beforeend', '<div id="livebar" style="display:none;position:fixed;bottom:12px;left:50%;transform:translateX(-50%);background:#B91C1C;color:#fff;padding:10px 16px;border-radius:12px;z-index:200;font-weight:700"></div>');
    window.users = liveUsers;
    if (SSLIVE.dirty) SSLIVE.save(SSLIVE.getS());
    setInterval(function () { if (document.visibilityState === 'visible' && !document.querySelector('.rbox textarea:focus,input:focus,textarea:focus')) SSLIVE.reload().catch(function () {}); }, 60000);
    try { render(); } catch (e) {}
  });

  /* ---------- the dashboard as an app on the phone: install + notifications ---------- */
  var ua = navigator.userAgent;
  var PS = SSLIVE.ps = { sup: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window, reg: null, sub: null, inst: null, ready: false, busy: false,
    ios: /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    standalone: (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true };
  function rr() { try { if (typeof TAB !== 'undefined' && (TAB === 'alerts' || TAB === 'overview')) render(); } catch (e) {} }
  if ('serviceWorker' in navigator && !setPw) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(async function (reg) {
      PS.reg = reg;
      if (PS.sup) { try { PS.sub = await reg.pushManager.getSubscription(); } catch (e) {} }
      PS.ready = true; rr();
    }).catch(function (e) { PS.ready = true; PS.err = e.message; rr(); });
  } else PS.ready = true;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); PS.inst = e; rr(); });
  window.addEventListener('appinstalled', function () { PS.inst = null; toast('ScanSay finns nu på hemskärmen.'); rr(); });

  function u8(b64) { var s = b64.replace(/-/g, '+').replace(/_/g, '/'); s += '==='.slice((s.length + 3) % 4); var r = atob(s), a = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; }
  function sameKey(sub, key) { try { var k = sub.options && sub.options.applicationServerKey; if (!k) return true; var a = new Uint8Array(k), b = u8(key); return a.length === b.length && a.every(function (x, i) { return x === b[i]; }); } catch (e) { return true; } }
  function devName() { return (/iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Enhet') + (PS.standalone ? ' · app' : ' · webbläsare'); }
  function mine() { var d = SSLIVE.data, m = (d && d.push && d.push.mine) || []; return PS.sub ? m.find(function (x) { return x.endpoint === PS.sub.endpoint; }) : null; }
  function secNames() { var S = SSLIVE.getS ? SSLIVE.getS() : null, n = []; ((S && S.groups) || []).forEach(function (g) { (g.secs || []).forEach(function (s) { if (s.name && n.indexOf(s.name) < 0) n.push(s.name); }); }); return n; }

  SSLIVE.pushOn = async function () {
    if (PS.busy) return; PS.busy = true;
    try {
      var lv = (document.getElementById('pl') || {}).value || 'c', secs = [].slice.call(document.querySelectorAll('.psec:checked')).map(function (x) { return x.value; });
      var perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (perm !== 'granted') { toast('Notiser tilläts inte. Du kan ändra det i telefonens inställningar.'); return; }
      var reg = PS.reg || await navigator.serviceWorker.ready, key = SSLIVE.data.push && SSLIVE.data.push.key;
      if (!key) throw new Error('Notiser är inte aktiverade på servern ännu.');
      var sub = await reg.pushManager.getSubscription();
      if (sub && !sameKey(sub, key)) { await sub.unsubscribe(); sub = null; }
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(key) });
      await call('POST', 'push_sub', { sub: sub.toJSON(), level: lv, secs: secs, device: devName() });
      PS.sub = sub;
      var d = SSLIVE.data; d.push.mine = (d.push.mine || []).filter(function (x) { return x.endpoint !== sub.endpoint; }).concat({ endpoint: sub.endpoint, level: lv, secs: secs, device: devName() });
      toast('Notiser är på för den här enheten.');
    } catch (e) { toast('Kunde inte slå på notiser: ' + e.message); }
    finally { PS.busy = false; rr(); }
  };
  SSLIVE.pushOff = async function () {
    if (!PS.sub) return; PS.busy = true;
    try { var ep = PS.sub.endpoint; await call('POST', 'push_off', { endpoint: ep }); await PS.sub.unsubscribe(); PS.sub = null; SSLIVE.data.push.mine = (SSLIVE.data.push.mine || []).filter(function (x) { return x.endpoint !== ep; }); toast('Notiser är avstängda på den här enheten.'); }
    catch (e) { toast('Kunde inte stänga av: ' + e.message); }
    finally { PS.busy = false; rr(); }
  };
  SSLIVE.pushTest = async function () {
    try { var r = await call('POST', 'push_test'); toast(r.n ? 'Testnotis skickad till ' + r.n + (r.n === 1 ? ' enhet' : ' enheter') + '.' : 'Ingen enhet tog emot testnotisen. Slå av och på notiser igen.'); }
    catch (e) { toast('Kunde inte skicka: ' + e.message); }
  };
  SSLIVE.install = async function () { if (!PS.inst) return; PS.inst.prompt(); try { await PS.inst.userChoice; } catch (e) {} PS.inst = null; rr(); };
  SSLIVE.hideBanner = function () { try { localStorage.setItem('ss-pushbanner', '1'); } catch (e) {} rr(); };

  var LV = [['urgent', 'Bara akuta larm'], ['c', 'Klagomål och akuta larm (rekommenderas)'], ['all', 'Alla meddelanden, även beröm']];
  function phoneSvg() { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/></svg>'; }
  /* the card on the Larm page */
  SSLIVE.phoneCard = function () {
    var m = mine(), others = ((SSLIVE.data.push && SSLIVE.data.push.mine) || []).filter(function (x) { return !PS.sub || x.endpoint !== PS.sub.endpoint; });
    var head = '<div class="card pcard"><div class="phd"><span class="pic">' + phoneSvg() + '</span><div><h2 style="margin:0">ScanSay i mobilen</h2><div class="sub">Notiser direkt i telefonen när en gäst skriver. Varje medarbetare slår på det i sin egen telefon.</div></div></div>';
    var body = '';
    var install = PS.standalone ? '' : PS.inst ? '<div class="pstep"><b>1. Installera appen</b><span>Lägg ScanSay på hemskärmen så öppnas den som en vanlig app.</span><button class="btn pri" onclick="SSLIVE.install()">Installera appen</button></div>'
      : PS.ios ? '<div class="pstep"><b>1. Lägg till på hemskärmen</b><span>Tryck på <b>Dela</b> <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v8h14v-8"/></svg> i Safari och välj <b>Lägg till på hemskärmen</b>. Öppna sedan ScanSay från hemskärmen och logga in. iPhone kräver detta för notiser (iOS 16.4 eller senare).</span></div>'
      : '<div class="pstep"><b>Tips</b><span>I Chrome på Android: öppna menyn ⋮ och välj <b>Installera app</b> eller <b>Lägg till på startskärmen</b>.</span></div>';
    if (!PS.ready) body = '<div class="sub">Kontrollerar enheten…</div>';
    else if (!PS.sup) body = install + (PS.ios && !PS.standalone ? '' : '<div class="pnote">Den här webbläsaren stöder inte notiser. Använd Chrome, Edge, Firefox eller Safari.</div>');
    else if (Notification.permission === 'denied') body = install + '<div class="pnote"><b>Notiser är blockerade på den här enheten.</b> Öppna telefonens inställningar → ScanSay (eller webbläsaren) → Notiser och tillåt dem. Ladda sedan om sidan.</div>';
    else {
      var cur = m ? m.level : 'c', cs = m ? (m.secs || []) : [], names = secNames();
      var opts = '<label class="plab">Vad ska den här enheten få notiser om?<select id="pl">' + LV.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === cur ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
        (names.length > 1 ? '<div class="plab">Bara från vissa avdelningar <span class="sub">(tomt = alla, akuta larm kommer alltid)</span><div class="psecs">' + names.map(function (n) { return '<label><input type="checkbox" class="psec" value="' + esc(n) + '"' + (cs.indexOf(n) >= 0 ? ' checked' : '') + '> ' + esc(n) + '</label>'; }).join('') + '</div></div>' : '');
      body = install + (PS.sub && m
        ? '<div class="pon"><span class="dot"></span><span><b>Notiser är på</b> för den här enheten (' + esc(m.device || devName()) + ').</span></div>' + opts + '<div class="pbtns"><button class="btn pri" onclick="SSLIVE.pushOn()">Spara ändringar</button><button class="btn line" onclick="SSLIVE.pushTest()">Skicka testnotis</button><button class="btn line red" onclick="SSLIVE.pushOff()">Stäng av</button></div>'
        : '<div class="pstep"><b>' + (!PS.standalone && (PS.inst || PS.ios) ? '2. ' : '') + 'Slå på notiser</b><span>Telefonen frågar om lov första gången. Tryck på <b>Tillåt</b>.</span></div>' + opts + '<div class="pbtns"><button class="btn pri" onclick="SSLIVE.pushOn()"' + (PS.busy ? ' disabled' : '') + '>Slå på notiser</button></div>');
    }
    var foot = others.length ? '<div class="sub" style="margin-top:12px">Du har även notiser på ' + others.length + (others.length === 1 ? ' annan enhet' : ' andra enheter') + ': ' + others.map(function (x) { return esc(x.device || 'enhet'); }).join(', ') + '. De stängs av när du loggar ut där.</div>' : '';
    return head + body + foot + '<div class="sub" style="margin-top:12px">Notisen visar avdelning, plats och ämne. Gästens kontaktuppgifter skickas aldrig till telefonen.</div></div>';
  };
  /* a small banner on the overview until notifications are on */
  SSLIVE.phoneBanner = function () {
    var hid = false; try { hid = localStorage.getItem('ss-pushbanner') === '1'; } catch (e) {}
    if (hid || !PS.ready || PS.sub || (PS.sup && Notification.permission === 'denied') || (!PS.sup && !PS.ios)) return '';
    return '<div class="pban"><span class="pic">' + phoneSvg() + '</span><div><b style="color:#fff!important;-webkit-text-fill-color:#fff!important">Få notiser i mobilen</b><span>Se nya ärenden och akuta larm direkt, utan att ha datorn öppen.</span></div><button class="btn pri sm" onclick="TAB=\'alerts\';render();scrollTo(0,0)">Slå på</button><button class="px" aria-label="Dölj" onclick="SSLIVE.hideBanner()">×</button></div>';
  };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function liveUsers() {
    var d = SSLIVE.data, m = d.members || [], admin = /Ägare|Gruppadmin/.test(d.me.role);
    return '<h1>Användare</h1><div class="sub" style="margin-bottom:12px">' + m.length + ' av ' + d.account.seats + ' agentinloggningar används. Varje person får en egen inloggning via e-post.</div><div class="grid g32">' +
      '<div class="card" style="overflow-x:auto"><table><thead><tr><th>Namn</th><th>E-post</th><th>Roll</th><th></th></tr></thead><tbody>' +
      m.map(function (x) { return '<tr><td><b>' + esc(x.name || '–') + '</b></td><td>' + esc(x.email || '') + '</td><td><span class="tag t-p">' + esc(x.role) + '</span></td><td>' + (admin && x.user_id !== d.me.id ? '<button class="btn sm red" onclick="liveRemove(\'' + x.user_id + '\')">Ta bort</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      (admin ? '<div class="card"><h2>Bjud in en kollega</h2><div class="grid" style="gap:8px"><input id="ln" placeholder="Namn"><input type="email" id="le" placeholder="namn@foretag.se"><select id="lr"><option>Handläggare</option><option>Gruppadmin</option><option>Läsare</option></select><button class="btn pri" onclick="liveInvite()">Skicka inbjudan</button></div><div class="sub" style="margin-top:10px"><b>Gruppadmin</b> ändrar platser, QR-koder och larm. <b>Handläggare</b> svarar på ärenden. <b>Läsare</b> ser statistik. Länken i mejlet gäller i 24 timmar.</div></div>' : '<div class="card sub">Bara ägare och gruppadmin kan bjuda in.</div>') + '</div>';
  }
  window.liveInvite = async function () {
    var e = document.getElementById('le').value.trim(), n = document.getElementById('ln').value.trim(), r = document.getElementById('lr').value;
    try { await SSLIVE.invite(e, n, r); toast('Inbjudan skickad till ' + e); await SSLIVE.reload(); } catch (x) { toast(x.message); }
  };
  window.liveRemove = async function (uid) { if (!confirm('Ta bort personens inloggning?')) return; try { await SSLIVE.remove(uid); toast('Borttagen'); await SSLIVE.reload(); } catch (x) { toast(x.message); } };
})();
