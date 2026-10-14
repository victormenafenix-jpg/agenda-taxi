self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',()=>{});
self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch(x){d={title:'Agenda Taxi',body:e.data?e.data.text():''}}
e.waitUntil(self.registration.showNotification(d.title||'Agenda Taxi',{body:d.body||'',tag:d.tag||'servicio',renotify:true,requireInteraction:!!d.expres,vibrate:d.expres?[400,150,400,150,400,150,400]:[200,100,200],icon:'icon-192.png',badge:'icon-192.png',data:{url:d.url||'./'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{for(const c of l){if('focus' in c)return c.focus()}return self.clients.openWindow((e.notification.data&&e.notification.data.url)||'./')}))});
