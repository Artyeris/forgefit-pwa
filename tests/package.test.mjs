/** Static package integrity checks. These are NOT browser/offline integration tests. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');
const sw=fs.readFileSync(path.join(dist,'sw.js'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(dist,'manifest.webmanifest'),'utf8'));
const index=fs.readFileSync(path.join(dist,'index.html'),'utf8');
const precache=JSON.parse(sw.match(/const FILES=(\[.*?\])\.map/)[1]);
test('Precache entries all exist, have content, and are unique',()=>{
 assert.equal(new Set(precache).size,precache.length);
 for(const entry of precache){assert(!entry.includes('..'));assert(fs.statSync(path.join(dist,entry)).size>0,entry)}
 for(const required of ['index.html','manifest.webmanifest','assets/app.js','assets/storage.js','assets/styles.css'])assert(precache.includes(required),required);
});
test('Standalone manifest uses relative scope and all icons are present',()=>{
 assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'./');
 assert(manifest.start_url.startsWith('./'));
 for(const icon of manifest.icons)assert(fs.existsSync(path.join(dist,icon.src)));
 assert(manifest.icons.some(x=>x.purpose?.includes('maskable')));
});
test('No external runtime assets or test adapter enter the production package',()=>{
 assert(!/<(?:script|link)[^>]+(?:src|href)=["']https?:/i.test(index));
 assert(!fs.existsSync(path.join(dist,'tests')));
 assert(!fs.existsSync(path.join(dist,'ui-harness.js')));
 const storage=fs.readFileSync(path.join(dist,'assets/storage.js'),'utf8');
 assert(storage.includes('indexedDB.open'));assert(!storage.includes('__test'));
 for(const file of fs.readdirSync(path.join(dist,'assets')).filter(x=>x.endsWith('.js'))){
  const text=fs.readFileSync(path.join(dist,'assets',file),'utf8');
  for(const match of text.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g))assert(fs.existsSync(path.join(dist,'assets',match[1])),`${file}: ${match[1]}`);
 }
});
test('Service worker uses atomic precache and explicit update activation',()=>{
 assert(sw.includes('cache.addAll'));assert(sw.includes("type==='SKIP_WAITING'"));
 assert(sw.includes('catch(error){await caches.delete(CACHE);throw error}'));
 assert(sw.includes("event.request.mode==='navigate'"));
});
test('HTML keeps local CSP, safe-area viewport and no remote fonts',()=>{
 assert(index.includes('Content-Security-Policy'));assert(index.includes('viewport-fit=cover'));
 assert(index.includes('apple-touch-icon'));assert(!index.includes('fonts.googleapis'));
});
