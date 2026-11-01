/* ScanSay guard: spam and fake-input protection for public forms.
   Client side: honeypot, human timing, interaction check, proof of work, rate limit,
   email / name / text checks. The same checks must run again on the server (see server/submit.js). */
(function(g){
const START=Date.now();let acts=0;
['pointerdown','keydown','touchstart','input'].forEach(e=>addEventListener(e,()=>{acts++},{passive:true,capture:true}));

/* compact SHA-256 (sync, for proof of work) */
const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
function sha256(str){const b=new TextEncoder().encode(str),l=b.length,n=((l+9+63)>>6)<<6,m=new Uint8Array(n);m.set(b);m[l]=0x80;const dv=new DataView(m.buffer);dv.setUint32(n-4,l*8);
 let h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];const w=new Uint32Array(64);const r=(x,y)=>(x>>>y)|(x<<(32-y));
 for(let o=0;o<n;o+=64){for(let i=0;i<16;i++)w[i]=dv.getUint32(o+i*4);for(let i=16;i<64;i++){const a=w[i-15],c=w[i-2];w[i]=(w[i-16]+(r(a,7)^r(a,18)^(a>>>3))+w[i-7]+(r(c,17)^r(c,19)^(c>>>10)))|0}
  let [A,B,C,D,E,F,G,H]=h;for(let i=0;i<64;i++){const t1=(H+(r(E,6)^r(E,11)^r(E,25))+((E&F)^(~E&G))+K[i]+w[i])|0,t2=((r(A,2)^r(A,13)^r(A,22))+((A&B)^(A&C)^(B&C)))|0;H=G;G=F;F=E;E=(D+t1)|0;D=C;C=B;B=A;A=(t1+t2)|0}
  h=h.map((v,i)=>(v+[A,B,C,D,E,F,G,H][i])|0)}
 return h.map(v=>(v>>>0).toString(16).padStart(8,'0')).join('')}
/* proof of work: find nonce so sha256(challenge+nonce) starts with `zeros` hex zeros (4 = ~65k tries, ~0.3-1 s on a phone) */
function pow(challenge,zeros=4){return new Promise(res=>{const p='0'.repeat(zeros);let i=0;const t0=Date.now();
 (function run(){const end=i+4000;for(;i<end;i++){if(sha256(challenge+i).startsWith(p)){res({challenge,nonce:i,ms:Date.now()-t0});return}}setTimeout(run,0)})()})}

const DISPOSABLE=('mailinator.com guerrillamail.com guerrillamail.net sharklasers.com grr.la 10minutemail.com 10minutemail.net tempmail.com temp-mail.org temp-mail.io tempmail.net tempmailo.com tempr.email '+
 'yopmail.com yopmail.fr yopmail.net trashmail.com trashmail.de trashmail.net getnada.com nada.email dispostable.com maildrop.cc mailnesia.com mintemail.com mohmal.com moakt.com '+
 'throwawaymail.com fakeinbox.com fakemail.net emailondeck.com spamgourmet.com mailcatch.com mailpoof.com burnermail.io inboxkitten.com 33mail.com anonaddy.me '+
 'mytemp.email tmpmail.org tmpmail.net tempinbox.com discard.email discardmail.com spambox.us spam4.me harakirimail.com mailtemp.info luxusmail.org emltmp.com '+
 'linshiyouxiang.net 1secmail.com 1secmail.org 1secmail.net kzccv.com wwjmp.com esiix.com xojxe.com yoggm.com dropmail.me minuteinbox.com tempail.com '+
 'example.com example.org example.net test.com invalid.com fake.com none.com noemail.com nomail.com asdf.com qwerty.com').split(/\s+/);
const COMMON=['gmail.com','hotmail.com','hotmail.se','outlook.com','outlook.se','live.se','live.com','yahoo.com','yahoo.se','icloud.com','me.com','msn.com','telia.com','bredband.net','spray.se','protonmail.com','proton.me','gmx.com','gmx.de','aol.com'];
function lev(a,b){const d=[...Array(b.length+1).keys()];for(let i=1;i<=a.length;i++){let p=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const t=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,p+(a[i-1]===b[j-1]?0:1));p=t}}return d[b.length]}

function email(e){e=String(e||'').trim().toLowerCase();
 if(!/^[a-z0-9._%+'-]{1,64}@[a-z0-9.-]+\.[a-z]{2,24}$/.test(e)||e.includes('..')||/^[.]|[.]@/.test(e))return{ok:false,reason:'format'};
 const [u,d]=e.split('@');
 if(DISPOSABLE.includes(d)||DISPOSABLE.some(x=>d.endsWith('.'+x)))return{ok:false,reason:'disposable'};
 if(/^(test|asdf|qwerty|abc|aaa+|xxx+|fake|noreply|no-reply|none|null|spam)\d*$/.test(u))return{ok:false,reason:'fake'};
 if(!COMMON.includes(d)){const near=COMMON.find(c=>lev(d,c)<=2&&d.split('.').pop().length>=2);if(near&&near!==d)return{ok:true,suggest:u+'@'+near}}
 return{ok:true}}
function name(n){n=String(n||'').trim();if(!n)return{ok:true};
 if(n.length>60)return{ok:false,reason:'length'};
 if(/[@<>{}\[\]|\\\/]|https?:|www\./i.test(n))return{ok:false,reason:'chars'};
 return{ok:true}} /* names are never judged as "fake": international names, nicknames and single names are all fine */
function text(t){t=String(t||'').trim();
 if(t.length<3)return{ok:false,reason:'short'};
 if(/https?:\/\/|www\.|\b[a-z0-9-]+\.(ru|xyz|top|click|link|biz|info|cn)\b/i.test(t))return{ok:false,reason:'link'};
 if(/(.)\1{7,}/.test(t))return{ok:false,reason:'repeat'};
 if(t.length>2000)return{ok:false,reason:'long'};
 return{ok:true}}
function rate(key,max,win){try{const k='ss-rate-'+key,now=Date.now();const a=JSON.parse(localStorage.getItem(k)||'[]').filter(x=>now-x<win);if(a.length>=max)return false;a.push(now);localStorage.setItem(k,JSON.stringify(a));return true}catch(e){return true}}
function dup(key,body){try{const k='ss-last-'+key,h=sha256(body.toLowerCase().replace(/\s+/g,' '));const last=localStorage.getItem(k);localStorage.setItem(k,h);return last===h}catch(e){return false}}
/* run all checks before sending. hp = honeypot value. Returns {ok, reason, proof} */
async function check({hp='',minMs=4000,key='form',body='',max=3,win=10*60*1000}={}){
 if(hp)return{ok:false,reason:'bot'};
 if(Date.now()-START<minMs)return{ok:false,reason:'fast'};
 if(acts<3)return{ok:false,reason:'nohuman'};
 if(dup(key,body))return{ok:false,reason:'duplicate'};
 if(!rate(key,max,win))return{ok:false,reason:'rate'};
 const proof=await pow(key+'|'+START+'|'+Math.random().toString(36).slice(2),4);
 return{ok:true,proof,ms:Date.now()-START,acts}}
g.SSG={check,email,name,text,pow,sha256,DISPOSABLE};
})(window);
