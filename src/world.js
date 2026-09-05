import { DIRECTIONS, ENCOUNTERS, ENEMY_TYPES, FIELD_TOOLS } from './data.js';
import { int, pick, shuffle } from './rng.js';

export const REGIONS = [
  {name:'银纹前厅',code:'Ⅰ',color:'#9caef9',floor:'#30384a',brick:'#465169',edge:'#7d90b0',mortar:'#283247',style:'stone'},
  {name:'苔辉水道',code:'Ⅱ',color:'#91d6b2',floor:'#253d38',brick:'#34594f',edge:'#7dbaa0',mortar:'#213a36',style:'garden'},
  {name:'残星书室',code:'Ⅲ',color:'#d9b7ee',floor:'#393044',brick:'#52415e',edge:'#aa86bf',mortar:'#312637',style:'library'},
  {name:'赭石遗庭',code:'Ⅳ',color:'#e8c38d',floor:'#42372e',brick:'#655442',edge:'#b7a078',mortar:'#3b322d',style:'arches'},
];
export function key(x,y){return `${x},${y}`;}
export function isFloor(d,x,y){return Number.isInteger(x)&&Number.isInteger(y)&&d.tiles[y]?.[x]===0;}
export function paths(d,sx,sy){
  const result={[key(sx,sy)]:0},queue=[{x:sx,y:sy}];
  for(let i=0;i<queue.length;i++)for(const v of DIRECTIONS){
    const x=queue[i].x+v.x,y=queue[i].y+v.y,k=key(x,y);
    if(isFloor(d,x,y)&&result[k]===undefined){result[k]=result[key(queue[i].x,queue[i].y)]+1;queue.push({x,y});}
  }
  return result;
}
export function regionAt(d,x,y){return REGIONS[d.zones?.[y]?.[x]??0];}
export function makeDungeon(state,floor=1){
  const size=floor>=4?19:floor>=2?17:15;
  const tiles=Array.from({length:size},()=>Array(size).fill(1));
  const visited=Array.from({length:size},()=>Array(size).fill(false));
  const stack=[{x:1,y:1}];tiles[1][1]=0;
  while(stack.length){
    const p=stack.at(-1),options=DIRECTIONS.filter(v=>p.x+v.x*2>0&&p.y+v.y*2>0&&p.x+v.x*2<size-1&&p.y+v.y*2<size-1&&tiles[p.y+v.y*2][p.x+v.x*2]===1);
    if(!options.length){stack.pop();continue;}
    const v=pick(state,options);tiles[p.y+v.y][p.x+v.x]=tiles[p.y+v.y*2][p.x+v.x*2]=0;
    stack.push({x:p.x+v.x*2,y:p.y+v.y*2});
  }
  // Fixed regional anchors, varied chamber sizes, loops and a long gallery instead of
  // an uninterrupted corridor texture. All chamber centers intersect the carved maze.
  const anchors=[{x:3,y:3},{x:size-4,y:3},{x:3,y:size-4},{x:size-4,y:size-4}];
  anchors.forEach((a,i)=>{
    const radius=i===(floor%4)?2:1;
    for(let y=Math.max(1,a.y-radius);y<=Math.min(size-2,a.y+radius);y++)for(let x=Math.max(1,a.x-radius);x<=Math.min(size-2,a.x+radius);x++)tiles[y][x]=0;
  });
  const gallery=anchors[floor%2].y;
  for(let x=3;x<=size-4;x++)tiles[gallery][x]=0;
  for(let i=0;i<10+floor;i++){
    const x=int(state,2,size-3),y=int(state,2,size-3);
    if((tiles[y][x-1]===0&&tiles[y][x+1]===0)||(tiles[y-1][x]===0&&tiles[y+1][x]===0))tiles[y][x]=0;
  }
  const zones=tiles.map((row,y)=>row.map((_,x)=>{
    let best=0;anchors.forEach((a,i)=>{if(Math.abs(a.x-x)+Math.abs(a.y-y)<Math.abs(anchors[best].x-x)+Math.abs(anchors[best].y-y))best=i;});
    return (best+floor-1)%4;
  }));
  const dungeon={size,tiles,visited,zones,landmarks:anchors.map(a=>({...a,zone:zones[a.y][a.x]})),events:{},packs:[],elapsed:0,start:{x:1,y:1},stairs:null};
  const dist=paths(dungeon,1,1),cells=Object.entries(dist).filter(([,n])=>n>5).sort((a,b)=>b[1]-a[1]);
  const stairKey=cells[0][0],[sx,sy]=stairKey.split(',').map(Number);
  dungeon.stairs={x:sx,y:sy};dungeon.events[stairKey]={type:'stairs',used:false};
  const pool=shuffle(state,cells.slice(1).map(([k])=>k));
  for(const type of ['chest','shrine','chest','fountain','altar','chest','shrine']){
    const k=pool.pop();if(k)dungeon.events[k]={type,used:false};
  }
  const early=Object.entries(dist).filter(([k,n])=>n>=2&&n<=4&&!dungeon.events[k]);
  if(early.length)dungeon.events[pick(state,early)[0]]={type:'chest',used:false,early:true};
  return dungeon;
}
export function populatePacks(run){
  const d=run.dungeon,dist=paths(d,1,1);
  const pool=shuffle(run,Object.entries(dist).filter(([k,n])=>n>=9&&!d.events[k]).map(([k])=>k));
  const occupied=[];
  for(let i=0;i<7+run.floor;i++){
    const k=pool.find(k=>!occupied.includes(k)&&occupied.every(o=>{const [x,y]=o.split(',').map(Number),[a,b]=k.split(',').map(Number);return Math.abs(x-a)+Math.abs(y-b)>2;}));
    if(!k)break;
    occupied.push(k);const [x,y]=k.split(',').map(Number);
    const elite=i===6;
    let troop=[...pick(run,ENCOUNTERS[run.floor-1])];
    if(run.party.length===1)troop=troop.slice(0,run.floor>=3&&i%3===1?2:1);
    else if(run.party.length===2)troop=troop.slice(0,2);
    if(elite)troop=run.party.length===1?['briar']:['sentinel','revenant',...(run.party.length===3?['moth']:[])];
    d.packs.push({id:`pack-${run.floor}-${i}`,x,y,home:{x,y},previous:null,kind:elite?'elite':'normal',troop,name:elite?'徘徊的强敌':`${ENEMY_TYPES[troop[0]].name}小队`,alert:0,alertUntil:0,alarmTarget:null,cooldown:0,engaged:false,defeated:false,members:null,route:patrolRoute(d,x,y),routeIndex:0,sleepUntil:0,sleepResistUntil:0,lure:null,mode:elite?'elite':'patrol'});
  }
}
export function revealAround(run){
  const d=run.dungeon;
  for(let y=run.y-1;y<=run.y+1;y++)for(let x=run.x-1;x<=run.x+1;x++)if(d.visited[y]?.[x]!==undefined)d.visited[y][x]=true;
  // Reveal straight sightlines, including their terminating wall; never see through walls.
  for(const v of DIRECTIONS)for(let i=1;i<=5;i++){
    const x=run.x+v.x*i,y=run.y+v.y*i;if(d.visited[y]?.[x]===undefined)break;
    d.visited[y][x]=true;if(!isFloor(d,x,y))break;
  }
}
export function visiblePacks(run){return run.dungeon.packs.filter(p=>!p.defeated&&!p.engaged&&run.dungeon.visited[p.y]?.[p.x]);}
/** A closed, cardinal patrol cycle. It depends only on the map and home coordinate. */
export function patrolRoute(d,sx,sy){
  const route=[{x:sx,y:sy}],seen=new Set([key(sx,sy)]);
  const rotation=(sx*17+sy*31)%4;
  for(let i=0;i<5;i++){
    const p=route.at(-1);
    const next=[...DIRECTIONS.slice(rotation),...DIRECTIONS.slice(0,rotation)]
      .map(v=>({x:p.x+v.x,y:p.y+v.y})).find(q=>isFloor(d,q.x,q.y)&&!seen.has(key(q.x,q.y))&&!(q.x===1&&q.y===1));
    if(!next)break;route.push(next);seen.add(key(next.x,next.y));
  }
  return route.concat(route.slice(1,-1).reverse());
}
export function packMode(run,p){
  const now=run.dungeon.elapsed;
  if(p.sleepUntil>now)return 'sleep';
  if(p.cooldown>0)return 'rest';
  if(p.kind==='elite')return 'elite';
  if(p.alertUntil>now)return 'alarmed';
  if(p.lure?.until>now)return 'lured';
  const q=p.route?.[p.routeIndex??0];
  return q&&(q.x!==p.x||q.y!==p.y)?'return':'patrol';
}
export function nearbyPacks(run,radius=8){
  const dist=paths(run.dungeon,run.x,run.y);
  return run.dungeon.packs.filter(p=>!p.defeated&&!p.engaged&&(dist[key(p.x,p.y)]<=radius||p.kind==='elite')).map(p=>{
    const mode=packMode(run,p),distance=dist[key(p.x,p.y)];
    return {id:p.id,name:p.name,kind:p.kind,x:p.x,y:p.y,distance,mode,eta:mode==='elite'||mode==='alarmed'?Math.max(1,distance):null,
      known:!!run.dungeon.visited[p.y]?.[p.x],count:p.members?p.members.filter(e=>e.hp>0).length:p.troop.length};
  }).sort((a,b)=>a.distance-b.distance);
}
/** Only a successfully resolved alarm action calls this. Merely starting combat does not. */
export function raiseAlarm(run,radius=8,duration=6){
  if((run.field?.hushUntil||0)>run.dungeon.elapsed)return {blocked:true,count:0};
  const dist=paths(run.dungeon,run.x,run.y);let count=0;
  for(const p of run.dungeon.packs){
    if(p.defeated||p.engaged||p.kind==='elite'||dist[key(p.x,p.y)]>radius)continue;
    p.alertUntil=run.dungeon.elapsed+duration;p.alert=duration;p.alarmTarget={x:run.x,y:run.y};p.mode='alarmed';count++;
  }
  return {blocked:false,count};
}
export function useFieldTool(run,id,packId=null){
  const tool=FIELD_TOOLS[id];
  if(run.phase!=='explore'||!tool)return {ok:false,error:'地图工具只能在进入战斗前使用。'};
  if(!(run.fieldSupplies?.[id]>0))return {ok:false,error:'这种地图工具已经用尽。'};
  const d=run.dungeon,now=d.elapsed;let target=null;
  if(id==='sleep'){
    target=d.packs.find(p=>p.id===packId&&!p.defeated&&!p.engaged);
    if(!target||!d.visited[target.y]?.[target.x]||paths(d,run.x,run.y)[key(target.x,target.y)]>tool.range)return {ok:false,error:'请选择已探明、路径 4 格内的敌群。'};
    if(target.sleepUntil>now||target.sleepResistUntil>now)return {ok:false,error:'目标仍在眠缚或抗性期间，不能覆盖。'};
  }
  if(id==='hush'&&(run.field?.hushUntil||0)>now)return {ok:false,error:'静音粉仍然生效，无需重复使用。'};
  if(id==='lure'&&d.packs.some(p=>!p.defeated&&!p.engaged&&p.lure?.until>now))return {ok:false,error:'已有诱饵生效；先完成当前诱导。'};
  let affected=[];
  if(id==='lure'){
    const dist=paths(d,run.x,run.y);
    affected=d.packs.filter(p=>!p.defeated&&!p.engaged&&p.kind!=='elite'&&dist[key(p.x,p.y)]<=6);
    if(!affected.length)return {ok:false,error:'路径 6 格内没有能被诱导的普通敌群。精英不会响应诱饵。'};
  }
  run.fieldSupplies[id]--;run.field??={hushUntil:0};
  if(id==='sleep'){
    const duration=target.kind==='elite'?1:3;
    target.sleepUntil=now+duration;target.sleepResistUntil=now+duration+4;target.mode='sleep';
  }else if(id==='hush')run.field.hushUntil=now+6;
  else for(const p of affected){p.lure={x:run.x,y:run.y,until:now+5};p.alertUntil=0;p.alert=0;p.mode='lured';}
  run.log.push({text:`使用「${tool.name}」${target?' → '+target.name:''}。没有推进世界节拍；效果随后续移动 / 完整战斗回合消耗。`,tone:'special'});
  if(run.log.length>100)run.log.shift();return {ok:true};
}
/** One successful step / wait or one completed combat round = exactly one world tick.
 * Normal packs follow their fixed route even during combat. Alarm responders target the
 * alarm location; elites always know the party position. No per-frame or item movement.
 */
export function stepPacks(run,{battle=false,hold=[]}={}){
  const d=run.dungeon,active=d.packs.filter(p=>!p.defeated&&!p.engaged);d.elapsed++;
  const occupied=new Set(active.map(p=>key(p.x,p.y)));
  for(const p of active){
    if(hold.includes(p.id)||(p.x===run.x&&p.y===run.y))continue;
    if(p.cooldown>0){p.cooldown--;p.mode='rest';continue;}
    if(p.sleepUntil>=d.elapsed){p.mode='sleep';continue;}
    p.route??=patrolRoute(d,p.home?.x??p.x,p.home?.y??p.y);p.routeIndex??=0;
    p.alert=Math.max(0,(p.alertUntil||0)-d.elapsed);
    let target=null,patrol=false;
    if(p.kind==='elite'){target={x:run.x,y:run.y};p.mode='elite';}
    else if(p.alertUntil>=d.elapsed&&p.alarmTarget){target=p.alarmTarget;p.mode='alarmed';}
    else if(p.lure?.until>=d.elapsed){target=p.lure;p.mode='lured';}
    else{
      patrol=true;p.mode='patrol';target=p.route[p.routeIndex];
      if(target.x===p.x&&target.y===p.y)target=p.route[(p.routeIndex+1)%p.route.length];
      else p.mode='return';
    }
    if(!target||(p.x===target.x&&p.y===target.y))continue;
    const dist=paths(d,target.x,target.y),distance=dist[key(p.x,p.y)];
    occupied.delete(key(p.x,p.y));
    const options=DIRECTIONS.map(v=>({x:p.x+v.x,y:p.y+v.y})).filter(q=>isFloor(d,q.x,q.y)&&dist[key(q.x,q.y)]<distance&&(!occupied.has(key(q.x,q.y))||(q.x===run.x&&q.y===run.y)));
    if(options.length){
      const next=options[0];p.previous={x:p.x,y:p.y};p.x=next.x;p.y=next.y;
      if(patrol&&p.x===target.x&&p.y===target.y&&p.mode==='patrol')p.routeIndex=(p.routeIndex+1)%p.route.length;
    }
    occupied.add(key(p.x,p.y));
  }
  return active.filter(p=>p.x===run.x&&p.y===run.y);
}
