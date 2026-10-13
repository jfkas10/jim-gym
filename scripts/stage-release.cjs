"use strict";

const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const source=fs.existsSync(path.join(root,"index.html"))?root:path.join(root,"site");
const destination=path.join(root,"release","site");
const files=[
  "README.md",
  "admin.js",
  "app-core.js",
  "apple-touch-icon.png",
  "auth.css",
  "auth.js",
  "bootstrap.js",
  "firebase.js",
  "firestore.rules",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png",
  "index.html",
  "manifest.webmanifest",
  "service-worker.js",
  "storage.js",
  "styles.css",
  "sync.js",
  "workout-history.js"
];

fs.rmSync(destination,{recursive:true,force:true});
fs.mkdirSync(destination,{recursive:true});
for(const filename of files){
  const input=path.join(source,filename);
  if(!fs.existsSync(input)) throw new Error(`Missing release file: ${filename}`);
  fs.copyFileSync(input,path.join(destination,filename));
}
console.log(`Staged ${files.length} flat release files.`);
