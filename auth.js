import { auth, prepareAuthPersistence } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  ensureUserProfile,
  getUserProfile,
  createCloudStorageAdapter,
  synchronizeUserStorage,
  uploadCurrentLocalStorage,
  deleteUserCloudData
} from "./sync.js";
import { configureAdminAccess } from "./admin.js";
import { loadSharedExerciseOverrides, saveSharedExerciseOverride, deleteSharedExerciseOverride } from "./sync.js";

const $=id=>document.getElementById(id);

function friendlyAuthError(error){
  const code=error?.code || "";
  const messages={
    "auth/invalid-credential":"The email or password is incorrect.",
    "auth/invalid-email":"Enter a valid email address.",
    "auth/email-already-in-use":"An account already exists for that email.",
    "auth/weak-password":"Choose a stronger password.",
    "auth/too-many-requests":"Too many attempts. Wait a moment and try again.",
    "auth/network-request-failed":"The network request failed. Check your connection.",
    "auth/operation-not-allowed":"Email/password sign-in is not enabled in Firebase.",
    "auth/unauthorized-domain":"This website domain is not authorized in Firebase Authentication."
  };
  return messages[code] || error?.message || "Authentication failed.";
}

function setMessage(message="",success=false){
  const node=$("authMessage");
  if(!node) return;
  node.textContent=message;
  node.classList.toggle("success",success);
}

function setBusy(button,busy,label){
  if(!button) return;
  button.disabled=busy;
  if(!button.dataset.originalLabel) button.dataset.originalLabel=button.textContent;
  button.textContent=busy ? label : button.dataset.originalLabel;
}

function showMode(mode){
  const signIn=mode==="signin";
  $("signInModeButton").setAttribute("aria-selected",String(signIn));
  $("registerModeButton").setAttribute("aria-selected",String(!signIn));
  $("signInForm").hidden=!signIn;
  $("registerForm").hidden=signIn;
  setMessage("");
}

async function updateAccountUI(user){
  const display=$("currentUserDisplayName");
  const email=$("currentUserEmail");
  const role=$("currentUserRole");

  if(display) display.textContent=user.displayName || "Your account";
  if(email) email.textContent=user.email || "";

  try{
    const profile=await getUserProfile(user.uid);
    window.currentUserIsAdmin=profile?.role==="admin";
    if(role) role.textContent=window.currentUserIsAdmin ? "Administrator" : "Private account";
    configureAdminAccess(user,profile);
  }catch{
    if(role) role.textContent="Private account";
    configureAdminAccess(user,null);
  }
}

function maybeMigrateLegacyData(user){
  if(!window.hasLegacyFitnessData?.()) return;

  const decisionKey="__legacyMigrationDecision";
  if(window.appStorage.getItem(decisionKey)) return;

  const migrate=window.confirm(
    "Existing workout data from the pre-account version was found in this browser.\\n\\n"+
    `Copy it into ${user.email || "this account"}?\\n\\n`+
    "Choose OK if this is your existing workout history. Choose Cancel to leave this account empty."
  );

  if(migrate){
    const count=window.migrateLegacyFitnessData?.() || 0;
    window.appStorage.setItem(decisionKey,"migrated");
    console.info(`Migrated ${count} legacy fitness storage entries.`);
  }else{
    window.appStorage.setItem(decisionKey,"declined");
  }
}

async function showAuthenticatedApp(user){
  window.setAppStorageUser(user.uid);

  $("authLoading").hidden=false;
  $("authCard").hidden=true;

  try{
    await ensureUserProfile(user);

    const sharedOverrides=await loadSharedExerciseOverrides();
    window.setBuiltInExerciseOverrides?.(sharedOverrides);
    window.saveBuiltInExerciseOverride=saveSharedExerciseOverride;
    window.deleteBuiltInExerciseOverride=deleteSharedExerciseOverride;

    // The pre-account migration happens before first cloud synchronization.
    maybeMigrateLegacyData(user);

    window.setAppStorageCloudAdapter(createCloudStorageAdapter(user.uid));

    const result=await synchronizeUserStorage(user.uid);
    console.info("Cloud synchronization:",result);
    window.dispatchEvent(new CustomEvent("fitness-cloud-sync",{
      detail:{
        state:"synced",
        message:result.direction==="uploaded"
          ? "Local data backed up to cloud"
          : result.direction==="downloaded"
            ? "Cloud data loaded"
            : "Cloud sync ready"
      }
    }));

    await updateAccountUI(user);

    $("authGate").hidden=true;
    $("appShell").hidden=false;

    if(typeof window.initializeFitnessApp==="function"){
      window.initializeFitnessApp();
    }
  }catch(error){
    console.error(error);
    $("authLoading").hidden=true;
    $("authCard").hidden=false;
    setMessage("Signed in, but cloud data could not be loaded. Check Firestore security rules and your connection.");
  }
}

function showSignedOut(){
  window.setAppStorageUser(null);
  $("appShell").hidden=true;
  $("authGate").hidden=false;
  $("authLoading").hidden=true;
  $("authCard").hidden=false;
}

export async function startAuthentication(){
  await prepareAuthPersistence();

  $("signInModeButton").addEventListener("click",()=>showMode("signin"));
  $("registerModeButton").addEventListener("click",()=>showMode("register"));

  $("signInForm").addEventListener("submit",async event=>{
    event.preventDefault();
    setMessage("");

    const button=$("signInButton");
    setBusy(button,true,"Signing In…");

    try{
      await signInWithEmailAndPassword(
        auth,
        $("signInEmail").value.trim(),
        $("signInPassword").value
      );
    }catch(error){
      setMessage(friendlyAuthError(error));
    }finally{
      setBusy(button,false);
    }
  });

  $("registerForm").addEventListener("submit",async event=>{
    event.preventDefault();
    setMessage("");

    const name=$("registerName").value.trim();
    const email=$("registerEmail").value.trim();
    const password=$("registerPassword").value;
    const confirmPassword=$("registerPasswordConfirm").value;

    if(password!==confirmPassword){
      setMessage("The passwords do not match.");
      return;
    }

    const button=$("registerButton");
    setBusy(button,true,"Creating Account…");

    try{
      const credential=await createUserWithEmailAndPassword(auth,email,password);
      await updateProfile(credential.user,{displayName:name});
      await credential.user.reload();
      await ensureUserProfile(auth.currentUser || credential.user);
      setMessage("Account created.",true);
      await updateAccountUI(auth.currentUser || credential.user);
    }catch(error){
      setMessage(friendlyAuthError(error));
    }finally{
      setBusy(button,false);
    }
  });

  $("forgotPasswordButton").addEventListener("click",async()=>{
    const email=$("signInEmail").value.trim();
    if(!email){
      setMessage("Enter your email address first.");
      $("signInEmail").focus();
      return;
    }

    try{
      await sendPasswordResetEmail(auth,email);
      setMessage("Password reset email sent.",true);
    }catch(error){
      setMessage(friendlyAuthError(error));
    }
  });

  $("logoutButton").addEventListener("click",async()=>{
    if(!window.confirm("Sign out of this account?")) return;
    await signOut(auth);
    location.reload();
  });

  $("deleteAccountButton")?.addEventListener("click",async()=>{
    const user=auth.currentUser;
    if(!user || !user.email) return;

    const first=window.confirm(
      "Permanently delete this account?\n\n"+
      "This will remove the account, its cloud workout data, splits, custom exercises, cycling history, and this device's cached data.\n\n"+
      "This cannot be undone."
    );
    if(!first) return;

    const password=window.prompt("Re-enter your password to confirm account deletion:");
    if(password===null) return;
    if(!password){
      window.alert("A password is required to delete the account.");
      return;
    }

    const button=$("deleteAccountButton");
    setBusy(button,true,"Deleting…");

    try{
      const credential=EmailAuthProvider.credential(user.email,password);
      await reauthenticateWithCredential(user,credential);

      await deleteUserCloudData(user.uid);
      window.clearAppStorageLocal?.();
      await deleteUser(user);

      window.alert("Account deleted.");
      location.reload();
    }catch(error){
      console.error(error);
      window.alert(friendlyAuthError(error));
      setBusy(button,false);
    }
  });

  window.clearCurrentUserFitnessData=async function(){
    const user=auth.currentUser;
    if(!user) throw new Error("No signed-in user.");

    window.clearAppStorageLocal?.();
    await createCloudStorageAdapter(user.uid).clear();
  };

  window.forceUploadCurrentUserData=async function(){
    const user=auth.currentUser;
    if(!user) throw new Error("No signed-in user.");
    return uploadCurrentLocalStorage(user.uid);
  };

  onAuthStateChanged(auth,user=>{
    if(user) showAuthenticatedApp(user);
    else showSignedOut();
  });
}
