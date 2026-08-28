import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

let currentAdminUser=null;
let users=[];
let filteredUsers=[];
let selectedUser=null;
let selectedData={};
let currentView="overview";
let initialized=false;

const $=id=>document.getElementById(id);

export function configureAdminAccess(user,profile){
  const isAdmin=profile?.role==="admin";
  window.currentUserIsAdmin=isAdmin;
  const tab=$("adminTab");

  if(tab) tab.hidden=!isAdmin;

  if(!isAdmin){
    if(tab?.getAttribute("aria-selected")==="true"){
      $("workoutLoggingTab")?.click();
    }
    return;
  }

  currentAdminUser=user;

  if(!initialized){
    setupAdminUI();
    initialized=true;
  }
}

function setupAdminUI(){
  $("adminRefreshButton")?.addEventListener("click",loadUsers);

  $("adminUserSearch")?.addEventListener("input",event=>{
    const term=event.target.value.trim().toLowerCase();
    filteredUsers=users.filter(user=>
      `${user.displayName||""} ${user.email||""}`.toLowerCase().includes(term)
    );
    renderUserList();
  });

  document.querySelectorAll("[data-admin-view]").forEach(button=>{
    button.addEventListener("click",()=>{
      currentView=button.dataset.adminView;
      document.querySelectorAll("[data-admin-view]").forEach(other=>
        other.setAttribute("aria-selected",String(other===button))
      );
      renderInspector();
    });
  });

  $("adminTab")?.addEventListener("click",()=>{
    if(!users.length) loadUsers();
  });
}

async function loadUsers(){
  setStatus("Loading users…");
  const list=$("adminUserList");
  if(list) list.innerHTML='<div class="admin-empty">Loading users…</div>';

  try{
    const snapshot=await getDocs(collection(db,"users"));
    users=snapshot.docs.map(doc=>({uid:doc.id,...doc.data()}))
      .sort((a,b)=>(a.displayName||a.email||"").localeCompare(b.displayName||b.email||""));

    filteredUsers=users.slice();
    $("adminUserCount").textContent=String(users.length);

    renderUserList();

    if(selectedUser){
      const refreshed=users.find(user=>user.uid===selectedUser.uid);
      if(refreshed) selectedUser=refreshed;
    }

    setStatus(`Loaded ${users.length} user${users.length===1?"":"s"}.`);
  }catch(error){
    console.error(error);
    if(list) list.innerHTML='<div class="admin-empty">User list could not be loaded.</div>';
    setStatus("Unable to read users. Confirm the v26.2 Firestore rules are published.",true);
  }
}

function renderUserList(){
  const list=$("adminUserList");
  if(!list) return;
  list.innerHTML="";

  if(!filteredUsers.length){
    list.innerHTML='<div class="admin-empty">No matching users.</div>';
    return;
  }

  filteredUsers.forEach(user=>{
    const button=document.createElement("button");
    button.type="button";
    button.className="admin-user-row";
    button.setAttribute("aria-selected",String(selectedUser?.uid===user.uid));

    const avatar=document.createElement("span");
    avatar.className="admin-user-avatar";
    avatar.textContent=initials(user.displayName||user.email||"?");

    const copy=document.createElement("span");
    copy.className="admin-user-copy";

    const name=document.createElement("strong");
    name.textContent=user.displayName || "Unnamed user";

    const email=document.createElement("span");
    email.textContent=user.email || user.uid;

    copy.append(name,email);
    button.append(avatar,copy);

    button.addEventListener("click",()=>selectUser(user));
    list.appendChild(button);
  });
}

async function selectUser(user){
  selectedUser=user;
  selectedData={};
  renderUserList();

  $("adminNoUserSelected").hidden=true;
  $("adminUserInspector").hidden=false;
  $("adminSelectedName").textContent=user.displayName || "Unnamed user";
  $("adminSelectedEmail").textContent=user.email || user.uid;
  $("adminSelectedRole").textContent=user.role==="admin" ? "Administrator" : "User";

  const content=$("adminInspectorContent");
  if(content) content.innerHTML='<div class="admin-empty">Loading cloud data…</div>';
  setStatus(`Loading ${user.displayName||user.email||"user"}…`);

  try{
    const snapshot=await getDocs(collection(db,"users",user.uid,"appData"));
    snapshot.forEach(doc=>{
      const data=doc.data();
      if(typeof data.key==="string"){
        selectedData[data.key]=safeParse(data.value);
      }
    });

    const totalKeys=Object.keys(selectedData).length;
    $("adminDataKeyCount").textContent=String(totalKeys);
    renderInspector();
    setStatus(`Loaded ${totalKeys} cloud record${totalKeys===1?"":"s"} for ${user.displayName||user.email||"user"}.`);
  }catch(error){
    console.error(error);
    if(content) content.innerHTML='<div class="admin-empty">This user’s app data could not be loaded.</div>';
    setStatus("Unable to read this user's data. Confirm the v26.2 Firestore rules are published.",true);
  }
}

function renderInspector(){
  if(!selectedUser) return;

  const content=$("adminInspectorContent");
  if(!content) return;
  content.innerHTML="";

  if(currentView==="overview") renderOverview(content);
  else if(currentView==="splits") renderSplits(content);
  else if(currentView==="workouts") renderWorkouts(content);
  else if(currentView==="cycling") renderCycling(content);
  else if(currentView==="library") renderLibrary(content);
}

function renderOverview(content){
  const workoutLogs=getWorkoutLogs();
  const cycling=getCyclingLogs();
  const splits=getCustomSplits();
  const exercises=getCustomExercises();
  const workoutDates=new Set(workoutLogs.map(item=>item.log.date).filter(Boolean));

  const stats=document.createElement("div");
  stats.className="admin-data-grid";
  stats.append(
    statCard(workoutLogs.length,"Logged sets"),
    statCard(cycling.length,"Cycling logs"),
    statCard(workoutDates.size,"Workout days"),
    statCard(splits.length,"Custom splits"),
    statCard(exercises.length,"Custom exercises"),
    statCard(Object.keys(selectedData).length,"Cloud records")
  );
  content.appendChild(stats);

  const profile=card(
    "Profile",
    [
      `UID: ${selectedUser.uid}`,
      `Email: ${selectedUser.email||"—"}`,
      `Role: ${selectedUser.role||"user"}`
    ]
  );
  content.appendChild(profile);

  const recent=[...workoutLogs]
    .sort((a,b)=>dateValue(b.log.date)-(dateValue(a.log.date)))
    .slice(0,6);

  const section=document.createElement("div");
  section.className="admin-data-card";
  section.innerHTML="<h4>Recent strength activity</h4>";

  if(!recent.length){
    section.appendChild(empty("No strength sets are stored."));
  }else{
    const list=document.createElement("div");
    list.className="admin-data-list";
    recent.forEach(item=>list.appendChild(workoutRow(item)));
    section.appendChild(list);
  }
  content.appendChild(section);
}

function renderSplits(content){
  const splits=getCustomSplits();

  if(!splits.length){
    content.appendChild(empty("No custom or locally edited splits are stored for this user."));
    return;
  }

  const list=document.createElement("div");
  list.className="admin-data-list";

  splits.forEach(split=>{
    const days=Array.isArray(split.days)?split.days:[];
    const workoutCount=days.reduce((sum,day)=>sum+(Array.isArray(day.workouts)?day.workouts.length:0),0);
    const warmupCount=days.reduce((sum,day)=>sum+(Array.isArray(day.warmups)?day.warmups.length:0),0);

    const row=document.createElement("div");
    row.className="admin-data-row";
    row.innerHTML=
      `<strong>${escapeHtml(split.name||"Unnamed split")}</strong>`+
      `<span>${days.length} day${days.length===1?"":"s"} · ${workoutCount} workouts · ${warmupCount} warm-ups</span>`;

    if(days.length){
      const daySummary=days.map((day,index)=>`Day ${index+1}: ${day.name||"Unnamed"}`).join(" · ");
      const detail=document.createElement("span");
      detail.textContent=daySummary;
      row.appendChild(detail);
    }

    list.appendChild(row);
  });

  content.appendChild(list);
}

function renderWorkouts(content){
  const logs=getWorkoutLogs()
    .sort((a,b)=>{
      const dateDiff=dateValue(b.log.date)-dateValue(a.log.date);
      return dateDiff || Number(b.log.timestamp||0)-Number(a.log.timestamp||0);
    });

  if(!logs.length){
    content.appendChild(empty("No strength workout sets are stored for this user."));
    return;
  }

  const header=document.createElement("div");
  header.className="admin-data-grid";
  header.append(
    statCard(logs.length,"Logged sets"),
    statCard(new Set(logs.map(item=>item.exerciseId)).size,"Exercises"),
    statCard(new Set(logs.map(item=>item.log.date).filter(Boolean)).size,"Training days")
  );
  content.appendChild(header);

  const list=document.createElement("div");
  list.className="admin-data-list";
  logs.forEach(item=>list.appendChild(workoutRow(item)));
  content.appendChild(list);
}

function renderCycling(content){
  const logs=getCyclingLogs()
    .sort((a,b)=>dateValue(b.date)-dateValue(a.date) || Number(b.timestamp||0)-Number(a.timestamp||0));

  if(!logs.length){
    content.appendChild(empty("No cycling commutes are stored for this user."));
    return;
  }

  const avgSpeed=average(logs.map(item=>Number(item.movingVelocity)).filter(Number.isFinite));
  const avgCalories=average(logs.map(item=>Number(item.calories)).filter(Number.isFinite));

  const header=document.createElement("div");
  header.className="admin-data-grid";
  header.append(
    statCard(logs.length,"Rides"),
    statCard(avgSpeed===null?"—":`${avgSpeed.toFixed(1)} mph`,"Avg velocity"),
    statCard(avgCalories===null?"—":`${avgCalories.toFixed(0)} kcal`,"Avg calories")
  );
  content.appendChild(header);

  const list=document.createElement("div");
  list.className="admin-data-list";
  logs.forEach(log=>{
    const row=document.createElement("div");
    row.className="admin-data-row";
    row.innerHTML=
      `<strong>${escapeHtml(log.date||"Unknown date")} · ${escapeHtml(log.commuteTime||"—")}</strong>`+
      `<span>${formatNum(log.movingVelocity,2)} mph · ${formatNum(log.calories,1)} kcal · ${formatNum(log.power,1)} W · ${formatNum(log.force,1)} lbf/leg</span>`;
    list.appendChild(row);
  });
  content.appendChild(list);
}

function renderLibrary(content){
  const exercises=getCustomExercises();
  const settings=selectedData.fitnessTrackerSettings;
  const advanced=selectedData.showAdvancedResults;
  const appearance=selectedData.fitnessTrackerAppearance;

  const overview=document.createElement("div");
  overview.className="admin-data-grid";
  overview.append(
    statCard(exercises.length,"Custom exercises"),
    statCard(appearance || "System","Appearance"),
    statCard(String(advanced)==="true"?"On":"Off","Advanced results")
  );
  content.appendChild(overview);

  if(settings && typeof settings==="object"){
    const lines=Object.entries(settings).map(([key,value])=>`${friendlyKey(key)}: ${value}`);
    content.appendChild(card("Saved cycling settings",lines));
  }

  const exerciseCard=document.createElement("div");
  exerciseCard.className="admin-data-card";
  exerciseCard.innerHTML="<h4>Custom exercise library</h4>";

  if(!exercises.length){
    exerciseCard.appendChild(empty("No custom exercises are stored."));
  }else{
    const list=document.createElement("div");
    list.className="admin-data-list";
    exercises.forEach(exercise=>{
      const row=document.createElement("div");
      row.className="admin-data-row";
      row.innerHTML=
        `<strong>${escapeHtml(exercise.name||"Unnamed exercise")}</strong>`+
        `<span>${escapeHtml(exercise.group||"Other")}${exercise.unit?` · ${escapeHtml(exercise.unit)}`:""}</span>`;
      list.appendChild(row);
    });
    exerciseCard.appendChild(list);
  }
  content.appendChild(exerciseCard);
}

function getWorkoutLogs(){
  const items=[];

  Object.entries(selectedData).forEach(([key,value])=>{
    if(!key.startsWith("workoutSetLogs:") || !Array.isArray(value)) return;
    const exerciseId=key.slice("workoutSetLogs:".length);

    value.forEach(log=>{
      if(log && typeof log==="object"){
        items.push({exerciseId,log});
      }
    });
  });

  return items;
}

function getCyclingLogs(){
  return Array.isArray(selectedData.cyclingActivityLogs)
    ? selectedData.cyclingActivityLogs
    : [];
}

function getCustomSplits(){
  return Array.isArray(selectedData.fitnessTrackerCustomSplits)
    ? selectedData.fitnessTrackerCustomSplits
    : [];
}

function getCustomExercises(){
  return Array.isArray(selectedData.fitnessTrackerCustomExercises)
    ? selectedData.fitnessTrackerCustomExercises
    : [];
}

function workoutRow(item){
  const row=document.createElement("div");
  row.className="admin-data-row";

  const log=item.log;
  const name=log.performedExerciseName || item.exerciseId;
  const side=log.side?` · ${log.side}`:"";
  const variant=log.variant?` · ${log.variant}`:"";
  const assistance=log.assisted?` · Assisted ${displayLoad(log.assistanceWeight)} lb`:"";
  const load=log.load===null || log.load===undefined ? "" : `${displayLoad(log.load)} lb × `;

  row.innerHTML=
    `<strong>${escapeHtml(log.date||"Unknown date")} · ${escapeHtml(name)}</strong>`+
    `<span>${escapeHtml(load)}${escapeHtml(String(log.reps??"—"))}${escapeHtml(variant)}${escapeHtml(side)}${escapeHtml(assistance)}</span>`;

  if(log.substituted && log.plannedExerciseName){
    const note=document.createElement("span");
    note.textContent=`Substitute for ${log.plannedExerciseName}`;
    row.appendChild(note);
  }

  return row;
}

function statCard(value,label){
  const card=document.createElement("div");
  card.className="admin-data-stat";

  const strong=document.createElement("strong");
  strong.textContent=String(value);

  const span=document.createElement("span");
  span.textContent=label;

  card.append(strong,span);
  return card;
}

function card(title,lines){
  const node=document.createElement("div");
  node.className="admin-data-card";

  const heading=document.createElement("h4");
  heading.textContent=title;
  node.appendChild(heading);

  lines.forEach(line=>{
    const p=document.createElement("p");
    p.textContent=line;
    node.appendChild(p);
  });

  return node;
}

function empty(text){
  const node=document.createElement("div");
  node.className="admin-empty";
  node.textContent=text;
  return node;
}

function safeParse(value){
  if(typeof value!=="string") return value;
  try{return JSON.parse(value)}catch{return value}
}

function initials(value){
  return String(value||"?")
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0,2)
    .map(part=>part[0]?.toUpperCase()||"")
    .join("") || "?";
}

function average(values){
  return values.length ? values.reduce((a,b)=>a+b,0)/values.length : null;
}

function dateValue(value){
  const match=String(value||"").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? new Date(Number(match[3]),Number(match[1])-1,Number(match[2])).getTime() : 0;
}

function displayLoad(value){
  const number=Number(value);
  return Number.isFinite(number) ? (Number.isInteger(number)?String(number):number.toFixed(1)) : "0";
}

function formatNum(value,digits){
  const number=Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "—";
}

function friendlyKey(value){
  return String(value)
    .replace(/([a-z])([A-Z])/g,"$1 $2")
    .replace(/^./,letter=>letter.toUpperCase());
}

function escapeHtml(value){
  return String(value??"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function setStatus(message,error=false){
  const status=$("adminStatus");
  if(!status) return;
  status.textContent=message;
  status.classList.toggle("error",error);
}
