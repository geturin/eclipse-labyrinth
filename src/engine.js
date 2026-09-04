import { VERSION, MAX_FLOOR, JOBS, SKILLS, STATUS, WEAPONS, BOONS, ENEMY_TYPES, DIRECTIONS, FLOORS } from './data.js';

// This module has no browser dependencies: game state can be replayed, saved and tested.
export function hashSeed(text) {
  let h = 2166136261;
  for (const c of String(text)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function random(state) {
  state.rng = (state.rng + 0x6D2B79F5) >>> 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function integer(state, min, max) { return Math.floor(random(state) * (max - min + 1)) + min; }
export function choose(state, items) { return items[integer(state, 0, items.length - 1)]; }
export function shuffled(state, values) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) { const j = integer(state, 0, i); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
export function cellKey(x, y) { return `${x},${y}`; }
export function walkable(dungeon, x, y) { return Number.isInteger(x) && Number.isInteger(y) && dungeon.tiles[y]?.[x] === 0; }
export function distances(dungeon, sx, sy) {
  const result = { [cellKey(sx, sy)]: 0 }, queue = [{ x:sx, y:sy }];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    for (const d of DIRECTIONS) {
      const x = p.x + d.x, y = p.y + d.y, key = cellKey(x,y);
      if (walkable(dungeon,x,y) && result[key] === undefined) { result[key] = result[cellKey(p.x,p.y)] + 1; queue.push({x,y}); }
    }
  }
  return result;
}
export function generateDungeon(state, floor = 1) {
  const size = floor >= 4 ? 19 : floor >= 2 ? 17 : 15;
  const tiles = Array.from({length:size}, () => Array(size).fill(1));
  const visited = Array.from({length:size}, () => Array(size).fill(false));
  tiles[1][1] = 0;
  const stack = [{x:1,y:1}];
  while (stack.length) {
    const p = stack[stack.length - 1];
    const possible = DIRECTIONS.filter(d => p.x+d.x*2>0 && p.y+d.y*2>0 && p.x+d.x*2<size-1 && p.y+d.y*2<size-1 && tiles[p.y+d.y*2][p.x+d.x*2] === 1);
    if (!possible.length) { stack.pop(); continue; }
    const d = choose(state,possible);
    tiles[p.y+d.y][p.x+d.x] = tiles[p.y+d.y*2][p.x+d.x*2] = 0;
    stack.push({x:p.x+d.x*2,y:p.y+d.y*2});
  }
  // Loops and connected rooms prevent the maze from being a single perfect tree.
  for (let i=0;i<7+floor;i++) {
    const x=integer(state,2,size-3), y=integer(state,2,size-3);
    if ((tiles[y][x-1]===0 && tiles[y][x+1]===0) || (tiles[y-1][x]===0 && tiles[y+1][x]===0)) tiles[y][x]=0;
  }
  for (let i=0;i<2;i++) {
    const x=integer(state,1,(size-5)/2)*2+1, y=integer(state,1,(size-5)/2)*2+1;
    for(let yy=y;yy<Math.min(size-1,y+3);yy++) for(let xx=x;xx<Math.min(size-1,x+3);xx++) tiles[yy][xx]=0;
  }
  const dungeon={size,tiles,visited,events:{},start:{x:1,y:1},stairs:null};
  const dist=distances(dungeon,1,1);
  const cells=Object.entries(dist).filter(([,n])=>n>4).sort((a,b)=>b[1]-a[1]);
  const stairKey=cells[0][0], [sx,sy]=stairKey.split(',').map(Number);
  dungeon.stairs={x:sx,y:sy};
  dungeon.events[stairKey]={type:'stairs',used:false};
  const pool=shuffled(state,cells.slice(1).map(([key])=>key));
  const types=['chest','shrine','chest','fountain','altar','chest','elite','shrine'];
  for(const type of types) { const key=pool.pop(); if(key) dungeon.events[key]={type,used:false}; }
  // One early treasure is intentional: introduce a build choice before the first fight.
  const early=Object.entries(dist).filter(([k,n])=>n>=2&&n<=4&&!dungeon.events[k]);
  if(early.length) dungeon.events[choose(state,early)[0]]={type:'chest',used:false};
  return dungeon;
}
function log(run,text,tone='info') { run.log.push({text,tone}); if(run.log.length>90) run.log.shift(); }
function living(items) { return items.filter(p=>p.hp>0); }
function clamp(value,min,max) { return Math.max(min,Math.min(max,value)); }
export function boonCount(run,id) { return run.boons[id] || 0; }
export function negativeCount(entity) { return Object.keys(entity.status).filter(k=>STATUS[k]?.negative).length; }
export function heroStats(hero) { return {atk:hero.atk+hero.weapon.atk,mag:hero.mag+hero.weapon.mag,def:hero.def,spd:hero.spd*(hero.status.haste?1.5:1)*(hero.status.slow?0.6:1)}; }
export function makeWeapon(id,floor=1,serial=0) {
  const base=WEAPONS[id];
  if(!base) throw new Error(`Unknown weapon: ${id}`);
  const bonus=Math.max(0,floor-1)*2;
  return {...base,id,uid:`${id}-${floor}-${serial}`,atk:base.atk+(base.atk>base.mag?bonus:Math.floor(bonus/2)),mag:base.mag+(base.mag>=base.atk?bonus:Math.floor(bonus/2)),floor};
}
function makeHero(id,index,solo) {
  const j=JOBS[id], hp=Math.round(j.hp*(solo?1.45:1)), mp=Math.round(j.mp*(solo?1.3:1));
  return {id:`hero-${index}`,job:id,name:j.person,maxHp:hp,hp,maxMp:mp,mp,atk:j.atk,mag:j.mag,def:j.def,spd:j.spd,weapon:makeWeapon(j.weapon),skills:[...j.skills],ranks:{},status:{},guard:false,phoenixUsed:false};
}
export function createRun(jobIds,seed) {
  if(!Array.isArray(jobIds)||jobIds.length<1||jobIds.length>3||new Set(jobIds).size!==jobIds.length||jobIds.some(j=>!JOBS[j])) throw new Error('请选择 1～3 个不同职业。');
  const cleanSeed=String(seed||'MOON').trim().slice(0,48)||'MOON';
  const run={version:VERSION,seed:cleanSeed,rng:hashSeed(cleanSeed),phase:'explore',floor:1,party:jobIds.map((j,i)=>makeHero(j,i,jobIds.length===1)),level:1,xp:0,nextXp:65,gold:0,boons:{},inventory:[],battles:0,kills:0,steps:0,danger:0,encounterAt:10,grace:0,guardianDefeated:false,log:[],battle:null,rewards:[],event:null,ending:null,fx:[],serial:0,solo:jobIds.length===1};
  enterFloor(run,1);
  log(run,run.solo?'独行誓约：生命 +45%、MP +30%、造成伤害 +25%。':'星灯已点亮。不同角色连续攻击同一敌人，将触发联携。','special');
  return run;
}
export function reveal(run) {
  for(let y=run.y-1;y<=run.y+1;y++) for(let x=run.x-1;x<=run.x+1;x++) if(run.dungeon.visited[y]?.[x]!==undefined) run.dungeon.visited[y][x]=true;
}
function enterFloor(run,floor) {
  run.floor=floor; run.dungeon=generateDungeon(run,floor); run.x=1;run.y=1;
  run.dir=DIRECTIONS.findIndex(d=>walkable(run.dungeon,1+d.x,1+d.y));
  run.guardianDefeated=false; run.phase='explore';run.battle=null;run.rewards=[];run.event=null;
  run.danger=0;run.encounterAt=integer(run,9,14);run.grace=3;
  for(const p of run.party) {p.status={};p.guard=false;}
  reveal(run); log(run,`第 ${floor} 层 · ${FLOORS[floor-1].name}`,'special');
}
export function turn(run,delta) { if(run.phase!=='explore')return false;run.dir=(run.dir+delta+4)%4;return true; }
export function move(run,kind='forward') {
  if(run.phase!=='explore') return false;
  const offset={forward:0,back:2,left:3,right:1}[kind];
  if(offset===undefined) return false;
  const d=DIRECTIONS[(run.dir+offset)%4], x=run.x+d.x,y=run.y+d.y;
  if(!walkable(run.dungeon,x,y)) return false;
  run.x=x;run.y=y;run.steps++;run.fx=[];reveal(run);
  if(run.grace>0)run.grace--;else run.danger++;
  if(run.danger>=run.encounterAt) {run.danger=0;run.encounterAt=integer(run,10,16);startBattle(run);}
  return true;
}
export function currentEvent(run) {
  const event=run.dungeon.events[cellKey(run.x,run.y)];
  return event&&!event.used?event:null;
}
export function interact(run) {
  if(run.phase!=='explore')return false;
  const event=currentEvent(run);
  if(!event)return false;
  const key=cellKey(run.x,run.y);
  if(event.type==='stairs') {
    if(!run.guardianDefeated) startBattle(run,run.floor===MAX_FLOOR?'boss':'guardian',key);
    else enterFloor(run,run.floor+1);
  } else if(event.type==='chest') {
    event.used=true;run.gold+=integer(run,15,32);openRewards(run,'treasure');log(run,'宝箱中藏着尚未被遗忘的星光。','loot');
  } else if(event.type==='elite') {startBattle(run,'elite',key);}
  else {run.phase='event';run.event={type:event.type,key};}
  return true;
}
export function resolveEvent(run,choice) {
  if(run.phase!=='event'||!run.event) return false;
  const {type,key}=run.event;
  if(choice==='leave') {run.phase='explore';run.event=null;return true;}
  if(type==='shrine'&&choice==='rest') {
    for(const p of run.party){p.hp=Math.min(p.maxHp,p.hp+Math.ceil(p.maxHp*0.45));p.mp=Math.min(p.maxMp,p.mp+Math.ceil(p.maxMp*0.5));p.status={};}
    log(run,'在星灯下小憩。全队恢复 45% 生命、50% MP。','heal');
  }else if(type==='fountain'&&choice==='drink'){
    for(const p of run.party){p.mp=p.maxMp;p.hp=Math.min(p.maxHp,p.hp+Math.ceil(p.maxHp*0.18));}log(run,'月之泉洗去了倦意。MP 完全恢复。','heal');
  }else if(type==='altar'&&choice==='offer'){
    if(run.gold<35)return false;run.gold-=35;run.dungeon.events[key].used=true;run.event=null;openRewards(run,'altar');log(run,'你将 35 星砂交给了无声的神像。','loot');return true;
  }else if(type==='altar'&&choice==='blood'){
    for(const p of living(run.party))p.hp=Math.max(1,p.hp-Math.ceil(p.maxHp*0.2));
    run.dungeon.events[key].used=true;run.event=null;openRewards(run,'altar');log(run,'神像收下了全队 20% 上限的生命。','special');return true;
  }else return false;
  run.dungeon.events[key].used=true;run.phase='explore';run.event=null;return true;
}
function generateEnemies(run,type) {
  const boss=type==='boss',guardian=type==='guardian',elite=type==='elite';
  const partyFactor=run.party.length===1?0.8:run.party.length===2?1.12:1.5;
  const factor=1+(run.floor-1)*0.24;
  const pool=run.floor===1?['slime','wisp','moth']:['slime','wisp','moth','sentinel','revenant'];
  let keys;
  if(boss) keys=['sovereign'];
  else if(guardian)keys=run.party.length>1&&run.floor>1?['guardian','wisp']:['guardian'];
  else if(elite)keys=['sentinel',...(run.party.length>1?['revenant']:[])];
  else keys=Array.from({length:run.party.length===1?integer(run,1,2):integer(run,2,3)},()=>choose(run,pool));
  return keys.map((id,index)=>{
    const base=ENEMY_TYPES[id];
    const hp=Math.round(base.hp*factor*partyFactor*(elite?1.35:1));
    return {...base,id:`enemy-${index}`,type:id,maxHp:hp,hp,atk:Math.round(base.atk*(1+(run.floor-1)*0.16)),mag:Math.round(base.mag*(1+(run.floor-1)*0.16)),def:base.def+run.floor-1,spd:base.spd,status:{},guard:false,intentIndex:boss||guardian?0:integer(run,0,base.intent.length-1),charged:false,phoenixUsed:true};
  });
}
export function startBattle(run,type='normal',origin=null) {
  if(run.phase!=='explore') return false;
  run.phase='battle';run.fx=[];
  for(const p of run.party){p.guard=false;p.status={};p.phoenixUsed=false;}
  run.battle={type,origin,enemies:generateEnemies(run,type),round:0,queue:[],active:null,serial:0,chainTarget:null,chainActor:null,chain:0,lastSkill:null,escaped:false};
  log(run,type==='boss'?'蚀月的圣女睁开了双眼。':type==='guardian'?'月门守卫挡住了去路。':'阴影中传来了脚步声。','battle');
  nextActor(run); return true;
}
export function intentOf(enemy) { return enemy.intent[enemy.intentIndex%enemy.intent.length]; }
export function activeHero(run) {return run.battle?run.party.find(p=>p.id===run.battle.active&&p.hp>0)||null:null;}
export function skillCost(hero,skillId) {
  const skill=SKILLS[skillId];if(!skill)return Infinity;
  let cost=skill.cost;
  if(cost&&hero.weapon.effect==='overload')cost+=2;
  if(cost&&hero.weapon.effect==='economy')cost=Math.max(1,Math.floor(cost*0.65));
  return cost;
}
function addStatus(run,target,id,turns,power=1) {
  const existing=target.status[id];target.status[id]={turns:Math.max(turns,existing?.turns||0),power:Math.max(power,existing?.power||1),applied:run.battle?.serial||0};
}
function heal(run,target,amount) {
  if(target.hp<=0)return 0;
  const n=Math.min(target.maxHp-target.hp,Math.max(0,Math.round(amount)));target.hp+=n;
  if(n)run.fx.push({id:target.id,type:'heal',amount:n});return n;
}
function revivePhoenix(run,target) {
  if(target.hp<=0&&target.weapon?.effect==='phoenix'&&!target.phoenixUsed) {target.phoenixUsed=true;target.hp=Math.ceil(target.maxHp*0.35);target.status={};log(run,`${target.name} 的「返魂」发动，重新站了起来！`,'special');return true;}return false;
}
function hurt(run,target,amount,source=null) {
  const n=Math.min(target.hp,Math.max(1,Math.round(amount)));target.hp=Math.max(0,target.hp-n);
  run.fx.push({id:target.id,type:'damage',amount:n});
  if(target.hp<=0&&!revivePhoenix(run,target)) {
    log(run,`${target.name}${target.job?' 倒下了。':' 消散于月光中。'}`,target.job?'danger':'battle');
    if(!target.job){run.kills++;if(source?.weapon?.effect==='soulsteal'){heal(run,source,source.maxHp*0.18);source.mp=Math.min(source.maxMp,source.mp+6);}}
  }
  return n;
}
function tickStart(run,entity) {
  entity.guard=false;
  for(const id of ['burn','poison'])if(entity.hp>0&&entity.status[id]) {
    const dot=entity.status[id];const amount=entity.maxHp*(id==='burn'?0.07:0.06)*(dot.power||1);
    const n=hurt(run,entity,amount);log(run,`${entity.name} 受到 ${n} 点${STATUS[id].name}伤害。`,'muted');
  }
  if(entity.job&&entity.hp>0)entity.mp=Math.min(entity.maxMp,entity.mp+(entity.job==='chrono'?2:0)+boonCount(run,'focus')*2);
}
function tickEnd(run,entity) {
  for(const [id,s]of Object.entries(entity.status))if(s.applied!==run.battle.serial){s.turns--;if(s.turns<=0)delete entity.status[id];}
}
function newRound(run) {
  const b=run.battle;b.round++;
  const actors=[...living(run.party),...living(b.enemies)].map(e=>({id:e.id,speed:e.job?heroStats(e).spd:e.spd*(e.status.haste?1.5:1)*(e.status.slow?0.6:1),tie:random(run)}));
  actors.sort((a,b)=>b.speed-a.speed||b.tie-a.tie);b.queue=actors.map(x=>x.id);
}
function checkFinish(run) {
  if(!living(run.party).length){run.phase='ended';run.ending='defeat';run.battle.active=null;log(run,'星灯熄灭了。但月亮会记住你的名字。','danger');return true;}
  if(!living(run.battle.enemies).length){finishBattle(run);return true;}return false;
}
function nextActor(run) {
  // A bounded loop rather than recursion also covers poison deaths before acting.
  for(let guard=0;guard<160&&run.phase==='battle';guard++) {
    if(checkFinish(run))return;
    const b=run.battle;if(!b.queue.length)newRound(run);
    const id=b.queue.shift(), entity=[...run.party,...b.enemies].find(e=>e.id===id);
    if(!entity||entity.hp<=0)continue;
    b.serial++;b.active=id;tickStart(run,entity);if(checkFinish(run))return;
    if(entity.hp<=0)continue;
    if(entity.job)return;
    enemyAct(run,entity);tickEnd(run,entity);if(checkFinish(run))return;
  }
  if(run.phase==='battle'&&!activeHero(run))throw new Error('Turn scheduler did not reach a player action.');
}
function lowestHp(party) {return living(party).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];}
function enemyAct(run,enemy) {
  const intent=intentOf(enemy);enemy.intentIndex++;
  if(intent==='guard'){enemy.guard=true;log(run,`${enemy.name} 架起防御。`,'muted');return;}
  if(intent==='charge'){enemy.charged=true;log(run,`${enemy.name} 正在蓄力！下次攻击伤害翻倍。`,'danger');return;}
  const targets=intent==='sweep'?living(run.party):[choose(run,living(run.party))];
  for(const target of targets) {
    const magic=['hex','drain'].includes(intent), base=magic?enemy.mag:enemy.atk;
    let power=intent==='heavy'?1.65:intent==='sweep'?0.85:1;
    if(enemy.charged)power*=1.9;
    let damage=(base*power-target.def*(magic?0.25:0.6))*(0.9+random(run)*0.2);
    if(target.guard)damage*=0.5;if(target.status.protect)damage*=0.7;if(target.job==='knight')damage*=0.88;
    if(target.status.marked)damage*=1.2;
    const dealt=hurt(run,target,Math.max(2,damage));
    log(run,`${enemy.name} → ${target.name} · ${dealt} 伤害${intent==='heavy'?' / 重击':''}`,'enemy');
    if(target.hp>0&&intent==='hex')addStatus(run,target,'burn',2);
    if(target.hp>0&&intent==='poison')addStatus(run,target,'poison',2);
    if(intent==='drain')heal(run,enemy,dealt*0.6);
  }
  enemy.charged=false;
}
function damageTarget(run,hero,target,skill,rank) {
  const stats=heroStats(hero),magic=skill.kind==='magic'||(skill.kind==='attack'&&['mage','shrine','chrono'].includes(hero.job));
  const offense=magic?stats.mag:stats.atk, negative=negativeCount(target), effect=hero.weapon.effect;
  const factor=1+rank*0.22;
  let damage=Math.max(2,offense*(skill.power||1)*factor-target.def*(magic?0.25:0.55));
  damage*=0.91+random(run)*0.18;
  if(run.solo)damage*=1.25;
  if(hero.status.fury)damage*=1.3;if(hero.status.haste)damage*=1.15;
  if(target.status.break&&!magic)damage*=1.35;if(target.status.marked)damage*=1.2;
  if(hero.job==='ninja'&&negative)damage*=1.25;
  if(hero.job==='reaver'&&hero.hp<hero.maxHp*0.5)damage*=1.35;
  if(skill.exploit)damage*=1+Math.min(4,negative)*0.2;
  if(skill.element&&skill.element===target.weak){damage*=1.4;log(run,'弱点命中 · 伤害 +40%','special');}
  if(skill.element==='ice'&&target.status.burn){damage*=1.6;log(run,'元素联动「融解」· 伤害 +60%','special');}
  if(effect==='execution'&&target.hp<target.maxHp*0.4)damage*=1.5;
  if(effect==='frostbite'&&target.status.slow)damage*=1.4;
  if(effect==='firstlight'&&run.battle.round<=2)damage*=1.4;
  if(effect==='bloodmoon'&&hero.hp<hero.maxHp*0.5)damage*=1.45;
  if(effect==='overload'&&skill.id!=='attack')damage*=1.4;
  if(effect==='affliction')damage*=1+negative*0.18;
  const b=run.battle;
  if(b.chainTarget===target.id&&b.chainActor!==hero.id) {
    b.chain=Math.min(4,b.chain+1);damage*=1+b.chain*0.12+boonCount(run,'harmony')*0.2;
    log(run,`CHAIN ×${b.chain+1} · ${hero.name} 接上了同伴的攻击！`,'special');
  } else if(b.chainActor===hero.id||b.chainTarget!==target.id) b.chain=0;
  b.chainTarget=target.id;b.chainActor=hero.id;
  const crit=random(run)<Math.min(0.8,0.06+boonCount(run,'critical')*0.08+(hero.job==='ninja'?0.07:0));
  if(crit)damage*=1.5;if(target.guard)damage*=0.5;
  const dealt=hurt(run,target,damage,hero);
  log(run,`${hero.name} · ${skill.name} → ${target.name} ${dealt}${crit?' 暴击！':''}`,'player');
  if(hero.job==='knight'&&target.status.break)hero.mp=Math.min(hero.maxMp,hero.mp+4);
  if(hero.job==='mage'&&target.status.burn&&skill.kind!=='attack')hero.mp=Math.min(hero.maxMp,hero.mp+3);
  const drain=(skill.drain||0)+(effect==='vampire'?0.18:0)+(hero.job==='reaver'?0.1:0)+boonCount(run,'siphon')*0.07;
  if(drain)heal(run,hero,dealt*drain);
  if(hero.job==='shrine'){const friend=lowestHp(run.party);if(friend)heal(run,friend,dealt*0.2);}
  if(target.hp>0){
    if(skill.status)addStatus(run,target,skill.status,skill.turns,1+boonCount(run,'embers')*0.4);
    const procs={guardbreak:['break',0.3],kindle:['burn',0.25],toxin:['poison',0.25],frostbite:['slow',0.3]};
    if(procs[effect]&&random(run)<procs[effect][1])addStatus(run,target,procs[effect][0],2,1+boonCount(run,'embers')*0.4);
    if(effect==='echo'&&random(run)<0.28){const n=hurt(run,target,dealt*0.45,hero);log(run,`「回响」追加 ${n} 伤害。`,'special');}
  }
  if(effect==='cleave'&&skill.target==='enemy')for(const other of living(b.enemies).filter(e=>e.id!==target.id)){const n=hurt(run,other,dealt*0.25,hero);log(run,`「星屑」溅射 ${other.name} ${n} 伤害。`,'special');}
}
export function act(run,skillId,targetId=null) {
  if(run.phase!=='battle')return {ok:false,error:'不在战斗中。'};
  const hero=activeHero(run);
  if(!hero)return {ok:false,error:'尚未轮到我方行动。'};
  if(skillId==='escape')return escapeBattle(run,hero);
  const skill=SKILLS[skillId];
  if(!skill||!['attack','guard',...hero.skills].includes(skillId))return {ok:false,error:'无法使用此技能。'};
  const cost=skillCost(hero,skillId);if(hero.mp<cost)return {ok:false,error:'MP 不足。普通攻击或防御可以恢复 MP。'};
  const b=run.battle;
  let targets=[];
  if(skill.target==='enemy'){const e=b.enemies.find(e=>e.id===targetId&&e.hp>0);if(!e)return {ok:false,error:'请选择存活的敌人。'};targets=[e];}
  else if(skill.target==='enemies')targets=living(b.enemies);
  else if(skill.target==='self')targets=[hero];
  else if(skill.target==='allies')targets=living(run.party);
  else if(skill.target==='ally'){const p=run.party.find(p=>p.id===targetId&&(p.hp>0||skill.kind==='revive'));if(!p)return {ok:false,error:'请选择有效队友。'};targets=[p];}
  hero.mp-=cost;run.fx=[];b.lastSkill=skillId;
  const rank=hero.ranks[skillId]||0,scale=1+rank*0.22,stats=heroStats(hero);
  if(['physical','magic','attack'].includes(skill.kind)) {
    for(const target of targets)if(target.hp>0)damageTarget(run,hero,target,skill,rank);
    if(skillId==='attack')hero.mp=Math.min(hero.maxMp,hero.mp+5);
  }else if(skill.kind==='guard') {hero.guard=true;hero.mp=Math.min(hero.maxMp,hero.mp+7);log(run,`${hero.name} 防御，回复 7 MP。`,'heal');}
  else if(skill.kind==='aegis') {heal(run,hero,hero.maxHp*0.3*scale);for(const p of living(run.party))addStatus(run,p,'protect',2);log(run,`${hero.name} 展开星纹壁垒。`,'heal');}
  else if(skill.kind==='heal') {for(const p of targets){heal(run,p,(stats.mag*1.5+p.maxHp*0.12)*scale);delete p.status.burn;delete p.status.poison;}log(run,'花雨落下，全队得到治疗与净化。','heal');}
  else if(skill.kind==='revive') {const p=targets[0];if(p.hp<=0){p.hp=Math.ceil(p.maxHp*0.4*scale);p.hp=Math.min(p.maxHp,p.hp);p.status={};run.fx.push({id:p.id,type:'heal',amount:p.hp});}else heal(run,p,p.maxHp*0.55*scale);log(run,`${hero.name} 将晨星还给了 ${p.name}。`,'heal');}
  else if(skill.kind==='veil'){heal(run,hero,hero.maxHp*0.25*scale);addStatus(run,hero,'haste',2);log(run,`${hero.name} 隐入胧月，恢复生命并获得迅捷。`,'heal');}
  else if(skill.kind==='haste'){for(const p of targets)addStatus(run,p,'haste',3+rank);log(run,'时间加速了。全队获得迅捷。','special');}
  else if(skill.kind==='rewind'){heal(run,targets[0],(stats.mag*2+15)*scale);for(const id of Object.keys(targets[0].status))if(STATUS[id]?.negative)delete targets[0].status[id];log(run,`${hero.name} 逆转了 ${targets[0].name} 的伤势。`,'heal');}
  else if(skill.kind==='bloodpact'){hero.hp=Math.max(1,hero.hp-Math.ceil(hero.hp*0.2));hero.mp=Math.min(hero.maxMp,hero.mp+12+rank*3);addStatus(run,hero,'fury',3);log(run,`${hero.name} 立下血誓，获得狂热。`,'special');}
  if(hero.hp>0){
    if(hero.weapon.effect==='lifewell')heal(run,hero,hero.maxHp*0.04);
    if(hero.weapon.effect==='mana')hero.mp=Math.min(hero.maxMp,hero.mp+3);
    if(hero.weapon.effect==='chorus'){const friend=lowestHp(run.party);if(friend)heal(run,friend,8);}
  }
  tickEnd(run,hero);if(!checkFinish(run))nextActor(run);
  return {ok:true};
}
function escapeBattle(run,hero) {
  if(['guardian','boss'].includes(run.battle.type))return {ok:false,error:'月门已经封闭，无法逃离这场战斗。'};
  run.fx=[];
  if(random(run)<0.65){log(run,'成功脱离战斗。','muted');run.battle=null;run.phase='explore';run.grace=6;for(const p of run.party){p.status={};p.guard=false;}return {ok:true};}
  log(run,'逃离失败！行动机会已消耗。','danger');tickEnd(run,hero);nextActor(run);return {ok:true};
}
function finishBattle(run) {
  const b=run.battle;run.battles++;run.grace=5;
  const xp=22+run.floor*9+b.enemies.length*6+(b.type!=='normal'?20:0);
  const coins=integer(run,12,25)*run.floor;run.xp+=xp;run.gold+=coins;
  for(const p of run.party){
    if(p.hp<=0)p.hp=Math.ceil(p.maxHp*0.15);
    p.hp=Math.min(p.maxHp,p.hp+Math.ceil(p.maxHp*(0.06+boonCount(run,'victory')*0.1)));
    p.mp=Math.min(p.maxMp,p.mp+4);p.status={};p.guard=false;
  }
  while(run.xp>=run.nextXp){
    run.xp-=run.nextXp;run.level++;run.nextXp=45+run.level*25;
    for(const p of run.party){p.maxHp+=11;p.hp=Math.min(p.maxHp,p.hp+23);p.maxMp+=3;p.mp=Math.min(p.maxMp,p.mp+10);p.atk+=2;p.mag+=2;p.def+=1;if(run.level%2===0)p.spd++;}
    log(run,`LEVEL UP · 全队 Lv.${run.level}，基础能力成长，恢复生命与 MP。`,'special');
  }
  log(run,`战斗胜利 · 经验 +${xp} · 星砂 +${coins}`,'loot');
  if(b.origin&&run.dungeon.events[b.origin]) {
    if(['guardian','boss'].includes(b.type))run.guardianDefeated=true;
    else run.dungeon.events[b.origin].used=true;
  }
  if(b.type==='boss'){run.phase='ended';run.ending='victory';b.active=null;log(run,'月蚀结束。你终于见到了黎明。','special');return;}
  run.battle=null;openRewards(run,b.type==='normal'?'battle':'elite');
}
function weaponReward(run,source) {
  const rare=Object.keys(WEAPONS).filter(k=>WEAPONS[k].rarity==='rare'),legendary=Object.keys(WEAPONS).filter(k=>WEAPONS[k].rarity==='legendary');
  const roll=random(run),legend=source==='altar'||(run.floor>=3&&roll<0.25)||(source==='elite'&&roll<0.4);
  const id=choose(run,legend?legendary:rare);
  run.serial++;return {type:'weapon',weapon:makeWeapon(id,run.floor,run.serial)};
}
function upgradeReward(run) {
  const pairs=run.party.flatMap(p=>p.skills.filter(s=>(p.ranks[s]||0)<3).map(s=>({heroId:p.id,skillId:s})));
  if(!pairs.length)return null;return {type:'skill',...choose(run,pairs)};
}
export function openRewards(run,source='battle') {
  run.phase='reward';run.rewardSource=source;run.event=null;
  const boonPool=shuffled(run,BOONS);
  const options=[{type:'boon',id:boonPool[0].id}];
  options.push(source==='treasure'||source==='altar'||random(run)<0.5?weaponReward(run,source):upgradeReward(run)||{type:'boon',id:boonPool[1].id});
  options.push(source==='elite'?weaponReward(run,source):upgradeReward(run)||{type:'boon',id:boonPool[2].id});
  if(options[1]?.type==='skill'&&options[2]?.type==='skill'&&options[1].heroId===options[2].heroId&&options[1].skillId===options[2].skillId)options[2]={type:'boon',id:boonPool[2].id};
  run.rewards=shuffled(run,options);return run.rewards;
}
export function takeReward(run,index,heroId=null) {
  if(run.phase!=='reward'||!Number.isInteger(index)||!run.rewards[index])return {ok:false,error:'奖励无效。'};
  const r=run.rewards[index];
  if(r.type==='boon'){
    const boon=BOONS.find(b=>b.id===r.id);run.boons[boon.id]=(run.boons[boon.id]||0)+1;
    if(boon.type==='stat')for(const p of run.party){p[boon.stat]+=boon.value;if(boon.stat==='maxHp')p.hp+=boon.value;if(boon.stat==='maxMp')p.mp+=boon.value;}
    log(run,`获得祝福「${boon.name}」。`,'loot');
  }else if(r.type==='skill'){
    const hero=run.party.find(p=>p.id===r.heroId);hero.ranks[r.skillId]=(hero.ranks[r.skillId]||0)+1;
    log(run,`${hero.name} 的「${SKILLS[r.skillId].name}」强化至 +${hero.ranks[r.skillId]}。`,'loot');
  }else if(r.type==='weapon'){
    const hero=run.party.find(p=>p.id===heroId);if(!hero)return {ok:false,error:'选择装备此武器的角色。'};
    run.inventory.push(hero.weapon);hero.weapon=r.weapon;
    log(run,`${hero.name} 装备了「${r.weapon.name}」· ${r.weapon.effectName}。`,'loot');
  }
  run.phase='explore';run.rewards=[];return {ok:true};
}
export function equipWeapon(run,heroId,weaponUid) {
  if(run.phase!=='explore')return false;
  const hero=run.party.find(p=>p.id===heroId),index=run.inventory.findIndex(w=>w.uid===weaponUid);
  if(!hero||index<0)return false;
  [hero.weapon,run.inventory[index]]=[run.inventory[index],hero.weapon];log(run,`${hero.name} 换上了「${hero.weapon.name}」。`,'loot');return true;
}
export function serializeRun(run) {return JSON.stringify(run);}
export function restoreRun(text) {
  let r;try{r=JSON.parse(text);}catch{throw new Error('存档无法读取。');}
  if(!r||r.version!==VERSION||!['explore','battle','reward','event','ended'].includes(r.phase)||!Array.isArray(r.party)||r.party.length<1||r.party.length>3||!Number.isInteger(r.floor)||r.floor<1||r.floor>MAX_FLOOR)throw new Error('存档版本或结构不兼容。');
  if(!Number.isInteger(r.rng)||!r.dungeon||!Number.isInteger(r.dungeon.size)||r.dungeon.size<5||r.dungeon.size>31||r.dungeon.tiles?.length!==r.dungeon.size||r.dungeon.tiles.some(row=>!Array.isArray(row)||row.length!==r.dungeon.size||row.some(v=>v!==0&&v!==1)))throw new Error('地图存档损坏。');
  if(!walkable(r.dungeon,r.x,r.y)||!Number.isInteger(r.dir)||r.dir<0||r.dir>3)throw new Error('角色位置无效。');
  if(!r.dungeon.visited||r.dungeon.visited.length!==r.dungeon.size||r.dungeon.visited.some(row=>!Array.isArray(row)||row.length!==r.dungeon.size)||!r.dungeon.events)throw new Error('地图记录损坏。');
  for(const p of r.party) {
    if(!JOBS[p.job]||!WEAPONS[p.weapon?.id]||!Array.isArray(p.skills)||p.skills.some(s=>!SKILLS[s])||!p.ranks||!p.status)throw new Error('角色存档损坏。');
    for(const k of ['hp','maxHp','mp','maxMp','atk','mag','def','spd'])if(!Number.isFinite(p[k])||p[k]<0)throw new Error('角色数值损坏。');
    if(p.maxHp<1||p.hp>p.maxHp||p.mp>p.maxMp)throw new Error('角色数值越界。');
  }
  if(!Array.isArray(r.log)||!Array.isArray(r.inventory)||!Array.isArray(r.rewards)||!r.boons)throw new Error('冒险记录损坏。');
  if(r.phase==='battle'&&(!r.battle||!Array.isArray(r.battle.enemies)||!Array.isArray(r.battle.queue)||!r.party.some(p=>p.id===r.battle.active&&p.hp>0)))throw new Error('战斗记录损坏。');
  if(r.phase==='event'&&(!r.event||!r.dungeon.events[r.event.key]))throw new Error('事件记录损坏。');
  if(r.phase==='reward'&&(r.rewards.length!==3||r.rewards.some(x=>!['boon','weapon','skill'].includes(x.type))))throw new Error('奖励记录损坏。');
  r.fx=[];return r;
}
