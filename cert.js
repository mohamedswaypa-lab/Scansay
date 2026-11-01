/* ScanSay Intyg (certificate): compute from feedback + render A4 and social images. Needs sticker.js (SSB) and qrcode. */
(function(){
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const CEO={sv:'VD, ScanSay',en:'CEO, ScanSay'};
const TX={
 sv:{title:'INTYG',sub:'Kundfeedback och ärendehantering',issued:'Utfärdat',period:'Period',id:'Intygs-ID',verify:'Kontrollera intyget',
   k1:'meddelanden från kunder',k2:'lästa och hanterade',k3:'av klagomålen lösta',k4:'mediantid till löst',
   tbl:['Avdelning','Meddelanden','Lösta','Betyg i början','Betyg i slutet'],
   lvl:{gold:'Guld',silver:'Silver',bronze:'Brons'},lvlw:'nivå',
   body:(d)=>`${d.company} har under perioden ${d.periodTxt} tagit emot ${fmt(d.n,'sv')} meddelanden från sina kunder via ScanSay. ${d.read} % av meddelandena lästes och hanterades, och ${d.res} % av alla klagomål markerades som lösta, med en mediantid på ${dur(d.medH,'sv')}.`+(d.a1>d.a0?` Kundernas snittbetyg steg från ${dec(d.a0,'sv')} till ${dec(d.a1,'sv')} av 5 under perioden.`:` Kundernas snittbetyg var ${dec(d.a1,'sv')} av 5.`)+` Det visar ett företag som lyssnar på sina kunder och agerar på det de säger.`,
   note:'Intyget bygger på data registrerad i ScanSay och avser hur företaget tar emot och hanterar privat kundfeedback. Det är inte en certifiering av företagets produkter eller tjänster och påverkar inte offentliga recensioner.',
   hours:'tim',min:'min',days:'dygn',more:'Fler avdelningar finns i det digitala intyget.',
   post:(d,url)=>`Vi är stolta över att presentera vårt intyg från ScanSay för ${d.periodTxt}: ${fmt(d.n,'sv')} meddelanden från våra gäster, ${d.res} % av klagomålen lösta och en mediantid på ${dur(d.medH,'sv')}. Tack till alla som säger till, det gör oss bättre varje dag. Läs intyget: ${url}`},
 en:{title:'CERTIFICATE',sub:'Customer feedback and case handling',issued:'Issued',period:'Period',id:'Certificate ID',verify:'Verify the certificate',
   k1:'messages from customers',k2:'read and handled',k3:'of complaints resolved',k4:'median time to resolve',
   tbl:['Department','Messages','Resolved','Rating at start','Rating at end'],
   lvl:{gold:'Gold',silver:'Silver',bronze:'Bronze'},lvlw:'level',
   body:(d)=>`During ${d.periodTxt}, ${d.company} received ${fmt(d.n,'en')} messages from its customers through ScanSay. ${d.read}% of the messages were read and handled, and ${d.res}% of all complaints were marked as resolved, with a median time of ${dur(d.medH,'en')}.`+(d.a1>d.a0?` The average customer rating rose from ${dec(d.a0,'en')} to ${dec(d.a1,'en')} out of 5 during the period.`:` The average customer rating was ${dec(d.a1,'en')} out of 5.`)+` It shows a business that listens to its customers and acts on what they say.`,
   note:'This certificate is based on data recorded in ScanSay and covers how the business receives and handles private customer feedback. It is not a certification of the business’s products or services and does not affect public reviews.',
   hours:'h',min:'min',days:'days',more:'More departments appear in the digital certificate.',
   post:(d,url)=>`We are proud to present our ScanSay certificate for ${d.periodTxt}: ${fmt(d.n,'en')} messages from our guests, ${d.res}% of complaints resolved and a median time of ${dur(d.medH,'en')}. Thank you to everyone who speaks up, it makes us better every day. Read the certificate: ${url}`}
};
const MON={sv:['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'],en:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']};
function fmt(n,l){return Math.round(n).toLocaleString(l==='sv'?'sv-SE':'en-GB')}
function dec(n,l){const s=(Math.round(n*10)/10).toFixed(1);return l==='sv'?s.replace('.',','):s}
function dur(h,l){const t=TX[l];if(h<1)return Math.max(1,Math.round(h*60))+' '+t.min;if(h<48)return dec(h,l).replace(/[,.]0$/,'')+' '+t.hours;return Math.round(h/24)+' '+t.days}
function dt(ts,l){const d=new Date(ts);return d.getDate()+' '+MON[l][d.getMonth()]+' '+d.getFullYear()}
function slug(s){return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function level(d){if(d.n<50||d.comp<5)return null;if(d.res>=90&&d.read>=95&&d.medH<=12)return'gold';if(d.res>=80&&d.read>=90)return'silver';if(d.res>=65)return'bronze';return null}
/* list: feedback items {ts,type,status,rating,secName,fixTs}; o:{company,group,months,now,lang} */
function compute(list,o){
  const now=o.now||Date.now(),from=now-o.months*30.44*864e5;const L=list.filter(f=>f.ts>=from&&f.ts<=now);
  const comp=L.filter(f=>f.type==='c'),fixed=comp.filter(f=>f.status==='fix');
  const read=L.length?Math.round(L.filter(f=>f.status!=='new').length/L.length*100):0,res=comp.length?Math.round(fixed.length/comp.length*100):0;
  const times=fixed.map(f=>((f.fixTs||f.ts+6*36e5)-f.ts)/36e5).sort((a,b)=>a-b);const medH=times.length?times[Math.floor(times.length/2)]:0;
  const q=(o.months*30.44*864e5)/4;const rAvg=a=>{const r=a.filter(f=>f.rating);return r.length?r.reduce((s,f)=>s+f.rating,0)/r.length:0};
  const first=L.filter(f=>f.ts<from+q),last=L.filter(f=>f.ts>=now-q);
  const names=[...new Set(L.map(f=>f.secName||'—'))];
  const secs=names.map(nm=>{const a=L.filter(f=>(f.secName||'—')===nm),c=a.filter(f=>f.type==='c');return{name:nm,n:a.length,res:c.length?Math.round(c.filter(f=>f.status==='fix').length/c.length*100):100,a0:rAvg(a.filter(f=>f.ts<from+q)),a1:rAvg(a.filter(f=>f.ts>=now-q))}}).sort((x,y)=>y.n-x.n);
  const l=o.lang||'sv';
  const d={company:o.company,group:o.group||'',industry:o.industry||'',lang:l,from,to:now,months:o.months,n:L.length,comp:comp.length,praise:L.filter(f=>f.type==='p').length,read,res,medH,a0:rAvg(first),a1:rAvg(last),secs,issued:now};
  d.periodTxt=dt(from,l)+' – '+dt(now,l);d.level=level(d);
  d.slug=slug(o.group||o.company);d.id='SS-'+new Date(now).getFullYear()+'-'+(Math.abs([...d.slug].reduce((h,c)=>h*31+c.charCodeAt(0)|0,7))%90000+10000);
  return d}
function wrap(t,max){const w=t.split(' '),out=[];let c='';w.forEach(x=>{if((c+' '+x).trim().length>max){out.push(c);c=x}else c=(c+' '+x).trim()});if(c)out.push(c);return out}
function seal(cx,cy,r,lv,l){const col={gold:'#B8860B',silver:'#7A7F87',bronze:'#9A5B2E'}[lv]||'#111';const t=TX[l];
  return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="${col}" stroke-width="${r*.05}"/><circle cx="${cx}" cy="${cy}" r="${r*.82}" fill="none" stroke="${col}" stroke-width="${r*.015}" stroke-dasharray="${r*.04} ${r*.04}"/>
  <text x="${cx}" y="${cy-r*.32}" text-anchor="middle" font-size="${r*.16}" font-weight="700" letter-spacing="${r*.02}" fill="${col}">SCANSAY</text>
  <text x="${cx}" y="${cy+r*.12}" text-anchor="middle" font-size="${r*.34}" font-weight="800" fill="${col}">${esc(t.lvl[lv]||'')}</text>
  <text x="${cx}" y="${cy+r*.42}" text-anchor="middle" font-size="${r*.14}" font-weight="700" fill="${col}">${t.lvlw.toUpperCase()} ${new Date().getFullYear()}</text></g>`}
const SIGP='<path d="M8 24C9 14 12 5 14 6C16 7 13 18 12 24C14 16 18 8 20 9C22 10 19 20 19 24C21 17 24 12 26 14C27 16 25 21 27 21C30 21 31 13 34 13C36 13 34 20 37 20C40 20 41 6 44 4C46 3 45 12 43 18C42 22 46 22 49 17C51 14 53 14 53 17C53 20 56 20 59 16C61 13 64 13 63 17C62 21 70 18 76 13" fill="none" stroke="#111" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 27C30 24 70 26 100 19C106 17.5 109 15.5 104 15.6" fill="none" stroke="#111" stroke-width=".85" stroke-linecap="round"/><circle cx="66" cy="9.5" r=".7" fill="#111"/>';
function signature(x,y,w){const k=w/108;return `<g transform="translate(${x-5*k} ${y-28*k}) scale(${k})">${SIGP}</g>`}
function svg(d,o){o=o||{};const l=d.lang,t=TX[l],W=210,H=297,url=o.url||('https://scansay.se/intyg/'+d.slug),fontCss=o.fontCss||'';
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm" font-family="'Plus Jakarta Sans',Arial,sans-serif">${fontCss?`<style>${fontCss}</style>`:''}<rect width="${W}" height="${H}" fill="#fff"/>
  <rect x="8" y="8" width="${W-16}" height="${H-16}" fill="none" stroke="#111" stroke-width=".5"/><rect x="10" y="10" width="${W-20}" height="${H-20}" fill="none" stroke="#C9A227" stroke-width=".4"/>
  ${SSB.mark(20,20,13,{})}<text x="36" y="29.5" font-size="8" font-weight="800" fill="#111">ScanSay</text>
  <text x="${W-20}" y="25" text-anchor="end" font-size="3.2" fill="#444">${t.id}</text><text x="${W-20}" y="30" text-anchor="end" font-size="3.6" font-weight="700" fill="#111">${d.id}</text>
  <text x="${W/2}" y="56" text-anchor="middle" font-size="15" font-weight="800" letter-spacing="3" fill="#111">${t.title}</text>
  <text x="${W/2}" y="64" text-anchor="middle" font-size="4.6" fill="#333">${t.sub}</text>
  <line x1="70" x2="140" y1="70" y2="70" stroke="#C9A227" stroke-width=".6"/>`;
  const cs=d.company.length>28?8:11;s+=`<text x="${W/2}" y="84" text-anchor="middle" font-size="${cs}" font-weight="800" fill="#111">${esc(d.company)}</text>`;
  if(d.group&&d.group!==d.company)s+=`<text x="${W/2}" y="92" text-anchor="middle" font-size="4.4" fill="#333">${esc(d.group)}</text>`;
  s+=`<text x="${W/2}" y="99" text-anchor="middle" font-size="3.8" fill="#444">${t.period}: ${esc(d.periodTxt)}</text>`;
  const K=[[fmt(d.n,l),t.k1],[d.read+' %',t.k2],[d.res+' %',t.k3],[dur(d.medH,l),t.k4]];
  K.forEach((k,i)=>{const x=22+i*43;s+=`<rect x="${x}" y="107" width="38" height="28" rx="2" fill="#fff" stroke="#111" stroke-width=".35"/><text x="${x+19}" y="121" text-anchor="middle" font-size="${String(k[0]).length>7?6.5:8.5}" font-weight="800" fill="#111">${esc(k[0])}</text>`+wrap(k[1],20).map((ln,j)=>`<text x="${x+19}" y="${127.5+j*3.6}" text-anchor="middle" font-size="2.9" fill="#333">${esc(ln)}</text>`).join('')});
  let y=147;wrap(t.body(d),86).forEach(ln=>{s+=`<text x="22" y="${y}" font-size="3.9" fill="#111">${esc(ln)}</text>`;y+=5.6});
  y+=4;const cols=[22,90,118,142,166];s+=`<line x1="22" x2="188" y1="${y}" y2="${y}" stroke="#111" stroke-width=".4"/>`;
  t.tbl.forEach((h,i)=>s+=`<text x="${cols[i]}" y="${y+5}" font-size="3" font-weight="800" fill="#111">${esc(h)}</text>`);y+=13;
  d.secs.slice(0,6).forEach(r=>{s+=`<line x1="22" x2="188" y1="${y-3.6}" y2="${y-3.6}" stroke="#bbb" stroke-width=".2"/><text x="22" y="${y+1}" font-size="3.4" font-weight="700" fill="#111">${esc(r.name)}</text><text x="${cols[1]}" y="${y+1}" font-size="3.4" fill="#111">${fmt(r.n,l)}</text><text x="${cols[2]}" y="${y+1}" font-size="3.4" fill="#111">${r.res} %</text><text x="${cols[3]}" y="${y+1}" font-size="3.4" fill="#111">${r.a0?dec(r.a0,l):'–'}</text><text x="${cols[4]}" y="${y+1}" font-size="3.4" font-weight="800" fill="#111">${r.a1?dec(r.a1,l):'–'}${r.a1>r.a0+.05&&r.a0?' ▲':''}</text>`;y+=7});
  if(d.secs.length>6){s+=`<text x="22" y="${y}" font-size="2.8" fill="#555">${t.more}</text>`;y+=4}
  s+=`<line x1="22" x2="188" y1="${y-3}" y2="${y-3}" stroke="#111" stroke-width=".4"/>`;
  // bottom: signature, seal, qr
  const by=246;s+=signature(22,by,60)+`<line x1="22" x2="88" y1="${by+5}" y2="${by+5}" stroke="#111" stroke-width=".3"/><text x="22" y="${by+10.5}" font-size="3.8" font-weight="800" fill="#111">${esc(CEO[l])}</text>${SSB.mark(78,by+6.5,7,{})}<text x="22" y="${by+15.5}" font-size="3.2" fill="#333">${t.issued} ${dt(d.issued,l)}</text>`;
  if(d.level)s+=seal(122,by+4,16,d.level,l);
  s+=`<rect x="158" y="${by-14}" width="30" height="30" fill="#fff"/>${SSB.qrWithLogo(url,159,by-13,28,"#111")}<text x="173" y="${by+21}" text-anchor="middle" font-size="2.7" fill="#333">${t.verify}</text>`;
  wrap(t.note,120).forEach((ln,i)=>s+=`<text x="${W/2}" y="${277+i*3.6}" text-anchor="middle" font-size="2.7" fill="#555">${esc(ln)}</text>`);
  return s+'</svg>'}
/* square social image 1080x1080 (units px) */
function social(d,o){o=o||{};const l=d.lang,t=TX[l],fontCss=o.fontCss||'';
  const gw=d.industry==='hotel';const P={sv:{h:gw?'Vi lyssnar på våra gäster':'Vi lyssnar på våra kunder',r:'av klagomålen lösta'},en:{h:gw?'We listen to our guests':'We listen to our customers',r:'of complaints resolved'}}[l];
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080" font-family="'Plus Jakarta Sans',Arial,sans-serif">${fontCss?`<style>${fontCss}</style>`:''}<rect width="1080" height="1080" fill="#fff"/><rect x="36" y="36" width="1008" height="1008" fill="none" stroke="#111" stroke-width="3"/>
  ${SSB.mark(80,80,64,{})}<text x="160" y="125" font-size="38" font-weight="800" fill="#111">ScanSay</text><text x="1000" y="122" text-anchor="end" font-size="26" fill="#444">${t.title} · ${d.id}</text>
  <text x="540" y="290" text-anchor="middle" font-size="${d.company.length>24?58:76}" font-weight="800" fill="#111">${esc(d.company)}</text>
  <text x="540" y="350" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-style="italic" font-weight="700" font-size="44" fill="#111">${P.h}</text>
  <text x="540" y="560" text-anchor="middle" font-size="200" font-weight="800" fill="#111">${d.res} %</text><text x="540" y="625" text-anchor="middle" font-size="36" fill="#333">${P.r}</text>
  <line x1="140" x2="940" y1="690" y2="690" stroke="#111" stroke-width="2"/>`;
  [[fmt(d.n,l),t.k1],[d.read+' %',t.k2],[dur(d.medH,l),t.k4]].forEach((k,i)=>{const x=220+i*320;s+=`<text x="${x}" y="780" text-anchor="middle" font-size="64" font-weight="800" fill="#111">${esc(k[0])}</text>`+wrap(k[1],22).map((ln,j)=>`<text x="${x}" y="${825+j*32}" text-anchor="middle" font-size="26" fill="#333">${esc(ln)}</text>`).join('')});
  s+=`<text x="80" y="985" font-size="26" fill="#444">${t.period}: ${esc(d.periodTxt)}</text>`;
  if(d.level)s+=seal(935,930,82,d.level,l);
  return s+'</svg>'}
window.SSC={SIGP,compute,svg,social,TX,CEO,level,fmt,dec,dur,slug};
})();
