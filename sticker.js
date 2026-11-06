/* ScanSay brand + sticker renderer (shared by website, dashboard, form, mockups). Logo: pine speech bubble, coral scan corners, sun-yellow eyes, white smile. */
(function(){
const PAL={black:'#0F1013',black2:'#18191E',gold:'#1D4ED8',goldText:'#1D4ED8',goldLight:'#2563EB',white:'#FFFFFF',cream:'#F6F6F8',cream2:'#ECECF0',line:'#E4E4E9',ink:'#1A1A1F',muted:'#5B5B66',
  /* legacy keys used by older code */ purple:'#0F1013',purple2:'#18191E',amber:'#1D4ED8',lav:'#F6F6F8',lav2:'#ECECF0',violet:'#1D4ED8'};
let GID=0;
const GOLD={l:'#FFF3C4',a:'#F4D06F',b:'#D9A93B',d:'#A97A12'};
function goldDefs(id){return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${GOLD.l}"/><stop offset=".35" stop-color="${GOLD.a}"/><stop offset=".65" stop-color="${GOLD.b}"/><stop offset="1" stop-color="${GOLD.d}"/></linearGradient><linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3B82F6"/><stop offset=".5" stop-color="#2563EB"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient></defs>`}
const uid=p=>p+(++GID)+Math.random().toString(36).slice(2,6);
/* The ScanSay mark. o.ring default true. */
function mark(x,y,s,o){o=o||{};const k=s/128,id=uid('qm');
  return `<g transform="translate(${x} ${y}) scale(${k})"><defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1D4ED8"/><stop offset="1" stop-color="#0B1F4D"/></linearGradient></defs><rect x="0" y="0" width="128" height="128" rx="26" fill="#fff"/><rect x="5" y="5" width="118" height="118" rx="22" fill="url(#${id}g)"/><g transform="translate(22.5 11) scale(.69)"><path d="M60.00 4.00 C66.00 24.00 86.00 30.00 101.00 42.00 C117.00 56.00 116.00 86.00 98.00 101.00 C86.00 112.00 70.00 116.00 60.00 134.00 C50.00 116.00 34.00 112.00 22.00 101.00 C4.00 86.00 3.00 56.00 19.00 42.00 C34.00 30.00 54.00 24.00 60.00 4.00 Z" fill="none" stroke="#FFFFFF" stroke-width="5.5"/><path d="M60 22 C63 28 63 33 60 37 C57 33 57 28 60 22 Z" fill="#FFFFFF"/><path d="M60 102 C56 108 56 113 60 118 C64 113 64 108 60 102 Z" fill="#FFFFFF"/><rect x="40" y="46" width="17" height="17" rx="2.6" fill="none" stroke="#FFFFFF" stroke-width="3.4"/><rect x="45.1" y="51.1" width="6.800000000000001" height="6.800000000000001" rx="1" fill="#FFFFFF"/><rect x="63" y="46" width="17" height="17" rx="2.6" fill="none" stroke="#FFFFFF" stroke-width="3.4"/><rect x="68.1" y="51.1" width="6.800000000000001" height="6.800000000000001" rx="1" fill="#FFFFFF"/><rect x="40" y="69" width="17" height="17" rx="2.6" fill="none" stroke="#FFFFFF" stroke-width="3.4"/><rect x="45.1" y="74.1" width="6.800000000000001" height="6.800000000000001" rx="1" fill="#FFFFFF"/><rect x="63" y="74" width="5" height="5" rx="1" fill="#FFFFFF"/><rect x="70" y="74" width="5" height="5" rx="1" fill="#FFFFFF"/><rect x="63" y="81" width="5" height="5" rx="1" fill="#FFFFFF"/><rect x="70" y="86" width="5" height="5" rx="1" fill="#FFFFFF"/></g></g>`}
function markSVG(size,o){return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">${mark(0,0,64,o)}</svg>`}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
/* QR in three styles: square | rounded | dots. hole:[fraction] leaves a clear square in the middle for the logo */
const QRSTYLES={square:{sv:'Fyrkant',en:'Square'},rounded:{sv:'Rundad',en:'Rounded'},dots:{sv:'Prickar',en:'Dots'}};
const QRCOLORS={'#0F1013':{sv:'Svart',en:'Black'},'#0B1F4D':{sv:'Marinblå',en:'Navy'},'#1D4ED8':{sv:'Blå',en:'Blue'}};
function rr(x,y,w,h,r){r=Math.min(r,w/2,h/2);return `M${(x+r).toFixed(3)} ${y.toFixed(3)}h${(w-2*r).toFixed(3)}a${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${r.toFixed(3)} ${r.toFixed(3)}v${(h-2*r).toFixed(3)}a${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 -${r.toFixed(3)} ${r.toFixed(3)}h-${(w-2*r).toFixed(3)}a${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 -${r.toFixed(3)} -${r.toFixed(3)}v-${(h-2*r).toFixed(3)}a${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${r.toFixed(3)} -${r.toFixed(3)}z`}
function qrPath(text,x,y,size,hole,style){style=style||'rounded';const q=qrcode(0,hole?'H':'M');q.addData(text);q.make();const n=q.getModuleCount(),m=size/n;let d='';
  const h0=hole?Math.floor(n*(1-hole)/2):-1,h1=hole?n-1-h0:-1;
  const inF=(r,c)=>(r<7&&c<7)||(r<7&&c>=n-7)||(r>=n-7&&c<7);
  for(let r=0;r<n;r++)for(let c=0;c<n;c++){if(hole&&r>=h0&&r<=h1&&c>=h0&&c<=h1)continue;if(style!=='square'&&inF(r,c))continue;if(!q.isDark(r,c))continue;
    const X=x+c*m,Y=y+r*m;
    if(style==='square')d+=`M${X.toFixed(3)} ${Y.toFixed(3)}h${m.toFixed(3)}v${m.toFixed(3)}h-${m.toFixed(3)}z`;
    else if(style==='dots'){const k=m*.42,cx=X+m/2,cy=Y+m/2;d+=`M${(cx-k).toFixed(3)} ${cy.toFixed(3)}a${k.toFixed(3)} ${k.toFixed(3)} 0 1 0 ${(2*k).toFixed(3)} 0a${k.toFixed(3)} ${k.toFixed(3)} 0 1 0 -${(2*k).toFixed(3)} 0z`}
    else d+=rr(X+m*.06,Y+m*.06,m*.88,m*.88,m*.32)}
  if(style!=='square'){const R=style==='dots'?.5:.3;[[0,0],[0,n-7],[n-7,0]].forEach(([r,c])=>{const X=x+c*m,Y=y+r*m;
    d+=rr(X,Y,7*m,7*m,7*m*R*.62)+rr(X+m,Y+m,5*m,5*m,5*m*R*.5);
    d+=rr(X+2*m,Y+2*m,3*m,3*m,3*m*R*.55)})}
  return d}
function qrSVG(text,x,y,size,hole,style,color){return `<path d="${qrPath(text,x,y,size,hole,style)}" fill="${color||'#0F1013'}" fill-rule="evenodd"/>`}
function qrWithLogo(text,x,y,size,color,style){const hole=.24,cx=x+size/2,cy=y+size/2,s=size*hole*.86;
  return qrSVG(text,x,y,size,hole,style,color)+mark(cx-s/2,cy-s/2,s,{})}
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
  black:{dark:true,bg:'#0F1013',fg:'#FFFFFF',ac:'#93C5FD',sub:'#A1A1AA',frame:'#E4002B',pw:'#FFFFFF',pws:1},
  orange:{dark:true,bg:'#F97316',fg:'#FFFFFF',ac:'#FFFFFF',sub:'rgba(255,255,255,.88)',frame:'#FFFFFF',pw:'#FFFFFF',pws:1},
  gold:{bg:'gold',fg:'#0F1013',ac:'#0F1013',sub:'#5A3E00',frame:'#0F1013',pw:'#0F1013'},
  green:{dark:true,bg:'#15803D',fg:'#FFFFFF',ac:'#D9F99D',sub:'rgba(255,255,255,.85)',frame:'#D9F99D',pw:'#FFFFFF',pws:1},
  blue:{dark:true,bg:'#1D4ED8',fg:'#FFFFFF',ac:'#FFFFFF',sub:'rgba(255,255,255,.85)',frame:'#FFFFFF',pw:'#FFFFFF',pws:1},
  lime:{dark:true,bg:'#E4002B',fg:'#FFFFFF',ac:'#FFFFFF',sub:'rgba(255,255,255,.9)',frame:'#FFFFFF',pw:'#FFFFFF',pws:1},
  cream:{bg:'#F6F6F8',fg:'#0F1013',ac:'#1D4ED8',sub:'#5B5B66',frame:'gold',stroke:'#E4E4E9',pw:'#1D4ED8',pws:1},
  ivory:{bg:'#F5EFE4',fg:'#1C1A17',ac:'#9A7B4F',sub:'#6B6257',frame:'#9A7B4F',stroke:'#E6DCCB',pw:'#1C1A17'},
  noir:{dark:true,bg:'#141414',fg:'#F5EFE4',ac:'#C9A96E',sub:'#B8AE9C',frame:'#C9A96E',pw:'#F5EFE4',pws:1},
  forest:{dark:true,bg:'#1F3A33',fg:'#F5EFE4',ac:'#C9A96E',sub:'#C8D3CC',frame:'#C9A96E',pw:'#F5EFE4',pws:1},
  pink:{dark:true,bg:'#EC4899',fg:'#FFFFFF',ac:'#FDE047',sub:'rgba(255,255,255,.9)',frame:'#FDE047',pw:'#FFFFFF',pws:1},
  sun:{bg:'#FDE047',fg:'#0A0F1C',ac:'#1D4ED8',sub:'#713F12',frame:'#0A0F1C',pw:'#0A0F1C'},
  sky:{bg:'#38BDF8',fg:'#0A0F1C',ac:'#0A0F1C',sub:'#0C4A6E',frame:'#0A0F1C',pw:'#0A0F1C'},
  purple:{dark:true,bg:'#7C3AED',fg:'#FFFFFF',ac:'#FFFFFF',sub:'rgba(255,255,255,.88)',frame:'#E4002B',pw:'#FFFFFF',pws:1},
  navy:{dark:true,bg:'#0A1F44',fg:'#FFFFFF',ac:'#FFFFFF',sub:'#93C5FD',frame:'#E4002B',pw:'#FFFFFF',pws:1}
};
function themeFor(t,custom){if(THEMES[t])return THEMES[t];const bg=/^#[0-9a-f]{6}$/i.test(custom||'')?custom:'#FFFFFF';const dark=lum(bg)<.35;
  return dark?{dark:true,bg,fg:'#FFFFFF',ac:'#2563EB',sub:'rgba(255,255,255,.75)',frame:'gold',pw:'#2563EB'}:{bg,fg:'#0F1013',ac:'#0F1013',sub:'rgba(0,0,0,.62)',frame:'#0F1013',pw:'#0F1013',stroke:'rgba(0,0,0,.12)'}}
const STYLES={modern:{sv:'Modern',en:'Modern',t:'',c:''},
  bold:{sv:'Kraftig',en:'Bold',t:'font-family="\'Inter Display\',Inter,Arial,sans-serif" letter-spacing="-.03em" W900',c:'font-family="\'Inter Display\',Inter,Arial,sans-serif" W900'},
  friendly:{sv:'Vänlig',en:'Friendly',t:'font-family="\'Plus Jakarta Sans\',Inter,Arial,sans-serif" W800',c:'font-family="\'Plus Jakarta Sans\',Inter,Arial,sans-serif" W800'},
  elegant:{sv:'Elegant',en:'Elegant',t:'font-family="\'Playfair Display\',Georgia,serif" font-style="italic" W700',c:''},
  caps:{sv:'Versaler',en:'Capitals',t:'letter-spacing=".04em" CAPS W900',c:'letter-spacing=".03em" CAPS W800'}};
function styl(svg,spec){if(!spec)return svg;const w=(spec.match(/W(\d00)/)||[])[1];const caps=/CAPS/.test(spec);const attrs=spec.replace(/W\d00|CAPS/g,'').trim();
  let s=svg;if(w)s=s.replace(/font-weight="\d+"/g,'font-weight="'+w+'"');if(caps)s=s.replace(/>([^<]+)<\/text>/g,(m,x)=>'>'+x.toUpperCase()+'</text>').replace(/font-size="([\d.]+)"/g,(m,v)=>'font-size="'+(v*.82).toFixed(2)+'"');return attrs?'<g '+attrs+'>'+s+'</g>':s}
const TXT={sv:{cta:'Lämna feedback',by:'Drivs av',code:'Kod'},en:{cta:'Leave feedback',by:'Powered by',code:'Code'}};
/* o: {code,url,title,cta,place,lang,theme,custom,w,h (mm),showPlace,logo(default true)} */
function sticker(o){
  const ST=STYLES[o.style]||STYLES.modern;const T=themeFor(o.theme,o.custom),L=TXT[o.lang]||TXT.sv,gid=uid('sbg');
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
    return `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s*.07}" fill="#fff"/>`+(useLogo?qrWithLogo(url,x+fr,y+fr,q,o.qrColor,o.qr):qrSVG(url,x+fr,y+fr,q,0,o.qr,o.qrColor))+
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
    body+=styl(txt(ttl.lines,W/2,y,ttl.fs,T.fg,800),ST.t);y+=tH+(tH?gap:0);
    body+=qrBlock((W-qs)/2,y,qs);y+=qs+gap;
    body+=styl(txt(ct.lines,W/2,y,ct.fs,T.ac,800),ST.c);y+=cH;
    if(plFs)body+=`<text x="${W/2}" y="${y+plFs*1.15}" text-anchor="middle" font-size="${plFs.toFixed(2)}" font-weight="600" fill="${T.sub}">${esc(o.place)}</text>`;
    body+=`<line x1="${W*.2}" x2="${W*.8}" y1="${H-pad*.55-fh}" y2="${H-pad*.55-fh}" stroke="${T.pw==='#0F1013'?'#0F1013':'#1D4ED8'}" stroke-opacity=".45" stroke-width="${m*.004}"/>`+footer(W/2,H-pad*.55-ffs*.55);
  }else{
    const qs=H-pad*2,lw=W-qs-pad*3,lx=pad;
    const ttl=fit(o.title,lw,H*.42,H*.2,3),ct=fit(cta,lw,H*.2,H*.13,2);
    const tH=ttl.lines.length*ttl.fs*1.18,cH=ct.lines.length*ct.fs*1.18,gap=H*.05;
    let y=pad+(H-pad*2-ffs*2.4-tH-gap-cH)/2;
    body+=styl(txt(ttl.lines,lx,y,ttl.fs,T.fg,800,'start'),ST.t);y+=tH+gap;body+=styl(txt(ct.lines,lx,y,ct.fs,T.ac,800,'start'),ST.c);
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
const THEME_NAMES={white:{sv:'Vit',en:'White'},black:{sv:'Svart',en:'Black'},orange:{sv:'Orange',en:'Orange'},gold:{sv:'Guld',en:'Gold'},green:{sv:'Grön',en:'Green'},blue:{sv:'Blå',en:'Blue'},lime:{sv:'Röd',en:'Red'},cream:{sv:'Krämvit',en:'Cream'},ivory:{sv:'Elfenben',en:'Ivory'},noir:{sv:'Noir',en:'Noir'},forest:{sv:'Skogsgrön',en:'Forest'},pink:{sv:'Rosa',en:'Pink'},sun:{sv:'Solgul',en:'Sun yellow'},sky:{sv:'Himmelsblå',en:'Sky blue'},purple:{sv:'Lila',en:'Purple'},navy:{sv:'Marinblå',en:'Navy'},custom:{sv:'Egen färg',en:'Custom colour'}};
const SWATCH={white:'#FFFFFF',black:'#0F1013',orange:'#F97316',gold:'linear-gradient(135deg,#FFF3C4,#F4D06F 35%,#D9A93B 65%,#A97A12)',green:'#15803D',blue:'#1D4ED8',lime:'#E4002B',cream:'#F6F6F8',ivory:'#F5EFE4',noir:'#141414',forest:'#1F3A33',pink:'#EC4899',sun:'#FDE047',sky:'#38BDF8',purple:'#7C3AED',navy:'#0A1F44'};
window.SSB={QRSTYLES,QRCOLORS,qrSVG,STYLES,PAL,GOLD,goldDefs,mark,markSVG,sticker,SIZES,THEMES,THEME_NAMES,SWATCH,TXT,qrPath,qrWithLogo,esc,themeFor};
})();
