(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MergeCore=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const WIDTH=440,HEIGHT=620,LINE=116;
 const SCHOOLS=[
  ['nuist','南京信息工程大学','南信大',18,'#426c9c',98],
  ['njfu','南京林业大学','南林',23,'#4b8063',93],
  ['njtech','南京工业大学','南工',29,'#a55352',88],
  ['njupt','南京邮电大学','南邮',35,'#357f9e',82],
  ['hhu','河海大学','河海',42,'#3f679e',63],
  ['njnu','南京师范大学','南师',49,'#bd5a55',58],
  ['njau','南京农业大学','南农',57,'#73924e',55],
  ['nuaa','南京航空航天大学','南航',65,'#4379ae',37],
  ['njust','南京理工大学','南理工',74,'#776591',36],
  ['nju','南京大学','南大',84,'#836195',null],
  ['seu','东南大学','东大',98,'#185746',null]
 ].map(([id,name,short,radius,color,rank])=>({id,name,short,radius,color,rank}));
 function validateSnapshot(s){
  const num=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
  const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
  if(!s||s.version!==1||!['playing','paused','won','lost'].includes(s.state)||!int(s.score,0,Number.MAX_SAFE_INTEGER)||!int(s.highest,0,10)||!int(s.current,0,4)||!int(s.next,0,4)||!num(s.time,0,1e12)||!num(s.lastDrop,-1000,s.time)||!num(s.danger,0,2100)||!Array.isArray(s.pieces)||s.pieces.length>2000)throw new Error('无效的对局存档');
  for(const p of s.pieces){
   if(!p||!int(p.level,0,10)||!num(p.x,-WIDTH,WIDTH*2)||!num(p.y,-HEIGHT*3,HEIGHT*2)||!num(p.vx,-1e4,1e4)||!num(p.vy,-1e4,1e4)||!num(p.angle,-1e10,1e10)||!num(p.angularVelocity,-1e4,1e4)||!num(p.deltaTime,.001,1000)||!num(p.born,0,s.time)||typeof p.entered!=='boolean'||!(p.overSince===null||num(p.overSince,0,s.time)))throw new Error('无效的校徽存档');
  }
  return s;
 }
 function createGame(M,options={}){
  const rng=options.rng||Math.random,notify=()=>options.onChange?.(g);
  const g={engine:null,bodies:new Map(),state:'playing',score:0,time:0,danger:0,current:0,next:0,lastDrop:-1000,highest:0,drop,spawn,step,pause,resume,restart,exportState,restoreState};
  let queue=[];
  function randomLevel(){return Math.min(4,Math.max(0,Math.floor(rng()*5)));}
  function restart(){
   if(g.engine){M.Events.off(g.engine);M.Composite.clear(g.engine.world,false);M.Engine.clear(g.engine);}
   g.engine=M.Engine.create({positionIterations:8,velocityIterations:8,enableSleeping:false});
   g.engine.gravity.y=1.15;
   M.Composite.add(g.engine.world,[M.Bodies.rectangle(-15,HEIGHT/2,50,HEIGHT*3,{isStatic:true}),M.Bodies.rectangle(WIDTH+15,HEIGHT/2,50,HEIGHT*3,{isStatic:true}),M.Bodies.rectangle(WIDTH/2,HEIGHT+15,WIDTH+100,50,{isStatic:true})]);
   g.bodies.clear();queue=[];g.state='playing';g.score=0;g.time=0;g.danger=0;g.lastDrop=-1000;g.highest=0;g.current=randomLevel();g.next=randomLevel();
   // Queue collisions, then change the world after Engine.update has finished.
   const collect=e=>{for(const p of e.pairs){const a=p.bodyA,b=p.bodyB;if(g.bodies.has(a.id)&&g.bodies.has(b.id)&&a.plugin.level===b.plugin.level&&a.plugin.level<10)queue.push([a,b]);}};
   M.Events.on(g.engine,'collisionStart collisionActive',collect);notify();
  }
  function spawn(level,x,y,meta={}){
   if(!Number.isInteger(level)||level<0||level>=SCHOOLS.length)throw new RangeError('Invalid school');
   const r=SCHOOLS[level].radius;
   const body=M.Bodies.circle(Math.max(r+12,Math.min(WIDTH-r-12,x)),y,r,{restitution:.16,friction:.35,frictionStatic:.7,frictionAir:.006,density:.0015,slop:.04});
   body.plugin={level,born:g.time,entered:false,overSince:null,...meta};
   g.bodies.set(body.id,body);M.Composite.add(g.engine.world,body);return body;
  }
  function drop(x){
   if(g.state!=='playing'||!Number.isFinite(x)||g.time-g.lastDrop<420)return false;
   spawn(g.current,x,54);g.lastDrop=g.time;g.current=g.next;g.next=randomLevel();notify();return true;
  }
  function mergePending(){
   const used=new Set();
   for(const [a,b] of queue){
    if(g.state!=='playing')break;
    if(used.has(a.id)||used.has(b.id)||!g.bodies.has(a.id)||!g.bodies.has(b.id))continue;
    used.add(a.id);used.add(b.id);
    const level=a.plugin.level+1,x=(a.position.x+b.position.x)/2,y=Math.min(HEIGHT-SCHOOLS[level].radius-11,(a.position.y+b.position.y)/2);
    const overTimes=[a.plugin.overSince,b.plugin.overSince].filter(t=>t!==null);
    M.Composite.remove(g.engine.world,[a,b]);g.bodies.delete(a.id);g.bodies.delete(b.id);
    const child=spawn(level,x,y,{entered:a.plugin.entered||b.plugin.entered,overSince:overTimes.length?Math.min(...overTimes):null});
    M.Body.setVelocity(child,{x:Math.max(-3,Math.min(3,(a.velocity.x+b.velocity.x)/2)),y:Math.min(0,(a.velocity.y+b.velocity.y)/2)});
    g.score+=2**level;g.highest=Math.max(g.highest,level);
    if(level===10)g.state='won';
    options.onMerge?.({level,x:child.position.x,y:child.position.y,points:2**level});notify();
   }
   queue=[];
  }
  function step(delta){
   if(g.state!=='playing')return;
   const dt=Math.min(1000/60,Math.max(0,delta));if(!dt)return;g.time+=dt;
   M.Engine.update(g.engine,dt);mergePending();if(g.state!=='playing')return;
   g.danger=0;
   for(const b of g.bodies.values()){
    const top=b.position.y-b.circleRadius,p=b.plugin;
    if(top>LINE)p.entered=true;
    const eligible=p.entered||p.overSince!==null||g.time-p.born>=1500;
    if(eligible&&top<LINE){
     if(p.overSince===null)p.overSince=g.time;
     g.danger=Math.max(g.danger,g.time-p.overSince);
     if(g.danger>=2000){g.state='lost';notify();break;}
    }else p.overSince=null;
   }
  }
  function pause(){if(g.state==='playing'){g.state='paused';notify();}}
  function resume(){if(g.state==='paused'){g.state='playing';notify();}}
  function exportState(){
   return {version:1,state:g.state,score:g.score,time:g.time,danger:g.danger,current:g.current,next:g.next,lastDrop:g.lastDrop,highest:g.highest,pieces:[...g.bodies.values()].map(b=>({level:b.plugin.level,x:b.position.x,y:b.position.y,vx:M.Body.getVelocity(b).x,vy:M.Body.getVelocity(b).y,angle:b.angle,angularVelocity:M.Body.getAngularVelocity(b),deltaTime:b.deltaTime,born:b.plugin.born,entered:b.plugin.entered,overSince:b.plugin.overSince}))};
  }
  function restoreState(snapshot){
   const s=validateSnapshot(snapshot);
   if(!['playing','paused'].includes(s.state))throw new Error('已结束对局不能恢复');
   restart();
   for(const key of ['score','time','danger','current','next','lastDrop','highest'])g[key]=s[key];
   g.engine.timing.timestamp=s.time;
   for(const p of s.pieces){const b=spawn(p.level,p.x,p.y,{born:p.born,entered:p.entered,overSince:p.overSince});M.Body.setPosition(b,{x:p.x,y:p.y});M.Body.setAngle(b,p.angle);b.deltaTime=p.deltaTime;M.Body.setVelocity(b,{x:p.vx,y:p.vy});M.Body.setAngularVelocity(b,p.angularVelocity);}
   g.state='paused';queue=[];notify();return g;
  }
  restart();return g;
 }
 return {createGame,SCHOOLS,WIDTH,HEIGHT,LINE,validateSnapshot};
});
