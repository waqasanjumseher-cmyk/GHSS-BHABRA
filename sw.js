/* School ERP service worker: opens instantly and works offline.
   Change VERSION only if you change THIS file. index.html updates itself. */
const VERSION='school-erp-v3';
const SHELL=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png'];
const LIBS=[
 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js',
 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js',
 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];
// Live data and sign-in always go straight to the network, never cached here.
const LIVE=/(firestore|identitytoolkit|securetoken|firebaseinstallations)\.googleapis\.com|www\.googleapis\.com|accounts\.google\.com|drive\.google\.com|wa\.me|firebaseapp\.com/;
self.addEventListener('install',e=>{
 e.waitUntil((async()=>{
  const c=await caches.open(VERSION);
  await Promise.all(SHELL.map(u=>c.add(u).catch(()=>{})));
  await Promise.all(LIBS.map(u=>fetch(u,{mode:'no-cors'}).then(r=>c.put(u,r)).catch(()=>{})));
  self.skipWaiting();
 })());
});
self.addEventListener('activate',e=>{
 e.waitUntil((async()=>{
  for(const k of await caches.keys())if(k!==VERSION)await caches.delete(k);
  await self.clients.claim();
 })());
});
async function revalidate(req,key){
 try{
  const c=await caches.open(VERSION),old=await c.match(key),res=await fetch(req);
  if(res&&(res.ok||res.type==='opaque')){
   const changed=old&&res.ok&&(old.headers.get('etag')!==res.headers.get('etag')||old.headers.get('last-modified')!==res.headers.get('last-modified'));
   await c.put(key,res.clone());
   if(changed)for(const cl of await self.clients.matchAll())cl.postMessage('erp-updated');
  }
  return res;
 }catch(e){return null}
}
self.addEventListener('fetch',e=>{
 const req=e.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(LIVE.test(url.href))return;
 // The app page: show the saved copy at once, refresh it in the background.
 if(req.mode==='navigate'){
  e.respondWith((async()=>{
   const c=await caches.open(VERSION),hit=await c.match('index.html');
   const net=revalidate(new Request('index.html',{cache:'no-cache'}),'index.html');
   if(hit){e.waitUntil(net);return hit}
   return (await net)||new Response('You are offline and the app has not been saved yet. Open it once with internet.',{status:503,headers:{'Content-Type':'text/plain'}});
  })());
  return;
 }
 // Libraries (Firebase, QR, Excel, fonts): saved forever, they never change.
 if(/gstatic\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com/.test(url.host)){
  e.respondWith((async()=>{
   const c=await caches.open(VERSION),hit=await c.match(req);
   if(hit)return hit;
   try{const res=await fetch(req);if(res.ok||res.type==='opaque')c.put(req,res.clone());return res}catch(err){return Response.error()}
  })());
  return;
 }
 // Our own files (icons, manifest): saved copy first, refresh quietly.
 if(url.origin===location.origin){
  e.respondWith((async()=>{
   const c=await caches.open(VERSION),hit=await c.match(req,{ignoreSearch:true});
   const net=revalidate(req,req);
   if(hit){e.waitUntil(net);return hit}
   return (await net)||Response.error();
  })());
 }
});
