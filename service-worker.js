const CACHE="cubeclash-v52";
const APP=["./","./index.html","./css/main.css","./js/app.js?v=52","./js/storage.js","./js/p2p.js","./js/reset.js","./manifest.json","./icons/icon.svg"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const url=new URL(e.request.url);
  const sameOrigin=url.origin===self.location.origin;
  const appAsset=sameOrigin&&(url.pathname.endsWith("/")||url.pathname.endsWith(".html")||url.pathname.endsWith(".js")||url.pathname.endsWith(".css")||url.pathname.endsWith(".json")||url.pathname.endsWith(".svg"));
  if(!appAsset)return;
  e.respondWith(fetch(e.request).then(r=>{
    if(r.ok){const x=r.clone();caches.open(CACHE).then(c=>c.put(e.request,x)).catch(()=>{});}return r;
  }).catch(()=>caches.match(e.request).then(c=>c||caches.match("./index.html"))));
});
