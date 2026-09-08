import { db } from "./firebase.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const APP_DATA_COLLECTION="appData";

function userRef(uid){
  return doc(db,"users",uid);
}

function appDataCollection(uid){
  return collection(db,"users",uid,APP_DATA_COLLECTION);
}

function appDataDoc(uid,key){
  return doc(db,"users",uid,APP_DATA_COLLECTION,encodeURIComponent(key));
}

export async function ensureUserProfile(user){
  const ref=userRef(user.uid);
  const snapshot=await getDoc(ref);

  if(!snapshot.exists()){
    await setDoc(ref,{
      displayName:user.displayName || "",
      email:user.email || "",
      role:"user",
      createdAt:serverTimestamp(),
      updatedAt:serverTimestamp()
    });
    return;
  }

  // Preserve the existing role. The client is never allowed to promote itself.
  await setDoc(ref,{
    displayName:user.displayName || snapshot.data().displayName || "",
    email:user.email || snapshot.data().email || "",
    updatedAt:serverTimestamp()
  },{merge:true});
}

export async function getUserProfile(uid){
  const snapshot=await getDoc(userRef(uid));
  return snapshot.exists() ? snapshot.data() : null;
}

function publicProgressRef(uid){
  return doc(db,"publicProgress",uid);
}

function publicProgressCollection(uid){
  return collection(db,"publicProgress",uid,"appData");
}

function publicProgressDoc(uid,key){
  return doc(db,"publicProgress",uid,"appData",encodeURIComponent(key));
}

function isPublicTrackingKey(key){
  return key==="cyclingActivityLogs" ||
    key==="fitnessTrackerCustomExercises" ||
    key.startsWith("workoutSetLogs:");
}

async function ensurePublicProgressProfile(uid,displayName){
  await setDoc(publicProgressRef(uid),{
    displayName:displayName || "James",
    visibility:"workout-progress",
    updatedAt:serverTimestamp()
  },{merge:true});
}

export function createCloudStorageAdapter(uid,options={}){
  const publishPublic=Boolean(options.publishPublic);
  const displayName=options.displayName || "James";

  return {
    async setItem(key,value){
      await setDoc(appDataDoc(uid,key),{
        key,
        value:String(value),
        updatedAt:serverTimestamp()
      });

      if(publishPublic && isPublicTrackingKey(key)){
        await ensurePublicProgressProfile(uid,displayName);
        await setDoc(publicProgressDoc(uid,key),{
          key,
          value:String(value),
          updatedAt:serverTimestamp()
        });
      }
    },

    async removeItem(key){
      await deleteDoc(appDataDoc(uid,key));

      if(publishPublic && isPublicTrackingKey(key)){
        await deleteDoc(publicProgressDoc(uid,key));
      }
    },

    async clear(){
      await deleteAllDocuments(appDataCollection(uid));

      if(publishPublic){
        await deleteAllDocuments(publicProgressCollection(uid));
      }
    }
  };
}

export async function synchronizeUserStorage(uid){
  const local=window.exportAppStorageEntries?.() || {};
  const remoteSnapshot=await getDocs(appDataCollection(uid));
  const remote={};

  remoteSnapshot.forEach(snapshot=>{
    const data=snapshot.data();
    if(typeof data.key==="string" && typeof data.value==="string"){
      remote[data.key]=data.value;
    }
  });

  if(remoteSnapshot.empty){
    const entries=Object.entries(local);
    if(entries.length){
      await uploadEntries(uid,entries);
      return {direction:"uploaded",count:entries.length};
    }
    return {direction:"empty",count:0};
  }

  // v26.6 uses a loss-averse merge. Historical workout/cycling arrays are
  // unioned by log identity so an offline/local set cannot be silently
  // discarded just because an older cloud snapshot already exists.
  const merged=mergeStorageStates(local,remote);
  window.replaceAppStorageEntriesLocal?.(merged);

  // Upload the merged result so every device converges on the same snapshot.
  await uploadEntries(uid,Object.entries(merged));
  return {direction:"merged",count:Object.keys(merged).length};
}

function mergeStorageStates(local,remote){
  const result={...remote};

  Object.entries(local||{}).forEach(([key,value])=>{
    if(!(key in remote)){
      result[key]=value;
      return;
    }

    if(key.startsWith("workoutSetLogs:") || key==="cyclingActivityLogs"){
      result[key]=mergeLogArrayStrings(remote[key],value);
      return;
    }

    // For structured user libraries, merge by id where possible.
    if(["fitnessTrackerCustomSplits","fitnessTrackerCustomExercises","fitnessTrackerGyms"].includes(key)){
      result[key]=mergeObjectArrayStrings(remote[key],value);
      return;
    }

    // For settings and UI state, the cloud copy remains authoritative.
  });

  return result;
}

function mergeLogArrayStrings(first,second){
  const a=safeJsonArray(first);
  const b=safeJsonArray(second);
  const seen=new Set();
  const merged=[];

  [...a,...b].forEach(item=>{
    const identity=item?.id
      ? `id:${item.id}`
      : JSON.stringify([
          item?.date||"",
          item?.timestamp||"",
          item?.performedExerciseId||"",
          item?.variant||"",
          item?.side||"",
          item?.load??"",
          item?.reps??"",
          item?.durationSeconds??"",
          item?.commuteTime??""
        ]);

    if(seen.has(identity)) return;
    seen.add(identity);
    merged.push(item);
  });

  merged.sort((x,y)=>(Number(x?.timestamp)||0)-(Number(y?.timestamp)||0));
  return JSON.stringify(merged);
}

function mergeObjectArrayStrings(first,second){
  const a=safeJsonArray(first);
  const b=safeJsonArray(second);
  const map=new Map();

  [...a,...b].forEach((item,index)=>{
    const id=item?.id || `index:${index}:${JSON.stringify(item)}`;
    const existing=map.get(id);

    if(!existing){
      map.set(id,item);
      return;
    }

    const existingUpdated=Number(existing?.updatedAt)||0;
    const incomingUpdated=Number(item?.updatedAt)||0;
    if(incomingUpdated>=existingUpdated) map.set(id,item);
  });

  return JSON.stringify([...map.values()]);
}

function safeJsonArray(value){
  try{
    const parsed=JSON.parse(value||"[]");
    return Array.isArray(parsed)?parsed:[];
  }catch{
    return [];
  }
}

export async function uploadCurrentLocalStorage(uid){
  const entries=Object.entries(window.exportAppStorageEntries?.() || {});
  await uploadEntries(uid,entries);
  return entries.length;
}

async function uploadEntries(uid,entries){
  // Firestore batches are capped at 500 operations. Keep headroom.
  for(let start=0;start<entries.length;start+=400){
    const batch=writeBatch(db);
    entries.slice(start,start+400).forEach(([key,value])=>{
      batch.set(appDataDoc(uid,key),{
        key,
        value:String(value),
        updatedAt:serverTimestamp()
      });
    });
    await batch.commit();
  }
}

async function deleteAllDocuments(collectionRef){
  const snapshot=await getDocs(collectionRef);
  const docs=snapshot.docs;

  for(let start=0;start<docs.length;start+=400){
    const batch=writeBatch(db);
    docs.slice(start,start+400).forEach(snapshot=>batch.delete(snapshot.ref));
    await batch.commit();
  }
}

export async function deleteUserCloudData(uid){
  await deleteAllDocuments(appDataCollection(uid));
  await deleteDoc(userRef(uid));
}


export async function loadSharedExerciseOverrides(){
  const snapshot=await getDocs(collection(db,"sharedExerciseOverrides"));
  const result={};
  snapshot.forEach(document=>{
    result[document.id]={id:document.id,...document.data()};
  });
  return result;
}

export async function saveSharedExerciseOverride(exerciseId,definition){
  await setDoc(doc(db,"sharedExerciseOverrides",exerciseId),{
    ...definition,
    id:exerciseId,
    updatedAt:serverTimestamp()
  });
}

export async function deleteSharedExerciseOverride(exerciseId){
  await deleteDoc(doc(db,"sharedExerciseOverrides",exerciseId));
}


export async function publishAdminProgressSnapshot(uid,displayName){
  await ensurePublicProgressProfile(uid,displayName);

  const entries=Object.entries(window.exportAppStorageEntries?.() || {})
    .filter(([key])=>isPublicTrackingKey(key));

  await deleteAllDocuments(publicProgressCollection(uid));

  for(let start=0;start<entries.length;start+=400){
    const batch=writeBatch(db);
    entries.slice(start,start+400).forEach(([key,value])=>{
      batch.set(publicProgressDoc(uid,key),{
        key,
        value:String(value),
        updatedAt:serverTimestamp()
      });
    });
    await batch.commit();
  }

  await ensurePublicProgressProfile(uid,displayName);
  return entries.length;
}

export async function loadPublishedAdminProgress(){
  const profiles=await getDocs(collection(db,"publicProgress"));
  if(profiles.empty) return null;

  // This app currently has a single admin. Prefer a profile named James when present.
  const docs=profiles.docs;
  const chosen=docs.find(snapshot=>
    String(snapshot.data()?.displayName||"").trim().toLowerCase()==="james"
  ) || docs[0];

  const snapshot=await getDocs(publicProgressCollection(chosen.id));
  const data={};

  snapshot.forEach(document=>{
    const item=document.data();
    if(typeof item.key==="string" && typeof item.value==="string"){
      data[item.key]=item.value;
    }
  });

  return {
    uid:chosen.id,
    displayName:chosen.data()?.displayName || "James",
    data
  };
}


export async function replaceUserCloudStorage(uid,entries){
  await deleteAllDocuments(appDataCollection(uid));
  await uploadEntries(uid,Object.entries(entries||{}));
}

export async function loadGlobalFitnessConfig(){
  const equipmentSnapshot=await getDoc(doc(db,"globalFitnessConfig","equipment"));
  const gymsSnapshot=await getDocs(collection(db,"globalGyms"));

  return {
    equipment:equipmentSnapshot.exists() && Array.isArray(equipmentSnapshot.data().items)
      ? equipmentSnapshot.data().items
      : null,
    gyms:gymsSnapshot.docs.map(snapshot=>({id:snapshot.id,...snapshot.data()}))
  };
}

export async function saveGlobalEquipmentList(items){
  await setDoc(doc(db,"globalFitnessConfig","equipment"),{
    items:Array.from(new Set((items||[]).map(item=>String(item).trim()).filter(Boolean))),
    updatedAt:serverTimestamp()
  });
}

export async function saveGlobalGym(gym){
  const id=gym.id || encodeURIComponent(String(gym.name||"gym").toLowerCase().replace(/[^a-z0-9]+/g,"-"));
  await setDoc(doc(db,"globalGyms",id),{
    name:String(gym.name||"").trim(),
    equipment:Array.from(new Set(gym.equipment||[])),
    updatedAt:serverTimestamp()
  });
  return id;
}

export async function deleteGlobalGym(id){
  await deleteDoc(doc(db,"globalGyms",id));
}
