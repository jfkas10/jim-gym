import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyAj3TDWfX3pMRxX8r9mppR9hcgeCaAX1KY",
  authDomain: "jim-gym-fitness-app.firebaseapp.com",
  projectId: "jim-gym-fitness-app",
  storageBucket: "jim-gym-fitness-app.firebasestorage.app",
  messagingSenderId: "464486014153",
  appId: "1:464486014153:web:0156839887a10c6a4b8118"
};

export const firebaseApp=initializeApp(firebaseConfig);
export const auth=getAuth(firebaseApp);
export const db=getFirestore(firebaseApp);

export async function prepareAuthPersistence(){
  await setPersistence(auth,browserLocalPersistence);
}
