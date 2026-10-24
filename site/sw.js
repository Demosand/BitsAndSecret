const CACHE='bitsandsecret-v1';
const BOOT=['./','index.html','player.css','player.js','logo.png','game.json'];
self.addEventListener('install',event=>event.waitUntil(
 caches.open(CACHE).then(cache=>cache.addAll(BOOT.map(path=>new Request(new URL(path,self.location.href),{cache:'reload'})))).then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 const url=new URL(event.request.url);
 const shell=event.request.mode==='navigate'||/\/(index\.html|game\.json|player\.js|player\.css)$/.test(url.pathname);
 if(shell){
  event.respondWith(fetch(event.request,{cache:'no-cache'}).then(response=>{
   if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{}));}
   return response;
  }).catch(async()=>{
   const cached=await caches.match(event.request,{ignoreSearch:true});if(!cached)return Response.error();
   const headers=new Headers(cached.headers);headers.set('X-Bits-Offline','1');
   return new Response(cached.body,{status:cached.status,headers});
  }));
  return;
 }
 event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{}));}
  return response;
 })));
});
