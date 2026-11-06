/* ForgeFit 0.1.0. Atomic offline shell; updates activate only on request. */
const SCOPE=self.registration.scope;
const PREFIX='forgefit-shell-'+btoa(SCOPE).replace(/[^a-z0-9]/gi,'')+'-';
const CACHE=PREFIX+"2200ba480abbc214";
const FILES=["apple-touch-icon.png","assets/app.js","assets/components.js","assets/dialogs.js","assets/model.js","assets/seeds.js","assets/storage.js","assets/styles.css","assets/ui.js","assets/views.js","icon-192.png","icon-512.png","icon-maskable.png","index.html","manifest.webmanifest"].map(path=>new URL(path,SCOPE).href);
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);try{await cache.addAll(FILES.map(url=>new Request(url,{cache:'reload'})))}catch(error){await caches.delete(CACHE);throw error}})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith((async()=>{const cache=await caches.open(CACHE);if(event.request.mode==='navigate'){const shell=await cache.match(new URL('index.html',SCOPE).href);if(shell)return shell;return fetch(event.request)}const hit=await cache.match(event.request,{ignoreSearch:true});return hit||fetch(event.request)})())});
