"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const site=fs.existsSync(path.join(root,"index.html"))?root:path.join(root,"site");
require(path.join(site,"workout-history.js"));

class MemoryStorage{
  constructor(entries={}){this.map=new Map(Object.entries(entries))}
  get length(){return this.map.size}
  key(index){return [...this.map.keys()].sort()[index]??null}
  getItem(key){return this.map.has(key)?this.map.get(key):null}
  setItem(key,value){this.map.set(key,String(value))}
}

const legacy=[
  {id:"old-1",date:"09/01/2026",timestamp:100,performedExerciseId:"machine-chest-press",load:100,reps:8},
  {date:"09/10/2026",timestamp:200,performedExerciseId:"machine-chest-press",load:110,reps:6}
];
const original=JSON.stringify(legacy);
const storage=new MemoryStorage({"workoutSetLogs:machine-chest-press":original});
const history=globalThis.createWorkoutHistoryStore({
  storage,
  aliases:{"flat-press":["machine-chest-press","flat-bench-press"]},
  variantNames:{"machine-chest-press":"Machine"}
});

assert.equal(history.read("flat-press").length,2);
assert.equal(history.migrateAll().copied,2);
assert.equal(storage.getItem("workoutSetLogs:machine-chest-press"),original);
assert.equal(history.read("flat-press").length,2);
assert.equal(history.migrateAll().copied,0);

const previous=history.read("flat-press").sort((a,b)=>b.timestamp-a.timestamp)[0];
assert.equal(previous.date,"09/10/2026");

const deleted=history.read("flat-press")[0];
history.remove("flat-press",deleted);
history.migrateAll();
assert.equal(history.read("flat-press").length,1);
assert.equal(storage.getItem("workoutSetLogs:machine-chest-press"),original);

console.log("Canonical history migration tests passed.");
