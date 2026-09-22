// DOM integration only: real game scripts and physics; drawing/browser APIs are stubs.
// These checks do not replace browser screenshots or physical phone testing.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await tick();}assert.fail('UI did not reach expected state');}
function shared(){return {value:null,windows:[],queue:Promise.resolve(),fail:false};}
async function page(t,db=shared(),options={}){
 const dom=new JSDOM(read('merge.html'),{url:'https://game.test/',runScripts:'outside-only',pretendToBeVisual:true});
 t.after(()=>dom.window.close());const w=dom.window;db.windows.push(w);
 w.PointerEvent=w.MouseEvent;w.matchMedia=()=>({matches:true});w.requestAnimationFrame=()=>1;
 const timers=[];w.setInterval=(fn,ms)=>(timers.push({fn,ms}),timers.length);
 const ctx=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 w.HTMLCanvasElement.prototype.getContext=()=>ctx;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.Image=class{set src(v){this.naturalWidth=100;this.naturalHeight=100;Promise.resolve().then(()=>this.onload?.());}};
 Object.defineProperty(w,'localStorage',{value:{getItem:()=>{if(options.blocked)throw Error('disabled');return db.value;},setItem:(key,v)=>{if(db.fail||options.blocked)throw Error('quota');const oldValue=db.value;db.value=v;for(const other of db.windows)if(other!==w&&other.document)Promise.resolve().then(()=>other.document&&other.dispatchEvent(new other.StorageEvent('storage',{key,newValue:v,oldValue})));}}});
 if(!options.noLocks)Object.defineProperty(w.navigator,'locks',{value:{request:(_,fn)=>{const r=db.queue.then(async()=>{if(db.gate)await db.gate;return fn();});db.queue=r.catch(()=>{});return r;}}});
 w.eval(read('merge.html').match(/<script>([\s\S]*?)<\/script>/)[1]);
 for(const file of ['assets/matter.min.js','core.js','save.js','assets.js'])w.eval(read(file));
 const create=w.MergeCore.createGame;w.MergeCore.createGame=(...args)=>(w.__game=create(...args));
 w.eval(read('app.js'));await until(()=>w.MergeGameReady);await tick();
 return {w,db,timers,el:id=>w.document.getElementById(id),click:id=>w.document.getElementById(id).click(),snapshot:()=>JSON.parse(db.value)};
}
test('reload offers a frozen game, continue restores, records panel and cancel restart preserve state',async t=>{
 const a=await page(t);a.w.__game.drop(160);a.w.__game.step(16);a.click('pause');await until(()=>a.snapshot().round?.snapshot.pieces.length===1);
 const saved=a.snapshot().round,b=await page(t,a.db);
 assert.ok(b.el('continue-saved'));assert.equal(b.w.__game.state,'paused');assert.equal(b.w.__game.time,saved.snapshot.time);assert.match(b.el('modal-content').textContent,/保存于/);
 b.click('continue-saved');await until(()=>b.w.__game.state==='playing');assert.equal(b.w.__game.bodies.size,1);assert.equal(b.w.__game.current,saved.snapshot.current);
 b.click('records');await until(()=>b.el('modal-content').textContent.includes('我的成就'));assert.equal(b.w.__game.state,'paused');b.click('close-modal');assert.equal(b.w.__game.state,'playing');
 b.click('restart');b.click('cancel-restart');assert.equal(b.w.__game.bodies.size,1);assert.equal(b.w.__game.state,'playing');
 b.click('pause');b.click('records');await until(()=>b.el('modal-content').textContent.includes('我的成就'));b.click('close-modal');assert.equal(b.w.__game.state,'paused');
});
test('win is counted once, all records survive a new game and a reload',async t=>{
 const a=await page(t);const g=a.w.__game;g.spawn(9,140,460);g.spawn(9,300,460);g.step(16);
 await until(()=>a.snapshot().stats.wins===1);assert.equal(a.snapshot().round,null);assert.match(a.el('achievement-toast').textContent,/圆梦东南/);
 a.w.dispatchEvent(new a.w.Event('pagehide'));await tick();assert.equal(a.snapshot().stats.wins,1);
 a.click('play-again');await until(()=>a.snapshot().round!==null);assert.equal(a.snapshot().stats.bestScore,1024);assert.equal(a.snapshot().stats.wins,1);
 const b=await page(t,a.db);assert.ok(b.el('continue-saved'));assert.equal(b.snapshot().stats.wins,1);b.click('new-saved');await until(()=>b.w.__game.state==='playing');assert.equal(b.w.__game.score,0);assert.equal(b.snapshot().stats.wins,1);
});
test('takeover stops old writer; reclaim reads latest round before continuing',async t=>{
 const a=await page(t);a.w.__game.drop(150);await until(()=>a.snapshot().round.snapshot.pieces.length===1);
 const b=await page(t,a.db);await until(()=>a.el('read-latest'));assert.equal(a.w.__game.state,'paused');
 b.click('new-saved');await until(()=>b.w.__game.state==='playing');const id=b.snapshot().round.id;
 a.w.dispatchEvent(new a.w.Event('pagehide'));await tick();assert.equal(a.snapshot().round.id,id);
 a.click('read-latest');await until(()=>a.el('continue-saved'));a.click('continue-saved');await until(()=>a.w.__game.state==='playing');assert.equal(a.w.__game.bodies.size,0);assert.equal(a.snapshot().round.id,id);await until(()=>b.el('read-latest'));
});
test('corrupt or disabled storage and missing safe-lock capability leave game playable',async t=>{
 const db=shared();db.value='{bad';const a=await page(t,db);assert.match(a.el('modal-content').textContent,/无法恢复/);a.click('new-saved');await until(()=>a.w.__game.state==='playing');
 for(const options of [{blocked:true},{noLocks:true}]){const b=await page(t,shared(),options);assert.equal(b.w.__game.state,'playing');assert.match(b.el('save-status').textContent,/无法保存/);b.w.__game.drop(200);assert.equal(b.w.__game.bodies.size,1);}
 db.fail=true;a.w.__game.drop(200);await until(()=>a.el('save-status').textContent.includes('无法保存'));assert.equal(a.w.__game.state,'playing');
});
test('records dialog blocks input immediately during delayed storage and does not reopen after dismissal',async t=>{
 const a=await page(t);let release;a.db.gate=new Promise(r=>release=r);
 a.click('records');assert.equal(a.el('modal').open,true);assert.equal(a.w.__game.state,'paused');
 a.click('close-modal');assert.equal(a.w.__game.state,'playing');release();a.db.gate=null;for(let i=0;i<10;i++)await tick();
 assert.equal(a.el('modal').open,false);assert.equal(a.w.__game.state,'playing');
});
test('one-second checkpoint and background event save current motion and pause',async t=>{
 const a=await page(t);a.w.__game.drop(190);await until(()=>a.snapshot().round.snapshot.pieces.length===1);
 for(let i=0;i<15;i++)a.w.__game.step(16);const time=a.w.__game.time;
 const timer=a.timers.find(x=>x.ms===1000);assert.ok(timer);timer.fn();await until(()=>a.snapshot().round.snapshot.time===time);
 a.w.__game.step(16);Object.defineProperty(a.w.document,'hidden',{value:true,configurable:true});a.w.document.dispatchEvent(new a.w.Event('visibilitychange'));
 await until(()=>a.snapshot().round.snapshot.state==='paused');assert.equal(a.w.__game.state,'paused');assert.equal(a.snapshot().round.snapshot.time,a.w.__game.time);
});
test('return home pauses immediately and waits for saved state before navigating',async t=>{
 const a=await page(t);a.el('home-link').href='#home';a.w.__game.drop(180);await until(()=>a.snapshot().round.snapshot.pieces.length===1);
 let release;a.db.gate=new Promise(r=>release=r);a.click('home-link');assert.equal(a.w.__game.state,'paused');assert.equal(a.w.location.hash,'');assert.match(a.el('modal-content').textContent,/保存/);
 release();a.db.gate=null;await until(()=>a.w.location.hash==='#home');assert.equal(a.snapshot().round.snapshot.state,'paused');
 const b=await page(t,a.db);assert.ok(b.el('continue-saved'));assert.equal(b.w.__game.bodies.size,1);
});
test('failed return-home save offers stay or leave instead of silently losing the round',async t=>{
 const a=await page(t,shared(),{blocked:true});a.el('home-link').href='#home';a.w.__game.drop(180);a.click('home-link');await until(()=>a.el('stay-game'));
 assert.equal(a.w.location.hash,'');assert.equal(a.w.__game.state,'paused');a.click('stay-game');assert.equal(a.w.__game.state,'playing');assert.equal(a.w.__game.bodies.size,1);
 a.click('home-link');await until(()=>a.el('leave-anyway'));a.click('leave-anyway');await until(()=>a.w.location.hash==='#home');
});
test('browser back from home reopens the saved-round choice instead of a stuck saving dialog',async t=>{
 const a=await page(t);a.el('home-link').href='#home';a.click('home-link');await until(()=>a.w.location.hash==='#home');
 const event=new a.w.Event('pageshow');Object.defineProperty(event,'persisted',{value:true});a.w.dispatchEvent(event);await until(()=>a.el('continue-saved'));assert.equal(a.w.__game.state,'paused');
});
test('result dialog can return home without starting another round, or keep the result after a failed save',async t=>{
 for(const blocked of [false,true]){
  const a=await page(t,shared(),{blocked});a.el('home-link').href='#home';a.w.__game.spawn(9,140,460);a.w.__game.spawn(9,300,460);a.w.__game.step(16);assert.ok(a.el('result-home'));a.click('result-home');
  if(blocked){await until(()=>a.el('stay-game'));a.click('stay-game');assert.ok(a.el('result-home'));assert.equal(a.w.__game.state,'won');assert.equal(a.el('modal').open,true);}
  else{await until(()=>a.w.location.hash==='#home');assert.equal(a.snapshot().round,null);assert.equal(a.snapshot().stats.wins,1);}
 }
});
