(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./core.js'));else root.MergeSave=factory(root.MergeCore);})(typeof globalThis!=='undefined'?globalThis:this,function(Core){
 'use strict';
 const KEY='merge-seu.save.v1',LOCK='merge-seu.save';
 const ACHIEVEMENTS=[
  {id:'first',name:'初次相遇',condition:'首次完成任意合成',test:s=>s.highest>=1},
  {id:'nuaa',name:'飞向南航',condition:'首次合成南京航空航天大学',test:s=>s.highest>=7},
  {id:'nju',name:'抵达南大',condition:'首次合成南京大学',test:s=>s.highest>=9},
  {id:'seu',name:'圆梦东南',condition:'首次合成东南大学',test:s=>s.wins>=1},
  {id:'five',name:'东南常客',condition:'累计通关5次',test:s=>s.wins>=5}
 ];
 const empty=()=>({version:1,revision:0,owner:'',updatedAt:0,round:null,lastSettled:null,stats:{bestScore:0,highest:-1,wins:0,achievements:{}}});
 const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
 const id=s=>typeof s==='string'&&s.length>0&&s.length<200;
 function decode(raw){
  if(raw===null)return {data:empty(),issue:''};
  let d;try{d=JSON.parse(raw);if(d.version!==1||!integer(d.revision)||typeof d.owner!=='string'||!integer(d.updatedAt)||!(d.lastSettled===null||id(d.lastSettled))||!d.stats||!integer(d.stats.bestScore)||!integer(d.stats.wins)||!integer(d.stats.highest,-1)||d.stats.highest>10||!d.stats.achievements||typeof d.stats.achievements!=='object')throw Error();
   for(const [key,date] of Object.entries(d.stats.achievements))if(!ACHIEVEMENTS.some(a=>a.id===key)||!integer(date))throw Error();
  }catch{return {data:empty(),issue:'存档损坏或版本不支持，无法恢复。可以开始新局。'};}
  let issue='';
  if(d.round!==null){try{const r=d.round;if(!r||!id(r.id)||!integer(r.savedAt)||!Number.isFinite(r.aim)||r.aim<0||r.aim>Core.WIDTH)throw Error();Core.validateSnapshot(r.snapshot);if(!['playing','paused'].includes(r.snapshot.state))throw Error();}catch{d.round=null;issue='上次对局存档无效，历史记录已保留。可以开始新局。';}}
  return {data:d,issue};
 }
 function createStore({storage,lock,owner,now=Date.now}){
  let data=empty(),available=typeof lock==='function',issue='',chain=Promise.resolve();
  function read(){if(!available)return;try{const result=decode(storage().getItem(KEY));data=result.data;if(result.issue)issue=result.issue;}catch{available=false;}}
  function write(){data.revision++;data.updatedAt=now();if(available)try{storage().setItem(KEY,JSON.stringify(data));}catch{available=false;}}
  // All read/modify/write work happens under one origin-wide Web Lock.
  function transaction(fn){
   const run=()=>{read();const result=fn();return {data,available,issue,...result};};
   const execute=async()=>{if(!available)return run();let ran=false;try{return await lock(()=>{ran=true;return run();});}catch(e){if(ran)throw e;available=false;return run();}};
   const result=chain.then(execute);chain=result.catch(()=>{});return result;
  }
  return {
   get data(){return data;},get available(){return available;},get issue(){return issue;},
   claim:()=>transaction(()=>{data.owner=owner;write();return {}; }),
   start:(roundId,snapshot,aim)=>transaction(()=>{
    if(data.owner!==owner)return {conflict:true};Core.validateSnapshot(snapshot);
    data.round={id:roundId,snapshot,aim,savedAt:now()};write();return {};
   }),
   save:(roundId,snapshot,aim)=>transaction(()=>{
    if(data.owner!==owner)return {conflict:true};
    if(data.lastSettled===roundId)return {unlocked:[]};
    if(data.round?.id!==roundId)return {conflict:true};
    Core.validateSnapshot(snapshot);const s=data.stats;
    s.bestScore=Math.max(s.bestScore,snapshot.score);if(snapshot.highest>0)s.highest=Math.max(s.highest,snapshot.highest);
    if(snapshot.state==='won')s.wins++;
    const unlocked=[];for(const a of ACHIEVEMENTS)if(!Object.hasOwn(s.achievements,a.id)&&a.test(s)){s.achievements[a.id]=now();unlocked.push(a.name);}
    if(['won','lost'].includes(snapshot.state)){data.round=null;data.lastSettled=roundId;}else data.round={id:roundId,snapshot,aim,savedAt:now()};
    write();return {unlocked};
   })
  };
 }
 return {KEY,LOCK,ACHIEVEMENTS,createStore,decode};
});
