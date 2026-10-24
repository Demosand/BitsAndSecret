'use strict';
const $=id=>document.getElementById(id);let instance,toastTimer,importedSave=false;
const offlineReady='serviceWorker' in navigator?navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(()=>navigator.serviceWorker.ready).then(()=>{if(navigator.serviceWorker.controller)return;return new Promise(resolve=>{navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true});setTimeout(resolve,3000)})}).catch(error=>console.warn('Offline cache unavailable',error)):Promise.resolve();
function toast(text){$('toast').textContent=String(text).slice(0,220);$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,6000)}
function chunkedFetch(files){const original=window.fetch.bind(window);const routes=new Map(Object.entries(files).map(([path,data])=>[new URL(path,location.href).href,data]));window.fetch=async(input,options)=>{const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,location.href).href;const entry=routes.get(url);if(!entry)return original(input,options);let index=0;const stream=new ReadableStream({async pull(controller){try{if(index===entry.parts.length){controller.close();return}const response=await original(new URL(entry.parts[index++],location.href),options);if(!response.ok)throw Error('Не удалось загрузить часть игры: '+response.status);controller.enqueue(new Uint8Array(await response.arrayBuffer()));}catch(error){controller.error(error)}}});return new Response(stream,{status:200,headers:{'Content-Type':'application/octet-stream','Content-Length':String(entry.size)}})}}
$('start').addEventListener('click',async()=>{if(instance)return;const button=$('start');button.hidden=true;$('progress').hidden=false;$('status').textContent='Загружаем игру…';$('detail').textContent='Оставь эту вкладку открытой до завершения загрузки.';try{document.body.classList.toggle('touch-mode',touchWanted);await offlineReady;if(!window.WebAssembly)throw Error('Этот браузер не поддерживает WebAssembly.');const configResponse=await fetch('game.json',{cache:'no-cache'});if(!configResponse.ok)throw Error('Файлы игры пока недоступны.');const game=await configResponse.json();$('game').dataset.build=game.buildId||game.config.codeUrl;console.info('[BitsAndSecret] build '+$('game').dataset.build);if(configResponse.headers.get('X-Bits-Offline')==='1')toast('Запускается сохранённая офлайн-версия игры.');chunkedFetch(game.chunkedFiles||{});const script=document.createElement('script');script.src=game.loader;await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(Error('Не удалось загрузить игровой движок.'));document.body.append(script)});instance=await createUnityInstance($('game'),{...game.config,devicePixelRatio:touchWanted?Math.min(window.devicePixelRatio||1,1.5):(window.devicePixelRatio||1),streamingAssetsUrl:'StreamingAssets',companyName:'BitsAndSecret',productName:'BitsAndSecret Web',productVersion:'1.0',showBanner:(message,type)=>{if(type==='error')toast(message);else console.warn(message)}},progress=>{$('progress').value=progress;$('status').textContent=progress<.9?`Загружаем игру… ${Math.round(progress*100)}%`:'Запускаем…'});window.bitsGame=instance;$('loading').hidden=true;$('game').focus();$('export').disabled=false;$('import').disabled=false;updateTouchControls();}catch(error){console.error(error);$('status').textContent='Не удалось запустить игру';$('detail').textContent='Обнови страницу и попробуй снова. Если ошибка повторится, открой сайт в актуальном Chrome или Edge.';button.textContent='Попробовать снова';button.hidden=false;button.onclick=()=>location.reload();$('progress').hidden=true}});
$('game').addEventListener('pointerdown',()=>$('game').focus());
$('fullscreen').addEventListener('click',async()=>{
 if(document.fullscreenElement){await document.exitFullscreen();return;}
 if(touchDevice||touchWanted){
  try{if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('Играть можно в обычном окне браузера.');}catch(error){toast('Полный экран недоступен в этом браузере.');}
 }else if(instance)instance.SetFullscreen(1);else $('player').requestFullscreen?.();
});
$('export').addEventListener('click',()=>{persistProgress();instance?.SendMessage('BrowserSaveSync','Export')});
$('import').addEventListener('click',()=>$('save-file').click());
$('save-file').addEventListener('change',async event=>{const file=event.target.files[0];event.target.value='';if(!file)return;if(file.size>1024*1024){toast('Файл сохранения слишком большой.');return}try{const data=JSON.parse(await file.text());if(data.format!=='BitsAndSecret.save.v1'||!Array.isArray(data.files)||data.files.length>4)throw Error('Неверный формат сохранения.');const names=new Set();for(const item of data.files){if(!item||!['save1.dat','save2.dat','save3.dat','preferences.json'].includes(item.name)||names.has(item.name)||typeof item.data!=='string'||atob(item.data).length>262144)throw Error('Файл сохранения повреждён.');names.add(item.name);}importedSave=true;instance.SendMessage('BrowserSaveSync','Import',JSON.stringify(data));}catch(error){toast(error.message)}});
window.addEventListener('bits-save-complete',()=>{$('save-status').textContent='Прогресс сохранён в браузере'});
window.addEventListener('bits-save-error',()=>{$('save-status').textContent='Ошибка сохранения';toast('Браузер не сохранил прогресс. Скачай резервную копию кнопкой снизу.')});
window.addEventListener('bits-import-complete',()=>{toast('Сохранение загружено. Перезапусти страницу, чтобы продолжить с ним.');$('save-status').textContent='Сохранение импортировано — обнови страницу'});

window.addEventListener('bits-file-error',event=>toast(event.detail));

function persistProgress(){if(!instance||importedSave)return;try{for(let slot=1;slot<=3;slot++)instance.SendMessage('SaveDataManager'+slot,'Save')}catch(error){console.warn('Progress snapshot failed',error)}}
setInterval(persistProgress,30000);
document.addEventListener('visibilitychange',()=>{if(document.hidden)persistProgress()});
window.addEventListener('pagehide',persistProgress);


// Touch input travels through Unity's existing keyboard path, so menu bindings,
// held actions and rhythm timing use the same code as a physical keyboard.
const touchPanel=$('touch-controls');
const touchKeys={ArrowLeft:['ArrowLeft',37],ArrowUp:['ArrowUp',38],ArrowDown:['ArrowDown',40],ArrowRight:['ArrowRight',39],Enter:['Enter',13],Escape:['Escape',27],KeyJ:['j',74],KeyK:['k',75]};
const touchPointers=new Map(),touchOwners=new Map();
const touchDevice=matchMedia('(any-pointer: coarse)').matches||navigator.maxTouchPoints>0;
let touchWanted=touchDevice;
try{const saved=localStorage.getItem('bits-touch-controls');if(saved!==null)touchWanted=saved==='show';}catch(error){}
if(new URLSearchParams(location.search).get('touch')==='1')touchWanted=true;
function sendTouchKey(code,down){
 const [key,keyCode]=touchKeys[code];
 const event=new KeyboardEvent(down?'keydown':'keyup',{key,code,keyCode,which:keyCode,bubbles:true,cancelable:true});
 // Older WebKit versions ignore the numeric KeyboardEvent initializer.
 for(const name of ['keyCode','which'])if(event[name]!==keyCode)Object.defineProperty(event,name,{value:keyCode});
 $('game').dispatchEvent(event);
}
function releaseTouch(pointerId){
 const held=touchPointers.get(pointerId);if(!held)return;
 touchPointers.delete(pointerId);
 const owners=touchOwners.get(held.code);owners.delete(pointerId);
 if(!owners.size){touchOwners.delete(held.code);held.button.classList.remove('is-held');sendTouchKey(held.code,false);}
}
function releaseAllTouch(){for(const pointerId of [...touchPointers.keys()])releaseTouch(pointerId);}
let touchResizeFrame;
function refreshGameSize(){if(!instance)return;cancelAnimationFrame(touchResizeFrame);touchResizeFrame=requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));}
function updateTouchControls(){
 const visible=!!instance&&touchWanted;
 if(!visible)releaseAllTouch();
 touchPanel.hidden=!visible;
 document.body.classList.toggle('touch-mode',visible);
 $('touch-toggle').setAttribute('aria-pressed',String(touchWanted));
 refreshGameSize();
 if(touchWanted&& !instance)document.querySelector('.keys').textContent='Удобнее играть горизонтально · кнопки появятся после загрузки';
}
for(const button of touchPanel.querySelectorAll('[data-touch-key]')){
 button.addEventListener('pointerdown',event=>{
  if(!instance||event.button>0||touchPointers.has(event.pointerId))return;
  event.preventDefault();event.stopPropagation();
  $('game').focus({preventScroll:true});
  button.setPointerCapture(event.pointerId);
  const code=button.dataset.touchKey;
  touchPointers.set(event.pointerId,{button,code});
  if(!touchOwners.has(code)){touchOwners.set(code,new Set());sendTouchKey(code,true);}
  touchOwners.get(code).add(event.pointerId);button.classList.add('is-held');
 });
 for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,event=>{event.preventDefault();releaseTouch(event.pointerId)});
 button.addEventListener('click',event=>{
  event.preventDefault();event.stopPropagation();
  // Keyboard / screen-reader activation has no pointerdown event.
  if(event.detail===0&&instance&&!touchOwners.has(button.dataset.touchKey)){
   const code=button.dataset.touchKey;sendTouchKey(code,true);setTimeout(()=>sendTouchKey(code,false),32);
  }
 });
}
touchPanel.addEventListener('contextmenu',event=>event.preventDefault());
$('touch-toggle').addEventListener('click',()=>{
 touchWanted=!touchWanted;
 try{localStorage.setItem('bits-touch-controls',touchWanted?'show':'hide');}catch(error){}
 updateTouchControls();
});
window.addEventListener('blur',releaseAllTouch);
window.addEventListener('pagehide',releaseAllTouch);
window.addEventListener('orientationchange',releaseAllTouch);
document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseAllTouch()});
if('ResizeObserver' in window)new ResizeObserver(entries=>{
 document.documentElement.style.setProperty('--footer-height',Math.ceil(entries[0].target.getBoundingClientRect().height)+'px');
 refreshGameSize();
}).observe(document.querySelector('footer'));
updateTouchControls();
