/* ScanSay · offert och avtal (svensk rätt, B2B). Delas av admin, signeringssidan och servern.
   MALL: låt en svensk jurist granska texterna innan skarp användning. */
(function (root) {
  const VERSION = '2026-11-05';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const kr = n => Math.round(+n || 0).toLocaleString('sv-SE') + ' kr';
  const date = t => { const d = t ? new Date(t) : new Date(); return isNaN(d) ? String(t) : d.toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' }); };
  const SELLER = { name: 'ScanSay AB', org: '559XXX-XXXX', address: 'Adress, postnummer och ort', email: 'hello@scansay.se', web: 'scansay.se', bankgiro: 'XXX-XXXX', vatNo: 'SE559XXXXXXX01' };
  const PLAN_NAMES = { start: 'Liten', pro: 'Mellan', business: 'Stor', enterprise: 'Företag', s: 'Liten', m: 'Mellan', l: 'Stor', e: 'Företag' };

  /* d = { no, date, seller{}, customer{name,org,contact,email,phone,address}, plan, industry, places, unit, agents, price, interval:'month'|'year',
           method:'stripe'|'invoice', start, termMonths, autoRenew, noticeDays, invoiceDays, vat, note, validDays } */
  function norm(d) {
    const s = Object.assign({}, SELLER, d.seller || {});
    return Object.assign({ no: 'OFF-' + Date.now().toString().slice(-6), date: Date.now(), interval: 'month', method: 'invoice', termMonths: 12, autoRenew: true, noticeDays: 30, invoiceDays: 30, vat: 25, validDays: 14, agents: 3, places: 10, unit: 'platser' }, d, { seller: s, customer: Object.assign({}, d.customer || {}) });
  }
  function period(d) { return d.interval === 'year' ? 'år' : 'månad'; }

  function offer(d0) {
    const d = norm(d0), c = d.customer, s = d.seller, per = period(d), vatAmt = d.price * d.vat / 100;
    const pay = d.method === 'stripe'
      ? `Kortbetalning via Stripe. Kortet debiteras i förskott vid avtalsstart och därefter automatiskt vid början av varje ny ${per}. Kunden får kvitto per e-post vid varje dragning.`
      : `Faktura i förskott per ${per}, betalningsvillkor ${d.invoiceDays} dagar netto. Betalning till bankgiro ${esc(s.bankgiro)}. Ange fakturanummer som referens.`;
    const renew = d.autoRenew
      ? `Avtalet förlängs automatiskt med en ${d.termMonths ? 'ny avtalsperiod om ' + d.termMonths + ' månader' : per} åt gången om det inte sägs upp senast ${d.noticeDays} dagar före periodens slut.`
      : `Avtalet upphör vid avtalsperiodens slut utan uppsägning.`;
    return `<div class="ctr">
<div class="ctr-h"><div class="ctr-brand"><span class="ctr-logo">${LOGO}</span><b>ScanSay</b></div><div class="ctr-meta"><b>Offert och avtal</b><span>Nr ${esc(d.no)} · ${date(d.date)}</span><span>Avtalsversion ${VERSION}</span></div></div>

<div class="ctr-parties"><div><small>Leverantör</small><b>${esc(s.name)}</b><span>Org.nr ${esc(s.org)}</span><span>${esc(s.address)}</span><span>${esc(s.email)} · ${esc(s.web)}</span></div>
<div><small>Kund</small><b>${esc(c.name)}</b><span>Org.nr ${esc(c.org || 'anges vid signering')}</span><span>${esc(c.address || '')}</span><span>Kontaktperson: ${esc(c.contact)} · ${esc(c.email)}${c.phone ? ' · ' + esc(c.phone) : ''}</span></div></div>

<h3 class="ctr-s">1. Det här ingår</h3>
<table class="ctr-t">
<tr><td>Tjänst</td><td><b>ScanSay ${esc(PLAN_NAMES[d.plan] || d.plan)}</b>: QR-baserad feedback med verifiering av avsändare (engångskod via sms eller e-post), översikt med inkorg, larm, statistik och svar till gäst.</td></tr>
<tr><td>Bransch</td><td>${esc(d.industry || '')}</td></tr>
<tr><td>Antal platser</td><td>${esc(d.places)} ${esc(d.unit)} (en unik QR-kod per plats)</td></tr>
${d.roles && Object.keys(d.roles).length ? `<tr><td>Inloggningar</td><td>1 ägare${['Gruppadmin', 'Handläggare', 'Medarbetare', 'Läsare'].filter(k => d.roles[k] > 0).map(k => ', ' + esc(d.roles[k]) + ' ' + ({ Gruppadmin: d.roles[k] === 1 ? 'chef' : 'chefer', Handläggare: 'handläggare', Medarbetare: 'medarbetare', Läsare: 'läsare' })[k]).join('')}${d.kind === 'group' ? ' per företag' : ''}. Chefer ser allt, handläggare svarar gäster, medarbetare ser sina avdelningar och läsare ser statistik.</td></tr>` : `<tr><td>Antal agenter</td><td>${esc(d.agents)} inloggningar för kundens chefer och handläggare</td></tr>`}
${d.kind === 'group' ? `<tr><td>Koncern</td><td><b>Moderbolag med upp till ${esc(d.children || 0)} dotterbolag.</b> Moderbolaget ser statistik för alla dotterbolag men inte gästernas meddelanden, och skapar själv dotterbolagen i översikten. Varje dotterbolag får samma innehåll som anges ovan.</td></tr>` : ''}
<tr><td>Personalmodul</td><td>${d.staff ? '<b>Ingår.</b> Medarbetare kan logga in, checka in på sitt pass och se sin egen feedback. Särskilda villkor i bilaga 2.' : 'Ingår inte. Kan läggas till senare genom ett tillägg till avtalet.'}</td></tr>
<tr><td>AI-funktioner</td><td>${d.ai === false ? 'Avstängda.' : 'Sammanfattningar och svarsförslag. AI-leverantören finns inom EU och tränar inte på Kundens data. AI fattar inga beslut om enskilda personer.'}</td></tr>
<tr><td>Dekaler</td><td>Kunden skapar och skriver ut dekaler i översikten. Tryckta dekaler beställs separat.</td></tr>
<tr><td>Support</td><td>E-post vardagar 09–17, svar inom en arbetsdag</td></tr>
</table>

<h3 class="ctr-s">2. Pris och betalning</h3>
<table class="ctr-t">
<tr><td>Pris</td><td><b>${kr(d.price)} per ${per}</b> exklusive moms</td></tr>
<tr><td>Moms ${d.vat} %</td><td>${kr(vatAmt)}</td></tr>
<tr><td>Att betala per ${per}</td><td><b>${kr(d.price + vatAmt)}</b> inklusive moms</td></tr>
<tr><td>Betalsätt</td><td>${pay}</td></tr>
<tr><td>Avtalsstart</td><td>${date(d.start)}</td></tr>
<tr><td>Avtalsperiod</td><td>${d.termMonths ? d.termMonths + ' månader' : 'Löpande per ' + per}</td></tr>
<tr><td>Förlängning</td><td>${renew}</td></tr>
</table>
${d.note ? `<p class="ctr-note">${esc(d.note)}</p>` : ''}
<p class="ctr-small">Offerten gäller i ${d.validDays} dagar från datumet ovan. Avtalet blir bindande när kunden signerar elektroniskt. Priser exklusive moms. Kunden ingår avtalet i sin näringsverksamhet.</p>

<h3 class="ctr-s">3. Allmänna villkor</h3>
${TERMS(d)}

<h3 class="ctr-s">Bilaga 1. Personuppgiftsbiträdesavtal (sammanfattning)</h3>
${PUB(d)}
${d.staff ? STAFF(d) : ''}${TEAM(d)}

<div class="ctr-sign" id="ctr-sign"><div><small>För ${esc(s.name)}</small><span class="ctr-sigl">${SIG}</span><span>Behörig firmatecknare · ${date(d.date)}</span></div>
<div><small>För ${esc(c.name)}</small><span class="ctr-sigl ctr-empty" data-sign-slot>Signeras elektroniskt</span><span data-sign-meta>Namn, titel och datum fylls i vid signering</span></div></div>
</div>`;
  }


  function TEAM(d) {
  const L = [
    ['Roller', 'Kunden ger varje användare en roll: Ägare, Chef, Handläggare, Medarbetare eller Läsare. En användare kan bara lägga till eller ta bort användare med lägre roll. Antalet användare per roll följer paketet i offerten.'],
    ['Ärenden och uppdrag', 'Handläggare kan skicka ett ärende som uppdrag till en medarbetare. Namn och tidpunkter för uppdraget sparas i ärendet så att uppföljningen blir rätt. Ett ärende kan markeras som löst tidigast 30 minuter efter att det flyttats till Pågående.'],
    ['Teamchatt', 'Användarna kan skriva till varandra i Kundens chatt. Kunden ansvarar för att chatten inte används för känsliga personuppgifter om gäster. Chattmeddelanden raderas automatiskt efter 12 månader, och privata meddelanden med en användare raderas när användaren tas bort.'],
    ['Begränsningar', 'Uppgifter om enskilda medarbetares uppdrag får inte vara enda underlag för beslut om anställning, lön eller disciplinära åtgärder.']
  ];
  return '<h3 class="ctr-s">Bilaga 3. Användare, roller, uppdrag och teamchatt</h3><ol class="ctr-ol">' + L.map(([h, t]) => '<li><b>' + h + '.</b> ' + t + '</li>').join('') + '</ol>';
}
function STAFF(d) {
    const L = [
      ['Syfte', 'Personalmodulen gör det möjligt för medarbetare att logga in, checka in på sitt pass och se feedback som rör deras arbetsplats. Syftet är att förbättra service och arbetsmiljö, inte att kontrollera enskilda medarbetare.'],
      ['Kundens ansvar före start', 'Innan modulen används ska Kunden (a) göra en konsekvensbedömning (DPIA) enligt artikel 35 i dataskyddsförordningen, (b) informera berörda medarbetare skriftligt enligt artikel 13, och (c) fullgöra sin informations- och förhandlingsskyldighet enligt lagen (1976:580) om medbestämmande i arbetslivet (MBL) om arbetsplatsen har kollektivavtal. ScanSay tillhandahåller mallar men ansvarar inte för att Kunden fullgör dessa skyldigheter.'],
      ['Statistik per medarbetare', 'Statistik kopplad till namngivna medarbetare är avstängd som standard. Kunden kan slå på den först när punkterna ovan är uppfyllda och ett datum för MBL-förhandling har angetts i översikten. Gäster ser aldrig medarbetares namn.'],
      ['Begränsningar', 'Uppgifterna får inte användas som enda underlag för beslut om anställning, lön, omplacering eller disciplinära åtgärder. AI används aldrig för sådana beslut. Medarbetare har rätt att se sina egna uppgifter.'],
      ['Lagring', 'Incheckningar och kopplingar till pass raderas efter 12 månader om inte Kunden väljer kortare tid. Anonym statistik får sparas längre.'],
      ['Avstängning', 'Kunden eller ScanSay kan stänga av modulen när som helst. Uppgifter som samlats in via modulen raderas då inom 30 dagar.']
    ];
    return '<h3 class="ctr-s">Bilaga 2. Personalmodul: särskilda villkor</h3><ol class="ctr-ol">' + L.map(([h, t]) => '<li><b>' + h + '.</b> ' + t + '</li>').join('') + '</ol>';
  }

  function TERMS(d) {
    const per = period(d);
    const T = [
      ['Parter och omfattning', `Villkoren gäller mellan ${esc(d.seller.name)} ("ScanSay") och företaget eller organisationen som anges som kund ("Kunden"). Avtalet består av offerten ovan, dessa villkor och personuppgiftsbiträdesavtalet. Vid motstridighet gäller offerten före villkoren och biträdesavtalet före båda i frågor om personuppgifter. Avtalet ingås mellan näringsidkare. Konsumentlagstiftning, till exempel ångerrätt enligt distansavtalslagen, gäller därför inte.`],
      ['Tjänsten', `ScanSay tillhandahåller en molnbaserad tjänst där besökare skannar en QR-kod och lämnar synpunkter. Synpunkter bekräftas med en engångskod innan de skickas. Kunden får tillgång till en översikt med inkorg, larm, statistik och möjlighet att svara. Tjänsten levereras i befintligt skick och utvecklas löpande. Funktioner som anges i offerten ingår under hela avtalstiden.`],
      ['Konton och agenter', `Kunden får det antal inloggningar (agenter) som anges i offerten. Varje inloggning är personlig och får inte delas. Kunden ansvarar för att lösenord hålls hemliga, att tvåstegsverifiering används där det erbjuds och att konton för personer som slutat tas bort. Ytterligare agenter kan beställas till gällande pris.`],
      ['Pris, fakturering och betalning', `Avgiften betalas i förskott per ${per}. Vid kortbetalning debiterar ScanSay, via betaltjänsten Stripe, kortet automatiskt vid varje ny period tills avtalet upphör. Kunden godkänner dessa återkommande dragningar genom att signera avtalet. Betalningen syns som "SCANSAY" på kontoutdraget. Vid faktura gäller ${d.invoiceDays} dagar netto. Vid försenad betalning har ScanSay rätt till dröjsmålsränta enligt räntelagen (1975:635), påminnelseavgift och ersättning för inkassokostnader enligt lagen (1981:739) om ersättning för inkassokostnader m.m. Är betalningen mer än 14 dagar försenad får ScanSay, efter skriftlig påminnelse, stänga av tjänsten tills full betalning skett. Avgiften löper även under avstängning.`],
      ['Bekräftelse och invändningar mot debitering', `Kunden har före signering tagit del av offerten, priset, betalsättet och dessa villkor. ScanSay sparar en logg över signeringen (namn, titel, e-postadress, IP-adress, tidpunkt, webbläsare, avtalsversion och en kontrollsumma av avtalstexten) som bevis på att avtalet ingåtts. Har Kunden invändningar mot en debitering ska Kunden först kontakta ScanSay på ${esc(d.seller.email)}, och ScanSay svarar inom fem arbetsdagar. Att bestrida en kortbetalning hos banken (återkrav) för en tjänst som levererats enligt avtalet är ett avtalsbrott. ScanSay har då rätt att kräva det bestridda beloppet, ersättning för avgifter och administrativa kostnader samt att stänga av tjänsten.`],
      ['Avtalstid, förlängning och uppsägning', `Avtalet gäller från avtalsstart under den avtalsperiod som anges i offerten. ${d.autoRenew ? `Därefter förlängs avtalet automatiskt med samma period om det inte sägs upp skriftligen senast ${d.noticeDays} dagar före periodens slut.` : 'Avtalet upphör vid periodens slut.'} Uppsägning görs skriftligen till ${esc(d.seller.email)} och bekräftas av ScanSay. Betalda avgifter för en påbörjad period återbetalas inte, utom när ScanSay säger upp avtalet utan att Kunden brutit mot det. Vardera part får säga upp avtalet med omedelbar verkan om den andra parten väsentligen bryter mot avtalet och inte vidtar rättelse inom 30 dagar efter skriftlig anmaning, eller om den andra parten försätts i konkurs eller annars kan antas vara på obestånd.`],
      ['Kundens ansvar', `Kunden ansvarar för att tjänsten används i enlighet med lag, för innehållet i egna frågor och svar och för att besökare informeras om hur deras uppgifter behandlas (ScanSay tillhandahåller en färdig integritetstext). Om tjänsten berör anställdas arbetssituation ansvarar Kunden för att fullgöra förhandlings- och informationsskyldigheten enligt lagen (1976:580) om medbestämmande i arbetslivet innan sådana funktioner används. Tjänsten får inte användas för att övervaka enskilda anställda, för att filtrera bort negativa omdömen inför publicering eller för otillåten marknadsföring.`],
      ['Personuppgifter', `ScanSay behandlar personuppgifter för Kundens räkning som personuppgiftsbiträde. Kunden är personuppgiftsansvarig. Behandlingen regleras i personuppgiftsbiträdesavtalet (bilaga 1) enligt artikel 28 i dataskyddsförordningen (EU) 2016/679. Uppgifterna lagras och behandlas inom EU/EES.`],
      ['Tillgänglighet och underhåll', `ScanSay strävar efter att tjänsten är tillgänglig 99,5 procent av tiden per kalendermånad, med undantag för planerat underhåll som aviseras minst 48 timmar i förväg. Om tillgängligheten understiger 99,0 procent under en månad har Kunden, efter begäran inom 30 dagar, rätt till avdrag på nästa faktura med 5 procent av månadsavgiften per påbörjad procentenhet, högst 50 procent. Avdraget är Kundens enda ersättning för bristande tillgänglighet.`],
      ['Ansvarsbegränsning', `ScanSay ansvarar inte för indirekta skador, till exempel utebliven vinst, förlorade intäkter, förlust av data eller skada på goodwill. ScanSays sammanlagda ansvar under avtalet är begränsat till de avgifter Kunden betalat för tjänsten under de senaste tolv månaderna före skadetillfället. Begränsningarna gäller inte vid uppsåt eller grov vårdslöshet. Krav ska framställas skriftligen inom tre månader från det att Kunden upptäckt eller borde ha upptäckt grunden för kravet. ScanSay ansvarar inte för innehållet i meddelanden som besökare skickar.`],
      ['Immateriella rättigheter', `ScanSay äger alla rättigheter till tjänsten, programvaran och varumärket. Kunden får en icke-exklusiv rätt att använda tjänsten under avtalstiden. Kunden äger sina data och kan exportera dem under avtalstiden och i 30 dagar efter att avtalet upphört.`],
      ['Sekretess', `Parterna ska inte lämna ut konfidentiell information om den andra parten till utomstående. Sekretessen gäller under avtalstiden och i tre år därefter, men inte information som är allmänt känd eller som en part måste lämna ut enligt lag.`],
      ['Ändringar', `ScanSay får ändra villkoren eller priserna med minst 60 dagars skriftligt varsel. Försämrar ändringen Kundens villkor väsentligt får Kunden säga upp avtalet till den dag ändringen träder i kraft. Indexering av priset sker högst en gång per år.`],
      ['Force majeure', `En part är befriad från påföljd för underlåtenhet att fullgöra en förpliktelse om underlåtenheten beror på omständighet utanför partens kontroll, till exempel krig, myndighetsbeslut, omfattande störningar i elektronisk kommunikation, strejk eller naturkatastrof.`],
      ['Överlåtelse', `Kunden får inte överlåta avtalet utan ScanSays skriftliga godkännande. ScanSay får överlåta avtalet till ett bolag i samma koncern eller vid överlåtelse av verksamheten.`],
      ['Tillämplig lag och tvister', `Svensk lag gäller för avtalet. Tvister ska i första hand lösas genom förhandling. Kan parterna inte enas avgörs tvisten av allmän domstol med Stockholms tingsrätt som första instans.`]
    ];
    return '<ol class="ctr-terms">' + T.map(([h, p]) => `<li><b>${h}.</b> ${p}</li>`).join('') + '</ol>';
  }

  function PUB(d) {
    const R = [
      ['Ändamål och instruktion', 'ScanSay behandlar personuppgifter endast för att leverera tjänsten och enligt Kundens dokumenterade instruktioner, som utgörs av avtalet och Kundens inställningar i översikten.'],
      ['Kategorier av uppgifter', 'Besökares meddelanden, betyg, tidpunkt och plats samt e-postadress eller telefonnummer som används för engångskoden. Kundens användare: namn, e-post, roll och inloggningslogg.'],
      ['Registrerade', 'Kundens gäster, kunder och besökare som lämnar synpunkter samt Kundens anställda med inloggning.'],
      ['Lagringstid', 'Meddelanden sparas i 12 månader. Engångskoder raderas efter 10 minuter. Telefonnummer och e-post för verifiering lagras krypterat och visas aldrig för Kundens personal. Anonym statistik sparas i högst 3 år.'],
      ['Säkerhet', 'Kryptering vid överföring (TLS 1.2 eller senare) och i lagring, behörighetsstyrning, tvåstegsverifiering för administratörer, loggning och regelbunden säkerhetsgranskning.'],
      ['Sekretess', 'Personer hos ScanSay som har åtkomst till uppgifterna omfattas av tystnadsplikt.'],
      ['Underbiträden', 'Drift, e-post, sms och AI-tjänster inom EU/EES. Aktuell lista finns på scansay.se. Kunden informeras minst 30 dagar innan ett nytt underbiträde anlitas och har rätt att invända.'],
      ['Personuppgiftsincident', 'ScanSay underrättar Kunden utan onödigt dröjsmål och senast inom 24 timmar efter att en incident upptäckts, så att Kunden kan anmäla till Integritetsskyddsmyndigheten inom 72 timmar.'],
      ['Bistånd och granskning', 'ScanSay hjälper Kunden att besvara registrerades begäranden, med konsekvensbedömningar och ger Kunden möjlighet till granskning.'],
      ['Avtalets upphörande', 'När avtalet upphör raderar ScanSay personuppgifterna inom 30 dagar, efter att Kunden fått möjlighet att exportera dem, om inte lag kräver fortsatt lagring.']
    ];
    return '<ol class="ctr-terms">' + R.map(([h, p]) => `<li><b>${h}.</b> ${p}</li>`).join('') + '</ol><p class="ctr-small">Det fullständiga personuppgiftsbiträdesavtalet finns på scansay.se/legal/pub-avtal.html och utgör en del av avtalet.</p>';
  }

  const LOGO = '<svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true"><defs><linearGradient id="ctrg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3B82F6"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient></defs><path d="M14 2h36a11 11 0 0 1 11 11v33a11 11 0 0 1-11 11H27l-14 7v-7h-1A9 9 0 0 1 3 48V13A11 11 0 0 1 14 2z" fill="url(#ctrg)"/><g fill="#fff"><rect x="13" y="11" width="15" height="15" rx="3"/><rect x="35" y="11" width="15" height="15" rx="3"/><rect x="13" y="33" width="15" height="15" rx="3"/><rect x="36" y="34" width="5" height="5"/><rect x="44" y="34" width="5" height="5"/><rect x="40" y="41" width="5" height="5"/></g><g fill="url(#ctrg)"><rect x="17.5" y="15.5" width="6" height="6" rx="1"/><rect x="39.5" y="15.5" width="6" height="6" rx="1"/><rect x="17.5" y="37.5" width="6" height="6" rx="1"/></g></svg>';
  const SIG = '<svg viewBox="0 0 160 40" width="150" height="38" aria-hidden="true"><path d="M6 30c10-18 18-22 20-14s-6 16 2 12 12-20 16-14-4 16 4 12 8-10 14-8 2 8 10 6 10-8 18-8 12 4 22 2 20-6 30-4" fill="none" stroke="#0A0F1C" stroke-width="2" stroke-linecap="round"/></svg>';

  const CSS = `.ctr{font-family:inherit;color:#0A0F1C;background:#fff;line-height:1.55;font-size:13.5px;max-width:820px;margin:0 auto;padding:34px 38px;border:1px solid #E5E7EB;border-radius:12px}
.ctr *{color:inherit;text-shadow:none}.ctr .ctr-h,.ctr .ctr-parties>div{position:static;backdrop-filter:none}.ctr .ctr-h{background:none!important}.ctr .ctr-s{font-size:16px;margin:24px 0 8px;padding-bottom:6px;border-bottom:2px solid #0A0F1C}
.ctr-h{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:1px solid #E5E7EB;padding-bottom:16px}
.ctr-brand{display:flex;align-items:center;gap:8px;font-size:20px}.ctr-brand b{font-weight:800;letter-spacing:-.03em}
.ctr-meta{text-align:right;display:flex;flex-direction:column;font-size:12.5px;color:#374151}.ctr-meta b{font-size:15px;color:#0A0F1C}
.ctr-parties{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}.ctr-parties>div{background:#F5F7FB;border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;font-size:12.5px}
.ctr-parties small{font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#1D4ED8;font-size:11px}.ctr-parties b{font-size:15px}
.ctr-t{width:100%;border-collapse:collapse}.ctr-t td{border-bottom:1px solid #EEF0F3;padding:7px 4px;vertical-align:top}.ctr-t td:first-child{width:30%;color:#374151;font-weight:600}
.ctr-terms{padding-left:20px;margin:0}.ctr-terms li{margin:0 0 8px}.ctr-small{font-size:12px;color:#4B5563}.ctr-note{background:#EFF6FF;border-radius:8px;padding:10px 12px}
.ctr-sign{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:26px;padding-top:16px;border-top:2px solid #0A0F1C}.ctr-sign>div{display:flex;flex-direction:column;gap:4px;font-size:12.5px}
.ctr-sign small{font-weight:800;text-transform:uppercase;letter-spacing:.06em;font-size:11px;color:#374151}.ctr-sigl{min-height:44px;border-bottom:1px solid #0A0F1C;display:flex;align-items:flex-end}
.ctr-empty{color:#9CA3AF;font-style:italic}.ctr-signed{font-family:"Brush Script MT","Segoe Script",cursive;font-size:26px;color:#1D4ED8!important}
@media (max-width:640px){.ctr{padding:20px 16px}.ctr-parties,.ctr-sign{grid-template-columns:1fr}.ctr-h{flex-direction:column}.ctr-meta{text-align:left}}
@media print{.ctr{border:0;padding:0}}`;

  async function hash(text) {
    if (root.crypto && root.crypto.subtle) { const b = await root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
    return require('crypto').createHash('sha256').update(text).digest('hex');
  }
  const api = { VERSION, SELLER, offer, terms: TERMS, pub: PUB, CSS, esc, kr, date, hash, norm, PLAN_NAMES };
  if (typeof module !== 'undefined') module.exports = api; else root.SSContract = api;
})(typeof window !== 'undefined' ? window : globalThis);
