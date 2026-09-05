import { ENEMY_TYPES } from './data.js';

/** Cosmetic scene descriptions. These functions never mutate the run or consume its RNG. */
export const SPRITE_COLORS = {enemy:'#ffb0c2',elite:'#ffcc81',chest:'#f3cf83',stairs:'#9ae9ed',gate:'#ffcf86',altar:'#dfc1ff',shrine:'#aed9ff',fountain:'#a0eee1',landmark:'#d1daed'};
const LABELS = {chest:'宝箱',stairs:'下行阶梯',gate:'月门守卫',altar:'月之祭坛',shrine:'休息星灯',fountain:'月之泉'};
const HEIGHTS = {chest:.63,stairs:1.06,gate:1.08,altar:.93,shrine:.85,fountain:.7};

export function packMembers(pack) {
  return pack.members ? pack.members.filter(e=>e.hp>0).map(e=>e.type) : [...pack.troop];
}

export function sceneObjects(run) {
  const d=run.dungeon, objects=[];
  for(const [key,event] of Object.entries(d.events)) {
    if(event.used)continue;
    const [x,y]=key.split(',').map(Number);
    const closed=event.type==='stairs'&&!run.guardianDefeated;
    const type=closed?'gate':event.type;
    objects.push({x:x+.5,y:y+.5,key:`event:${key}`,image:type,height:HEIGHTS[type]??.8,
      label:closed?(run.floor===5?'蚀月的圣女':'月门守卫'):LABELS[type],icon:type,color:SPRITE_COLORS[type],priority:closed?3:2,phase:x*13+y*7});
    if(closed)objects.push({x:x+.5,y:y+.5,key:`guardian:${key}`,image:run.floor===5?'mob-sovereign':'mob-guardian',height:.77,depthBias:-.035,shadow:true,phase:0});
  }
  for(const l of d.landmarks??[]) {
    // A landmark and an event can occupy the same floor cell. Do not stack two solid billboards.
    if(d.events[`${l.x},${l.y}`]&&!d.events[`${l.x},${l.y}`].used)continue;
    objects.push({x:l.x+.5,y:l.y+.5,key:`landmark:${l.x},${l.y}`,image:`landmark-${l.zone}`,height:.8,phase:0});
  }
  if(run.phase!=='battle')for(const pack of d.packs??[]) {
    if(pack.defeated||pack.engaged)continue;
    const members=packMembers(pack).filter(id=>ENEMY_TYPES[id]);if(!members.length)continue;
    const elite=pack.kind==='elite',color=SPRITE_COLORS[elite?'elite':'enemy'];
    // Companions sit behind the leader. Actual surviving members are used after a retreat.
    members.slice(1,3).forEach((id,i)=>objects.push({x:pack.x+.5,y:pack.y+.5,key:`${pack.id}:${i}`,image:`mob-${id}`,height:.54,offset:i===0?-.22:.22,depthBias:.055,companion:true,phase:i+pack.x}));
    objects.push({x:pack.x+.5,y:pack.y+.5,key:pack.id,image:`mob-${members[0]}`,height:elite?.86:.74,
      label:`${elite?'强敌 · ':''}${ENEMY_TYPES[members[0]].name} ×${members.length}`,icon:elite?'elite':'enemy',
      color,priority:elite?4:3,shadow:true,elite,phase:pack.x*7+pack.y*3});
  }
  return objects;
}

/** Stable wall-side dressing, excluded from events, landmarks and the start cell.
 * World positions (not screen-space overlays) ensure they cannot reveal unseen corridors.
 */
export function sceneDecorations(d) {
  const result=[],reserved=new Set([...Object.keys(d.events),...(d.landmarks??[]).map(l=>`${l.x},${l.y}`),'1,1']);
  for(let y=1;y<d.size-1;y++)for(let x=1;x<d.size-1;x++) {
    if(d.tiles[y][x]!==0||reserved.has(`${x},${y}`))continue;
    const n=(x*73856093^y*19349663)>>>0;if(n%7!==0)continue;
    const walls=[[0,-1],[1,0],[0,1],[-1,0]].filter(([dx,dy])=>d.tiles[y+dy]?.[x+dx]===1);
    if(!walls.length)continue;
    const [dx,dy]=walls[n%walls.length],zone=d.zones?.[y]?.[x]??0;
    result.push({x:x+.5+dx*.33,y:y+.5+dy*.33,key:`decor:${x},${y}`,image:`decor-${zone}`,height:.42,decor:true,phase:n%100});
  }
  return result;
}

/** Screen projection keeps the artwork's aspect ratio. No minimum-size enlargement through walls. */
export function projectSprite(object,camera,width,height) {
  const dx=Math.cos(camera.angle),dy=Math.sin(camera.angle),x=object.x-camera.x,y=object.y-camera.y;
  const depth=x*dx+y*dy+(object.depthBias??0);
  if(!Number.isFinite(depth)||depth<=.18||depth>=11)return null;
  const lateral=-x*dy+y*dx,sh=height/depth*object.height;
  const sw=sh*(object.aspect??1),center=width/2*(1+lateral/(depth*.78))+(object.offset??0)*sh;
  return {...object,depth,sh,sw,left:center-sw/2,top:height/2+height/depth/2-sh*.94,center,ground:height/2+height/depth/2};
}

/** Coalesce visible pixels into clip spans. Never sample/crop the source SVG per column. */
export function visibleSpans(depthBuffer,depth,left,width) {
  if(!Number.isFinite(depth)||!Number.isFinite(left)||!Number.isFinite(width)||!(width>0))return [];
  const first=Math.max(0,Math.floor(left)),last=Math.min(depthBuffer.length,Math.ceil(left+width)),spans=[];
  let start=-1;
  for(let col=first;col<last;col++) {
    const visible=depth<depthBuffer[col]-1e-5;
    if(visible&&start<0)start=col;
    if(!visible&&start>=0){spans.push([start,col-start]);start=-1;}
  }
  if(start>=0)spans.push([start,last-start]);
  return spans;
}

/** Animation is opt-in, independently of camera comfort; reduced-motion always wins. */
export function spriteMotion(object,time,enabled) {
  if(!enabled)return {lift:0,stretch:1,light:1};
  const t=time*.001+(object.phase??0),id=object.image;
  if(/mob-(wisp|prism|moth|revenant|sovereign)/.test(id))return {lift:Math.sin(t*1.55)*.009,stretch:1,light:.98+Math.sin(t)*.02};
  if(id.startsWith('mob-'))return {lift:0,stretch:1+Math.sin(t*1.6)*.007,light:1};
  if(id==='shrine'||id==='fountain')return {lift:0,stretch:1,light:.97+Math.sin(t*2.1)*.03};
  return {lift:0,stretch:1,light:1};
}

export function placeLabels(candidates,width,height,scale=1,reserved=[]) {
  const placed=[],occupied=[...reserved];
  for(const item of [...candidates].sort((a,b)=>b.priority-a.priority||a.depth-b.depth)) {
    const w=Math.min(width-12*scale,item.width),h=25*scale;
    const x=Math.max(6*scale,Math.min(width-w-6*scale,item.center-w/2));
    let y=Math.max(8*scale,Math.min(height-h-8*scale,item.top-30*scale));
    let fit=false;
    for(let attempt=0;attempt<3;attempt++) {
      if(occupied.every(p=>x+w+3*scale<p.x||x>p.x+p.w+3*scale||y+h+3*scale<p.y||y>p.y+p.h+3*scale)){fit=true;break;}
      y+=29*scale;if(y+h>height-8*scale)break;
    }
    if(fit){const label={...item,x,y,w,h};placed.push(label);occupied.push(label);}
  }
  return placed;
}
