// The production build replaces these placeholders with its complete app shell.
const CACHE = 'patrimoine-app-__BUILD_ID__';
const PRECACHE = /*__PRECACHE__*/ ['/index.html','/manifest.webmanifest','/icon-192.png','/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE))));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 // Retain the previous shell for already-open tabs; never touch other applications' caches.
 const keys=(await caches.keys()).filter(k=>k.startsWith('patrimoine-app-')&&k!==CACHE);
 await Promise.all(keys.slice(0,Math.max(0,keys.length-1)).map(k=>caches.delete(k)));
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/.netlify/')||url.pathname.startsWith('/api/'))return;
 if(req.mode==='navigate'){
  event.respondWith((async()=>{
   try {const response=await fetch(req,{signal:AbortSignal.timeout(3500)});if(response.ok)return response;throw new Error('offline');}
   catch{const cached=await (await caches.open(CACHE)).match('/index.html');if(cached)return new Response((await cached.text()).replace('<html','<html data-offline="true"'),{headers:{'content-type':'text/html;charset=utf-8'}});return new Response('Connexion nécessaire pour la première ouverture.',{status:503,headers:{'content-type':'text/plain;charset=utf-8'}});}
  })());return;
 }
 // Only known static files are cached. An asset failure must never return HTML.
 if(!PRECACHE.includes(url.pathname)){
  if(!['script','style'].includes(req.destination))return;
  event.respondWith((async()=>{for(const key of (await caches.keys()).filter(k=>k.startsWith('patrimoine-app-'))){const found=await (await caches.open(key)).match(url.pathname);if(found)return found;}return fetch(req);})());return;
 }
 event.respondWith((async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(url.pathname);if(cached)return cached;const response=await fetch(req);if(response.ok)await cache.put(url.pathname,response.clone());return response;})());
});
