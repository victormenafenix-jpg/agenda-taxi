var WA='529811150093',L='es';
function waUrl(m){return 'https://wa.me/'+WA+'?text='+encodeURIComponent(m)}
function waLinks(){document.querySelectorAll('.wal').forEach(a=>{a.href=waUrl(L=='en'?(a.dataset.msgen||'Hello, I would like to book a taxi.'):(a.dataset.msg||'Hola, quiero reservar un taxi.'));a.target='_blank';a.rel='noopener'})}
const ES=new Map();
function setLang(l){L=l;document.documentElement.lang=l;document.querySelectorAll('[data-en]').forEach(e=>{if(!ES.has(e))ES.set(e,e.innerHTML);e.innerHTML=l=='en'?e.dataset.en:ES.get(e)});
document.querySelectorAll('[data-enph]').forEach(e=>{if(!e.dataset.esph)e.dataset.esph=e.placeholder;e.placeholder=l=='en'?e.dataset.enph:e.dataset.esph});
const b=document.getElementById('lg');if(b)b.textContent=l=='en'?'Español':'English';waLinks();try{localStorage.setItem('tclg',l)}catch(e){}}
waLinks();
try{const q=new URLSearchParams(location.search).get('lang');if(q=='en')setLang('en')}catch(e){}
document.querySelectorAll('.rot').forEach(r=>{const I=[...r.querySelectorAll('img')];let i=0;I[0].classList.add('on');if(I.length>1)setInterval(()=>{I[i].classList.remove('on');i=(i+1)%I.length;I[i].classList.add('on')},4000+Math.random()*1500)});
