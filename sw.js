self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',()=>{});
self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch(x){d={title:'Agenda Taxi',body:e.data?e.data.text():''}}
e.waitUntil(self.registration.showNotification(d.title||'Agenda Taxi',{body:d.body||'',tag:d.tag||'servicio',renotify:true,requireInteraction:!!d.expres,vibrate:d.expres?[400,150,400,150,400,150,400]:[200,100,200],icon:'icon-192.png',badge:'icon-192.png',data:{url:d.url||'./'}}))});

const SIG={tomado:'en_camino',en_camino:'llego',llego:'abordo',abordo:'terminado'};
const TIT={en_camino:'🚕 Vas en camino',llego:'📍 Ya llegaste',abordo:'👤 Pasajero a bordo'};
const BTN={en_camino:'🚕 Voy en camino',llego:'📍 Ya llegué',abordo:'👤 Ya abordó',terminado:'✅ Terminé el servicio'};

async function tok(){try{const c=await caches.open('agt');const r=await c.match('./__tok');return r?await r.json():null}catch(e){return null}}
async function avisarPaginas(m){const l=await self.clients.matchAll({type:'window',includeUncontrolled:true});l.forEach(c=>c.postMessage(m));return l}

// Avanza el servicio desde el botón de la notificación, sin abrir la agenda
async function avanzar(d,n){const t=await tok();if(!t||!t.t||!t.e||t.e*1000<Date.now()+30000)return false;
try{const r=await fetch(t.u+'/rest/v1/rpc/cambiar_estado',{method:'POST',headers:{apikey:t.k,Authorization:'Bearer '+t.t,'Content-Type':'application/json'},body:JSON.stringify({p_id:d.sid,p_estado:d.sig})});
const j=await r.json();if(j!=='ok')return false}catch(e){return false}
n.close();
if(d.sig==='terminado'){await self.registration.showNotification('✅ Servicio terminado',{body:'Buen trabajo. Abre la agenda para ver el siguiente.',tag:'curso',silent:true,icon:'icon-192.png',badge:'icon-192.png',data:{url:d.url}})}
else{const sig=SIG[d.sig];await self.registration.showNotification(TIT[d.sig]||'🚕 Servicio en curso',{body:d.sig==='abordo'?'Llevar a: '+(d.dest||''):'Recoger en: '+(d.ori||''),tag:'curso',requireInteraction:true,silent:true,renotify:false,icon:'icon-192.png',badge:'icon-192.png',actions:[{action:'sig',title:BTN[sig]}],data:Object.assign({},d,{sig})})}
await avisarPaginas({t:'refresca'});return true}

async function abrir(url,msg){const l=await self.clients.matchAll({type:'window',includeUncontrolled:true});
for(const c of l){if('focus' in c){if(msg)c.postMessage(msg);return c.focus()}}
let u=url||'./';if(msg&&msg.t==='hacer')u+=(u.includes('?')?'&':'?')+'do='+msg.sig+'&sid='+msg.sid;
return self.clients.openWindow(u)}

self.addEventListener('notificationclick',e=>{const d=(e.notification&&e.notification.data)||{};
if(e.action==='sig'&&d.sid){e.waitUntil(avanzar(d,e.notification).then(ok=>{if(!ok){e.notification.close();return abrir(d.url,{t:'hacer',sid:d.sid,sig:d.sig})}}));return}
e.notification.close();
e.waitUntil(abrir(d.url||'./',d.sid?{t:'manejo'}:null))});
