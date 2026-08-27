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

export function createCloudStorageAdapter(uid){
  return {
    async setItem(key,value){
      await setDoc(appDataDoc(uid,key),{
        key,
        value:String(value),
        updatedAt:serverTimestamp()
      });
    },

    async removeItem(key){
      await deleteDoc(appDataDoc(uid,key));
    },

    async clear(){
      await deleteAllDocuments(appDataCollection(uid));
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
