const {test}=require('node:test');
const assert=require('node:assert/strict');
const Matter=require('../assets/matter.min.js');
const Core=require('../core.js');
const make=()=>Core.createGame(Matter,{rng:()=>0});
test('engine exposes a playable game',()=>{assert.equal(make()?.state,'playing');});
for(let level=0;level<10;level++) test(`collision merges level ${level+1} exactly once`,()=>{
 const g=make(),r=Core.SCHOOLS[level].radius;
 g.spawn(level,220-r+1,430);g.spawn(level,220+r-1,430);
 g.step(1000/60);
 assert.equal(g.bodies.size,1);assert.equal([...g.bodies.values()][0].plugin.level,level+1);
 assert.equal(g.score,2**(level+1));assert.equal(g.state,level===9?'won':'playing');
});
test('different schools do not merge',()=>{const g=make();g.spawn(0,200,450);g.spawn(1,232,450);g.step(16);assert.equal(g.bodies.size,2);assert.equal(g.score,0);});
test('three touching equal bodies consume each body at most once',()=>{const g=make();[190,220,250].forEach(x=>g.spawn(0,x,450));g.step(16);assert.equal(g.bodies.size,2);assert.equal(g.score,2);});
test('win stops drops and physics, restart clears the whole round',()=>{const g=make();g.spawn(9,140,460);g.spawn(9,300,460);g.step(16);assert.equal(g.state,'won');const t=g.time;assert.equal(g.drop(220),false);g.step(500);assert.equal(g.time,t);g.restart();assert.equal(g.state,'playing');assert.equal(g.score,0);assert.equal(g.bodies.size,0);});
test('pause freezes simulation and drop; resume restores play',()=>{const g=make();g.drop(200);g.pause();const t=g.time;g.step(100);assert.equal(g.time,t);assert.equal(g.drop(200),false);g.resume();g.step(16);assert.ok(g.time>t);});
test('new arrival gets grace, then two continuous seconds above the line loses',()=>{const g=make();const b=g.spawn(0,220,60);Matter.Body.setStatic(b,true);for(let i=0;i<180;i++)g.step(1000/60);assert.equal(g.state,'playing');for(let i=0;i<40;i++)g.step(1000/60);assert.equal(g.state,'lost');});
test('returning below danger line resets the countdown',()=>{const g=make();const b=g.spawn(0,220,160);Matter.Body.setStatic(b,true);g.step(16);Matter.Body.setPosition(b,{x:220,y:100});for(let i=0;i<100;i++)g.step(16);assert.ok(g.danger>0);Matter.Body.setPosition(b,{x:220,y:180});g.step(16);assert.equal(g.danger,0);assert.equal(g.state,'playing');});
test('drop clamps position, limits rapid taps and only spawns first five schools',()=>{const g=make();assert.equal(g.drop(-200),true);assert.equal(g.drop(900),false);const b=[...g.bodies.values()][0];assert.ok(b.position.x>=b.circleRadius+12);for(let i=0;i<40;i++)g.step(16);assert.equal(g.drop(900),true);assert.ok([...g.bodies.values()].every(b=>b.plugin.level<5));});
test('merging above line keeps an already active danger countdown',()=>{
 const g=make();g.engine.gravity.y=0;g.spawn(0,160,60);const b=g.spawn(0,260,60);
 for(let i=0;i<200;i++)g.step(16);const before=g.danger;assert.ok(before>1600);
 Matter.Body.setPosition(b,{x:190,y:60});g.step(16);assert.equal(g.bodies.size,1);assert.ok(g.danger>=before,'merge must not grant a second entry grace period');
 for(let i=0;i<30;i++)g.step(16);assert.equal(g.state,'lost');
});
