import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),dist=path.join(root,'dist');
await fs.rm(dist,{recursive:true,force:true});await fs.mkdir(path.join(dist,'assets'),{recursive:true});
await fs.cp(path.join(root,'public'),dist,{recursive:true});
await fs.cp(path.join(root,'build'),path.join(dist,'assets'),{recursive:true});
await fs.copyFile(path.join(root,'src/styles.css'),path.join(dist,'assets/styles.css'));
async function files(dir,prefix=''){let out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const rel=prefix+e.name;if(e.isDirectory())out.push(...await files(path.join(dir,e.name),rel+'/'));else if(!rel.startsWith('_'))out.push(rel)}return out.sort()}
const assets=await files(dist),hash=crypto.createHash('sha256');for(const f of assets)hash.update(f).update(await fs.readFile(path.join(dist,f)));const revision=hash.digest('hex').slice(0,16);
const sw=`/* ForgeFit 0.1.0. Atomic offline shell; updates activate only on request. */
const SCOPE=self.registration.scope;
const PREFIX='forgefit-shell-'+btoa(SCOPE).replace(/[^a-z0-9]/gi,'')+'-';
const CACHE=PREFIX+${JSON.stringify(revision)};
const FILES=${JSON.stringify(assets)}.map(path=>new URL(path,SCOPE).href);
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);try{await cache.addAll(FILES.map(url=>new Request(url,{cache:'reload'})))}catch(error){await caches.delete(CACHE);throw error}})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith((async()=>{const cache=await caches.open(CACHE);if(event.request.mode==='navigate'){const shell=await cache.match(new URL('index.html',SCOPE).href);if(shell)return shell;return fetch(event.request)}const hit=await cache.match(event.request,{ignoreSearch:true});return hit||fetch(event.request)})())});
`;
await fs.writeFile(path.join(dist,'sw.js'),sw);await fs.writeFile(path.join(root,'docs/BUILD.txt'),`ForgeFit 0.1.0\nOffline shell revision: ${revision}\nPrecached files: ${assets.length}\nRuntime dependencies: none\n`);
console.log(`Built ${dist} (${assets.length+2} files; cache ${revision})`);
