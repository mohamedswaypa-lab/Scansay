(function(){
const L=window.L,TP=window.SSTPL,lang=L.lang,tr=x=>TP.tr(x,lang);
const $=id=>document.getElementById(id),esc=SSB.esc;
function toast(t){const e=$('toast');e.textContent=t;e.classList.add('on');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('on'),2600)}
/* ---------- router ---------- */
function closeMenus(){document.querySelectorAll('.menu li.open').forEach(li=>{li.classList.remove('open');li.querySelector('.dd').setAttribute('aria-expanded','false')});$('mob').classList.remove('open');$('burger').setAttribute('aria-expanded','false')}
function go(page,to,push){
  if(!L.ids.includes(page))page='home';
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('on',p.id==='p-'+page));document.body.classList.toggle('vhome',page==='home');playBg();
  document.querySelectorAll('.menu a[data-go]').forEach(a=>a.classList.toggle('cur',a.dataset.go===page));
  closeMenus();
  if(push!==false){const h='#'+page+(to?'/'+to:'');if(location.hash!==h)history.pushState(null,'',h)}
  syncLang();
  const t=to&&document.getElementById(to);
  if(page==='verified'){renderVerified(to);window.scrollTo(0,0);return}
  if(t)setTimeout(()=>t.scrollIntoView({behavior:'smooth'}),40);else window.scrollTo({top:0,behavior:'instant'in window?'instant':'auto'});
}
function fromHash(){const h=decodeURIComponent(location.hash.slice(1));const [p,to]=h.split('/');go(p||'home',to,false)}
function syncLang(){const h=location.hash;document.querySelectorAll('a[data-lang]').forEach(a=>{a.href=(a.dataset.lang==='sv'?'index.html':'en.html')+h})}
document.addEventListener('click',e=>{
  const a=e.target.closest('[data-go]');
  if(a){e.preventDefault();go(a.dataset.go,a.dataset.to);return}
  const dd=e.target.closest('.dd');
  if(dd){e.preventDefault();const li=dd.parentElement;const hover=matchMedia('(hover:hover) and (pointer:fine)').matches;const was=li.classList.contains('open');if(hover&&was){dd.setAttribute('aria-expanded','true');return}document.querySelectorAll('.menu li.open').forEach(x=>{if(x!==li){x.classList.remove('open');x.querySelector('.dd').setAttribute('aria-expanded','false')}});li.classList.toggle('open',!was);dd.setAttribute('aria-expanded',String(!was));return}
  if(!e.target.closest('.drop'))document.querySelectorAll('.menu li.open').forEach(li=>{li.classList.remove('open');li.querySelector('.dd').setAttribute('aria-expanded','false')});
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenus()});
/* hover open on desktop pointers */
document.querySelectorAll('.menu>li').forEach(li=>{if(!li.querySelector('.dd'))return;let t;const fine=()=>matchMedia('(hover:hover) and (pointer:fine)').matches;
  li.addEventListener('mouseenter',()=>{if(!fine())return;clearTimeout(li._t);document.querySelectorAll('.menu li.open').forEach(x=>{if(x!==li){clearTimeout(x._t);x.classList.remove('open');x.querySelector('.dd').setAttribute('aria-expanded','false')}});li.classList.add('open');li.querySelector('.dd').setAttribute('aria-expanded','true')});
  li.addEventListener('mouseleave',()=>{if(!fine())return;clearTimeout(li._t);li._t=setTimeout(()=>{li.classList.remove('open');li.querySelector('.dd').setAttribute('aria-expanded','false')},450)})});
$('burger').addEventListener('click',()=>{const m=$('mob'),o=!m.classList.contains('open');m.classList.toggle('open',o);$('burger').setAttribute('aria-expanded',o)});
window.addEventListener('popstate',fromHash);window.addEventListener('hashchange',fromHash);
/* ---------- department explorer ---------- */
function hmap(el,indKey,pick){if(!el)return;let ik=indKey,cur=0;
  function draw(){const ind=TP.IND[ik],secs=ind.sec;if(cur>=secs.length)cur=0;const s=secs[cur];
    if(pick)pick.innerHTML=L.inds.map(([k,n])=>`<button type="button" class="${k===ik?'on':''}" data-k="${k}">${esc(n)}</button>`).join('');
    if(pick)pick.querySelectorAll('button').forEach(b=>b.onclick=()=>{ik=b.dataset.k;cur=0;draw()});
    el.innerHTML=`<div class="hzones">${secs.map((x,i)=>`<button type="button" class="hz ${i===cur?'on':''}" data-i="${i}">${esc(tr(x.n))}<small>${x.t.length}</small></button>`).join('')}</div>
    <div class="hpanel"><div><div class="eyebrow">${L.zones}</div><h3 style="font-size:28px">${esc(tr(s.n))}</h3><b style="color:#0F1013;font-size:14px">${L.topics}</b><div class="chips">${s.t.map(t=>`<span class="chip">${esc(tr(t))}</span>`).join('')}</div>
    <div class="qq"><small>${L.quick}</small>${esc(tr(TP.QUICK(s.k)))}</div><p class="note">${L.places}: ${s.ex.map(x=>esc(tr(x))).join(', ')}</p></div>
    <div>${SSB.sticker({code:'K3F9A',title:L.deftitle,place:tr(s.ex[0]),lang,theme:'purple',w:60,h:100})}</div></div>`;
    el.querySelector('.hpanel svg').style.cssText='width:100%;height:auto;filter:drop-shadow(0 14px 24px rgba(15,16,19,.3))';
    el.querySelectorAll('.hz').forEach(b=>b.onclick=()=>{cur=+b.dataset.i;draw()})}
  draw()}
hmap($('hmap'),'hotel',$('indpick'));hmap($('hmap2'),'hotel',null);
/* ---------- category pages ---------- */
document.querySelectorAll('.inds[data-cat]').forEach(el=>{const c=TP.CAT[el.dataset.cat];
  el.innerHTML=Object.entries(c.ind).map(([k,i])=>`<div class="ind"><h3>${esc(tr(i.n))}<small>${L.unit} ${esc(tr(i.unit))}</small></h3>${i.sec.map(s=>`<div class="sec"><b>${esc(tr(s.n))}</b><div class="chips">${s.t.map(t=>`<span class="chip">${esc(tr(t))}</span>`).join('')}</div></div>`).join('')}</div>`).join('')});
/* ---------- ROI ---------- */
function roi(){if(!$('r1'))return;const f=n=>Math.round(n).toLocaleString(lang==='sv'?'sv-SE':'en-GB');
  const r=+$('r1').value,st=+$('r2').value;$('rv1').textContent=f(r)+L.sek;$('rv2').textContent=(lang==='sv'?String(st.toFixed(1)).replace('.',','):st.toFixed(1));
  $('ro2').textContent=f(r*.05*st)+' – '+f(r*.09*st)+L.sek}
['r1','r2'].forEach(id=>$(id)&&$(id).addEventListener('input',roi));roi();
/* ---------- sticker builder ---------- */
function builder(el){if(!el)return;const st={title:L.deftitle,cta:L.ctadef,place:L.defplace,size:'5x10',theme:'purple'};
  el.innerHTML=`<div class="sbform"><label>${L.size}</label><div class="seg" data-k="size">${SSB.SIZES.map(s=>`<button type="button" data-v="${s.id}">${esc(s[lang])}</button>`).join('')}</div>
   <label for="${el.id}t">${L.title}</label><input id="${el.id}t" value="${esc(st.title)}" maxlength="60">
   <label for="${el.id}c">${L.cta}</label><input id="${el.id}c" value="${esc(st.cta)}" maxlength="40">
   <label for="${el.id}p">${L.place}</label><input id="${el.id}p" value="${esc(st.place)}" maxlength="40">
   <label>${L.color}</label><div class="seg" data-k="theme">${Object.keys(SSB.THEMES).map(t=>`<button type="button" class="sw" data-v="${t}" title="${L.th[t]}" aria-label="${L.th[t]}" style="background:${SSB.THEMES[t].bg}"></button>`).join('')}</div>
   <p class="note" id="${el.id}w"></p><p class="note">${L.sbnote}</p><div class="ctas" style="margin-top:12px"><a class="btn btn-p" href="app/index.html#qr">${L.tryit}</a></div></div><div class="sbprev" id="${el.id}v"></div>`;
  const draw=()=>{const s=SSB.SIZES.find(x=>x.id===st.size);$(el.id+'v').innerHTML=SSB.sticker({code:'K3F9A',title:st.title,cta:st.cta,place:st.place,lang,theme:st.theme,w:s.w,h:s.h});
    const sv=$(el.id+'v').firstChild;sv.removeAttribute('width');sv.removeAttribute('height');const k=Math.min(1,s.w/s.h);sv.style.width=(s.w>=s.h?'100%':Math.round(320*s.w/s.h*1.25)+'px');
    const qmm=Math.min(s.w,s.h)*.5;$(el.id+'w').textContent=qmm<20?L.small:'';
    el.querySelectorAll('.seg').forEach(g=>g.querySelectorAll('button').forEach(b=>b.classList.toggle('on',st[g.dataset.k]===b.dataset.v)))};
  el.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{st[b.parentElement.dataset.k]=b.dataset.v;draw()});
  [['t','title'],['c','cta'],['p','place']].forEach(([s,k])=>$(el.id+s).addEventListener('input',e=>{st[k]=e.target.value;draw()}));
  draw()}
builder($('sbHome'));builder($('sbFull'));

/* ---------- hero sticker + category visuals ---------- */
if(false&&$('hsticker')){$('hsticker').innerHTML=SSB.sticker({code:'K3F9A',title:L.catst.hospitality,place:L.defplace,lang,theme:'black',w:56,h:100});const v=$('hsticker').firstChild;v.removeAttribute('width');v.removeAttribute('height')}
const CT={hospitality:'black',transport:'gold',property:'white',public:'cream',leisure:'black',retail:'gold'};
document.querySelectorAll('.cvis').forEach(el=>{const c=el.dataset.cat;el.innerHTML=SSB.sticker({code:'K3F9A',title:L.catst[c],lang,theme:CT[c],w:58,h:100,showPlace:false});const v=el.firstChild;v.removeAttribute('width');v.removeAttribute('height')});
/* ---------- packages ---------- */
const TI=window.SSTIERS;
function pkgRender(el,pick,gk){if(!el)return;let g=gk||'hotel';
  const draw=()=>{const G=TI.G[g];pick.innerHTML=Object.keys(TI.G).map(k=>`<button type="button" class="${k===g?'on':''}" data-k="${k}">${esc(tr(TI.G[k].n))}</button>`).join('');
    pick.querySelectorAll('button').forEach(b=>b.onclick=()=>{g=b.dataset.k;draw()});
    el.innerHTML=TI.LV.map((lv,i)=>`<div class="pkg ${i===1?'pop':''} ${lv.id==='e'?'ent':''}">${i===1?`<span class="badge">${L.pk.popular}</span>`:''}<h3>${esc(tr(lv.n))}</h3><div class="pprice">${L.pk.price}</div>
     <div class="pscope"><small>${L.pk.scope}</small><b>${esc(tr(G.scope[lv.id]))}</b></div>${TI.custom(lv.id)?`<div class="pcust">${L.pk.custom}</div>`:''}
     <ul>${TI.FEAT[lv.id].map(f=>`<li>${esc(tr(f))}</li>`).join('')}</ul><a class="btn ${i===1?'btn-a':'btn-o'}" href="#contact" data-go="contact" data-pkg="${g}|${lv.id}">${L.pk.apply}</a></div>`).join('')};
  draw()}
pkgRender($('pkgs'),$('pkgpick'));
document.addEventListener('click',e=>{const a=e.target.closest('[data-pkg]');if(a){window.__pkg=a.dataset.pkg.split('|');setTimeout(applyPkg,30)}},true);

/* ---------- contact form ---------- */
let TIER='m';
function applyPkg(){if(!window.__pkg||!$('f_cat'))return;const [g,lv]=window.__pkg;const ind=TI.G[g].ind[0];const cat=Object.keys(TP.CAT).find(k=>TP.CAT[k].ind[ind]);$('f_cat').value=cat;$('f_cat').onchange();$('f_ind').value=ind;TIER=lv;$('f_ind').onchange();window.__pkg=null}
if($('f_cat')){const cs=$('f_cat'),is=$('f_ind');
  cs.innerHTML=Object.entries(TP.CAT).map(([k,c])=>`<option value="${k}" ${k==='hospitality'?'selected':''}>${esc(tr(c.n))}</option>`).join('');
  const fillInd=()=>{const c=TP.CAT[cs.value];is.innerHTML=Object.entries(c.ind).map(([k,i])=>`<option value="${k}">${esc(tr(i.n))}</option>`).join('');fillTier()};
  const fillTier=()=>{const g=TI.G[TI.groupOf(is.value)];
    $('f_tier').innerHTML=TI.LV.map(lv=>`<button type="button" class="${TIER===lv.id?'on':''}" data-t="${lv.id}"><b>${esc(tr(lv.n))}</b><small>${esc(tr(g.scope[lv.id]))}</small></button>`).join('');
    $('f_tier').querySelectorAll('button').forEach(b=>b.onclick=()=>{TIER=b.dataset.t;fillTier()});fillSecs()};
  const fillSecs=()=>{const i=TP.IND[is.value],g=TI.G[TI.groupOf(is.value)],cu=TI.custom(TIER),pre=g.secs[TIER];
    const inc=k=>pre==='all'||(pre==='first'?k===i.sec[0].k:Array.isArray(pre)&&pre.includes(k));
    $('f_secs').innerHTML=(cu?`<p class="note" style="margin:0 0 6px">${L.pk.pick}</p>`:`<p class="note" style="margin:0 0 6px">${pre==='all'?L.pk.all:L.pk.preset}</p>`)+i.sec.map(s=>`<label class="sp ${!cu&&!inc(s.k)?'off':''}"><input type="checkbox" value="${s.k}" ${inc(s.k)||cu&&inc(s.k)?'checked':''} ${cu?'':'disabled'}> ${esc(tr(s.n))}</label>`).join('');
    $('f_ownwrap').style.display=cu?'block':'none'};
  cs.onchange=fillInd;is.onchange=fillTier;fillInd();applyPkg();
  $('f_e').addEventListener('blur',()=>{const r=SSG.email($('f_e').value);if(r.suggest&&confirm(L.g.sug+r.suggest+'?'))$('f_e').value=r.suggest});
  $('cform').addEventListener('submit',async e=>{e.preventDefault();const btn=e.target.querySelector('button[type=submit]');
    const ok=$('f_n').value.trim()&&$('f_c').value.trim()&&$('f_e').value.trim()&&$('f_ok').checked;
    if(!ok){toast(L.need);return}
    const em=SSG.email($('f_e').value);if(!em.ok){toast(L.g[em.reason]||L.g.format);$('f_e').focus();return}
    const nm=SSG.name($('f_n').value);if(!nm.ok){toast(L.g.name);$('f_n').focus();return}
    const lbl=btn.textContent;btn.disabled=true;btn.textContent=L.g.checking;
    const g=await SSG.check({hp:$('f_web').value,minMs:5000,key:'apply',body:$('f_e').value+'|'+$('f_c').value,max:3,win:60*60*1000});
    btn.textContent=lbl;if(!g.ok){btn.disabled=false;toast(L.g[g.reason]||L.g.bot);return}
    const secs=[...$('f_secs').querySelectorAll('input:checked')].map(x=>x.value);const own=($('f_own').value||'').split(',').map(x=>x.trim()).filter(Boolean);
    try{const a=JSON.parse(localStorage.getItem('scansay-applications')||'[]');a.push({id:'w'+Date.now(),name:$('f_n').value,company:$('f_c').value,email:$('f_e').value,phone:$('f_p').value,cat:cs.value,ind:is.value,tier:TIER,secs,own:TI.custom(TIER)?own:[],size:$('f_m').value,msg:$('f_x').value,lang,time:Date.now(),guard:{pow:g.proof.nonce,ms:g.ms}});localStorage.setItem('scansay-applications',JSON.stringify(a))}catch(err){}
    $('cok').style.display='block'})}
if($('lform'))$('lform').addEventListener('submit',e=>{e.preventDefault();$('lok').style.display='block'});

/* ---------- certificates ---------- */
function exampleCerts(){const mk=(name,group,ind,secs,n,sd,boost)=>{let seed=sd;const r=()=>(seed=(seed*16807)%2147483647)/2147483647;const now=new Date('2026-10-24T18:00:00').getTime();const fb=[];
   for(let i=0;i<n;i++){const age=r()*365,ts=now-age*864e5,bad=.36*(.7+.6*age/365),x=r(),type=x<bad?'c':x<.88?'p':'i',rating=type==='c'?(r()<.6?1:2):type==='p'?(r()<.7?5:4):3;
    fb.push({ts,type,rating,status:type!=='c'?'fix':age<1?'new':(r()<boost?'fix':'prog'),secName:tr(secs[Math.floor(r()*secs.length)]),fixTs:ts+(r()*(1.5+age/25))*36e5})}
   const d=SSC.compute(fb,{company:name,group,industry:ind,months:12,lang,now});d.example=true;return d};
  const sv=lang==='sv',C=(d,city)=>{d.city=city;return d};
  return [C(mk(sv?'Exempel Hotell':'Example Hotel',sv?'Exempel Hotell Göteborg':'Example Hotel Gothenburg','hotel',['Rum|Rooms','Reception|Reception','Restaurang och frukost|Restaurant and breakfast','Spa och gym|Spa and gym','Toaletter|Toilets'],1400,5,.96),sv?'Göteborg':'Gothenburg'),
          C(mk(sv?'Exempel Taxi':'Example Taxi',sv?'Exempel Taxi Stad':'Example Taxi City','taxi',['Bilar|Cars','Bokning|Booking','Förare|Drivers'],2100,21,.93),'Stockholm')]}
const EX=exampleCerts();
function published(){let p={};try{p=JSON.parse(localStorage.getItem('scansay-published-certs')||'{}')}catch(e){}return Object.values(p).map(x=>{const d=x[lang]||x.sv;d.pubDate=x.pubDate;return d}).filter(Boolean)}
function allCerts(){const pub=published();return pub.concat(EX.filter(e=>!pub.find(p=>p.slug===e.slug)))}
document.querySelectorAll('.certimg').forEach(el=>{const d=EX[0];el.innerHTML=el.dataset.ex==='social'?SSC.social(d):SSC.svg(d);const sv=el.firstChild;sv.removeAttribute('width');sv.removeAttribute('height');sv.style.cssText='width:100%;height:auto;background:#fff;box-shadow:0 24px 60px -20px rgba(15,16,19,.45);border-radius:6px'});
const INDL={hotel:['Hotell','Hotels'],taxi:['Taxi','Taxis'],restaurant:['Restaurang','Restaurants'],cafe:['Kafé','Cafés'],gym:['Gym','Gyms'],workshop:['Verkstad','Workshops'],salon:['Frisör och skönhet','Hair and beauty'],cleaning:['Städ och fastighet','Cleaning and property'],shop:['Butik','Shops']};
const indName=k=>(INDL[k]||[k,k])[lang==='sv'?0:1];
const VT=lang==='sv'?{all:'Alla',count:n=>`${n} verifierade företag`,sort:'Sortera',s1:'Högst andel lösta',s2:'Flest meddelanden',s3:'A–Ö',ph:'Sök företag, ort, bransch eller intygs-ID',ver:'Verifierat',id:'Intygs-ID',city:'Ort'}
 :{all:'All',count:n=>`${n} verified businesses`,sort:'Sort',s1:'Highest share solved',s2:'Most messages',s3:'A–Z',ph:'Search business, city, industry or certificate ID',ver:'Verified',id:'Certificate ID',city:'City'};
const LVC={gold:'lv-g',silver:'lv-s',bronze:'lv-b'};
function vcard(d){const lv=d.level?`<span class="lvb ${LVC[d.level]}">${L.lvl[d.level]} ${new Date(d.to).getFullYear()}</span>`:'';
  return `<a class="vcard v2" href="#verified/${d.slug}" data-go="verified" data-to="${d.slug}"><div class="vtop">${SSB.markSVG(36)}<div class="vn"><b>${esc(d.group||d.company)}</b><small>${esc(indName(d.industry))} · ${esc(d.city||'')}</small></div>${lv}</div>
   <div class="vok">✓ ${VT.ver} · ${esc(d.id)}</div>
   <div class="vnums"><div><b>${d.res} %</b><small>${L.resd}</small></div><div><b>${SSC.fmt(d.n,lang)}</b><small>${L.msgs}</small></div><div><b>${SSC.dur(d.medH,lang)}</b><small>${L.med}</small></div></div><span class="more">${L.open} →</span></a>`}
let VF='all',VS='res';
function renderVerified(slug){const list=allCerts(),det=$('vdetail'),vl=$('vlist'),q=$('vq');if(!vl)return;
  q.placeholder=VT.ph;
  const inds=[...new Set(list.map(d=>d.industry))];
  let bar=$('vbar');if(!bar){bar=document.createElement('div');bar.id='vbar';bar.className='vbar';q.parentElement.after(bar)}
  const draw=()=>{const t=(q.value||'').toLowerCase().trim();
    let f=list.filter(d=>(VF==='all'||d.industry===VF)&&(!t||[d.group,d.company,d.city,indName(d.industry),d.id].join(' ').toLowerCase().includes(t)));
    f.sort(VS==='res'?(a,b)=>b.res-a.res:VS==='n'?(a,b)=>b.n-a.n:(a,b)=>(a.group||a.company).localeCompare(b.group||b.company,lang));
    bar.innerHTML=`<div class="vchips">${['all',...inds].map(k=>`<button type="button" class="${VF===k?'on':''}" data-k="${k}">${k==='all'?VT.all:esc(indName(k))}</button>`).join('')}</div>
     <div class="vmeta"><span>${VT.count(f.length)}</span><label>${VT.sort} <select id="vsort"><option value="res" ${VS==='res'?'selected':''}>${VT.s1}</option><option value="n" ${VS==='n'?'selected':''}>${VT.s2}</option><option value="az" ${VS==='az'?'selected':''}>${VT.s3}</option></select></label></div>`;
    bar.querySelectorAll('.vchips button').forEach(b=>b.onclick=()=>{VF=b.dataset.k;draw()});$('vsort').onchange=e=>{VS=e.target.value;draw()};
    vl.innerHTML=f.map(vcard).join('')||`<p class="note">${L.none}</p>`};
  q.oninput=draw;draw();
  if(slug){const d=list.find(x=>x.slug===slug);det.innerHTML=d?`<div class="vdet"><div><a href="#verified" data-go="verified" class="crumbback">← ${L.back}</a><div class="vok big">✓ ${VT.ver} · ${VT.id} ${esc(d.id)}</div><h2>${esc(d.group||d.company)}</h2><p class="vsub">${esc(indName(d.industry))} · ${esc(d.city||'')}${d.level?` · <span class="lvb ${LVC[d.level]}">${L.lvl[d.level]}</span>`:''}</p>${d.example?`<span class="badge">${L.ex}</span>`:''}
     <div class="vnums big"><div><b>${d.res} %</b><small>${L.resd}</small></div><div><b>${d.read} %</b><small>${SSC.TX[lang].k2}</small></div><div><b>${SSC.fmt(d.n,lang)}</b><small>${L.msgs}</small></div><div><b>${SSC.dur(d.medH,lang)}</b><small>${L.med}</small></div></div>
     <p>${esc(SSC.TX[lang].body(d))}</p><p class="note">${esc(SSC.TX[lang].note)}</p></div><div class="certimg2">${SSC.svg(d,{url:location.href})}</div></div>`:`<p class="note">${L.notfound}</p>`;
    const sv=det.querySelector('.certimg2 svg');if(sv){sv.removeAttribute('width');sv.removeAttribute('height');sv.style.cssText='width:100%;height:auto;background:#fff;box-shadow:0 24px 60px -20px rgba(15,16,19,.45);border-radius:8px'}
    det.scrollIntoView({behavior:'smooth',block:'start'})}
  else det.innerHTML=''}
/* home finder: search from the start page, show the top three */
(function(){const f=$('hfind');if(!f)return;const hq=$('hq'),hc=$('hcards');
  if(hc)hc.innerHTML=allCerts().slice().sort((a,b)=>b.res-a.res).slice(0,3).map(vcard).join('');
  f.addEventListener('submit',e=>{e.preventDefault();$('vq').value=hq.value;VF='all';go('verified')});
  document.querySelectorAll('[data-vind]').forEach(b=>b.addEventListener('click',()=>{VF=b.dataset.vind;$('vq').value='';go('verified')}))})();

/* ---------- background video: landscape on desktop, vertical on phones, always try to play ---------- */
function playBg(){const v=document.getElementById('bgvid');if(!v)return;if(matchMedia('(prefers-reduced-motion: reduce)').matches){v.pause();return}const want=innerWidth<760?'video/bg_m.mp4':'video/bg.mp4';
  if(!v.getAttribute('src')||!v.getAttribute('src').endsWith(want)){v.poster=want.replace('.mp4','.jpg');v.src=want;v.load()}
  v.muted=true;v.playsInline=true;const p=v.play();if(p&&p.catch)p.catch(()=>{})}
['touchstart','scroll','click'].forEach(ev=>addEventListener(ev,()=>{const v=document.getElementById('bgvid');if(v&&v.paused)v.play().catch(()=>{})},{passive:true}));
addEventListener('resize',()=>{clearTimeout(window.__rz);window.__rz=setTimeout(playBg,300)});
/* ---------- cookie notice, back to top, in-page links, FAQ search ---------- */
try{if(!localStorage.getItem('ss-cookie'))$('ckb').classList.add('show')}catch(e){$('ckb').classList.add('show')}
$('ckok').onclick=()=>{$('ckb').classList.remove('show');try{localStorage.setItem('ss-cookie',Date.now())}catch(e){}};
$('totop').onclick=()=>scrollTo({top:0,behavior:'smooth'});
addEventListener('scroll',()=>$('totop').classList.toggle('show',scrollY>600),{passive:true});
document.addEventListener('click',e=>{const a=e.target.closest('.fqn,.tocl');if(!a)return;e.preventDefault();const t=document.getElementById(a.dataset.fq||a.dataset.sec);if(t)scrollTo({top:t.getBoundingClientRect().top+scrollY-100,behavior:'smooth'})});
if($('fqq'))$('fqq').addEventListener('input',()=>{const q=$('fqq').value.trim().toLowerCase();let n=0;
  document.querySelectorAll('#p-faq details').forEach(d=>{const hit=!q||d.textContent.toLowerCase().includes(q);d.style.display=hit?'':'none';if(hit)n++;if(q&&hit)d.open=true});
  document.querySelectorAll('#p-faq .fqc').forEach(c=>{c.style.display=[...c.querySelectorAll('details')].some(d=>d.style.display!=='none')?'':'none'});$('fqnone').style.display=n?'none':'block'});

/* ---------- chatbot + contact agent ---------- */
(function(){const B=L.bot,box=$('bot');if(!box)return;
 const SK='scansay-support',load=()=>{try{return JSON.parse(localStorage.getItem(SK)||'[]')}catch(e){return window.__sup||[]}},store=a=>{try{localStorage.setItem(SK,JSON.stringify(a))}catch(e){window.__sup=a}};
 let open=false,view='chat',hist=[{f:'bot',t:B.hi}],mine=(()=>{try{return JSON.parse(localStorage.getItem('ss-my-cases')||'[]')}catch(e){return[]}})(),seen=0;
 const stop=new Set('och att det som en är på för med jag vi ni hur vad kan har the a an and is to of for how what do does i you we it in on'.split(' '));
 const words=t=>t.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N} ]/gu,' ').split(/\s+/).filter(w=>w.length>2&&!stop.has(w));
 function answer(q){const w=words(q);if(!w.length)return null;let best=null,bs=0;
   const sc=(text,boost)=>{const t=' '+text.toLowerCase()+' ';let s=0;w.forEach(x=>{if(t.includes(' '+x))s+=2;else if(x.length>4&&t.includes(x.slice(0,5)))s+=1});return s*boost};
   B.kb.forEach(k=>{const s=sc(k[0],1.6);if(s>bs){bs=s;best={t:k[1],go:k[2]}}});
   L.faq.forEach(f=>{const s=sc(f[0],1.2)+sc(f[1],.4);if(s>bs){bs=s;best={t:f[1],go:'faq'}}});
   return bs>=2?best:null}
 function myReplies(){const all=load();let n=0;const out=[];all.filter(c=>mine.includes(c.id)).forEach(c=>c.msgs.forEach(m=>{if(m.from==='agent'){n++;out.push({c,m})}}));return{n,out}}
 function ask(q){if(!q.trim())return;hist.push({f:'me',t:q});const a=answer(q);
   hist.push(a?{f:'bot',t:a.t,go:a.go}:{f:'bot',t:B.unsure,agent:true});draw();}
 function send(){const n=$('b_n').value.trim(),e=$('b_e').value.trim(),s=$('b_s').value,m=$('b_m').value.trim();
   if(!n||!m||!SSG.email(e).ok||$('b_web').value){toast(B.freq);return}
   const c={id:'w'+Date.now().toString(36),src:'web',name:n,email:e,subject:s,status:'open',ts:Date.now(),lang,msgs:[{from:'user',text:m,ts:Date.now()}]};
   const all=load();all.unshift(c);store(all);mine.push(c.id);try{localStorage.setItem('ss-my-cases',JSON.stringify(mine))}catch(err){}
   hist.push({f:'me',t:s+': '+m},{f:'bot',t:B.fok+' '+B.case+' '+c.id.toUpperCase()+'.'});view='chat';draw()}
 function draw(){const r=myReplies();const badge=r.n>seen&&!open?`<span class="bdot">${r.n-seen}</span>`:'';
   if(!open){box.innerHTML=`<button class="bfab" type="button" aria-label="${B.title}" onclick="window.__bot(1)"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg>${badge}</button>`;return}
   seen=r.n;
   const msgs=hist.map(h=>`<div class="bm ${h.f}"><div>${esc(h.t)}${h.go?`<br><a href="#${h.go}" data-go="${h.go}" class="blink">${B.more} →</a>`:''}${h.agent?`<br><button class="bbtn" type="button" onclick="window.__bot('agent')">${B.agent}</button>`:''}</div></div>`).join('')+
     r.out.map(x=>`<div class="bm agent"><div><b>${B.reply} · ${esc(x.c.subject)}</b><br>${esc(x.m.text)}</div></div>`).join('');
   const body=view==='chat'?`<div class="bmsgs" id="bmsgs">${msgs}</div>${hist.length<3?`<div class="bsug">${B.sugg.map(x=>`<button type="button" onclick="window.__bot('ask',this.textContent)">${esc(x)}</button>`).join('')}</div>`:''}
     <form class="bin" onsubmit="event.preventDefault();window.__bot('ask',this.q.value);this.q.value=''"><input name="q" placeholder="${B.ph}" aria-label="${B.ph}" autocomplete="off"><button class="bsend" type="submit" aria-label="${B.send}">➤</button></form>
     <button class="bagent" type="button" onclick="window.__bot('agent')">👤 ${B.agent}</button>`
    :`<div class="bform"><label>${B.fname}<input id="b_n" autocomplete="name"></label><label>${B.femail}<input id="b_e" type="email" autocomplete="email"></label><label>${B.fsub}<select id="b_s">${B.subs.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label><label>${B.fmsg}<textarea id="b_m" rows="4"></textarea></label><div class="hp" aria-hidden="true"><input id="b_web" tabindex="-1" autocomplete="off"></div>
     <button class="btn btn-a" type="button" onclick="window.__bot('send')">${B.fsend}</button><button class="bagent" type="button" onclick="window.__bot('chat')">← ${B.back}</button></div>`;
   box.innerHTML=`<div class="bwin" role="dialog" aria-label="${B.title}"><div class="bhead">${document.querySelector('.logo svg').outerHTML}<div><b>${B.title}</b><small><i></i>${B.sub}</small></div><button type="button" aria-label="Stäng" onclick="window.__bot(0)">×</button></div>${body}</div>`;
   const m=$('bmsgs');if(m)m.scrollTop=m.scrollHeight}
 window.__bot=(a,v)=>{if(a===1){open=true}else if(a===0){open=false}else if(a==='ask')ask(v);else if(a==='agent'){view='agent'}else if(a==='chat'){view='chat'}else if(a==='send')return send();draw();if(a==='agent'){setTimeout(()=>$('b_n')&&$('b_n').focus(),50)}};
 box.addEventListener('click',e=>{if(e.target.closest('.blink')){open=false;setTimeout(draw,10)}});
 draw();setInterval(()=>{const r=myReplies();if(r.n>seen)draw()},5000);
})();
fromHash();
})();

/* section background videos: load and play only while visible */
(function(){const vids=[...document.querySelectorAll('.sv video')];if(!vids.length||!('IntersectionObserver' in window))return;
const rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
const io=new IntersectionObserver(es=>es.forEach(e=>{const v=e.target;if(e.isIntersecting){if(rm)return;if(!v.getAttribute('src'))v.src=v.dataset.src;v.muted=true;const p=v.play();if(p&&p.catch)p.catch(()=>{})}else if(!v.paused)v.pause()}),{rootMargin:'250px 0px'});
vids.forEach(v=>io.observe(v))})();

/* System tour slides + dashboard tabs */
(function(){
  document.querySelectorAll('.tourw').forEach(function(w){
    var slides=w.querySelectorAll('.tslide'),tabs=w.querySelectorAll('.ttab'),dots=w.querySelectorAll('.tdot'),i=0,t=null,D=7000,vis=false;
    var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    function show(n){i=(n+slides.length)%slides.length;
      [slides,tabs,dots].forEach(function(L){L.forEach(function(e,k){e.classList.toggle('on',k===i);if(e.classList.contains('ttab'))e.setAttribute('aria-selected',k===i?'true':'false')})});
      tabs.forEach(function(e,k){if(k===i){e.style.animation='none';void e.offsetWidth;e.style.animation=''}});
      var s=slides[i];s.querySelectorAll('[style*="--d"]').forEach(function(e){e.style.animation='none';void e.offsetWidth;e.style.animation=''});
      restart()}
    function restart(){clearTimeout(t);if(!reduce&&vis&&!w.classList.contains('paused'))t=setTimeout(function(){show(i+1)},D)}
    w.style.setProperty('--tdur',D/1000+'s');
    tabs.forEach(function(b){b.addEventListener('click',function(){show(+b.dataset.ti)})});
    dots.forEach(function(b){b.addEventListener('click',function(){show(+b.dataset.ti)})});
    w.querySelectorAll('.tarr').forEach(function(b){b.addEventListener('click',function(){show(i+(+b.dataset.tm))})});
    w.addEventListener('mouseenter',function(){w.classList.add('paused');clearTimeout(t)});
    w.addEventListener('mouseleave',function(){w.classList.remove('paused');restart()});
    w.addEventListener('keydown',function(e){if(e.key==='ArrowRight')show(i+1);if(e.key==='ArrowLeft')show(i-1)});
    var x0=null;w.addEventListener('touchstart',function(e){x0=e.touches[0].clientX},{passive:true});
    w.addEventListener('touchend',function(e){if(x0===null)return;var dx=e.changedTouches[0].clientX-x0;if(Math.abs(dx)>50)show(i+(dx<0?1:-1));x0=null},{passive:true});
    if('IntersectionObserver' in window){new IntersectionObserver(function(es){es.forEach(function(en){vis=en.isIntersecting;if(vis)show(i);else clearTimeout(t)})},{threshold:.35}).observe(w)}else{vis=true;restart()}
  });
  document.querySelectorAll('.dshow').forEach(function(d){
    var bs=d.querySelectorAll('.dtabs button'),im=d.querySelectorAll('.dimg'),k=0,t=null;
    function sel(n){k=n;bs.forEach(function(b,j){b.classList.toggle('on',j===n)});im.forEach(function(e,j){e.classList.toggle('on',j===n)})}
    bs.forEach(function(b,j){b.addEventListener('click',function(){sel(j);clearInterval(t)})});
    if(bs.length)t=setInterval(function(){if(document.visibilityState==='visible'&&d.getBoundingClientRect().top<innerHeight&&d.getBoundingClientRect().bottom>0)sel((k+1)%bs.length)},4500);
  });
})();

/* Hero slider */
(function(){var w=document.querySelector('.hsl');if(!w)return;
 var S=w.querySelectorAll('.hsl-s'),B=w.querySelectorAll('.hsl-tab'),V=w.querySelectorAll('.hbg'),i=0,t=null,D=7000;
 var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 function loadV(v){if(!v.src&&v.dataset.src&&!reduce){v.src=v.dataset.src;v.load()}var p=v.play&&v.play();if(p&&p.catch)p.catch(function(){})}
 function show(n){i=(n+S.length)%S.length;S.forEach(function(e,k){e.classList.toggle('on',k===i)});
  B.forEach(function(e,k){e.classList.toggle('on',k===i);var bar=e.querySelector('i');if(k===i&&bar){bar.style.animation='none';void bar.offsetWidth;bar.style.animation=''}});
  var bg=S[i].dataset.bg;V.forEach(function(v){var on=v.getAttribute('data-src').indexOf(bg)>=0;v.classList.toggle('on',on);if(on)loadV(v)});
  clearTimeout(t);if(!reduce&&!w.classList.contains('paused'))t=setTimeout(function(){show(i+1)},D)}
 B.forEach(function(b){b.addEventListener('click',function(){show(+b.dataset.i)})});
 w.addEventListener('mouseenter',function(){w.classList.add('paused');clearTimeout(t)});
 w.addEventListener('mouseleave',function(){w.classList.remove('paused');show(i)});
 var x0=null;w.addEventListener('touchstart',function(e){x0=e.touches[0].clientX},{passive:true});
 w.addEventListener('touchend',function(e){if(x0===null)return;var dx=e.changedTouches[0].clientX-x0;if(Math.abs(dx)>50)show(i+(dx<0?1:-1));x0=null},{passive:true});
 show(0);
})();
