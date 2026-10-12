const C='tje-v2';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['./','index.html','app.js','places.js','icon.svg','manifest.webmanifest']).catch(()=>{})));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET')return;
  const shell=u.origin===location.origin||u.href.includes('cesium.com/downloads/cesiumjs')||u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com';
  if(!shell)return;
  e.respondWith(caches.open(C).then(async c=>{const hit=await c.match(e.request);const net=fetch(e.request).then(r=>{if(r.ok)c.put(e.request,r.clone());return r}).catch(()=>hit);return hit||net}))});
