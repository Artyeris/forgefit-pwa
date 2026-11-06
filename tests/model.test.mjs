import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,library} from '../build/seeds.js';
import {numeric,setError,clone,startSession,loggedExercise,finish,elapsed,pause,resume,completed,volume,previous,day,weekStart,weekStats,backup,parseBackup,validateState,uid} from '../build/model.js';
import {esc} from '../build/components.js';
process.env.TZ='Europe/Vilnius';
const set=(overrides={})=>({id:uid(),kind:'work',weight:'20',reps:'10',rir:'2',done:true,...overrides});
function session(){const s=fresh(),routine=s.routines.find(x=>x.id==='home-pull');const x=startSession(s,routine,1000);x.exercises[0].sets=[set({weight:'0'})];return x}
const cases=[
 ['fresh state has no fabricated history',()=>{const s=fresh();assert.equal(s.history.length,0);assert.equal(s.active,null);assert.equal(s.exercises.length,56);assert.equal(s.routines.length,7);assert.deepEqual(validateState(s),s)}],
 ['decimal point and comma parsing',()=>{assert.equal(numeric('12,5'),12.5);assert.equal(numeric('12.5'),12.5);assert.equal(numeric(' 0 '),0)}],
 ['reject malformed weights',()=>{for(const v of ['','-1','NaN','Infinity','1e3','1.2.3','0x20','+2'])assert.equal(numeric(v),null)}],
 ['whole reps required',()=>{assert.ok(setError(set({reps:'2.5'}),'weight'));assert.equal(setError(set(),'weight'),null)}],
 ['time sets do not require external weight',()=>assert.equal(setError(set({weight:'',reps:'45'}),'time'),null)],
 ['RIR validates zero, ten and empty',()=>{for(const rir of ['0','10',''])assert.equal(setError(set({rir}),'weight'),null);for(const rir of ['-1','11','1.5'])assert.ok(setError(set({rir}),'weight'))}],
 ['bodyweight zero is valid',()=>assert.equal(setError(set({weight:'0'}),'bodyweight'),null)],
 ['bounded load and rep counts',()=>{assert.ok(setError(set({weight:'5001'}),'weight'));assert.ok(setError(set({reps:'1000'}),'weight'));assert.ok(setError(set({reps:'86401'}),'time'))}],
 ['new session never invents starting dumbbell weights',()=>{const s=fresh(),x=startSession(s,s.routines[2]);assert.equal(x.exercises[0].sets[0].weight,'');assert.equal(x.exercises[0].sets[0].done,false)}],
 ['session elapsed survives long suspension',()=>{const s=session();assert.equal(elapsed(s,181000),180000)}],
 ['pause excludes paused duration',()=>{const s=session();pause(s,11000);assert.equal(elapsed(s,100000),10000);resume(s,101000);assert.equal(elapsed(s,111000),20000)}],
 ['pause and resume freeze remaining rest',()=>{const s=session();s.restEnd=61000;s.restLength=60000;pause(s,11000);assert.equal(s.pausedRest,50000);assert.equal(s.restEnd,null);resume(s,111000);assert.equal(s.restEnd,161000)}],
 ['pausing twice is idempotent',()=>{const s=session();pause(s,11000);pause(s,21000);assert.equal(s.elapsed,10000)}],
 ['warm-ups excluded, drop sets included',()=>{const s=session();s.exercises=s.exercises.slice(0,1);s.exercises[0].sets=[set({kind:'warmup'}),set(),set({kind:'drop'}),set({done:false})];assert.equal(completed(s),2);assert.equal(completed(s,true),3)}],
 ['recorded external volume uses no hidden multipliers',()=>{const s=session();s.exercises=s.exercises.slice(0,1);s.exercises[0].metric='weight';s.exercises[0].sets=[set(),set({kind:'warmup'}),set({done:false})];assert.equal(volume(s),200)}],
 ['timed holds excluded from volume',()=>{const s=session();s.exercises=s.exercises.slice(0,1);s.exercises[0].metric='time';s.exercises[0].sets=[set({reps:'60'})];assert.equal(volume(s),0)}],
 ['finish requires at least one completed set',()=>{const s=session();s.exercises.forEach(e=>e.sets.forEach(x=>x.done=false));assert.throws(()=>finish(s,2000))}],
 ['finish removes unchecked sets and empty exercises',()=>{const s=session(),done=finish(s,61000);assert.equal(done.exercises.length,1);assert.equal(done.exercises[0].sets.length,1);assert.equal(done.runningSince,null);assert.equal(done.duration,60000);assert.equal(done.restEnd,null);assert.equal(s.finishedAt,null)}],
 ['finished duration remains stable',()=>{const s=finish(session(),61000);assert.equal(elapsed(s,900000),60000)}],
 ['invalid completed set rejected at finish',()=>{const s=session();s.exercises[0].sets[0].reps='';assert.throws(()=>finish(s,61000))}],
 ['previous performance chooses latest chronological workout',()=>{const older=finish(session(),61000),newer=clone(older);newer.id=uid();newer.startedAt=100000;newer.exercises[0].sets[0].reps='12';assert.equal(previous([newer,older],'pull-up').sets[0].reps,'12')}],
 ['new sessions prefill previous working performance',()=>{const s=fresh(),old=finish(session(),61000);old.exercises[0].sets[0].reps='14';s.history=[old];const x=startSession(s,s.routines[0]);assert.equal(x.exercises[0].sets[0].reps,'14');assert.equal(x.exercises[0].sets[0].done,false)}],
 ['previous warm-ups never replace working targets',()=>{const s=fresh(),old=finish(session(),61000);old.exercises[0].sets.unshift(set({kind:'warmup',reps:'2'}));s.history=[old];const x=startSession(s,s.routines[0]);assert.equal(x.exercises[0].sets[0].reps,'10')}],
 ['week starts at local Monday midnight',()=>{const start=new Date(weekStart(new Date('2026-11-06T12:00:00+02:00').getTime()));assert.equal(start.getDay(),1);assert.equal(start.getHours(),0);assert.equal(day(+start),'2026-11-02')}],
 ['weekly stats handle boundary days and primary muscles',()=>{const now=new Date('2026-11-06T12:00:00+02:00').getTime(),a=finish(session(),61000);a.startedAt=weekStart(now);a.finishedAt=a.startedAt+60000;const b=clone(a);b.id=uid();b.startedAt=a.startedAt-1;b.finishedAt=b.startedAt+60000;const st=weekStats([a,b],0,now);assert.equal(st.workouts,1);assert.equal(st.sets,1);assert.equal(st.exercises,1);assert.equal(st.muscles.Back,1)}],
 ['DST week uses calendar boundaries',()=>{const t=new Date('2026-10-25T14:00:00+02:00').getTime();const start=weekStart(t);assert.equal(day(start),'2026-10-19');assert.equal(day(weekStart(t,1)),'2026-10-26')}],
 ['backup round-trips an active session and history',()=>{const s=fresh();s.history=[finish(session(),61000)];s.active=startSession(s,s.routines[2]);assert.deepEqual(parseBackup(JSON.stringify(backup(s))),s)}],
 ['malformed JSON and foreign format rejected',()=>{assert.throws(()=>parseBackup('{'));assert.throws(()=>parseBackup('{"format":"foreign","schema":1}'))}],
 ['future schema rejected instead of silently resetting',()=>{const b=backup(fresh());b.schema=2;assert.throws(()=>parseBackup(JSON.stringify(b)))}],
 ['missing exercise references rejected',()=>{const s=fresh();s.routines[0].exercises[0].exerciseId='missing';assert.throws(()=>validateState(s))}],
 ['duplicate IDs rejected',()=>{const s=fresh();s.exercises.push(clone(s.exercises[0]));assert.throws(()=>validateState(s))}],
 ['invalid identifiers rejected',()=>{const s=fresh();s.routines[0].id='evil:route';assert.throws(()=>validateState(s))}],
 ['unknown imported keys are stripped',()=>{const s=fresh();s.untrusted='ignored';const parsed=validateState(s);assert.equal('untrusted' in parsed,false)}],
 ['invalid settings rejected',()=>{const s=fresh();s.settings.weeklyWorkouts=0;assert.throws(()=>validateState(s))}],
 ['out-of-range active exercise rejected',()=>{const s=fresh();s.active=session();s.active.current=99;assert.throws(()=>validateState(s))}],
 ['active and completed session IDs cannot collide',()=>{const s=fresh(),x=session();s.active=x;s.history=[finish(x,61000)];assert.throws(()=>validateState(s))}],
 ['completed sets are validated during import',()=>{const s=fresh();s.history=[finish(session(),61000)];s.history[0].exercises[0].sets[0].weight='NaN';assert.throws(()=>validateState(s))}],
 ['overlarge backup rejected',()=>assert.throws(()=>parseBackup(' '.repeat(10*1024*1024+1)))],
 ['HTML escaping protects names and notes',()=>assert.equal(esc('<img src=x onerror="evil()">&\''),'&lt;img src=x onerror=&quot;evil()&quot;&gt;&amp;&#39;')],
 ['all seed routines reference valid exercises',()=>{const s=fresh(),ids=new Set(library().map(x=>x.id));for(const r of s.routines)for(const e of r.exercises)assert.ok(ids.has(e.exerciseId))}]
];
for(const [name,fn] of cases)test(name,fn);
