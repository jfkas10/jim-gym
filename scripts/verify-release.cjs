"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const childProcess=require("node:child_process");

const root=path.resolve(__dirname,"..");
const site=fs.existsSync(path.join(root,"index.html"))?root:path.join(root,"site");
const packageVersion=require(path.join(root,"package.json")).version;
const html=fs.readFileSync(path.join(site,"index.html"),"utf8");
const worker=fs.readFileSync(path.join(site,"service-worker.js"),"utf8");
const appCore=fs.readFileSync(path.join(site,"app-core.js"),"utf8");

for(const filename of fs.readdirSync(site).filter(name=>name.endsWith(".js"))){
  childProcess.execFileSync(process.execPath,["--check",path.join(site,filename)],{stdio:"inherit"});
}

assert.match(html,new RegExp(`app-version-badge">v${packageVersion.replaceAll(".","\\.")}<`));
assert.match(worker,new RegExp(`const VERSION="v${packageVersion.replaceAll(".","\\.")}"`));
assert.match(appCore,new RegExp(`BACKUP_SCHEMA_VERSION="${packageVersion.replaceAll(".","\\.")}"`));
assert.doesNotMatch(appCore,/tension\s*:\s*\.(?:[1-9]\d*)/);

const shellMatch=worker.match(/const APP_SHELL=\[([\s\S]*?)\];/);
assert.ok(shellMatch,"service worker must declare APP_SHELL");
for(const match of shellMatch[1].matchAll(/"\.\/(.*?)"/g)){
  if(match[1]) assert.ok(fs.existsSync(path.join(site,match[1])),`missing cached file: ${match[1]}`);
}

assert.match(appCore,/backupFilenameSlug\(owner\.displayName\|\|owner\.email\|\|"user"\).*jim-gym-backup-/s);
console.log(`Release verification passed for v${packageVersion}.`);
