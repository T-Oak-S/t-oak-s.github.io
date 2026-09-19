/* UI uses the same simulation as the automated physics tests. */
(()=>{
 'use strict';
 if(!window.GameBoot||!GameBoot.check())return;
 if(!window.MergeCore||!window.MergeSave||!window.Matter||!window.BADGE_ASSETS){GameBoot.fail('resource','脚本或校徽清单');return;}
 const {SCHOOLS,WIDTH,HEIGHT,LINE,createGame}=MergeCore;
 const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d');
 const images=new Map(),sources=window.BADGE_ASSETS||{},particles=[];
 let game=null,ready=false,aim=WIDTH/2,activePointer=null,lastFrame=0,accumulator=0,modalKind='',returnToPlaying=false,lastState='',loadingAttempt=0;
 const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
 const owner=uid(),store=MergeSave.createStore({owner,storage:()=>window.localStorage,lock:navigator.locks?.request?fn=>navigator.locks.request(MergeSave.LOCK,fn):null});
 let roundId=null,owns=false,switching=false,saveQueued=false,toastTimer,dialogRevision=0;
 function saveStatus(){
  $('save-status').textContent=!store.available?'当前环境无法保存进度':!owns?'对局已在其他页面打开':store.data.round?'已保存 '+new Date(store.data.round.savedAt).toLocaleTimeString('zh-CN',{hour12:false}):'记录已保存';
 }
 function takenOver(){
  if(!ready)return;owns=false;activePointer=null;game.pause();saveStatus();
  showDialog('takeover','<h2>已在其他页面打开</h2><p>本页已暂停，避免覆盖最新进度。</p><div class="dialog-actions"><button id="read-latest" class="primary-button">读取最新对局</button></div>',{closable:false});
  $('read-latest').onclick=offerSaved;
 }
 async function saveNow(){
  if(!ready||!owns||switching||!roundId)return;
  try{const result=await store.save(roundId,game.exportState(),aim);if(result.conflict){takenOver();return;}saveStatus();
   if(result.unlocked?.length){clearTimeout(toastTimer);$('achievement-toast').textContent='成就解锁：'+result.unlocked.join(' · ');$('achievement-toast').hidden=false;toastTimer=setTimeout(()=>$('achievement-toast').hidden=true,4500);}
  }catch{$('save-status').textContent='当前环境无法保存进度';}
 }
 function scheduleSave(){if(saveQueued||switching||!owns||!roundId)return;saveQueued=true;Promise.resolve().then(()=>{saveQueued=false;saveNow();});}
 function savedDetails(r){return `<p>上次得分 <strong>${r.snapshot.score.toLocaleString('zh-CN')}</strong><br>最高合成：${r.snapshot.highest?SCHOOLS[r.snapshot.highest].name:'尚未合成'}<br>保存于 ${new Date(r.savedAt).toLocaleString('zh-CN')}</p>`;}
 async function offerSaved(){
  if(switching)return;switching=true;owns=false;roundId=null;game.pause();activePointer=null;
  try{await store.claim();owns=true;const r=store.data.round;saveStatus();
   if(r){game.restoreState(r.snapshot);aim=r.aim;showDialog('restore','<h2>继续上次挑战？</h2>'+savedDetails(r)+'<div class="dialog-actions"><button id="continue-saved" class="primary-button">继续上局</button><button id="new-saved" class="secondary-button">开始新局</button></div>',{closable:false});$('continue-saved').onclick=continueSaved;$('new-saved').onclick=restart;
   }else if(store.issue){showDialog('restore',`<h2>无法恢复上局</h2><p>${esc(store.issue)}</p><button id="new-saved" class="primary-button">开始新局</button>`,{closable:false});$('new-saved').onclick=restart;
   }else{switching=false;await restart();}
  }finally{switching=false;}
 }
 async function continueSaved(){
  if(switching)return;switching=true;owns=false;
  try{await store.claim();owns=true;const r=store.data.round;
   if(!r){switching=false;await offerSaved();return;}
   roundId=r.id;game.restoreState(r.snapshot);aim=r.aim;switching=false;resume();saveStatus();
  }finally{switching=false;}
 }
 async function showRecords(){
  returnToPlaying=game.state==='playing';game.pause();activePointer=null;renderRecords();const revision=dialogRevision;
  await saveNow();if(owns&&modalKind==='records'&&dialogRevision===revision)renderRecords();
 }
 function renderRecords(){
  const s=store.data.stats;
  showDialog('records',`<h2>本机记录</h2><dl class="record-stats"><div><dt>最高分</dt><dd>${s.bestScore.toLocaleString('zh-CN')}</dd></div><div><dt>最高合成学校</dt><dd>${s.highest<0?'尚未合成':SCHOOLS[s.highest].name}</dd></div><div><dt>累计通关</dt><dd>${s.wins} 次</dd></div></dl><h3>我的成就</h3><ul class="achievement-list">${MergeSave.ACHIEVEMENTS.map(a=>`<li class="${Object.hasOwn(s.achievements,a.id)?'unlocked':''}"><strong>${a.name}</strong><span>${Object.hasOwn(s.achievements,a.id)?'已解锁 · '+new Date(s.achievements[a.id]).toLocaleDateString('zh-CN'):a.condition}</span></li>`).join('')}</ul><p class="storage-note">${store.available?'记录仅保存在当前浏览器；清理浏览器数据会丢失记录。在线版与单文件版不共享存档。':'当前环境无法保存进度，记录仅在本次打开期间保留。'}</p>`);
 }
 window.addEventListener('storage',e=>{if(e.key===MergeSave.KEY&&owns){try{if(!e.newValue||JSON.parse(e.newValue).owner!==owner)takenOver();}catch{takenOver();}}});
 setInterval(()=>{if(game?.state==='playing')saveNow();},1000);
 window.addEventListener('pagehide',()=>{if(game?.state==='playing')game.pause();saveNow();});
 window.MergeAppStarted=true;
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function badge(c,level,x,y,r,angle=0){
  const school=SCHOOLS[level],im=images.get(school.id);c.save();c.translate(x,y);c.rotate(angle);
  c.shadowColor='#24473518';c.shadowBlur=4;c.shadowOffsetY=2;c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.fillStyle='#fffefb';c.fill();c.shadowColor='transparent';
  c.lineWidth=Math.max(1.4,r*.035);c.strokeStyle=school.color;c.stroke();
  if(im){const rect=sources[school.id]?.rect||[0,0,im.naturalWidth,im.naturalHeight];const size=r*(['njtech','njupt','nju'].includes(school.id)?1.4:1.75),scale=size/Math.max(rect[2],rect[3]),w=rect[2]*scale,h=rect[3]*scale;c.beginPath();c.arc(0,0,r-1.5,0,Math.PI*2);c.clip();c.drawImage(im,...rect,-w/2,-h/2,w,h);}
  c.restore();
 }
 function badgeElement(el,level){const c=el.getContext('2d'),w=el.width,h=el.height;c.clearRect(0,0,w,h);badge(c,level,w/2,h/2,Math.min(w,h)*.455);el.setAttribute('aria-label',SCHOOLS[level].name+'校徽');}
 function fillBadges(root=document){root.querySelectorAll('canvas[data-school]').forEach(el=>badgeElement(el,Number(el.dataset.school)));}
 function listMarkup(){return SCHOOLS.map((s,i)=>`<li class="school-row ${i===10?'final':''} ${game&&i<=game.highest?'reached':''}" data-level="${i}"><span class="school-number">${String(i+1).padStart(2,'0')}</span><canvas data-school="${i}" width="96" height="96" role="img" aria-label="${esc(s.name)}校徽"></canvas><span class="school-name">${esc(s.name)}</span>${i===10?'<span class="level-tag">终点</span>':''}</li>`).join('');}
 $('school-list').innerHTML=listMarkup();
 function sync(){
  if(!game)return;
  if(ready)scheduleSave();
  $('score').textContent=game.score.toLocaleString('zh-CN');$('next-name').textContent=SCHOOLS[game.next].name;badgeElement($('next-badge'),game.next);
  $('status-label').textContent=({playing:'合成进行中',paused:'已暂停',won:'挑战成功',lost:'本局结束'})[game.state];
  $('progress-label').textContent=game.highest?'已合成：'+SCHOOLS[game.highest].short:'目标：东南大学';
  $('pause').disabled=!ready||['won','lost'].includes(game.state);$('restart').disabled=!ready;
  $('pause').innerHTML=game.state==='paused'?'<span aria-hidden="true">▷</span><span>继续</span>':'<span aria-hidden="true">Ⅱ</span><span>暂停</span>';
  document.querySelectorAll('#school-list .school-row').forEach(el=>el.classList.toggle('reached',Number(el.dataset.level)<=game.highest));
  $('first-hint').hidden=!ready||game.bodies.size>0||game.state!=='playing';
  if(game.state!==lastState){lastState=game.state;if(game.state==='won'||game.state==='lost')showResult();}
 }
 function showDialog(kind,html,{closable=true}={}){
  dialogRevision++;modalKind=kind;$('modal-content').innerHTML=html;$('close-modal').hidden=!closable;
  if(!$('modal').open)$('modal').showModal();fillBadges($('modal'));
 }
 function closeDialog(){dialogRevision++;if($('modal').open)$('modal').close();modalKind='';}
 function resume(){if(!owns){offerSaved();return;}closeDialog();activePointer=null;accumulator=0;lastFrame=performance.now();game?.resume();}
 function pause(reason='稍作休息，再接再厉'){
  if(!ready||!game||game.state!=='playing')return;
  activePointer=null;game.pause();showDialog('pause',`<p class="dialog-eyebrow">TAKE A BREAK</p><h2>游戏已暂停</h2><p>${reason}</p><div class="dialog-actions"><button class="primary-button" id="resume-game">继续游戏</button></div>`);$('resume-game').onclick=resume;
 }
 async function restart(){
  if(switching)return;const pending=saveNow();switching=true;game.pause();await pending;if(!owns){switching=false;await offerSaved();return;}
  try{closeDialog();particles.length=0;activePointer=null;lastState='';game.restart();game.pause();aim=WIDTH/2;roundId=uid();
   const result=await store.start(roundId,game.exportState(),aim);if(result.conflict){takenOver();return;}
   accumulator=0;lastFrame=performance.now();$('feedback').textContent='相同校徽碰在一起，就能合成下一级';switching=false;game.resume();saveStatus();sync();
  }finally{switching=false;}
 }
 function requestRestart(){
  if(!ready)return;
  if(game.bodies.size===0||['won','lost'].includes(game.state)){restart();return;}
  returnToPlaying=game.state==='playing';game.pause();activePointer=null;
  showDialog('restart','<h2>重新开始？</h2><p>本局进度和得分将清零。</p><div class="dialog-actions"><button class="primary-button" id="confirm-restart">重新开始</button><button class="secondary-button" id="cancel-restart">保留本局</button></div>');
  $('confirm-restart').onclick=restart;$('cancel-restart').onclick=dismiss;
 }
 function celebrate(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;for(let i=0;i<35;i++){const e=document.createElement('i');e.className='confetti';e.style.left=Math.random()*100+'vw';e.style.background=['#c39a53','#255f4c','#b4c4a3','#fffdf4'][i%4];e.style.animationDelay=Math.random()*.8+'s';e.style.setProperty('--drift',(Math.random()-.5)*280+'px');document.body.append(e);setTimeout(()=>e.remove(),4000);}}
 function showResult(){
  activePointer=null;const won=game.state==='won';
  showDialog('result',`<p class="dialog-eyebrow">${won?'CHALLENGE COMPLETE':'NICE TRY'}</p>${won?'<canvas class="dialog-badge" data-school="10" width="280" height="280" role="img" aria-label="东南大学校徽"></canvas>':''}<h2>${won?'东南大学，合成成功！':'差一点，就到下一站'}</h2><p>${won?'从第一枚校徽，到这一次圆满。':'校徽越过警戒线，下局再接再厉。'}</p><span class="label">本局得分</span><div class="result-score">${game.score.toLocaleString('zh-CN')}</div><div class="dialog-actions"><button class="primary-button" id="play-again">再玩一次</button></div>`,{closable:false});
  $('play-again').onclick=restart;if(won)celebrate();
 }
 function showGuide(){
  returnToPlaying=game?.state==='playing';game?.pause();activePointer=null;
  showDialog('guide',`<h2>合成图鉴</h2><p>两个相同校徽，合成下一级</p><ol class="modal-list">${listMarkup()}</ol><p class="ranking-note">前九级参考 2026 软科中国大学排名主榜。<br>南大 → 东大为本游戏趣味设定。</p>`);
 }
 function dismiss(){
  if(['result','restore','takeover'].includes(modalKind))return;
  if(modalKind==='pause'){resume();return;}
  const shouldResume=returnToPlaying;closeDialog();if(shouldResume)resume();else if(game?.state==='paused'){showDialog('pause','<h2>游戏已暂停</h2><div class="dialog-actions"><button class="primary-button" id="resume-game">继续游戏</button></div>');$('resume-game').onclick=resume;}
 }
 $('pause').onclick=()=>game?.state==='paused'?resume():pause();$('restart').onclick=requestRestart;$('guide').onclick=showGuide;$('records').onclick=showRecords;$('close-modal').onclick=dismiss;
 $('modal').addEventListener('cancel',e=>{e.preventDefault();dismiss();});
 function aimAt(clientX){const rect=canvas.getBoundingClientRect();aim=Math.max(12+SCHOOLS[game?.current||0].radius,Math.min(WIDTH-12-SCHOOLS[game?.current||0].radius,(clientX-rect.left)/rect.width*WIDTH));}
 function drop(){if(!ready||$('modal').open)return false;const dropped=game.drop(aim);if(dropped){$('first-hint').hidden=true;canvas.focus({preventScroll:true});}return dropped;}
 canvas.addEventListener('pointermove',e=>{if(!ready||game.state!=='playing')return;if(e.pointerType==='mouse'||e.pointerId===activePointer)aimAt(e.clientX);});
 canvas.addEventListener('pointerdown',e=>{if(!ready||game.state!=='playing'||activePointer!==null||!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0))return;e.preventDefault();activePointer=e.pointerId;aimAt(e.clientX);canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointerup',e=>{if(e.pointerId!==activePointer)return;aimAt(e.clientX);activePointer=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);drop();});
 canvas.addEventListener('pointercancel',()=>activePointer=null);canvas.addEventListener('lostpointercapture',()=>activePointer=null);
 canvas.addEventListener('keydown',e=>{if(!ready||game.state!=='playing')return;if(['ArrowLeft','ArrowRight',' ','Enter'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')aim=Math.max(SCHOOLS[game.current].radius+12,aim-15);else if(e.key==='ArrowRight')aim=Math.min(WIDTH-SCHOOLS[game.current].radius-12,aim+15);else if(!e.repeat)drop();}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)return;activePointer=null;if(game?.state==='playing')pause('返回游戏后，点击继续。');else if(game?.state==='paused')returnToPlaying=false;saveNow();});
 function draw(){
  ctx.setTransform(canvas.width/WIDTH,0,0,canvas.height/HEIGHT,0,0);ctx.clearRect(0,0,WIDTH,HEIGHT);
  ctx.fillStyle='#e9ede2';for(let x=30;x<WIDTH;x+=25)for(let y=140;y<HEIGHT-20;y+=25){ctx.beginPath();ctx.arc(x,y,.65,0,7);ctx.fill();}
  ctx.strokeStyle='#dce3d3';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(10,LINE+17);ctx.lineTo(10,HEIGHT-24);ctx.quadraticCurveTo(10,HEIGHT-10,24,HEIGHT-10);ctx.lineTo(WIDTH-24,HEIGHT-10);ctx.quadraticCurveTo(WIDTH-10,HEIGHT-10,WIDTH-10,HEIGHT-24);ctx.lineTo(WIDTH-10,LINE+17);ctx.stroke();
  ctx.save();ctx.setLineDash([5,7]);ctx.strokeStyle=game?.danger>0?'#c07156':'#d3b9a0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(15,LINE);ctx.lineTo(WIDTH-15,LINE);ctx.stroke();ctx.restore();
  $('board').classList.toggle('is-danger',game?.danger>0&&game.state==='playing');
  ctx.fillStyle=game?.danger>0?'#b96042':'#baa990';ctx.font='11px "Microsoft YaHei", sans-serif';ctx.textAlign='right';ctx.fillText(game?.danger>0?`已越线 · 剩余 ${Math.max(0,(2000-game.danger)/1000).toFixed(1)}秒`:'警戒线',WIDTH-20,LINE-8);
  if(game){for(const b of game.bodies.values())badge(ctx,b.plugin.level,b.position.x,b.position.y,b.circleRadius,b.angle);
   if(ready&&game.state==='playing'){
    const r=SCHOOLS[game.current].radius;aim=Math.max(r+12,Math.min(WIDTH-r-12,aim));
    ctx.save();ctx.setLineDash([3,6]);ctx.lineWidth=1;ctx.strokeStyle='#bdcbb5';ctx.beginPath();ctx.moveTo(aim,54+r+8);ctx.lineTo(aim,HEIGHT-18);ctx.stroke();ctx.restore();badge(ctx,game.current,aim,54,r);
    ctx.fillStyle='#749078';ctx.textAlign='center';ctx.font='11px "Microsoft YaHei", sans-serif';ctx.fillText(SCHOOLS[game.current].short,aim,54-r-11);
   }
  }
  for(const p of particles){ctx.save();ctx.globalAlpha=Math.max(0,p.life/40);if(p.text){ctx.font='bold 18px sans-serif';ctx.textAlign='center';ctx.fillStyle=varGreen;ctx.fillText(p.text,p.x,p.y);}else{ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,7);ctx.fill();}ctx.restore();}
 }
 const varGreen='#174e40';
 function frame(now){
  if(!lastFrame)lastFrame=now;const delta=Math.min(80,now-lastFrame);lastFrame=now;
  if(ready&&game?.state==='playing'){accumulator+=delta;while(accumulator>=1000/60){game.step(1000/60);accumulator-=1000/60;if(game.state!=='playing'){accumulator=0;break;}}}else accumulator=0;
  if(game?.state!=='paused')for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=delta/16.67;p.x+=p.vx*delta/16.67;p.y+=p.vy*delta/16.67;if(p.life<=0)particles.splice(i,1);}
  draw();requestAnimationFrame(frame);
 }
 function onMerge(e){
  $('feedback').textContent=`合成 ${SCHOOLS[e.level].name} ＋${e.points}`;
  particles.push({x:e.x,y:e.y-20,vx:0,vy:-1.2,life:40,text:'+'+e.points});
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)for(let i=0;i<10;i++){const a=i*Math.PI/5;particles.push({x:e.x,y:e.y,vx:Math.cos(a)*2,vy:Math.sin(a)*2,size:2+Math.random()*2,life:28,color:SCHOOLS[e.level].color});}
 }
 async function load(){
  const attempt=++loadingAttempt;let loaded=0,failed=false;ready=false;GameBoot.begin();$('retry').hidden=true;$('loading').hidden=false;$('loading-text').textContent='正在准备校徽 · 0 / 11';$('loading').querySelector('.loader').hidden=false;
  try{
   await Promise.all(SCHOOLS.map(s=>new Promise((resolve,reject)=>{const im=new Image(),timeout=setTimeout(()=>reject(new Error(s.name)),15000);im.onload=()=>{clearTimeout(timeout);if(attempt!==loadingAttempt)return resolve();images.set(s.id,im);loaded++;if(!failed)$('loading-text').textContent=`正在准备校徽 · ${loaded} / ${SCHOOLS.length}`;resolve();};im.onerror=()=>{clearTimeout(timeout);reject(new Error(s.name));};im.src=sources[s.id]?.src||`assets/${s.id}.png`;})));
   if(attempt!==loadingAttempt)return;fillBadges();
   game=createGame(Matter,{onChange:sync,onMerge});game.pause();ready=true;$('records').disabled=false;$('loading').hidden=true;sync();await offerSaved();GameBoot.ready();
   if(document.hidden)pause('返回游戏后，点击继续。');
  }catch(e){failed=true;if(attempt!==loadingAttempt)return;GameBoot.fail('resource',e.message);$('retry').onclick=load;}
 }
 $('retry').onclick=load;requestAnimationFrame(frame);load();
 // Optional WebMCP: the same drop action and state as the visible game.
 const context=document.modelContext;
 if(context?.registerTool){
  const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  const register=t=>{try{Promise.resolve(context.registerTool(t,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
  register({name:'read_merge_game',description:'读取校徽合成游戏的本局分数、状态、下一个校徽与当前棋子位置。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({ready,state:game?.state,score:game?.score,current:game?SCHOOLS[game.current].name:null,next:game?SCHOOLS[game.next].name:null,pieces:game?[...game.bodies.values()].map(b=>({school:SCHOOLS[b.plugin.level].name,x:b.position.x,y:b.position.y})):[]})});
  register({name:'drop_school_badge',description:'在指定横向位置投放当前校徽；x范围0到440。只在进行中的游戏内生效。',inputSchema:{type:'object',properties:{x:{type:'number',minimum:0,maximum:440}},required:['x'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!input||typeof input.x!=='number'||!Number.isFinite(input.x)||input.x<0||input.x>440)throw new Error('x必须在0到440之间');if(!ready||game.state!=='playing'||$('modal').open)throw new Error('游戏尚未就绪或已暂停/结束');aim=input.x;if(!drop())throw new Error('请等待当前投放间隔结束');return {dropped:true,score:game.score,next:SCHOOLS[game.next].name};}});
 }
})();
