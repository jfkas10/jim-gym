const VERSION="v26.6.0";
const SHELL_CACHE=`jim-gym-shell-${VERSION}`;
const RUNTIME_CACHE=`jim-gym-runtime-${VERSION}`;

const APP_SHELL=[
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./styles.css",
  "./auth.css",
  "./storage.js",
  "./app-core.js",
  "./firebase.js",
  "./sync.js",
  "./admin.js",
  "./auth.js",
  "./bootstrap.js",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache=>cache.addAll(APP_SHELL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys=>Promise.all(
        keys
          .filter(key=>key.startsWith("jim-gym-") && ![SHELL_CACHE,RUNTIME_CACHE].includes(key))
          .map(key=>caches.delete(key))
      )),
      self.clients.claim()
    ])
  );
});

function isFirebaseApi(url){
  return url.hostname.includes("googleapis.com") ||
         url.hostname.includes("firebaseio.com") ||
         url.hostname.includes("identitytoolkit.googleapis.com") ||
         url.hostname.includes("securetoken.googleapis.com");
}

function isRuntimeLibrary(url){
  return url.hostname==="cdn.jsdelivr.net" ||
         url.hostname==="www.gstatic.com";
}

async function staleWhileRevalidate(request){
  const cache=await caches.open(RUNTIME_CACHE);
  const cached=await cache.match(request);

  const networkPromise=fetch(request)
    .then(response=>{
      if(response && (response.ok || response.type==="opaque")){
        cache.put(request,response.clone());
      }
      return response;
    })
    .catch(()=>null);

  return cached || await networkPromise || Response.error();
}

async function networkFirst(request){
  try{
    const response=await fetch(request);
    const cache=await caches.open(SHELL_CACHE);
    if(response && response.ok){
      cache.put(request,response.clone());
    }
    return response;
  }catch{
    return (await caches.match(request)) || (await caches.match("./index.html"));
  }
}

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET") return;

  const url=new URL(request.url);

  // Never cache authenticated Firebase/Firestore API traffic.
  if(isFirebaseApi(url)) return;

  if(request.mode==="navigate"){
    event.respondWith(networkFirst(request));
    return;
  }

  if(url.origin===self.location.origin){
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Cache CDN libraries after their first successful online load.
  if(isRuntimeLibrary(url)){
    event.respondWith(staleWhileRevalidate(request));
  }
});

self.addEventListener("message",event=>{
  if(event.data?.type==="SKIP_WAITING"){
    self.skipWaiting();
  }
});
