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

  // Cloud is authoritative once cloud data exists. This allows another phone
  // to pick up the user's latest state without mixing accounts.
  window.replaceAppStorageEntriesLocal?.(remote);
  return {direction:"downloaded",count:Object.keys(remote).length};
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
