import {type AppState,type Backup,clone,uid,validateState,backup} from './model.js';
import {fresh} from './seeds.js';
interface Row{id:string;revision:number;state:AppState}
interface Journal{baseRevision:number;state:AppState}
const JOURNAL='forgefit-draft-v1';
function open():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open('forgefit-local',1);r.onupgradeneeded=()=>{for(const name of ['state','recovery'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name,{keyPath:'id'})};r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Close other ForgeFit windows, then reload.'));r.onsuccess=()=>resolve(r.result)})}
function read<T>(db:IDBDatabase,table:string,key:string):Promise<T|undefined>{return new Promise((resolve,reject)=>{const r=db.transaction(table).objectStore(table).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function put(db:IDBDatabase,table:string,value:unknown):Promise<void>{return new Promise((resolve,reject)=>{const t=db.transaction(table,'readwrite');t.objectStore(table).put(value);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error??Error('Save interrupted.'))})}
export class LocalStore{
 state:AppState=fresh();revision=0;error='';recovered=false;conflict=false;recoveryJournal:AppState|null=null;
 onStatus:(()=>void)|null=null;onExternal:(()=>void)|null=null;
 private db!:IDBDatabase;private pending=false;private writer:Promise<void>|null=null;private channel:BroadcastChannel|null=null;
 get saving():boolean{return this.pending||!!this.writer}
 async init():Promise<void>{
  this.db=await open();this.db.onversionchange=()=>{this.db.close();this.error='Database upgraded in another window. Export your draft, then reload.';this.onStatus?.()};
  const row=await read<Row>(this.db,'state','main');if(row){this.state=validateState(row.state);this.revision=row.revision}else this.pending=true;
  try{const raw=localStorage.getItem(JOURNAL);if(raw){const j=JSON.parse(raw) as Journal,d=validateState(j.state);if(d.changeId===this.state.changeId)localStorage.removeItem(JOURNAL);else if(j.baseRevision===this.revision){this.state=d;this.pending=true;this.recovered=true}else this.recoveryJournal=d}}catch{this.error='An unreadable draft was found. The last database save is loaded. Export a backup before continuing.'}
  if(this.pending)await this.flush();
  if(typeof BroadcastChannel!=='undefined'){this.channel=new BroadcastChannel('forgefit-saved');this.channel.onmessage=async e=>{if(Number(e.data?.revision)<=this.revision||this.saving||this.conflict)return;try{const r=await read<Row>(this.db,'state','main');if(r&&r.revision>this.revision&&!this.saving){this.state=validateState(r.state);this.revision=r.revision;this.onExternal?.()}}catch{/* Keep last available data. */}}}
 }
 change(fn:(state:AppState)=>void):void{if(this.conflict)throw Error('Another window saved newer data. Export this draft, then reload.');const next=clone(this.state);fn(next);next.updatedAt=Date.now();next.changeId=uid();this.state=next;this.pending=true;this.error='';this.journal();this.onStatus?.();void this.flush().catch(()=>{})}
 private journal():void{try{localStorage.setItem(JOURNAL,JSON.stringify({baseRevision:this.revision,state:this.state}))}catch{/* IndexedDB remains authoritative; a failed commit is shown persistently. */}}
 private cas(snapshot:AppState):Promise<number>{const expected=this.revision;return new Promise((resolve,reject)=>{const t=this.db.transaction('state','readwrite'),s=t.objectStore('state');let conflict=false;const r=s.get('main');r.onsuccess=()=>{if((r.result?.revision??0)!==expected){conflict=true;t.abort();return}s.put({id:'main',revision:expected+1,state:snapshot} satisfies Row)};t.oncomplete=()=>resolve(expected+1);t.onerror=()=>reject(t.error??Error('Could not save data.'));t.onabort=()=>{if(conflict)this.conflict=true;reject(Error(conflict?'A different window saved newer data. Export this draft, then reload. Nothing was overwritten.':'Your save was interrupted. Export a backup before closing.'))}})}
 flush():Promise<void>{if(this.writer)return this.writer;if(!this.pending)return Promise.resolve();this.writer=(async()=>{while(this.pending){this.pending=false;const snapshot=clone(this.state);try{this.revision=await this.cas(snapshot);if(this.pending)this.journal();else{try{const j=JSON.parse(localStorage.getItem(JOURNAL)??'null') as Journal|null;if(j?.state.changeId===snapshot.changeId)localStorage.removeItem(JOURNAL)}catch{}}this.channel?.postMessage({revision:this.revision})}catch(e){this.pending=true;this.error=e instanceof Error?e.message:'Unable to save. Export a backup.';this.journal();throw e}}})().finally(()=>{this.writer=null;this.onStatus?.()});return this.writer}
 async replace(data:AppState):Promise<void>{const clean=validateState(data);await this.flush();await put(this.db,'recovery',{id:'before-import',data:backup(this.state)});this.change(s=>Object.assign(s,clean));await this.flush()}
 async beforeImport():Promise<Backup|null>{return(await read<{data:Backup}>(this.db,'recovery','before-import'))?.data??null}
}
export const store=new LocalStore();
