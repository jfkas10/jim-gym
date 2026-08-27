
function isStandaloneMode(){
  return window.matchMedia("(display-mode: standalone)").matches ||
         window.navigator.standalone===true;
}

function updateInstallUI(){
  const title=document.getElementById("installAppTitle");
  const status=document.getElementById("installAppStatus");
  const button=document.getElementById("installInstructionsButton");

  if(isStandaloneMode()){
    if(title) title.textContent="Jim Gym is installed";
    if(status) status.textContent="You are currently using the Home Screen app.";
    if(button) button.textContent="Installation Info";
  }
}

function setupInstallInstructions(){
  const button=document.getElementById("installInstructionsButton");
  const sheet=document.getElementById("installInstructionsSheet");
  const close=document.getElementById("closeInstallInstructionsButton");

  button?.addEventListener("click",()=>{
    if(sheet) sheet.hidden=!sheet.hidden;
  });

  close?.addEventListener("click",()=>{
    if(sheet) sheet.hidden=true;
  });

  updateInstallUI();
}

function setupConnectivityBanner(){
  const banner=document.createElement("div");
  banner.className="offline-banner";
  banner.textContent="Offline · changes remain cached on this iPhone";
  banner.hidden=navigator.onLine;
  document.body.appendChild(banner);

  const refresh=()=>{
    banner.hidden=navigator.onLine;
  };

  window.addEventListener("online",refresh);
  window.addEventListener("offline",refresh);
}

async function registerServiceWorker(){
  if(!("serviceWorker" in navigator)) return;

  try{
    const registration=await navigator.serviceWorker.register("./service-worker.js");

    registration.addEventListener("updatefound",()=>{
      const worker=registration.installing;
      if(!worker) return;

      worker.addEventListener("statechange",()=>{
        if(worker.state==="installed" && navigator.serviceWorker.controller){
          worker.postMessage({type:"SKIP_WAITING"});
        }
      });
    });
  }catch(error){
    console.warn("Service worker registration failed:",error);
  }
}


window.addEventListener("fitness-cloud-sync",event=>{
  const status=document.getElementById("cloudSyncStatus");
  if(!status) return;
  status.textContent=event.detail?.message || "Cloud sync";
  status.dataset.state=event.detail?.state || "";
});

import { startAuthentication } from "./auth.js";

window.addEventListener("DOMContentLoaded",async()=>{
  setupInstallInstructions();
  setupConnectivityBanner();
  registerServiceWorker();
  try{
    await startAuthentication();
  }catch(error){
    console.error(error);
    const loading=document.getElementById("authLoading");
    const card=document.getElementById("authCard");
    const message=document.getElementById("authMessage");

    if(loading) loading.hidden=true;
    if(card) card.hidden=false;
    if(message){
      message.textContent="Firebase could not initialize. Check that this site is served over HTTP/HTTPS and that its domain is authorized in Firebase.";
    }
  }
});
