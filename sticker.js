/* ScanSay brand + sticker renderer (shared by website, dashboard, form, mockups). Logo: pine speech bubble, coral scan corners, sun-yellow eyes, white smile. */
(function(){
const PAL={black:'#0F1013',black2:'#18191E',gold:'#1D4ED8',goldText:'#1D4ED8',goldLight:'#2563EB',white:'#FFFFFF',cream:'#F6F6F8',cream2:'#ECECF0',line:'#E4E4E9',ink:'#1A1A1F',muted:'#5B5B66',
  /* legacy keys used by older code */ purple:'#0F1013',purple2:'#18191E',amber:'#1D4ED8',lav:'#F6F6F8',lav2:'#ECECF0',violet:'#1D4ED8'};
let GID=0;
const GOLD={l:'#FFF3C4',a:'#F4D06F',b:'#D9A93B',d:'#A97A12'};
function goldDefs(id){return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${GOLD.l}"/><stop offset=".35" stop-color="${GOLD.a}"/><stop offset=".65" stop-color="${GOLD.b}"/><stop offset="1" stop-color="${GOLD.d}"/></linearGradient><linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3B82F6"/><stop offset=".5" stop-color="#2563EB"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient></defs>`}
const uid=p=>p+(++GID)+Math.random().toString(36).slice(2,6);
/* The ScanSay mark. o.ring default true. */
function mark(x,y,s,o){o=o||{};const k=s/64,id=uid('qm');
  return `<g transform="translate(${x} ${y}) scale(${k})"><defs><linearGradient id="qg${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3B82F6"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient></defs><path d="M14 2h36a11 11 0 0 1 11 11v33a11 11 0 0 1-11 11H27l-14 7v-7h-1A9 9 0 0 1 3 48V13A11 11 0 0 1 14 2z" fill="url(#qg${id})"/><rect x="13.0" y="11.0" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="18.5" y="11.0" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="24.0" y="11.0" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="13.0" y="16.5" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="24.0" y="16.5" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="13.0" y="22.0" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="18.5" y="22.0" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="24.0" y="22.0" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="35.0" y="11.0" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="40.5" y="11.0" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="46.0" y="11.0" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="35.0" y="16.5" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="46.0" y="16.5" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="35.0" y="22.0" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="40.5" y="22.0" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="46.0" y="22.0" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="13.0" y="33.0" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="18.5" y="33.0" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="24.0" y="33.0" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="13.0" y="38.5" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="24.0" y="38.5" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="13.0" y="44.0" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="18.5" y="44.0" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="24.0" y="44.0" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="35.0" y="33.0" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="46.0" y="33.0" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="40.5" y="38.5" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="35.0" y="44.0" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="29.5" y="27.5" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="40.5" y="27.5" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="29.5" y="38.5" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="46.0" y="44.0" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="29.5" y="16.5" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/><rect x="18.5" y="27.5" width="4.6" height="4.6" rx="1.2" fill="#FFFFFF"/></g>`}
function markSVG(size,o){return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">${mark(0,0,64,o)}</svg>`}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
/* QR path; hole:[fraction] leaves a clear square in the middle for the logo */
function qrPath(text,x,y,size,hole){const q=qrcode(0,hole?'H':'M');q.addData(text);q.make();const n=q.getModuleCount(),m=size/n;let d='';
  const h0=hole?Math.floor(n*(1-hole)/2):-1,h1=hole?n-1-h0:-1;
  for(let r=0;r<n;r++)for(let c=0;c<n;c++){if(hole&&r>=h0&&r<=h1&&c>=h0&&c<=h1)continue;if(q.isDark(r,c))d+=`M${(x+c*m).toFixed(3)} ${(y+r*m).toFixed(3)}h${m.toFixed(3)}v${m.toFixed(3)}h-${m.toFixed(3)}z`}return d}
function qrWithLogo(text,x,y,size,color){const hole=.24,cx=x+size/2,cy=y+size/2,s=size*hole*.86;
  return `<path d="${qrPath(text,x,y,size,hole)}" fill="${color||'#0F1013'}"/>${mark(cx-s/2,cy-s/2,s,{})}`}
const CW=.58;
function fit(text,maxW,maxH,maxFs,maxLines){text=String(text||'').trim().replace(/\s+/g,' ');if(!text)return{lines:[],fs:0};
  const words=text.split(' ');let best={lines:[text],fs:0};
  for(let n=1;n<=maxLines;n++){const target=text.length/n;let lines=[],cur='';
    words.forEach(w=>{const t=cur?cur+' '+w:w;if(cur&&t.length>target*1.15&&lines.length<n-1){lines.push(cur);cur=w}else cur=t});lines.push(cur);
    const longest=Math.max(...lines.map(l=>l.length));const fs=Math.min(maxFs,maxW/(longest*CW),maxH/(lines.length*1.18));if(fs>best.fs*1.08)best={lines,fs}}
  return best}
function lum(hex){const h=hex.replace('#','');const v=[0,2,4].map(i=>parseInt(h.substr(i,2),16)/255).map(c=>c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4));return .2126*v[0]+.7152*v[1]+.0722*v[2]}
const THEMES={
  white:{bg:'#FFFFFF',fg:'#0F1013',ac:'#1D4ED8',sub:'#5B5B66',frame:'gold',stroke:'#E4E4E9',pw:'#1D4ED8',pws:1},
  black:{dark:true,bg:'#0F1013',fg:'#FFFFFF',ac:'#F4D06F',sub:'#A1A1AA',frame:'gold',pw:'#F4D06F'},
  orange:{dark:true,bg:'#F97316',fg:'#FFFFFF',ac:'#FFFFFF',sub:'rgba(255,255,255,.88)',frame:'#FFFFFF',pw:'#FFFFFF',pws:1},
  gold:{bg:'gold',fg:'#0F1013',ac:'#0F1013',sub:'#5A3E00',frame:'#0F1013',pw:'#0F1013'},
  green:{dark:true,bg:'#15803D',fg:'#FFFFFF',ac:'#D9F99D',sub:'rgba(255,255,255,.85)',frame:'#D9F99D',pw:'#FFFFFF',pws:1},
  blue:{dark:true,bg:'#1D4ED8',fg:'#FFFFFF',ac:'#C8F542',sub:'rgba(255,255,255,.85)',frame:'#C8F542',pw:'#FFFFFF',pws:1},
  lime:{bg:'#C8F542',fg:'#0A0F1C',ac:'#0A0F1C',sub:'#365314',frame:'#0A0F1C',pw:'#0A0F1C'},
  cream:{bg:'#F6F6F8',fg:'#0F1013',ac:'#1D4ED8',sub:'#5B5B66',frame:'gold',stroke:'#E4E4E9',pw:'#1D4ED8',pws:1}
};
function themeFor(t,custom){if(THEMES[t])return THEMES[t];const bg=/^#[0-9a-f]{6}$/i.test(custom||'')?custom:'#FFFFFF';const dark=lum(bg)<.35;
  return dark?{dark:true,bg,fg:'#FFFFFF',ac:'#2563EB',sub:'rgba(255,255,255,.75)',frame:'gold',pw:'#2563EB'}:{bg,fg:'#0F1013',ac:'#0F1013',sub:'rgba(0,0,0,.62)',frame:'#0F1013',pw:'#0F1013',stroke:'rgba(0,0,0,.12)'}}
const TXT={sv:{cta:'Lämna feedback',by:'Drivs av',code:'Kod'},en:{cta:'Leave feedback',by:'Powered by',code:'Code'}};
/* o: {code,url,title,cta,place,lang,theme,custom,w,h (mm),showPlace,logo(default true)} */
function sticker(o){
  const T=themeFor(o.theme,o.custom),L=TXT[o.lang]||TXT.sv,gid=uid('sbg');
  const W=+o.w||50,H=+o.h||100,m=Math.min(W,H),pad=m*.075,url=o.url||('https://scansay.se/k/'+o.code),useLogo=o.logo!==false;
  const cta=o.cta==null||o.cta===''?L.cta:o.cta;const land=W>H*1.15;
  const frameCol=T.frame==='gold'?(T.dark?`url(#${gid})`:`url(#${gid}b)`):T.frame;
  let body='';
  const ffs=Math.max(m*.042,1.6),mk=ffs*1.9;
  const pwCol=(T.pw==='#0F1013'||T.pw==='#0A0F1C'||T.pws)?T.pw:(T.dark?`url(#${gid})`:`url(#${gid}b)`);
  function footer(cx,y){const byW=L.by.length*ffs*.56,nameW=7*ffs*1.08*.6,tot=byW+ffs*.6+mk+ffs*.5+nameW;let x=cx-tot/2;
    return `<text x="${x}" y="${y}" font-size="${ffs}" font-weight="700" fill="${(T.pw==='#0F1013'||T.pw==='#0A0F1C')?T.sub:pwCol}">${L.by}</text>${mark(x+byW+ffs*.6,y-mk*.78,mk,{})}<text x="${x+byW+ffs*.6+mk+ffs*.5}" y="${y}" font-size="${ffs*1.08}" font-weight="800" fill="${pwCol}">ScanSay</text>`}
  function qrBlock(x,y,s){const fr=s*.055,br=s*.16,sw=Math.max(s*.022,.5),q=s-fr*2;
    const c=(d)=>`<path d="${d}" fill="none" stroke="${frameCol}" stroke-width="${sw}" stroke-linecap="round"/>`;const o2=-sw*1.6,X=x+o2,Y=y+o2,S=s-o2*2;
    return `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s*.07}" fill="#fff"/>`+(useLogo?qrWithLogo(url,x+fr,y+fr,q):`<path d="${qrPath(url,x+fr,y+fr,q)}" fill="#0F1013"/>`)+
      c(`M${X} ${Y+br}V${Y+sw*2}q0-${sw*2} ${sw*2}-${sw*2}H${X+br}`)+c(`M${X+S-br} ${Y}H${X+S-sw*2}q${sw*2} 0 ${sw*2} ${sw*2}V${Y+br}`)+
      c(`M${X+S} ${Y+S-br}V${Y+S-sw*2}q0 ${sw*2}-${sw*2} ${sw*2}H${X+S-br}`)+c(`M${X+br} ${Y+S}H${X+sw*2}q-${sw*2} 0-${sw*2}-${sw*2}V${Y+S-br}`)}
  const txt=(lines,cx,y,fs,col,wt,anchor)=>lines.map((l,i)=>`<text x="${cx}" y="${y+fs*.86+i*fs*1.18}" text-anchor="${anchor||'middle'}" font-size="${fs.toFixed(2)}" font-weight="${wt}" fill="${col}">${esc(l)}</text>`).join('');
  if(!land){
    const sq=H/W<1.3,fh=ffs*2.6,ttl=fit(o.title,W-pad*2,H*(sq?.13:.2),m*(sq?.11:.17),sq?2:3);
    const ct=fit(cta,W-pad*2,m*(sq?.09:.2),m*(sq?.075:.11),sq?1:2);
    const plFs=o.place&&o.showPlace!==false&&!sq?Math.min(m*.055,(W-pad*2)/(String(o.place).length*CW*.9)):0;
    const tH=ttl.lines.length*ttl.fs*1.18,cH=ct.lines.length*ct.fs*1.18,pH=plFs?plFs*1.5:0,gap=m*(sq?.04:.06);
    let qs=Math.min(W-pad*2-m*.04,H-pad*2-fh-tH-cH-pH-gap*(ttl.lines.length?3:2));qs=Math.max(qs,m*.3);
    const stack=tH+(tH?gap:0)+qs+gap+cH+pH;let y=pad+Math.max(0,(H-pad*2-fh-stack)/2);
    body+=txt(ttl.lines,W/2,y,ttl.fs,T.fg,800);y+=tH+(tH?gap:0);
    body+=qrBlock((W-qs)/2,y,qs);y+=qs+gap;
    body+=txt(ct.lines,W/2,y,ct.fs,T.ac,800);y+=cH;
    if(plFs)body+=`<text x="${W/2}" y="${y+plFs*1.15}" text-anchor="middle" font-size="${plFs.toFixed(2)}" font-weight="600" fill="${T.sub}">${esc(o.place)}</text>`;
    body+=`<line x1="${W*.2}" x2="${W*.8}" y1="${H-pad*.55-fh}" y2="${H-pad*.55-fh}" stroke="${T.pw==='#0F1013'?'#0F1013':'#1D4ED8'}" stroke-opacity=".45" stroke-width="${m*.004}"/>`+footer(W/2,H-pad*.55-ffs*.55);
  }else{
    const qs=H-pad*2,lw=W-qs-pad*3,lx=pad;
    const ttl=fit(o.title,lw,H*.42,H*.2,3),ct=fit(cta,lw,H*.2,H*.13,2);
    const tH=ttl.lines.length*ttl.fs*1.18,cH=ct.lines.length*ct.fs*1.18,gap=H*.05;
    let y=pad+(H-pad*2-ffs*2.4-tH-gap-cH)/2;
    body+=txt(ttl.lines,lx,y,ttl.fs,T.fg,800,'start');y+=tH+gap;body+=txt(ct.lines,lx,y,ct.fs,T.ac,800,'start');
    body+=footer(lx+lw/2,H-pad);body+=qrBlock(W-pad-qs,pad,qs);
  }
  const bgFill=T.bg==='gold'?`url(#${gid})`:T.bg;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm" font-family="Inter,'Plus Jakarta Sans',Arial,sans-serif">${goldDefs(gid)}<rect width="${W}" height="${H}" rx="${m*.07}" fill="${bgFill}" ${T.stroke?`stroke="${T.stroke}" stroke-width="${m*.006}"`:''}/>${body}</svg>`}
const SIZES=[
 {id:'5x10',w:50,h:100,sv:'5 × 10 cm (ca 2 × 4 tum)',en:'5 × 10 cm (about 2 × 4 in)'},
 {id:'7x10',w:70,h:100,sv:'7 × 10 cm',en:'7 × 10 cm'},
 {id:'a6',w:105,h:148,sv:'A6, 10,5 × 14,8 cm',en:'A6, 10.5 × 14.8 cm'},
 {id:'a5',w:148,h:210,sv:'A5, 14,8 × 21 cm (bordsställ)',en:'A5, 14.8 × 21 cm (table stand)'},
 {id:'8x8',w:80,h:80,sv:'8 × 8 cm kvadrat',en:'8 × 8 cm square'},
 {id:'5x5',w:50,h:50,sv:'5 × 5 cm liten',en:'5 × 5 cm small'},
 {id:'10x5',w:100,h:50,sv:'10 × 5 cm liggande',en:'10 × 5 cm landscape'}
];
const THEME_NAMES={white:{sv:'Vit',en:'White'},black:{sv:'Svart',en:'Black'},orange:{sv:'Orange',en:'Orange'},gold:{sv:'Guld',en:'Gold'},green:{sv:'Grön',en:'Green'},blue:{sv:'Blå',en:'Blue'},lime:{sv:'Lime',en:'Lime'},cream:{sv:'Krämvit',en:'Cream'},custom:{sv:'Egen färg',en:'Custom colour'}};
const SWATCH={white:'#FFFFFF',black:'#0F1013',orange:'#F97316',gold:'linear-gradient(135deg,#FFF3C4,#F4D06F 35%,#D9A93B 65%,#A97A12)',green:'#15803D',blue:'#1D4ED8',lime:'#C8F542',cream:'#F6F6F8'};
window.SSB={PAL,GOLD,goldDefs,mark,markSVG,sticker,SIZES,THEMES,THEME_NAMES,SWATCH,TXT,qrPath,qrWithLogo,esc,themeFor};
})();
