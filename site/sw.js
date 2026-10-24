const CACHE='bitsandsecret-v1';
const BOOT=['./','index.html','player.css','player.js','storage.js','logo.png','game.json'];
let frozen=false;
const writes=new Set();
function storeResponse(request,response){
 if(frozen)return Promise.resolve();
 const write=caches.open(CACHE).then(cache=>frozen?undefined:cache.put(request,response)).catch(()=>{});
 writes.add(write);write.finally(()=>writes.delete(write));return write;
}
self.addEventListener('message',event=>{
 if(event.data?.type!=='BITS_FREEZE_CACHE')return;
 frozen=true;
 event.waitUntil(Promise.allSettled([...writes]).then(()=>event.ports[0]?.postMessage({type:'BITS_CACHE_FROZEN'})));
});
self.addEventListener('install',event=>event.waitUntil(
 caches.open(CACHE).then(cache=>cache.addAll(BOOT.map(path=>new Request(new URL(path,self.location.href),{cache:'reload'})))).then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 if(frozen){event.respondWith(fetch(event.request,{cache:'no-store'}));return;}
 const url=new URL(event.request.url);
 const shell=event.request.mode==='navigate'||/\/(index\.html|game\.json|player\.js|player\.css|storage\.js)$/.test(url.pathname);
 if(shell){
  event.respondWith(fetch(event.request,{cache:'no-cache'}).then(response=>{
   if(response.ok)event.waitUntil(storeResponse(event.request,response.clone()));
   return response;
  }).catch(async()=>{
   const cached=await caches.match(event.request)||await caches.match(event.request,{ignoreSearch:true});if(!cached)return Response.error();
   const headers=new Headers(cached.headers);headers.set('X-Bits-Offline','1');
   return new Response(cached.body,{status:cached.status,headers});
  }));
  return;
 }
 event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
  if(response.ok)event.waitUntil(storeResponse(event.request,response.clone()));
  return response;
 })));
});
