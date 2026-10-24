// Download storage only. Save databases (IDBFS) and preferences are never opened.
export function isGameUrl(value, scope){
 if(typeof value!=='string'||!/^https?:\/\//.test(value))return false;
 try{const url=new URL(value);return url.origin===scope.origin&&url.pathname.startsWith(scope.pathname);}catch{return false;}
}

async function freezeCacheWrites(){
 const worker=navigator.serviceWorker?.controller;
 if(!worker)return;
 await new Promise((resolve,reject)=>{
  const channel=new MessageChannel();
  const timer=setTimeout(()=>{channel.port1.close();reject(Error('Обнови страницу и повтори удаление: служба кэша ещё не обновилась.'));},5000);
  channel.port1.onmessage=event=>{if(event.data?.type!=='BITS_CACHE_FROZEN')return;clearTimeout(timer);channel.port1.close();resolve();};
  worker.postMessage({type:'BITS_FREEZE_CACHE'},[channel.port2]);
 });
}

function clearUnityDownloads(scope){
 if(!('indexedDB' in globalThis))return Promise.resolve(0);
 return new Promise((resolve,reject)=>{
  let missing=false;
  const request=indexedDB.open('UnityCache');
  request.onupgradeneeded=()=>{missing=true;request.transaction.abort();};
  request.onerror=()=>missing?resolve(0):reject(Error('Не удалось открыть кэш Unity.'));
  request.onblocked=()=>reject(Error('Закрой другие вкладки с игрой и повтори удаление.'));
  request.onsuccess=()=>{
   const db=request.result;
   const stores=['RequestStore','WebAssembly'].filter(name=>db.objectStoreNames.contains(name));
   if(!stores.length){db.close();resolve(0);return;}
   let count=0;
   const transaction=db.transaction(stores,'readwrite');
   transaction.oncomplete=()=>{db.close();resolve(count);};
   transaction.onabort=transaction.onerror=()=>{db.close();reject(Error('Не удалось очистить кэш Unity.'));};
   for(const name of stores){
    const store=transaction.objectStore(name);
    // Key cursors avoid reading/copying hundreds of megabytes into phone RAM.
    store.openKeyCursor().onsuccess=event=>{
     const cursor=event.target.result;if(!cursor)return;
     const key=cursor.primaryKey;
     // Older virtual Response objects had an empty URL. Unity can never look
     // this orphan up by an absolute download URL; it is not usable game data.
     if(isGameUrl(key,scope)||(name==='RequestStore'&&key==='')){store.delete(key);count++;}
     cursor.continue();
    };
   }
  };
 });
}

export async function purgeGameDownloads(scope=new URL('./',location.href),{freeze=true}={}){
 if(freeze)await freezeCacheWrites();
 // Unregister this game's worker only. Other Pages projects share the origin.
 if(navigator.serviceWorker){
  for(const registration of await navigator.serviceWorker.getRegistrations()){
   if(registration.scope===scope.href)await registration.unregister();
  }
 }
 let cacheEntries=0;
 if('caches' in globalThis){
  for(const name of await caches.keys()){
   const cache=await caches.open(name);
   for(const request of await cache.keys()){
    if(isGameUrl(request.url,scope)&&await cache.delete(request))cacheEntries++;
   }
   if(name.startsWith('bitsandsecret-')&&!(await cache.keys()).length)await caches.delete(name);
  }
 }
 return {cacheEntries,unityEntries:await clearUnityDownloads(scope)};
}
