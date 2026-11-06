/** Pure domain functions. No browser storage or rendering dependencies. */
export const VERSION='0.1.0';
export type Metric='weight'|'bodyweight'|'time';
export type Kind='work'|'warmup'|'drop';
export type Theme='light'|'dark'|'system';
export const MUSCLES=['Back','Chest','Shoulders','Biceps','Triceps','Quads','Hamstrings','Glutes','Calves','Core','Full body'] as const;
export const EQUIPMENT=['Dumbbells','Bodyweight','Bench','Pull-up bar','Parallel bars','Bands','Barbell','Cable','Machine','Other'] as const;
export interface Exercise{id:string;name:string;muscle:string;equipment:string;metric:Metric;custom:boolean;note:string}
export interface PlanExercise{id:string;exerciseId:string;sets:number;reps:number;rest:number;rir:number|null}
export interface Routine{id:string;name:string;subtitle:string;exercises:PlanExercise[]}
export interface SetLog{id:string;kind:Kind;weight:string;reps:string;rir:string;done:boolean}
export interface LoggedExercise{id:string;exerciseId:string;name:string;muscle:string;equipment:string;metric:Metric;rest:number;note:string;sets:SetLog[]}
export interface Session{id:string;routineId:string|null;name:string;startedAt:number;finishedAt:number|null;elapsed:number;runningSince:number|null;duration:number;restEnd:number|null;restLength:number;pausedRest:number|null;exercises:LoggedExercise[];current:number;note:string}
export interface Settings{name:string;theme:Theme;defaultRest:number;weeklyWorkouts:number;weeklySets:number;weeklyExercises:number;sound:boolean;keepAwake:boolean;onboardingDone:boolean;lastExportAt:number|null}
export interface AppState{schema:1;changeId:string;updatedAt:number;settings:Settings;exercises:Exercise[];routines:Routine[];history:Session[];active:Session|null}
export interface Backup{format:'forgefit-backup';schema:1;appVersion:string;exportedAt:string;data:AppState}
export const uid=():string=>crypto.randomUUID();
export const clone=<T>(x:T):T=>structuredClone(x);
export function numeric(v:string):number|null{const s=v.trim().replace(',','.');if(!/^\d+(?:\.\d+)?$/.test(s))return null;const n=Number(s);return Number.isFinite(n)?n:null}
export function setError(s:SetLog,metric:Metric):string|null{
 const reps=numeric(s.reps);if(reps===null||!Number.isInteger(reps)||reps<1||reps>(metric==='time'?86400:999))return metric==='time'?'Enter 1–86,400 whole seconds.':'Enter 1–999 whole repetitions.';
 const w=numeric(s.weight);if(metric!=='time'&&(w===null||w<0||w>5000))return 'Enter a weight from 0 to 5,000 kg. Use 0 for bodyweight only.';
 const r=numeric(s.rir);if(s.rir!==''&&(r===null||!Number.isInteger(r)||r>10))return 'RIR must be 0–10, or empty.';return null;
}
export function elapsed(s:Session,now=Date.now()):number{return s.finishedAt!==null?s.duration:Math.max(0,s.elapsed+(s.runningSince===null?0:now-s.runningSince))}
export function pause(s:Session,now=Date.now()):void{if(s.runningSince===null)return;s.elapsed=elapsed(s,now);s.runningSince=null;s.pausedRest=s.restEnd===null?null:Math.max(0,s.restEnd-now);s.restEnd=null}
export function resume(s:Session,now=Date.now()):void{if(s.runningSince!==null)return;s.runningSince=now;s.restEnd=s.pausedRest?now+s.pausedRest:null;s.pausedRest=null}
export function completed(s:Session,includeWarmups=false):number{return s.exercises.reduce((n,e)=>n+e.sets.filter(x=>x.done&&(includeWarmups||x.kind!=='warmup')).length,0)}
/** External load as entered; no body-mass estimate or hidden per-hand multiplier. */
export function volume(s:Session):number{return s.exercises.reduce((n,e)=>n+(e.metric==='time'?0:e.sets.reduce((v,x)=>v+(x.done&&x.kind!=='warmup'?(numeric(x.weight)??0)*(numeric(x.reps)??0):0),0)),0)}
export function previous(history:Session[],id:string):LoggedExercise|undefined{return [...history].sort((a,b)=>b.startedAt-a.startedAt).flatMap(s=>s.exercises).find(e=>e.exerciseId===id&&e.sets.some(x=>x.done&&x.kind!=='warmup'))}
export function loggedExercise(e:Exercise,plan?:PlanExercise,history:Session[]=[],rest=120):LoggedExercise{
 const prev=previous(history,e.id)?.sets.filter(x=>x.done&&x.kind!=='warmup')??[];
 return{id:uid(),exerciseId:e.id,name:e.name,muscle:e.muscle,equipment:e.equipment,metric:e.metric,rest:plan?.rest??rest,note:'',sets:Array.from({length:plan?.sets??3},(_,i)=>({id:uid(),kind:'work',weight:prev[i]?.weight??(e.metric==='weight'?'':'0'),reps:prev[i]?.reps??String(plan?.reps??(e.metric==='time'?45:10)),rir:prev[i]?.rir??(plan?.rir!=null?String(plan.rir):''),done:false}))};
}
export function startSession(state:AppState,routine:Routine|null,now=Date.now()):Session{
 return{id:uid(),routineId:routine?.id??null,name:routine?.name??'Free workout',startedAt:now,finishedAt:null,elapsed:0,runningSince:now,duration:0,restEnd:null,restLength:0,pausedRest:null,current:0,note:'',exercises:(routine?.exercises??[]).map(p=>{const e=state.exercises.find(x=>x.id===p.exerciseId);if(!e)throw Error('A planned exercise is missing.');return loggedExercise(e,p,state.history,state.settings.defaultRest)})};
}
export function finish(s:Session,now=Date.now()):Session{
 if(!completed(s,true))throw Error('Complete at least one set first.');const out=clone(s);
 for(const e of out.exercises)for(const x of e.sets)if(x.done){const error=setError(x,e.metric);if(error)throw Error(`${e.name}: ${error}`)}
 out.duration=elapsed(s,now);out.elapsed=out.duration;out.finishedAt=now;out.runningSince=null;out.restEnd=null;out.pausedRest=null;out.current=0;
 out.exercises=out.exercises.map(e=>({...e,sets:e.sets.filter(x=>x.done)})).filter(e=>e.sets.length>0);return out;
}
export function day(time:number):string{const d=new Date(time);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export function weekStart(now=Date.now(),offset=0):number{const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7+offset*7);return +d}
export function weekStats(history:Session[],offset=0,now=Date.now()){
 const start=weekStart(now,offset),end=new Date(start);end.setDate(end.getDate()+7);const sessions=history.filter(s=>s.startedAt>=start&&s.startedAt<+end);const ids=new Set<string>(),muscles:Record<string,number>={};
 for(const s of sessions)for(const e of s.exercises){const n=e.sets.filter(x=>x.done&&x.kind!=='warmup').length;if(n){ids.add(e.exerciseId);muscles[e.muscle]=(muscles[e.muscle]??0)+n}}
 return{sessions,workouts:sessions.length,sets:sessions.reduce((n,s)=>n+completed(s),0),exercises:ids.size,muscles,volume:sessions.reduce((n,s)=>n+volume(s),0)};
}
export function backup(state:AppState):Backup{return{format:'forgefit-backup',schema:1,appVersion:VERSION,exportedAt:new Date().toISOString(),data:clone(state)}}
const obj=(v:unknown,label:string):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error(`Invalid ${label}.`);return v as Record<string,unknown>};
const str=(v:unknown,label:string,max=200,empty=true):string=>{if(typeof v!=='string'||v.length>max||(!empty&&!v.trim()))throw Error(`Invalid ${label}.`);return v};
const identifier=(v:unknown,label:string):string=>{const id=str(v,label,100,false);if(!/^[A-Za-z0-9_-]+$/.test(id))throw Error(`Invalid ${label}.`);return id};
const num=(v:unknown,label:string,min=0,max=9e15):number=>{if(typeof v!=='number'||!Number.isFinite(v)||!Number.isInteger(v)||v<min||v>max)throw Error(`Invalid ${label}.`);return v};
const nullable=(v:unknown,label:string,max=9e15):number|null=>v===null?null:num(v,label,0,max);
const bool=(v:unknown,label:string):boolean=>{if(typeof v!=='boolean')throw Error(`Invalid ${label}.`);return v};
const arr=(v:unknown,label:string,max:number):unknown[]=>{if(!Array.isArray(v)||v.length>max)throw Error(`Invalid ${label}.`);return v};
function choice<T extends string>(v:unknown,values:readonly T[],label:string):T{if(typeof v!=='string'||!values.includes(v as T))throw Error(`Invalid ${label}.`);return v as T}
function unique<T extends{id:string}>(items:T[],label:string):T[]{if(new Set(items.map(x=>x.id)).size!==items.length)throw Error(`Duplicate IDs in ${label}.`);return items}
/** Allowlisted, bounded schema reconstruction. Imported objects are never trusted or merged blindly. */
export function validateState(value:unknown):AppState{
 const d=obj(value,'data');if(d.schema!==1)throw Error('Unsupported data schema.');const p=obj(d.settings,'settings');
 const settings:Settings={name:str(p.name,'name',60),theme:choice(p.theme,['light','dark','system'],'theme'),defaultRest:num(p.defaultRest,'rest',0,3600),weeklyWorkouts:num(p.weeklyWorkouts,'workout target',1,14),weeklySets:num(p.weeklySets,'set target',1,999),weeklyExercises:num(p.weeklyExercises,'exercise target',1,200),sound:bool(p.sound,'sound'),keepAwake:bool(p.keepAwake,'screen setting'),onboardingDone:bool(p.onboardingDone,'onboarding'),lastExportAt:nullable(p.lastExportAt,'export date')};
 const exercises=unique(arr(d.exercises,'library',2000).map(v=>{const e=obj(v,'exercise');return{id:identifier(e.id,'exercise ID'),name:str(e.name,'exercise name',100,false),muscle:choice(e.muscle,MUSCLES,'muscle'),equipment:choice(e.equipment,EQUIPMENT,'equipment'),metric:choice(e.metric,['weight','bodyweight','time'],'metric'),custom:bool(e.custom,'custom flag'),note:str(e.note,'exercise note',2000)}}),'library');
 const byId=new Map(exercises.map(e=>[e.id,e]));
 const routines=unique(arr(d.routines,'routines',200).map(v=>{const r=obj(v,'routine');return{id:identifier(r.id,'routine ID'),name:str(r.name,'routine name',80,false),subtitle:str(r.subtitle,'description',1000),exercises:unique(arr(r.exercises,'routine exercises',100).map(v=>{const p=obj(v,'plan');const id=identifier(p.exerciseId,'exercise reference'),e=byId.get(id);if(!e)throw Error('A routine references a missing exercise.');return{id:identifier(p.id,'plan ID'),exerciseId:id,sets:num(p.sets,'set target',1,30),reps:num(p.reps,'rep target',1,e.metric==='time'?86400:999),rest:num(p.rest,'rest target',0,3600),rir:nullable(p.rir,'RIR target',10)}}),'routine exercises')}}),'routines');
 function readSession(v:unknown,active:boolean):Session{
  const s=obj(v,'session');const out:Session={id:identifier(s.id,'session ID'),routineId:s.routineId===null?null:identifier(s.routineId,'routine reference'),name:str(s.name,'session name',80,false),startedAt:num(s.startedAt,'start time',0,8640000000000000),finishedAt:nullable(s.finishedAt,'finish time',8640000000000000),elapsed:num(s.elapsed,'elapsed time'),runningSince:nullable(s.runningSince,'running since',8640000000000000),duration:num(s.duration,'duration'),restEnd:nullable(s.restEnd,'rest deadline'),restLength:num(s.restLength,'rest length',0,3600000),pausedRest:nullable(s.pausedRest,'paused rest',3600000),current:num(s.current,'exercise index',0,99),note:str(s.note,'session note',4000),exercises:unique(arr(s.exercises,'logged exercises',100).map(v=>{const e=obj(v,'logged exercise'),metric=choice(e.metric,['weight','bodyweight','time'],'metric');return{id:identifier(e.id,'logged ID'),exerciseId:identifier(e.exerciseId,'exercise reference'),name:str(e.name,'exercise name',100,false),muscle:choice(e.muscle,MUSCLES,'muscle'),equipment:choice(e.equipment,EQUIPMENT,'equipment'),metric,rest:num(e.rest,'rest',0,3600),note:str(e.note,'exercise note',2000),sets:unique(arr(e.sets,'sets',100).map(v=>{const x=obj(v,'set');const row:SetLog={id:identifier(x.id,'set ID'),kind:choice(x.kind,['work','warmup','drop'],'set kind'),weight:str(x.weight,'weight',12),reps:str(x.reps,'reps',12),rir:str(x.rir,'RIR',4),done:bool(x.done,'completed set')};if(row.done){const error=setError(row,metric);if(error)throw Error(error)}return row}),'sets')}}),'logged exercises')};
  if(active&&out.finishedAt!==null)throw Error('Active workout cannot already be finished.');
  if(!active&&(out.finishedAt===null||out.finishedAt<out.startedAt||out.runningSince!==null||!completed(out,true)))throw Error('Invalid completed workout.');
  if(out.exercises.length&&out.current>=out.exercises.length)throw Error('Invalid exercise selection.');return out;
 }
 const history=unique(arr(d.history,'history',20000).map(s=>readSession(s,false)),'history');const active=d.active===null?null:readSession(d.active,true);
 if(active&&history.some(s=>s.id===active.id))throw Error('Active workout is already in history.');
 return{schema:1,changeId:identifier(d.changeId,'change ID'),updatedAt:num(d.updatedAt,'update time',0,8640000000000000),settings,exercises,routines,history,active};
}
export function parseBackup(text:string):AppState{if(text.length>10*1024*1024)throw Error('Backup exceeds the 10 MB limit.');let value:unknown;try{value=JSON.parse(text)}catch{throw Error('This is not valid JSON.')}const root=obj(value,'backup');if(root.format!=='forgefit-backup'||root.schema!==1)throw Error('Not a supported ForgeFit backup.');return validateState(root.data)}
