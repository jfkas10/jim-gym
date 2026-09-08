"use strict";

(function(){
  const PREFIX_ROOT="fitnessUser:";
  let currentUid=null;
  let cloudAdapter=null;
  let guestMode=false;
  const guestMemory=new Map();

  const knownLegacyKey=(key)=>{
    return key==="cyclingActivityLogs" ||
      key==="fitnessTrackerAppearance" ||
      key==="fitnessTrackerLastTab" ||
      key==="fitnessTrackerSettings" ||
      key==="showAdvancedResults" ||
      key==="fitnessTrackerCustomExercises" ||
      key==="fitnessTrackerCustomSplits" ||
      key.startsWith("workoutSetLogs:") ||
      key.startsWith("warmupState:");
  };

  const prefix=()=>currentUid ? `${PREFIX_ROOT}${currentUid}:` : null;

  const localEntries=()=>{
    if(guestMode){
      return Object.fromEntries(guestMemory.entries());
    }

    const p=prefix();
    if(!p) return {};
    const entries={};

    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key && key.startsWith(p)){
        entries[key.slice(p.length)]=localStorage.getItem(key);
      }
    }

    return entries;
  };

  const notify=(detail)=>{
    window.dispatchEvent(new CustomEvent("fitness-cloud-sync",{detail}));
  };

  const runRemote=(operation)=>{
    if(!cloudAdapter) return;
    Promise.resolve()
      .then(operation)
      .catch(error=>{
        console.error("Cloud sync failed:",error);
        notify({state:"error",message:"Cloud sync failed. Changes remain cached on this device."});
      });
  };

  window.setAppStorageUser=function(uid){
    guestMode=false;
    currentUid=String(uid||"").trim() || null;
  };

  window.setAppGuestMode=function(){
    guestMode=true;
    currentUid="guest";
    cloudAdapter=null;
    guestMemory.clear();
  };

  window.isAppGuest=function(){
    return guestMode;
  };

  window.setAppStorageCloudAdapter=function(adapter){
    cloudAdapter=guestMode ? null : (adapter || null);
  };

  window.exportAppStorageEntries=function(){
    return localEntries();
  };

  window.replaceAppStorageEntriesLocal=function(entries){
    if(guestMode){
      guestMemory.clear();
      Object.entries(entries||{}).forEach(([key,value])=>{
        if(value!==null && value!==undefined) guestMemory.set(key,String(value));
      });
      return;
    }

    const p=prefix();
    if(!p) return;

    const remove=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key && key.startsWith(p)) remove.push(key);
    }
    remove.forEach(key=>localStorage.removeItem(key));

    Object.entries(entries||{}).forEach(([key,value])=>{
      if(value!==null && value!==undefined){
        localStorage.setItem(p+key,String(value));
      }
    });
  };

  window.clearAppStorageLocal=function(){
    window.replaceAppStorageEntriesLocal({});
  };

  window.appStorage={
    get length(){
      return Object.keys(localEntries()).length;
    },

    key(index){
      const keys=Object.keys(localEntries()).sort();
      return keys[index] ?? null;
    },

    getItem(key){
      if(guestMode) return guestMemory.has(key) ? guestMemory.get(key) : null;
      const p=prefix();
      if(!p) return null;
      return localStorage.getItem(p+key);
    },

    setItem(key,value){
      const stringValue=String(value);

      if(guestMode){
        guestMemory.set(key,stringValue);
        return;
      }

      const p=prefix();
      if(!p) throw new Error("No authenticated user is selected for local storage.");

      localStorage.setItem(p+key,stringValue);

      runRemote(async()=>{
        notify({state:"syncing",message:"Syncing…"});
        await cloudAdapter.setItem(key,stringValue);
        notify({state:"synced",message:"Saved to cloud"});
      });
    },

    removeItem(key){
      if(guestMode){
        guestMemory.delete(key);
        return;
      }

      const p=prefix();
      if(!p) return;

      localStorage.removeItem(p+key);

      runRemote(async()=>{
        notify({state:"syncing",message:"Syncing…"});
        await cloudAdapter.removeItem(key);
        notify({state:"synced",message:"Saved to cloud"});
      });
    },

    clear(){
      if(guestMode){
        guestMemory.clear();
        return;
      }

      window.clearAppStorageLocal();

      runRemote(async()=>{
        notify({state:"syncing",message:"Deleting cloud data…"});
        await cloudAdapter.clear();
        notify({state:"synced",message:"Cloud data cleared"});
      });
    }
  };

  window.hasLegacyFitnessData=function(){
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key && knownLegacyKey(key)) return true;
    }
    return false;
  };

  window.migrateLegacyFitnessData=function(){
    const p=prefix();
    if(!p) return 0;

    const copy=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key && knownLegacyKey(key)){
        copy.push([key,localStorage.getItem(key)]);
      }
    }

    copy.forEach(([key,value])=>{
      if(localStorage.getItem(p+key)===null && value!==null){
        localStorage.setItem(p+key,value);
      }
    });

    return copy.length;
  };
})();
