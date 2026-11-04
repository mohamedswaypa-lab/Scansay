/* ScanSay customer dashboard · live mode.
   On the real domain the dashboard loads the company's data from /api/app and saves changes back.
   Locally (localhost), in previews and with ?demo=1 it keeps using the demo data in the browser. */
(function () {
  var host = location.hostname, demo = /[?&]demo/.test(location.search);
  var on = /^https?:$/.test(location.protocol) && !/localhost|127\.0\.0\.1|claude\.ai|claudeusercontent/.test(host) && !demo;
  var AK = 'ss-auth';
  function accQ() { var x = null; try { x = localStorage.getItem('ss-acc'); } catch (e) {} return x ? '&acc=' + encodeURIComponent(x) : ''; }
  function auth() { try { return JSON.parse(localStorage.getItem(AK) || 'null'); } catch (e) { return null; } }
  function setAuth(a) { try { if (a) localStorage.setItem(AK, JSON.stringify(a)); else localStorage.removeItem(AK); } catch (e) {} }
  function toLogin(msg) { setAuth(null); location.replace('../index.html' + (msg ? '?m=' + msg : '') + '#login'); throw new Error('redirect'); }
  function xhr(method, url, body, tok) { var x = new XMLHttpRequest(); x.open(method, url, false); x.setRequestHeader('Content-Type', 'application/json'); if (tok) x.setRequestHeader('Authorization', 'Bearer ' + tok); try { x.send(body ? JSON.stringify(body) : null); } catch (e) { return { status: 0, data: {} }; } var j = {}; try { j = JSON.parse(x.responseText || '{}'); } catch (e) {} return { status: x.status, data: j }; }
  function refreshSync() { var a = auth(); if (!a || !a.refresh_token) return false; var r = xhr('POST', '/api/auth?a=refresh', { refresh_token: a.refresh_token }); if (r.status !== 200) return false; setAuth({ access_token: r.data.access_token, refresh_token: r.data.refresh_token, exp: Date.now() + (r.data.expires_in || 3600) * 1000 }); return true; }
  async function call(method, a, body) {
    var at = auth(); if (!at) toLogin();
    if (at.exp && at.exp - Date.now() < 60e3) { refreshSync(); at = auth(); }
    var r = await fetch('/api/app?a=' + a + accQ(), { method: method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + at.access_token }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401 && refreshSync()) return call(method, a, body);
    if (r.status === 401) toLogin('expired');
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) { var e = new Error(ERR[j.error] || j.error || ('Fel ' + r.status)); e.data = j; e.status = r.status; throw e; }
    return j;
  }
  var ERR = { role: 'Din roll får inte göra det. Be ägaren om hjälp.', seats: 'Alla inloggningar för den rollen används. Kontakta ScanSay för fler.', nocontact: 'Kunden lämnade ingen e-post eller telefon, så svaret kan inte skickas.', taken: 'En kod var upptagen. Försök igen.', locked: 'Kontot är pausat. Kontakta ScanSay.', size: 'För mycket data på en gång.', format: 'Skriv en giltig e-postadress.', children: 'Ni har skapat alla dotterbolag som ingår. Kontakta ScanSay för fler.', nouser: 'Kollegan finns inte längre.', name: 'Skriv företagets namn.', self: 'Du kan inte ändra dig själv.', notfound: 'Ärendet finns inte längre.', wait: 'Vänta minst 30 minuter efter att ärendet blev pågående, så hinner ni åtgärda och dubbelkolla.', notprog: 'Flytta ärendet till Pågående först.', assignee: 'Bara den som fick uppdraget kan markera det klart.', target: 'Välj en kollega som kan ta uppdrag.' };

  /* invite or password-reset link: #access_token=…&type=invite|recovery */
  var hp = new URLSearchParams((location.hash || '').slice(1));
  var setPw = on && hp.get('access_token') && /invite|recovery|signup|magiclink/.test(hp.get('type') || '');
  if (setPw) {
    setAuth({ access_token: hp.get('access_token'), refresh_token: hp.get('refresh_token'), exp: Date.now() + (+hp.get('expires_in') || 3600) * 1000 });
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
  }

  var SSLIVE = window.SSLIVE = { on: on, setPw: setPw, data: null };
  window.SSLIVE_switch = function (id) { try { localStorage.setItem('ss-acc', id); } catch (e) {} location.replace('/app/'); };
  if (!on) return;
  document.documentElement.classList.add('live');

  SSLIVE.boot = function () {
    if (setPw) { document.addEventListener('DOMContentLoaded', pwScreen); return emptyS(); }
    var a = auth(); if (!a) toLogin();
    var r = xhr('GET', '/api/app?a=state' + accQ(), null, a.access_token);
    if (r.status === 0) { location.replace('/app/offline.html'); return emptyS(); }
    if (r.status === 401 && refreshSync()) r = xhr('GET', '/api/app?a=state' + accQ(), null, auth().access_token);
    if (r.status === 401) toLogin('expired');
    if (r.status === 423) toLogin('locked');
    if (r.status === 403) toLogin('noaccount');
    if (r.status !== 200) { document.addEventListener('DOMContentLoaded', function () { document.body.innerHTML = '<div style="max-width:520px;margin:80px auto;font-family:Inter,Arial;padding:20px"><h1>Översikten kunde inte laddas</h1><p>Försök igen om en stund. Om felet finns kvar, mejla hello@scansay.se.</p><p style="color:#6B7280">' + (r.data.error || r.status) + '</p><button onclick="location.reload()" style="padding:10px 16px;border-radius:10px;border:0;background:#1D4ED8;color:#fff;font-weight:700">Försök igen</button></div>'; }); return emptyS(); }
    var d = SSLIVE.data = r.data, st = d.state || {}, acc = d.account;
    SSLIVE.role = d.me.role; SSLIVE.full = /Ägare|Gruppadmin/.test(d.me.role);
    if (d.group) { SSLIVE.group = true; document.addEventListener('DOMContentLoaded', function () { var sc = document.createElement('script'); sc.src = '/app/group.js?v=2'; document.body.appendChild(sc); }); return emptyS(); }
    var S = { groups: st.groups || [], staff: st.staff || [], roster: st.roster || [], alerts: st.alerts || [], alertLog: st.alertLog || [], invites: [], companies: [],
      mbl: st.mbl || {}, retention: st.retention || 12, channels: st.channels, chcfg: st.chcfg || {}, urgent: st.urgent, esc: st.esc, pub: st.pub, reviews: st.reviews || {}, fb: d.feedback || [], imported: [],
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
    var st = {}; ['reviews', 'groups', 'staff', 'roster', 'alerts', 'alertLog', 'mbl', 'retention', 'channels', 'chcfg', 'urgent', 'esc', 'pub'].forEach(function (k) { if (S[k] !== undefined) st[k] = S[k]; });
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
  SSLIVE.invite = function (email, name, role, secs) { return call('POST', 'invite', { email: email, name: name, role: role, secs: secs || [] }); };
  SSLIVE.remove = function (uid) { return call('POST', 'remove', { user_id: uid }); };
  SSLIVE.forward = function (F, uid, note) { return call('POST', 'assign', { id: F.id, user_id: uid, note: note }); };
  SSLIVE.setMember = function (uid, patch) { return call('POST', 'member', Object.assign({ user_id: uid }, patch)); };
  SSLIVE.call = call;
  SSLIVE.logout = async function () {
    try { if (PS.sub) { var ep = PS.sub.endpoint; await Promise.race([call('POST', 'push_off', { endpoint: ep }), new Promise(function (r) { setTimeout(r, 2500); })]); await PS.sub.unsubscribe(); } } catch (e) {}
    setAuth(null); location.href = '../index.html#login';
  };
  SSLIVE.reload = async function () { var d = await call('GET', 'state'); if (SSLIVE.group) { return; } SSLIVE.getS().fb = d.feedback || []; SSLIVE.data.members = d.members; SSLIVE.data.messages = d.messages; render(); };

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
    document.querySelectorAll('header .logo div div, header .logo small').forEach(function (el) { if (/Företagsöversikt/.test(el.textContent)) el.textContent = (SSLIVE.group ? 'Koncernöversikt · ' : 'Företagsöversikt · ') + d.account.name; });
    if (SSLIVE.group) { var sc = document.getElementById('scope'); if (sc) (sc.closest('.scope') || sc).style.display = 'none'; }
    var h = document.querySelector('header');
    var sw = (d.accounts || []).length > 1 ? '<select onchange="SSLIVE_switch(this.value)" style="padding:6px 8px;border-radius:9px;border:1px solid #D1D5DB;background:#fff;color:#0F1013;font-weight:600">' + d.accounts.map(function (x) { return '<option value="' + x.id + '"' + (x.id === d.account.id ? ' selected' : '') + '>' + esc(x.name || '') + (x.kind === 'group' ? ' (koncern)' : '') + '</option>'; }).join('') + '</select>' : '';
    if (h && !document.getElementById('lo')) h.insertAdjacentHTML('beforeend', '<div class="liveme">' + sw + '<span>' + esc(d.me.email) + ' · ' + esc(roleName(d.me.role)) + '</span><button id="lo" class="btn sm line" onclick="SSLIVE.logout()">Logga ut</button></div>');
    if (d.account.parent) document.querySelectorAll('header .logo div div, header .logo small').forEach(function (el) { if (/Företagsöversikt/.test(el.textContent)) el.textContent = 'Företagsöversikt · ' + d.account.name + ' · del av ' + d.account.parent; });
    document.body.insertAdjacentHTML('beforeend', '<div id="livebar" style="display:none;position:fixed;bottom:12px;left:50%;transform:translateX(-50%);background:#B91C1C;color:#fff;padding:10px 16px;border-radius:12px;z-index:200;font-weight:700"></div>');
    setTimeout(chatLoad, 1200); setInterval(function () { if (document.visibilityState === 'visible' && TAB !== 'team') chatLoad(); }, 60000);
    if (SSLIVE.group) return;
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
  /* ---------- messages between the company and ScanSay ---------- */
  var MT = null;
  function threads() { var m = (SSLIVE.data && SSLIVE.data.messages) || [], t = {}; m.forEach(function (x) { (t[x.thread] = t[x.thread] || { id: x.thread, subject: x.subject, msgs: [], unread: 0 }).msgs.push(x); if (x.sender === 'admin' && !x.read_company) t[x.thread].unread++; });
    return Object.keys(t).map(function (k) { return t[k]; }).sort(function (a, b) { return Date.parse(b.msgs[b.msgs.length - 1].created_at) - Date.parse(a.msgs[a.msgs.length - 1].created_at); }); }
  SSLIVE.unread = function () { return threads().reduce(function (s, t) { return s + t.unread; }, 0); };
  /* ---------- Teams-style chat frame (used for the team chat and for the conversation with ScanSay) ---------- */
  var linkRe = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;
  function linkify(t) { return esc(t).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"&])/g, function (u) { return '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u + '</a>'; }); }
  function dayLabel(ts) { var d = new Date(ts), n = new Date(); var y = new Date(n); y.setDate(n.getDate() - 1); return d.toDateString() === n.toDateString() ? 'Idag' : d.toDateString() === y.toDateString() ? 'Igår' : d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' }); }
  function hm(ts) { var d = new Date(ts); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function initials(n) { return String(n || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(function (x) { return x[0].toUpperCase(); }).join(''); }
  var AVC = ['#1D4ED8', '#65A30D', '#7C3AED', '#0D9488', '#EA580C', '#DB2777', '#0EA5E9', '#B45309'];
  function avc(n) { var h = 0; String(n || '').split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) % 997; }); return AVC[h % AVC.length]; }
  function chatFrame(o) {
    var items = o.items || [], q = (o.q || '').trim().toLowerCase(), tab = o.tab || 'msgs', body = '';
    if (q) { var hits = (o.all || items).filter(function (m) { return String(m.body).toLowerCase().indexOf(q) >= 0 || String(m.by || '').toLowerCase().indexOf(q) >= 0; }).slice(-80).reverse();
      body = '<div class="csr">' + (hits.map(function (m) { return '<button class="chit" onclick="' + o.openJs + '(\'' + m.ch + '\')"><div class="cwho"><b>' + esc(m.by || '') + '</b> <span>' + esc(m.chName || '') + ' · ' + dayLabel(m.ts) + ' ' + hm(m.ts) + '</span></div><div>' + esc(m.body).replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>') + '</div></button>'; }).join('') || '<div class="cempty">Inga meddelanden matchar sökningen.</div>') + '</div>'; }
    else if (tab === 'links') { var L2 = []; items.forEach(function (m) { (String(m.body).match(linkRe) || []).forEach(function (u) { L2.push({ u: u, by: m.by, ts: m.ts }); }); });
      body = '<div class="csr">' + (L2.reverse().map(function (l) { return '<a class="clink" href="' + esc(l.u) + '" target="_blank" rel="noopener noreferrer"><span>🔗</span><div><b>' + esc(l.u.replace(/^https?:\/\//, '').slice(0, 70)) + '</b><small>' + esc(l.by || '') + ' · ' + dayLabel(l.ts) + ' ' + hm(l.ts) + '</small></div></a>'; }).join('') || '<div class="cempty">Inga länkar har delats här ännu.</div>') + '</div>'; }
    else { var last = ''; body = '<div class="cmsgs" id="cmsgs">' + (items.map(function (m) { var dl = dayLabel(m.ts), sep = dl !== last ? '<div class="cday"><span>' + dl + '</span></div>' : ''; last = dl;
        return sep + '<div class="cm ' + (m.mine ? 'me' : '') + '">' + (m.mine ? '' : '<span class="cav" style="background:' + avc(m.by) + '">' + esc(initials(m.by)) + '</span>') + '<div class="cb"><div class="cwho"><b>' + esc(m.mine ? 'Du' : m.by || '') + '</b> <span>' + hm(m.ts) + '</span></div><div class="ct">' + linkify(m.body) + '</div></div></div>'; }).join('') || '<div class="cempty">' + (o.empty || 'Inga meddelanden ännu. Skriv det första!') + '</div>') + '</div>'; }
    return '<div class="chat"><aside class="cside"><input class="csearch" type="search" placeholder="Sök i alla meddelanden…" value="' + esc(o.q || '') + '" oninput="' + o.searchJs + '(this.value)">' + o.side + '</aside>' +
      '<section class="cmain"><div class="chead"><div><b>' + esc(o.title || '') + '</b>' + (o.sub ? '<small>' + esc(o.sub) + '</small>' : '') + '</div><div class="ctabs"><button class="' + (tab === 'msgs' && !q ? 'on' : '') + '" onclick="' + o.tabJs + '(\'msgs\')">Meddelanden</button><button class="' + (tab === 'links' && !q ? 'on' : '') + '" onclick="' + o.tabJs + '(\'links\')">Länkar</button></div></div>' + body +
      (o.canSend === false || q || tab === 'links' ? '' : '<div class="ccomp"><textarea id="' + o.inputId + '" rows="2" placeholder="' + esc(o.ph || 'Skriv ett meddelande…') + '" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();' + o.sendJs + '}"></textarea><button class="btn pri" onclick="' + o.sendJs + '">Skicka</button></div>') + '</section></div>';
  }
  function scrollChat() { setTimeout(function () { var m = document.getElementById('cmsgs'); if (m) m.scrollTop = m.scrollHeight; }, 0); }

  /* ---------- team chat: everyone in the company, direct messages, and the koncern chat for owners and managers ---------- */
  var CH = { data: null, cur: 'own|team', q: '', tab: 'msgs', busy: false, t: null };
  function seen(k, v) { try { var o = JSON.parse(localStorage.getItem('ss-chatseen') || '{}'); if (v) { o[k] = v; localStorage.setItem('ss-chatseen', JSON.stringify(o)); } return o[k] || 0; } catch (e) { return 0; } }
  function chKey(m) { return m.scope + '|' + m.channel; }
  function dmCh(scope, other) { var ids = [SSLIVE.data.me.id, other].sort(); return scope + '|' + (scope === 'k' ? 'kdm:' : 'dm:') + ids.join('|'); }
  async function chatLoad() { if (CH.busy || !SSLIVE.data || !SSLIVE.data.me) return; CH.busy = true; try { CH.data = await call('GET', 'chat'); CH.at = Date.now(); } catch (e) { CH.err = e.message; } CH.busy = false; if (typeof TAB !== 'undefined' && TAB === 'team') { render(); scrollChat(); } else { try { render(); } catch (e) {} } }
  SSLIVE.chatUnread = function () { if (!CH.data || !SSLIVE.data) return 0; var me = CH.data.me; return CH.data.msgs.filter(function (m) { return m.user_id !== me && Date.parse(m.created_at) > seen(chKey(m)); }).length; };
  function chName(k) { var p = k.split('|'), sc = p[0], ch = p.slice(1).join('|'); if (ch === 'team') return '# Alla i ' + (SSLIVE.data.account.name || 'företaget'); if (ch === 'koncern') return '# Koncernen ' + (CH.data.koncern || '');
    var ids = ch.replace(/^k?dm:/, '').split('|'), o = ids.find(function (x) { return x !== SSLIVE.data.me.id; }) || ids[0], pp = (CH.data.people || []).find(function (x) { return x.user_id === o && x.scope === sc; }); return pp ? pp.name + (sc === 'k' && pp.company ? ' · ' + pp.company : '') : 'Tidigare användare'; }
  SSLIVE.teamV = function () {
    if (!CH.data) { chatLoad(); return '<h1>Team</h1><div class="card sub">Laddar chatten…</div>'; }
    var gap = Date.now() - (CH.vAt || 0); CH.vAt = Date.now();
    if ((gap > 2000 || Date.now() - (CH.at || 0) > 8000) && !CH.busy) setTimeout(chatLoad, 0);
    clearTimeout(CH.t); CH.t = setTimeout(function () { if (TAB === 'team' && !document.querySelector('#ctin:focus')) chatLoad(); }, 15000);
    var me = CH.data.me, all = CH.data.msgs.map(function (m) { var k = chKey(m); return { ch: k, chName: '', by: m.by_name, body: m.body, ts: Date.parse(m.created_at), mine: m.user_id === me, uid: m.user_id }; });
    all.forEach(function (m) { m.chName = chName(m.ch); });
    var items = all.filter(function (m) { return m.ch === CH.cur; });
    if (items.length) seen(CH.cur, items[items.length - 1].ts + 1);
    var unread = function (k) { return all.filter(function (m) { return m.ch === k && !m.mine && m.ts > seen(k); }).length; };
    var row = function (k, label, sub, col) { var u = unread(k); return '<button class="cch ' + (CH.cur === k ? 'on' : '') + '" onclick="SSLIVE.chOpen(\'' + k + '\')"><span class="cav sm" style="background:' + (col || avc(label)) + '">' + (label[0] === '#' ? '#' : esc(initials(label))) + '</span><span class="cnm"><b>' + esc(label.replace(/^# /, '')) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' + (u ? '<span class="cnt">' + u + '</span>' : '') + '</button>'; };
    var side = '<div class="cgh">Kanaler</div>' + row('own|team', '# Alla', SSLIVE.data.account.name, '#1D4ED8') + (CH.data.koncern ? row('k|koncern', '# Koncernen', CH.data.koncern, '#65A30D') : '') +
      '<div class="cgh">Direktmeddelanden</div>' + (CH.data.people || []).filter(function (p) { return p.user_id !== me; }).map(function (p) { return row(dmCh(p.scope, p.user_id), p.name, (p.scope === 'k' ? p.company + ' · ' : '') + roleName(p.role)); }).join('');
    var h = chatFrame({ side: side, title: chName(CH.cur), sub: /\|team$/.test(CH.cur) ? 'Alla i företaget ser kanalen' : /\|koncern$/.test(CH.cur) ? 'Ägaren och alla hotellchefer' : 'Bara ni två ser samtalet', items: items, all: all, q: CH.q, tab: CH.tab,
      openJs: 'SSLIVE.chOpen', searchJs: 'SSLIVE.chSearch', tabJs: 'SSLIVE.chTab', inputId: 'ctin', sendJs: 'SSLIVE.chSend()', ph: 'Skriv till ' + chName(CH.cur) + '…  (Enter skickar, Shift+Enter ny rad)' });
    scrollChat();
    return '<div class="row between" style="margin-bottom:12px"><div><h1>Team</h1><div class="sub">Chatta med kollegorna. Meddelanden sparas i 12 månader och raderas när en person slutar.</div></div></div>' + h;
  };
  SSLIVE.chOpen = function (k) { CH.cur = k; CH.q = ''; CH.tab = 'msgs'; render(); scrollChat(); setTimeout(function () { var e = document.getElementById('ctin'); if (e) e.focus(); }, 30); };
  SSLIVE.chSearch = function (v) { CH.q = v; clearTimeout(CH.st); CH.st = setTimeout(function () { render(); var e = document.querySelector('.csearch'); if (e) { e.focus(); e.setSelectionRange(e.value.length, e.value.length); } }, 250); };
  SSLIVE.chTab = function (t) { CH.tab = t; CH.q = ''; render(); scrollChat(); };
  SSLIVE.chSend = async function () { var el = document.getElementById('ctin'), t = el && el.value.trim(); if (!t) return; var p = CH.cur.split('|'); el.value = '';
    try { await call('POST', 'chat_send', { scope: p[0], channel: p.slice(1).join('|'), text: t }); await chatLoad(); } catch (e) { el.value = t; toast('Kunde inte skicka: ' + e.message); } };
  SSLIVE.chatLoad = chatLoad;

  /* ---------- conversation with ScanSay, in the same chat style ---------- */
  var MQ = '', MTAB = 'msgs';
  SSLIVE.msgsV = function () {
    var L = threads(); if (MT === null && L[0]) MT = L[0].id; var t = L.find(function (x) { return x.id === MT; });
    if (t && t.unread) { t.msgs.forEach(function (x) { x.read_company = true; }); call('POST', 'msg_read', { thread: t.id }).catch(function () {}); }
    var all = []; L.forEach(function (x) { x.msgs.forEach(function (m) { all.push({ ch: x.id, chName: x.subject || 'Meddelande', by: m.sender === 'admin' ? 'ScanSay' : m.by_name, body: m.body, ts: Date.parse(m.created_at), mine: m.sender !== 'admin' }); }); });
    var side = '<button class="btn pri" style="width:100%;margin-bottom:10px" onclick="SSLIVE.msgNew()">+ Nytt meddelande</button><div class="cgh">Konversationer med ScanSay</div>' + (L.map(function (x) { var last = x.msgs[x.msgs.length - 1]; return '<button class="cch ' + (x.id === MT ? 'on' : '') + '" onclick="SSLIVE.msgOpen(\'' + x.id + '\')"><span class="cav sm" style="background:#1D4ED8">S</span><span class="cnm"><b>' + esc(x.subject || 'Meddelande') + '</b><small>' + esc(String(last.body).slice(0, 40)) + '</small></span>' + (x.unread ? '<span class="cnt">' + x.unread + '</span>' : '') + '</button>'; }).join('') || '<div class="sub" style="padding:8px">Inga konversationer ännu.</div>');
    var head = '<div class="row between" style="margin-bottom:12px"><div><h1>Meddelanden</h1><div class="sub">Er kontakt med ScanSay: avtal, faktura, fler QR-koder eller hjälp. Svar kommer hit och som e-post.</div></div></div>';
    if (MT === 'new') return head + '<div class="chat"><aside class="cside">' + side + '</aside><section class="cmain"><div class="chead"><div><b>Nytt meddelande till ScanSay</b><small>Vi svarar oftast inom en arbetsdag</small></div></div><div style="padding:16px;display:grid;gap:10px"><input id="mn_s" type="text" placeholder="Ämne, t.ex. Fler QR-koder till nya flygeln"><textarea id="mn_t" rows="7" placeholder="Skriv ditt meddelande…"></textarea><div class="row"><button class="btn pri" onclick="SSLIVE.msgSend()">Skicka</button><button class="btn line" onclick="SSLIVE.msgOpen(null)">Avbryt</button></div></div></section></div>';
    if (!t) return head + '<div class="card"><div class="sub">Inga meddelanden ännu.</div><button class="btn pri" style="margin-top:10px" onclick="SSLIVE.msgNew()">Skriv till ScanSay</button></div>';
    var items = all.filter(function (m) { return m.ch === t.id; });
    scrollChat();
    return head + chatFrame({ side: side, title: t.subject || 'Meddelande', sub: 'Konversation med ScanSay', items: items, all: all, q: MQ, tab: MTAB, openJs: 'SSLIVE.msgOpen', searchJs: 'SSLIVE.msgSearch', tabJs: 'SSLIVE.msgTab', inputId: 'mr_t', sendJs: "SSLIVE.msgSend('" + t.id + "')", ph: 'Skriv ett svar till ScanSay…' });
  };
  SSLIVE.msgSearch = function (v) { MQ = v; clearTimeout(SSLIVE._mq); SSLIVE._mq = setTimeout(function () { render(); var e = document.querySelector('.csearch'); if (e) { e.focus(); e.setSelectionRange(e.value.length, e.value.length); } }, 250); };
  SSLIVE.msgTab = function (t) { MTAB = t; MQ = ''; render(); };
  SSLIVE.msgOpen = function (id) { MT = id; MQ = ''; MTAB = 'msgs'; render(); scrollChat(); };
  /* company details the owner/manager can change */
  SSLIVE.settingsV = function () {
    var A = SSLIVE.data.account, f = function (id, l, v, t, ph) { return '<label style="display:grid;gap:5px;font-weight:600">' + l + '<input id="' + id + '" type="' + (t || 'text') + '" value="' + esc(v || '') + '" placeholder="' + (ph || '') + '"></label>'; };
    var R = A.roles || {}, rk = Object.keys(R).filter(function (k) { return R[k] > 0; });
    return '<h1>Företaget</h1><div class="sub" style="margin-bottom:12px">Namn och kontaktuppgifter. Namnet visas för gästerna i formuläret och i mejlen.</div><div class="grid g32"><div class="card"><h2>Uppgifter</h2><div class="grid g2" style="gap:10px">' +
      f('s_n', 'Företagets namn', A.name) + f('s_o', 'Org.nr', A.org, 'text', '556677-8899') + f('s_c', 'Ort', A.city) + f('s_p', 'Telefon', A.phone, 'tel') + f('s_e', 'E-post för fakturor och besked från ScanSay', A.email, 'email') +
      '</div><div class="row" style="margin-top:12px"><button class="btn pri" onclick="SSLIVE.saveSettings()">Spara</button></div></div>' +
      '<div class="card"><h2>Ert paket</h2><div class="sub" style="line-height:1.7">Paket: <b>' + esc(A.plan || '–') + '</b><br>Inloggningar: 1 ägare' + rk.map(function (k) { return ', ' + R[k] + ' ' + roleName(k).toLowerCase(); }).join('') + (A.kind === 'group' ? '<br>Dotterbolag: upp till <b>' + A.max_children + '</b>' : '') + (A.parent ? '<br>Del av koncernen <b>' + esc(A.parent) + '</b>' : '') + '</div><p class="sub" style="margin-top:10px">Vill ni ändra paketet, fler inloggningar eller fler dotterbolag? Skriv till oss under <a href="javascript:void 0" onclick="TAB=\'msgs\';render()">Meddelanden</a>.</p></div></div>';
  };
  SSLIVE.saveSettings = async function () {
    var v = function (id) { return document.getElementById(id).value.trim(); };
    try { await call('POST', 'account_update', { name: v('s_n'), org: v('s_o'), city: v('s_c'), phone: v('s_p'), email: v('s_e') }); var d = await call('GET', 'state'); SSLIVE.data.account = d.account;
      document.querySelectorAll('header .logo div div, header .logo small').forEach(function (el) { if (/översikt ·/i.test(el.textContent)) el.textContent = el.textContent.replace(/· [^·]+/, '· ' + d.account.name); });
      toast('Sparat. Det nya namnet syns i formuläret och i mejlen.'); render(); } catch (e) { toast('Kunde inte spara: ' + e.message); }
  };
  window.liveRename = async function (uid, cur) { var n = prompt('Nytt namn', cur || ''); if (n === null) return; try { await SSLIVE.setMember(uid, { name: n }); toast('Namnet är ändrat'); await SSLIVE.reload(); } catch (x) { toast(x.message); } };
  SSLIVE.msgNew = function () { MT = 'new'; render(); };
  SSLIVE.msgSend = async function (thread) {
    var tx = document.getElementById(thread ? 'mr_t' : 'mn_t').value.trim(); if (tx.length < 2) return toast('Skriv ett meddelande först.');
    try { var r = await call('POST', thread ? 'msg_reply' : 'msg_new', { thread: thread, subject: thread ? undefined : document.getElementById('mn_s').value.trim(), text: tx }); var d = await call('GET', 'state'); SSLIVE.data.messages = d.messages; MT = r.thread; render(); toast('Skickat till ScanSay'); }
    catch (e) { toast('Kunde inte skicka: ' + e.message); }
  };
  /* ---------- the manager's view of the team: who answered, solved and finished tasks ---------- */
  window.teamCard = function () {
    var S = SSLIVE.getS(), d = SSLIVE.data, L = S.fb.filter(function (f) { return inScope(f) && per(f); });
    var med = function (a) { if (!a.length) return null; a = a.slice().sort(function (x, y) { return x - y; }); var m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
    var dur = function (ms) { if (ms == null) return '–'; var h = ms / 36e5; return h < 1 ? Math.max(1, Math.round(ms / 6e4)) + ' min' : h < 48 ? (Math.round(h * 10) / 10).toString().replace('.', ',') + ' tim' : Math.round(h / 24) + ' d'; };
    var nm = function (m) { return m.name || m.email; };
    var agents = (d.members || []).filter(function (m) { return m.role === 'Handläggare' || m.role === 'Ägare' || m.role === 'Gruppadmin'; }).map(function (m) { var n = nm(m);
      var rep = L.filter(function (f) { return (f.replies || []).some(function (r) { return !r.internal && !r.guest && (r.by === n || r.email === m.email); }); });
      var sol = L.filter(function (f) { return f.fixedBy === n || f.fixedBy === m.email; });
      return { n: n, role: m.role, rep: rep.length, sol: sol.length, t: med(sol.map(function (f) { return (f.fixTs || f.ts) - f.ts; })), task: L.filter(function (f) { return (f.replies || []).some(function (r) { return r.assign && (r.by === n || r.email === m.email); }); }).length }; }).filter(function (x) { return x.role === 'Handläggare' || x.rep || x.sol; });
    var staff = (d.members || []).filter(function (m) { return m.role === 'Medarbetare'; }).map(function (m) { var n = nm(m), t = L.filter(function (f) { return f.assignedName === n || f.assignedTo === m.user_id; }), dn = t.filter(function (f) { return f.taskDoneTs; });
      return { n: n, t: t.length, dn: dn.length, open: t.length - dn.length, tm: med(dn.map(function (f) { return f.taskDoneTs - f.assignedTs; })) }; });
    var praise = {}; L.filter(function (f) { return f.type === 'p'; }).forEach(function (f) { var k = f.secName || 'Övrigt'; praise[k] = (praise[k] || 0) + 1; });
    var pk = Object.keys(praise).sort(function (a, b) { return praise[b] - praise[a]; });
    var open = L.filter(function (f) { return f.status === 'new' && f.type !== 'p'; }).length, prog = L.filter(function (f) { return f.status === 'prog'; }).length, tasks = L.filter(function (f) { return f.assignedName && !f.taskDoneTs && f.status !== 'fix'; }).length;
    return '<div class="card tcard" style="margin-top:14px"><div class="row between"><h2 style="margin:0">Teamet</h2><div class="row" style="gap:8px"><span class="tag t-new">' + open + ' nya</span><span class="tag t-prog">' + prog + ' pågående</span><span class="tag" style="background:#FEF3C7!important;color:#78350F!important">' + tasks + ' uppdrag väntar</span></div></div>' +
      '<div class="grid g2" style="gap:14px;margin-top:12px"><div style="overflow-x:auto"><b class="tsub">Handläggare</b><table><thead><tr><th>Namn</th><th>Besvarade</th><th>Lösta</th><th>Uppdrag skickade</th><th>Tid till löst</th></tr></thead><tbody>' +
      (agents.map(function (x) { return '<tr><td><b>' + esc(x.n) + '</b><div class="sub">' + esc(roleName(x.role)) + '</div></td><td>' + x.rep + '</td><td><b style="color:#15803D">' + x.sol + '</b></td><td>' + x.task + '</td><td>' + dur(x.t) + '</td></tr>'; }).join('') || '<tr><td colspan="5" class="sub">Inga handläggare ännu. Bjud in under Användare.</td></tr>') + '</tbody></table></div>' +
      '<div style="overflow-x:auto"><b class="tsub">Medarbetare</b><table><thead><tr><th>Namn</th><th>Uppdrag</th><th>Klara</th><th>Väntar</th><th>Tid till klart</th></tr></thead><tbody>' +
      (staff.map(function (x) { return '<tr><td><b>' + esc(x.n) + '</b></td><td>' + x.t + '</td><td><b style="color:#15803D">' + x.dn + '</b></td><td>' + (x.open ? '<b style="color:#B45309">' + x.open + '</b>' : '0') + '</td><td>' + dur(x.tm) + '</td></tr>'; }).join('') || '<tr><td colspan="5" class="sub">Inga medarbetare ännu.</td></tr>') + '</tbody></table></div></div>' +
      '<div style="margin-top:12px"><b class="tsub">Beröm per avdelning</b><div class="row" style="gap:8px;margin-top:6px;flex-wrap:wrap">' + (pk.map(function (k) { return '<span class="tag t-p">👏 ' + esc(k) + ' · ' + praise[k] + '</span>'; }).join('') || '<span class="sub">Inget beröm i perioden ännu.</span>') + '</div></div></div>';
  };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function liveUsers() {
    var d = SSLIVE.data, me = d.me.role, all = d.members || [], secs = secNames();
    var RK = { 'Ägare': 5, 'Gruppadmin': 4, 'Handläggare': 3, 'Medarbetare': 1, 'Läsare': 1 };
    var can = function (t) { return (/Ägare|Gruppadmin/.test(me) && RK[t] < RK[me]) || (me === 'Handläggare' && t === 'Medarbetare'); };
    var roles = ['Handläggare', 'Medarbetare', 'Läsare', 'Gruppadmin'].filter(can), m = me === 'Handläggare' ? all.filter(function (x) { return x.role === 'Medarbetare' || x.user_id === d.me.id; }) : all;
    var Q = d.account.roles || {}, used = function (r) { return all.filter(function (x) { return x.role === r; }).length; };
    var RD = { 'Gruppadmin': 'Biträdande chef: samma som chefen, utom att ta bort chefen.', 'Handläggare': 'Handläggare: inkorgen. Svarar gästerna, skickar uppdrag till medarbetarna och avslutar ärendena.', 'Medarbetare': 'Medarbetare (t.ex. städ, teknik, parkering, säkerhet): får uppdrag i mobilen och trycker Klart när det är gjort.', 'Läsare': 'Läsare: bara statistik, inga meddelanden.' };
    var roleSel = function (id, cur) { return '<select id="' + id + '" onchange="liveRole(this)">' + roles.concat(roles.indexOf(cur) < 0 ? [cur] : []).map(function (r) { return '<option value="' + r + '"' + (r === cur ? ' selected' : '') + '>' + roleName(r) + '</option>'; }).join('') + '</select>'; };
    var secBox = function (pre, cur) { return secs.length ? '<div class="psecs" style="margin-top:6px">' + secs.map(function (n) { return '<label><input type="checkbox" class="' + pre + '" value="' + esc(n) + '"' + (cur.indexOf(n) >= 0 ? ' checked' : '') + '> ' + esc(n) + '</label>'; }).join('') + '</div>' : ''; };
    var quota = Object.keys(Q).length ? '<div class="qrow">' + ['Gruppadmin', 'Handläggare', 'Medarbetare', 'Läsare'].filter(function (r) { return Q[r] > 0 || used(r); }).map(function (r) { var u = used(r), q = Q[r] || 0; return '<span class="qpill' + (u >= q ? ' full' : '') + '"><b>' + u + '/' + q + '</b> ' + roleName(r).toLowerCase() + '</span>'; }).join('') + '</div>' : '';
    var tagc = { 'Ägare': '#1D4ED8', 'Gruppadmin': '#1D4ED8', 'Handläggare': '#7C3AED', 'Medarbetare': '#0D9488', 'Läsare': '#6B7280' };
    return '<h1>' + (me === 'Handläggare' ? 'Medarbetare' : 'Användare') + '</h1><div class="sub" style="margin-bottom:10px">' + (me === 'Handläggare' ? 'Lägg till och ta bort medarbetare som får uppdrag från dig.' : 'Varje person får en egen inloggning och ser bara det rollen tillåter. Du kan lägga till och ta bort roller under din egen.') + '</div>' + quota + '<div class="grid g32">' +
      '<div class="card" style="overflow-x:auto"><table><thead><tr><th>Namn</th><th>E-post</th><th>Roll</th><th></th></tr></thead><tbody>' +
      m.map(function (x) { var ok = can(x.role) && x.user_id !== d.me.id;
        return '<tr><td><span class="cav sm" style="background:' + (tagc[x.role] || '#6B7280') + ';margin-right:8px">' + esc(initials(x.name || x.email)) + '</span><b>' + esc(x.name || '–') + '</b>' + (ok || x.user_id === d.me.id ? ' <button class="btn sm line" style="padding:2px 8px" onclick="liveRename(\'' + x.user_id + '\',' + esc(JSON.stringify(x.name || '')).replace(/'/g, '&#39;') + ')">✎</button>' : '') + '</td><td>' + esc(x.email || '') + '</td><td>' + (ok && /Ägare|Gruppadmin/.test(me) ? roleSel('r_' + x.user_id, x.role) : '<span class="tag" style="background:' + tagc[x.role] + '1A!important;color:' + tagc[x.role] + '!important;-webkit-text-fill-color:' + tagc[x.role] + '!important">' + esc(roleName(x.role)) + '</span>') + '</td><td>' + (ok ? '<button class="btn sm red" onclick="liveRemove(\'' + x.user_id + '\')">Ta bort</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<div class="sub" style="margin-top:10px">När någon tas bort raderas inloggningen och personens privata chattar. Pågående uppdrag går tillbaka till inkorgen.</div></div>' +
      (roles.length ? '<div class="card"><h2>Lägg till en person</h2><div class="grid" style="gap:8px"><input id="ln" type="text" placeholder="Namn"><input type="email" id="le" placeholder="namn@foretag.se"><select id="lr" onchange="document.getElementById(\'lsecs\').style.display=this.value===\'Medarbetare\'?\'block\':\'none\';document.getElementById(\'lrd\').textContent=(' + JSON.stringify(RD).replace(/"/g, '&quot;') + ')[this.value]">' + roles.map(function (r) { return '<option value="' + r + '">' + roleName(r) + '</option>'; }).join('') + '</select>' +
        '<div class="sub" id="lrd">' + RD[roles[0]] + '</div><div id="lsecs" style="display:' + (roles[0] === 'Medarbetare' ? 'block' : 'none') + '">' + (secs.length ? '<b style="font-size:13px">Avdelningar (för akuta larm)</b>' : '') + secBox('ls', []) + '</div><button class="btn pri" onclick="liveInvite()">Skicka inbjudan</button></div><div class="sub" style="margin-top:10px">Länken i mejlet gäller i 24 timmar. Personen väljer själv sitt lösenord.</div></div>' : '') + '</div>';
  }
  window.liveInvite = async function () {
    var e = document.getElementById('le').value.trim(), n = document.getElementById('ln').value.trim(), r = document.getElementById('lr').value;
    var secs = [].slice.call(document.querySelectorAll('.ls:checked')).map(function (x) { return x.value; });
    try { await SSLIVE.invite(e, n, r, secs); toast('Inbjudan skickad till ' + e); await SSLIVE.reload(); } catch (x) { toast(x.message); }
  };
  window.liveRole = async function (el) { var uid = el.id.slice(2); try { await SSLIVE.setMember(uid, { role: el.value }); toast('Rollen är ändrad'); await SSLIVE.reload(); } catch (x) { toast(x.message); } };
  window.liveSecs = async function (uid) { var secs = [].slice.call(document.querySelectorAll('.ms_' + uid + ':checked')).map(function (x) { return x.value; }); try { await SSLIVE.setMember(uid, { secs: secs }); toast('Avdelningarna är sparade'); await SSLIVE.reload(); } catch (x) { toast(x.message); } };
  window.liveRemove = async function (uid) { if (!confirm('Ta bort personens inloggning?')) return; try { await SSLIVE.remove(uid); toast('Borttagen'); await SSLIVE.reload(); } catch (x) { toast(x.message); } };
})();
