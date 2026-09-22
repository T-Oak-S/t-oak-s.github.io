const {test}=require('node:test');
const assert=require('node:assert/strict');
const Matter=require('../assets/matter.min.js');
const Core=require('../core.js');
const make=()=>Core.createGame(Matter,{rng:()=>0});

test('snapshot restores moving pieces and timers paused without advancing offline time',()=>{
 const a=make();a.drop(180);for(let i=0;i<12;i++)a.step(16);
 const body=[...a.bodies.values()][0];Matter.Body.setAngularVelocity(body,.03);
 a.score=32;a.highest=5;const s=a.exportState(),b=make();b.restoreState(JSON.parse(JSON.stringify(s)));
 assert.equal(b.state,'paused');const restored=b.exportState();assert.ok(Math.abs(restored.pieces[0].angularVelocity-s.pieces[0].angularVelocity)<1e-12);restored.pieces[0].angularVelocity=s.pieces[0].angularVelocity;assert.deepEqual(restored,{...s,state:'paused'});
 b.step(16);assert.equal(b.time,s.time);b.resume();assert.equal(b.drop(200),false);
 a.step(16);b.step(16);assert.ok(Math.abs([...a.bodies.values()][0].position.y-[...b.bodies.values()][0].position.y)<.01);
});
test('restore keeps imminent overflow and rejects malformed snapshots without clearing game',()=>{
 const a=make();a.engine.gravity.y=0;a.spawn(0,220,60);for(let i=0;i<210;i++)a.step(16);
 const b=make();b.restoreState(a.exportState());b.engine.gravity.y=0;assert.ok(b.danger>1800);b.resume();for(let i=0;i<12;i++)b.step(16);assert.equal(b.state,'lost');
 const s=a.exportState();s.pieces[0].x=NaN;const old=a.exportState();assert.throws(()=>a.restoreState(s));assert.deepEqual(a.exportState(),old);
 assert.throws(()=>a.restoreState({...old,version:999}));
});
test('storage settles once, preserves records on restart, and serializes ownership',async()=>{
 const Save=require('../save.js');let value=null;let chain=Promise.resolve();
 const storage={getItem:()=>value,setItem:(_,v)=>value=v};const lock=fn=>{const p=chain.then(fn);chain=p.catch(()=>{});return p;};
 const a=Save.createStore({storage:()=>storage,lock,owner:'a'}),b=Save.createStore({storage:()=>storage,lock,owner:'b'});
 await a.claim();const g=make();await a.start('round1',g.exportState(),220);
 g.spawn(9,140,460);g.spawn(9,300,460);g.step(16);
 await a.save('round1',g.exportState(),220);await a.save('round1',g.exportState(),220);
 let d=JSON.parse(value);assert.equal(d.stats.wins,1);assert.equal(d.round,null);assert.ok(d.stats.achievements.seu);assert.equal(d.stats.highest,10);
 await a.start('round2',make().exportState(),200);assert.equal(JSON.parse(value).stats.wins,1);
 await b.claim();const result=await a.save('round2',make().exportState(),200);assert.equal(result.conflict,true);assert.equal(JSON.parse(value).owner,'b');
});
test('five wins unlock once, failed writes retain session records, corrupt saves recover',async()=>{
 const Save=require('../save.js');let value=null,fail=false;
 const storage={getItem:()=>value,setItem:(_,v)=>{if(fail)throw Error('quota');value=v;}};
 const a=Save.createStore({storage:()=>storage,lock:fn=>Promise.resolve().then(fn),owner:'a'});await a.claim();
 for(let i=0;i<5;i++){const g=make();await a.start('r'+i,g.exportState(),220);for(const l of [0,6,8,9]){g.bodies.forEach(b=>{Matter.Composite.remove(g.engine.world,b);});g.bodies.clear();const r=Core.SCHOOLS[l].radius;g.spawn(l,220-r+1,440);g.spawn(l,220+r-1,440);g.step(16);}await a.save('r'+i,g.exportState(),220);}
 assert.equal(a.data.stats.wins,5);assert.equal(Object.keys(a.data.stats.achievements).length,5);
 const dates={...a.data.stats.achievements};fail=true;await a.start('offline',make().exportState(),220);assert.equal(a.available,false);assert.deepEqual(a.data.stats.achievements,dates);
 value='{bad';fail=false;const b=Save.createStore({storage:()=>storage,lock:fn=>Promise.resolve().then(fn),owner:'b'});await b.claim();assert.ok(b.issue);assert.equal(b.data.round,null);
});
test('invalid round keeps valid history, unsupported versions and storage reads fail safely',async()=>{
 const Save=require('../save.js');const valid={version:1,revision:2,owner:'a',updatedAt:100,lastSettled:null,round:{id:'r',savedAt:100,aim:200,snapshot:{version:999}},stats:{bestScore:256,highest:8,wins:0,achievements:{first:100}}};
 const decoded=Save.decode(JSON.stringify(valid));assert.equal(decoded.data.round,null);assert.equal(decoded.data.stats.bestScore,256);assert.ok(decoded.issue);
 assert.ok(Save.decode(JSON.stringify({...valid,version:99})).issue);
 const store=Save.createStore({owner:'b',storage:()=>{throw Error('blocked');},lock:fn=>Promise.resolve().then(fn)});await store.claim();await store.start('r',make().exportState(),220);assert.equal(store.available,false);assert.equal(store.data.round.id,'r');
});
