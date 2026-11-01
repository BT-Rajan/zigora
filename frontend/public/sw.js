const V='zg-v5'  // the app lives under /app/ (or <folder>/app/), so paths here are relative to this file
const API=new URL('../api/',self.registration.scope).pathname  // never cached: /api/ or /<folder>/api/
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(async c=>{await c.addAll(['./','./manifest.json','./icon-192.png','./favicon.svg'])
  const page=await (await c.match('./')).text(),files=[...page.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(m=>new URL(m[1],self.registration.scope).href)  // the app's own scripts and styles, so it opens offline from the first visit
  await c.addAll(files).catch(()=>{})}));self.skipWaiting()})
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith('zg-v')&&x!==V).map(x=>caches.delete(x)))));self.clients.claim()})  // zg-read and zg-frames are the student's offline copies; sign-out clears them
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url)
  if(r.method==='GET'&&/\/diagram-offline\/\d+$/.test(u.pathname)){e.respondWith(caches.match(u.origin+u.pathname,{cacheName:'zg-frames'}).then(h=>h||new Response('',{status:404})));return}  // a diagram the page kept when it was opened online
  if(r.method!=='GET'||u.pathname.startsWith(API))return
  if(r.mode==='navigate'){e.respondWith(fetch(r).catch(()=>caches.match('./')));return}
  e.respondWith(caches.match(r).then(h=>h||fetch(r).then(x=>{const c=x.clone();caches.open(V).then(k=>k.put(r,c));return x})))})
