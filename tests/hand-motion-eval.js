(async()=>{
 const r=ORBIT_STAGE.raidenRig,S=r.config.worldUnitsPerMeter,T=r.THREE;
 const segment=(p1,q1,p2,q2)=>r.fingerSegmentDistance(p1,q1,p2,q2);
 const songs=[];
 for(const song of ['genshin','cornfield']){
  if(song==='cornfield'){restoreCornfield();ORBIT_STAGE.state.external=true;}
  const notes=ORBIT_STAGE.notes,assigned=notes.filter(n=>n.finger&&n.hand),times=[...new Set([0,5.878125,53.15784375,77.3953125,...notes.map(n=>+(n.time+.035).toFixed(5)),...Array.from({length:Math.floor(DATA.duration)},(_,i)=>i+.5)])].sort((a,b)=>a-b);
  const result={song,notes:notes.length,unassigned:notes.length-assigned.length,samples:times.length,sameHandGapMM:Infinity,betweenHandGapMM:Infinity,minSkinClearanceMM:Infinity,maxContactErrorMM:0,meanErrorMM:0,contactSamples:0,orderViolations:0,handInversions:0,worst:[],maxBoneStretch:0,ms:[],transitionMaxDegrees:0};
  for(const n of assigned){const held=assigned.filter(a=>a!==n&&a.time<=n.time&&a.keyEnd>n.time);for(const a of held){if(n.hand===a.hand&&(n.hand==='L'?-1:1)*(n.midi-a.midi)*(n.finger-a.finger)<0)result.orderViolations++;if(n.hand==='L'&&a.hand==='R'&&n.midi>a.midi)result.handInversions++;}}
  ORBIT_STAGE.renderAt(0,'hands');
  for(const hand of Object.values(r.pianoHands)){
   for(const f of hand.fingers)f.points=f.bones.map(b=>r.world(b));
   for(let i=0;i<5;i++){
    const f=hand.fingers[i],q=f.angles.slice(),all=r.pianoHandCost(hand),part=r.pianoHandCost(hand,i),next=q.slice();next[0]+=.001;
    r.applyPianoFinger(f,next);
    if(Math.abs((r.pianoHandCost(hand)-all)-(r.pianoHandCost(hand,i)-part))>1e-8)throw Error('Incremental collision objective differs from full objective');
    r.applyPianoFinger(f,q);
   }
  }
  const lengths={};
  for(const t of times){const start=performance.now();ORBIT_STAGE.renderAt(t,'hands');result.ms.push(performance.now()-start);
   const points={};for(const h of ['L','R']){const hand=r.pianoHands[h];points[h]=hand.fingers.map(f=>f.bones.map(b=>r.world(b)));for(let f=0;f<5;f++)for(let j=0;j<3;j++){const len=points[h][f][j].distanceTo(points[h][f][j+1]),id=h+f+j;if(lengths[id]==null)lengths[id]=len;result.maxBoneStretch=Math.max(result.maxBoneStretch,Math.abs(len-lengths[id]));}}
   for(const h of r.handPoseAudit.hands)result.sameHandGapMM=Math.min(result.sameHandGapMM,h.minGapMM);
   result.minSkinClearanceMM=Math.min(result.minSkinClearanceMM,...Object.values(r.handPoseAudit.surfaceClearanceMM));
   for(const l of points.L)for(const rr of points.R)for(let i=0;i<3;i++)for(let j=0;j<3;j++)result.betweenHandGapMM=Math.min(result.betweenHandGapMM,segment(l[i],l[i+1],rr[j],rr[j+1])/S*1000);
   for(const e of r.errors){result.maxContactErrorMM=Math.max(result.maxContactErrorMM,e.errorMM);result.meanErrorMM+=e.errorMM;result.contactSamples++;}
   if(result.worst.length<8&&r.handPoseAudit.surfaceLiftMM.R>10)result.worst.push({t,lift:r.handPoseAudit.surfaceLiftMM});
  }
  result.meanErrorMM/=Math.max(1,result.contactSamples);result.ms.sort((a,b)=>a-b);result.renderP50=result.ms[Math.floor(result.ms.length*.5)];result.renderP95=result.ms[Math.floor(result.ms.length*.95)];delete result.ms;
  for(const t of [5.85,20,53.13,77.37]){let prev=null;for(let j=0;j<24;j++){ORBIT_STAGE.renderAt(t+j/120,'hands');const qs=Object.values(r.pianoHands).flatMap(h=>h.fingers.flatMap(f=>f.bones.slice(0,3).map(b=>b.quaternion.clone())));if(prev)qs.forEach((q,i)=>result.transitionMaxDegrees=Math.max(result.transitionMaxDegrees,q.angleTo(prev[i])*180/Math.PI));prev=qs;}}
  result.seekDifferenceRadians=0;
  for(const n of assigned.slice(20,24)){
   const t=n.time+.012,read=()=>Object.values(r.pianoHands).flatMap(h=>h.fingers.flatMap(f=>f.bones.slice(0,3).map(b=>b.quaternion.clone())));
   r.poseCache.clear();ORBIT_STAGE.renderAt(t-.08,'hands');ORBIT_STAGE.renderAt(t,'hands');const a=read();
   r.poseCache.clear();ORBIT_STAGE.renderAt(t,'hands');read().forEach((q,i)=>result.seekDifferenceRadians=Math.max(result.seekDifferenceRadians,q.angleTo(a[i])));
  }
  songs.push(result);
 }
 const frameTimes=[];r.poseCache.clear();ORBIT_STAGE.renderAt(40,'hands');
 for(let j=1;j<=120;j++){const start=performance.now();ORBIT_STAGE.renderAt(40+j/60,'hands');frameTimes.push(performance.now()-start);}
 frameTimes.sort((a,b)=>a-b);songs.at(-1).continuousCPU={p50:frameTimes[60],p95:frameTimes[114],mean:frameTimes.reduce((a,b)=>a+b)/frameTimes.length};
 let frames=0,start=performance.now();
 await new Promise(resolve=>{function step(now){ORBIT_STAGE.renderAt(45+(now-start)/1000,'hands');frames++;if(now-start<4000)requestAnimationFrame(step);else resolve();}requestAnimationFrame(step);});
 songs.at(-1).animationFPS=frames/((performance.now()-start)/1000);
 return songs;
})()
