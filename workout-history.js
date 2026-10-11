"use strict";

(function(root){
  const LOG_PREFIX="workoutSetLogs:";
  const TOMBSTONE_PREFIX="workoutHistoryTombstones:";

  function safeArray(value){
    try{
      const parsed=JSON.parse(value||"[]");
      return Array.isArray(parsed) ? parsed : [];
    }catch{
      return [];
    }
  }

  function createWorkoutHistoryStore(options={}){
    const storage=options.storage;
    const aliases=options.aliases||{};
    const variantNames=options.variantNames||{};

    if(!storage || typeof storage.getItem!=="function" || typeof storage.setItem!=="function"){
      throw new Error("Workout history requires a Storage-compatible adapter.");
    }

    function canonicalId(exerciseId){
      const value=String(exerciseId||"");
      for(const [canonical,legacyIds] of Object.entries(aliases)){
        if(value===canonical || (legacyIds||[]).includes(value)) return canonical;
      }
      return value;
    }

    function relatedIds(exerciseId){
      const canonical=canonicalId(exerciseId);
      return [...new Set([canonical,...(aliases[canonical]||[])].filter(Boolean))];
    }

    function raw(exerciseId){
      return safeArray(storage.getItem(LOG_PREFIX+exerciseId));
    }

    function identity(log,sourceId=""){
      if(log?.id) return `id:${log.id}`;
      return JSON.stringify([
        log?.date||"",
        Number(log?.timestamp)||0,
        canonicalId(log?.performedExerciseId||sourceId),
        log?.side||"",
        log?.load??"",
        log?.reps??"",
        log?.durationSeconds??"",
        log?.assistanceWeight??"",
        log?.commuteTime??""
      ]);
    }

    function storageLogIds(){
      const ids=[];
      for(let index=0;index<Number(storage.length||0);index++){
        const key=storage.key(index);
        if(key && key.startsWith(LOG_PREFIX)) ids.push(key.slice(LOG_PREFIX.length));
      }
      return ids;
    }

    function tombstones(exerciseId){
      return new Set(safeArray(storage.getItem(TOMBSTONE_PREFIX+canonicalId(exerciseId))));
    }

    function read(exerciseId){
      const canonical=canonicalId(exerciseId);
      const explicit=relatedIds(canonical);
      const candidates=[...explicit];

      // Also recover records placed under an unexpected historical key when the
      // record itself identifies a known canonical exercise.
      storageLogIds().forEach(id=>{
        if(candidates.includes(id)) return;
        if(raw(id).some(log=>canonicalId(log?.performedExerciseId||id)===canonical)){
          candidates.push(id);
        }
      });

      const hidden=tombstones(canonical);
      const seen=new Set();
      const result=[];

      // Canonical storage is first so an edited canonical copy wins over the
      // preserved legacy original with the same log ID.
      candidates.forEach(sourceId=>{
        raw(sourceId).forEach(log=>{
          if(!log || typeof log!=="object") return;
          const logCanonical=canonicalId(log.performedExerciseId||sourceId);
          if(logCanonical!==canonical && !explicit.includes(sourceId)) return;
          const key=identity(log,sourceId);
          if(hidden.has(key) || seen.has(key)) return;
          seen.add(key);
          result.push({
            ...log,
            performedExerciseId:canonical,
            variant:log.variant||variantNames[sourceId]||null,
            _storageId:canonical,
            _sourceStorageId:sourceId
          });
        });
      });

      return result.sort((a,b)=>(Number(a.timestamp)||0)-(Number(b.timestamp)||0));
    }

    function write(exerciseId,logs){
      const canonical=canonicalId(exerciseId);
      const normalized=(Array.isArray(logs)?logs:[]).map(log=>{
        const copy={...log,performedExerciseId:canonical};
        delete copy._storageId;
        delete copy._sourceStorageId;
        return copy;
      });
      storage.setItem(LOG_PREFIX+canonical,JSON.stringify(normalized));
      return normalized;
    }

    function append(exerciseId,log){
      const canonical=canonicalId(exerciseId);
      const next=read(canonical);
      next.push({...log,performedExerciseId:canonical});
      write(canonical,next);
      return log;
    }

    function remove(exerciseId,logOrIdentity){
      const canonical=canonicalId(exerciseId);
      const target=typeof logOrIdentity==="string"
        ? logOrIdentity
        : identity(logOrIdentity,logOrIdentity?._sourceStorageId||canonical);
      const hidden=tombstones(canonical);
      hidden.add(target);
      storage.setItem(TOMBSTONE_PREFIX+canonical,JSON.stringify([...hidden]));
      write(canonical,read(canonical).filter(log=>identity(log,canonical)!==target));
    }

    function update(exerciseId,original,changes){
      const canonical=canonicalId(exerciseId);
      const target=identity(original,original?._sourceStorageId||canonical);
      let changed=false;
      let replacement=null;
      const next=read(canonical).map(log=>{
        if(identity(log,canonical)!==target) return log;
        changed=true;
        replacement={...log,...changes,performedExerciseId:canonical};
        return replacement;
      });
      if(changed){
        const replacementIdentity=identity(replacement,canonical);
        if(replacementIdentity!==target){
          const hidden=tombstones(canonical);
          hidden.add(target);
          storage.setItem(TOMBSTONE_PREFIX+canonical,JSON.stringify([...hidden]));
        }
        write(canonical,next);
      }
      return changed;
    }

    function migrateAll(){
      let copied=0;
      Object.keys(aliases).forEach(canonical=>{
        const existing=raw(canonical);
        const merged=read(canonical);
        if(!existing.length && !merged.length) return;
        const existingIds=new Set(existing.map(log=>identity(log,canonical)));
        copied+=merged.filter(log=>!existingIds.has(identity(log,canonical))).length;
        write(canonical,merged);
      });
      return {copied};
    }

    return {canonicalId,relatedIds,identity,read,raw,write,append,remove,update,migrateAll};
  }

  root.createWorkoutHistoryStore=createWorkoutHistoryStore;
})(typeof window!=="undefined" ? window : globalThis);
