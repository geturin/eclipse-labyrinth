import { VERSION, MAX_FLOOR, JOBS, SKILLS, EVOLUTIONS, STATUS, WEAPONS, BOONS, ENEMY_TYPES, ENCOUNTERS, BOSS_SPECS, DIRECTIONS, FLOORS } from './data.js';
import { hash, next, int, pick, shuffle } from './rng.js';
import { key, isFloor, paths, makeDungeon, populatePacks, revealAround, stepPacks, nearbyPacks } from './world.js';

// Pure serializable state: UI, timers and rendering cannot advance combat or the world clock.
export function hashSeed(text){return hash(text);}
export function random(state){return next(state);}
export function integer(state,min,max){return int(state,min,max);}
export function choose(state,items){return pick(state,items);}
export function shuffled(state,items){return shuffle(state,items);}
export function cellKey(x,y){return key(x,y);}
export function walkable(d,x,y){return isFloor(d,x,y);}
export function distances(d,x,y){return paths(d,x,y);}
export function generateDungeon(state,floor=1){return makeDungeon(state,floor);}
export function reinforcementInfo(run){return nearbyPacks(run);}
const live=items=>items.filter(p=>p.hp>0);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const isBoss=e=>!!e.boss;
const magicKinds=['magic','heal','cleanse','revive','sanctuary','haste','dispel','delay','echoTime','focus'];
const magicIntents=['hex','mark','bless','enemyHeal','summon','mirror','sweepMagic'];
const armIntents=['heavy','hunt','sweep','corrode','cover','thorns'];
function log(run,text,tone='info'){run.log.push({text,tone});if(run.log.length>100)run.log.shift();}
export function boonCount(run,id){return run.boons[id]||0;}
export function negativeCount(e){return Object.keys(e.status).filter(id=>STATUS[id]?.negative).length;}
export function heroStats(h){return {atk:h.atk+h.weapon.atk,mag:h.mag+h.weapon.mag,def:h.def,spd:h.spd*(h.status.haste?1.5:1)*(h.status.slow?.6:1)};}
export function effectiveSkill(hero,id){
  const s=SKILLS[id];if(!s)return null;
  return hero.evolutions?.[id]?{...s,...EVOLUTIONS[id].patch,desc:`${s.desc} 觉醒：${EVOLUTIONS[id].desc}`}:{...s};
}
export function makeWeapon(id,floor=1,serial=0){
  const base=WEAPONS[id];if(!base)throw new Error(`Unknown weapon: ${id}`);
  const bonus=Math.max(0,floor-1);
  return {...base,id,uid:`${id}-${floor}-${serial}`,atk:base.atk+(base.atk>base.mag?bonus:Math.floor(bonus/2)),mag:base.mag+(base.mag>=base.atk?bonus:Math.floor(bonus/2)),floor};
}
function makeHero(id,index,solo){
  const j=JOBS[id],hp=Math.round(j.hp*(solo?1.45:1)),mp=Math.round(j.mp*(solo?1.3:1));
  return {id:`hero-${index}`,job:id,name:j.person,maxHp:hp,hp,maxMp:mp,mp,atk:j.atk,mag:j.mag,def:j.def,spd:j.spd,weapon:makeWeapon(j.weapon),skills:[...j.skills],ranks:{},evolutions:{},status:{},resists:{},barrier:0,guard:false,phoenixUsed:false,laststandUsed:false};
}
export function createRun(jobIds,seed){
  if(!Array.isArray(jobIds)||jobIds.length<1||jobIds.length>3||new Set(jobIds).size!==jobIds.length||jobIds.some(j=>!JOBS[j]))throw new Error('请选择 1～3 个不同职业。');
  const cleanSeed=String(seed||'MOON').trim().slice(0,48)||'MOON';
  const run={version:VERSION,seed:cleanSeed,rng:hash(cleanSeed),phase:'explore',floor:1,party:jobIds.map((j,i)=>makeHero(j,i,jobIds.length===1)),level:1,xp:0,nextXp:85,gold:0,boons:{},inventory:[],supplies:{tonic:3,ether:2,salt:2},battles:0,kills:0,steps:0,guardianDefeated:false,log:[],battle:null,rewards:[],event:null,ending:null,fx:[],serial:0,enemySerial:0,solo:jobIds.length===1,comfort:true,lastPosition:{x:1,y:1}};
  enterFloor(run,1);
  log(run,'v0.2 · 明雷探索：每走一格怪物也走一格；战斗每回合末附近小队移动并可能增援。','special');
  if(run.solo)log(run,'独行誓约：生命 +45%、MP +30%、伤害 +20%。独行是挑战模式；利用有限补给与新技能。','special');
  return run;
}
export function reveal(run){revealAround(run);}
function enterFloor(run,floor){
  if(floor>MAX_FLOOR)return;
  run.floor=floor;run.dungeon=makeDungeon(run,floor);run.x=1;run.y=1;run.lastPosition={x:1,y:1};
  run.dir=DIRECTIONS.findIndex(v=>isFloor(run.dungeon,1+v.x,1+v.y));
  run.guardianDefeated=false;run.phase='explore';run.battle=null;run.rewards=[];run.event=null;
  for(const p of run.party){p.status={};p.resists={};p.guard=false;p.barrier=0;}
  if(floor>1){run.supplies.tonic=Math.min(5,run.supplies.tonic+2);run.supplies.ether=Math.min(4,run.supplies.ether+1);run.supplies.salt=Math.min(4,run.supplies.salt+2);}
  populatePacks(run);revealAround(run);log(run,`第 ${floor} 层 · ${FLOORS[floor-1].name} · 四个区域有不同地标、墙面和地面。`,'special');
}
export function turn(run,delta){if(run.phase!=='explore'||!Number.isInteger(delta))return false;run.dir=((run.dir+delta)%4+4)%4;return true;}
export function move(run,kind='forward'){
  if(run.phase!=='explore')return false;
  const offset={forward:0,back:2,left:3,right:1}[kind];if(offset===undefined)return false;
  const v=DIRECTIONS[(run.dir+offset)%4],x=run.x+v.x,y=run.y+v.y;
  if(!isFloor(run.dungeon,x,y))return false;
  run.lastPosition={x:run.x,y:run.y};run.x=x;run.y=y;run.steps++;run.fx=[];revealAround(run);
  const contact=run.dungeon.packs.filter(p=>!p.defeated&&!p.engaged&&p.x===x&&p.y===y);
  const arrivals=stepPacks(run,{hold:contact.map(p=>p.id)});
  if(arrivals.length)startBattle(run,arrivals.some(p=>p.kind==='elite')?'elite':'normal',null,arrivals);
  return true;
}
export function waitTurn(run){
  if(run.phase!=='explore')return false;
  const arrivals=stepPacks(run);log(run,'你停步倾听。地面上的脚步声前进了一拍。','muted');
  if(arrivals.length)startBattle(run,arrivals.some(p=>p.kind==='elite')?'elite':'normal',null,arrivals);
  return true;
}
export function currentEvent(run){const e=run.dungeon.events[key(run.x,run.y)];return e&&!e.used?e:null;}
export function interact(run){
  if(run.phase!=='explore')return false;const e=currentEvent(run);if(!e)return false;
  const origin=key(run.x,run.y);
  if(e.type==='stairs'){
    if(!run.guardianDefeated)startBattle(run,run.floor===MAX_FLOOR?'boss':'guardian',origin);
    else enterFloor(run,run.floor+1);
  }else if(e.type==='chest'){
    e.used=true;run.gold+=int(run,15,25);openRewards(run,'treasure');log(run,'宝箱内有失传的战技。新技能只属于这一局。','loot');
  }else{run.phase='event';run.event={type:e.type,key:origin};}
  return true;
}
export function resolveEvent(run,choice){
  if(run.phase!=='event'||!run.event)return false;const {type,key:k}=run.event;
  if(choice==='leave'){run.phase='explore';run.event=null;return true;}
  if(type==='shrine'&&choice==='rest'){
    for(const p of run.party){p.hp=Math.min(p.maxHp,p.hp+Math.ceil(p.maxHp*.45));p.mp=Math.min(p.maxMp,p.mp+Math.ceil(p.maxMp*.5));p.status={};}
    log(run,'星灯休整：恢复 45% 生命、50% MP。这处灯火只够使用一次。','heal');
  }else if(type==='fountain'&&choice==='drink'){
    for(const p of run.party){p.mp=p.maxMp;p.hp=Math.min(p.maxHp,p.hp+Math.ceil(p.maxHp*.18));}
    log(run,'月之泉恢复了 MP，并补充少量生命。','heal');
  }else if(type==='altar'&&['offer','blood'].includes(choice)){
    if(choice==='offer'){if(run.gold<35)return false;run.gold-=35;}
    else for(const p of live(run.party))p.hp=Math.max(1,p.hp-Math.ceil(p.maxHp*.2));
    run.dungeon.events[k].used=true;run.event=null;openRewards(run,'altar');return true;
  }else return false;
  run.dungeon.events[k].used=true;run.phase='explore';run.event=null;return true;
}
function makeEnemy(run,id,{elite=false,boss=false,packId=null}={}){
  const base=ENEMY_TYPES[id],partyFactor=run.party.length===1?.78:run.party.length===2?1.08:1.35;
  const hp=Math.round(base.hp*(1+(run.floor-1)*(boss?.32:.34))*partyFactor*(elite?1.4:1));
  const atkScale=(1+(run.floor-1)*.25)*(run.solo?.9:1)*(elite?1.18:1);
  const e={...base,id:`enemy-${++run.enemySerial}`,type:id,packId,maxHp:hp,hp,atk:Math.round(base.atk*atkScale),mag:Math.round(base.mag*atkScale),def:base.def+Math.floor((run.floor-1)*1.4),spd:base.spd,status:{},resists:{},guard:false,intentIndex:0,plannedIntent:base.intent[0],targetId:null,charged:false,barrier:0,phoenixUsed:true,summoned:false,skipActions:0,delayReadyRound:0,readyRound:1};
  if(boss){
    const spec=BOSS_SPECS[run.floor-1];e.name=spec.name;e.kind=spec.kind;e.tint=spec.tint;
    e.boss={spec:run.floor-1,hpTriggered:[],hpResolved:[],queued:[],pending:null,nextTurn:3,eventSerial:0,lockNotice:false};
  }
  return e;
}
function defaultTroop(run,type){
  if(type==='boss')return ['sovereign'];if(type==='guardian')return ['guardian'];
  if(type==='elite')return run.solo?['briar']:['sentinel','revenant',...(run.party.length===3?['moth']:[])];
  return pick(run,ENCOUNTERS[run.floor-1]).slice(0,run.solo?1:run.party.length===2?2:3);
}
function joinPacks(run,packs,initial=false){
  const b=run.battle;
  for(const p of packs){
    if(p.defeated||p.engaged)continue;
    const count=p.members?p.members.filter(e=>e.hp>0).length:p.troop.length;
    if(live(b.enemies).length+count>6)continue; // Whole packs wait at the tile, never silently discarded.
    if(!p.members)p.members=p.troop.map(id=>makeEnemy(run,id,{elite:p.kind==='elite',packId:p.id}));
    const members=live(p.members);if(!members.length){p.defeated=true;continue;}
    p.engaged=true;b.packIds.push(p.id);
    for(const e of members){e.status={};e.guard=false;e.readyRound=initial?1:b.round+1;b.enemies.push(e);}
    log(run,`${initial?'遭遇':'增援抵达'}：${p.name} · ${members.length} 体${initial?'':'，下一回合加入行动序列'}。`,initial?'battle':'danger');
  }
}
export function startBattle(run,type='normal',origin=null,packs=null){
  if(run.phase!=='explore')return false;
  run.phase='battle';run.fx=[];
  for(const p of run.party){p.guard=false;p.status={};p.resists={};p.barrier=0;p.phoenixUsed=false;p.laststandUsed=false;}
  run.battle={type,origin,packIds:[],enemies:[],round:0,roundClosed:true,queue:[],active:null,serial:0,chainTarget:null,chainActor:null,chain:0,lastSkill:null,escapeAttempts:0};
  if(packs)joinPacks(run,packs,true);
  else run.battle.enemies=defaultTroop(run,type).map(id=>makeEnemy(run,id,{elite:type==='elite',boss:['boss','guardian'].includes(type)}));
  for(const e of run.battle.enemies)if(e.boss){const spec=BOSS_SPECS[e.boss.spec];addStatus(run,e,spec.buff,99);log(run,`${e.name}：${spec.trait}`,'danger');}
  nextActor(run);return true;
}
export function intentOf(enemy){
  if(enemy.skipActions>0)return 'delay';
  const intent=enemy.plannedIntent||enemy.intent[enemy.intentIndex%enemy.intent.length];
  if((enemy.status.headbind&&magicIntents.includes(intent))||(enemy.status.armbind&&armIntents.includes(intent)))return 'bound';
  return intent;
}
export function activeHero(run){return run.battle?run.party.find(p=>p.id===run.battle.active&&p.hp>0)||null:null;}
export function skillCost(hero,id){
  const s=SKILLS[id];if(!s)return Infinity;let cost=s.cost;
  if(cost&&!['physical','magic','heal','revive','sanctuary'].includes(s.kind)&&!s.supply)cost=Math.max(1,cost-(hero.ranks[id]||0));
  if(cost&&hero.weapon.effect==='overload')cost+=2;if(cost&&hero.weapon.effect==='economy')cost=Math.max(1,Math.floor(cost*.65));return cost;
}
export function skillProblem(run,h,id){
  const s=effectiveSkill(h,id);if(!s||!['attack','guard','tonic','ether','salt',...h.skills].includes(id))return '尚未习得这个技能。';
  if(h.mp<skillCost(h,id))return 'MP 不足；防御回复 3 MP，普攻只回复 1 MP。';
  if(s.supply&&run.supplies[s.supply]<=0)return '这一种队伍补给已用尽。';
  if(h.status.headbind&&magicKinds.includes(s.kind)&&!s.supply)return '封头中，无法施法。';
  if(h.status.armbind&&s.kind==='physical')return '封腕中，无法使用物理技能。';
  if(s.kind==='laststand'&&h.laststandUsed)return '不归之誓每场战斗只能使用一次。';
  return null;
}
function addStatus(run,e,id,turns,power=1,extra={}){
  if(!STATUS[id]||e.hp<=0)return false;
  if(STATUS[id].negative&&e.status.immune)return false;
  if(['headbind','armbind'].includes(id)&&(e.status[id]||(e.resists?.[id]||0)>=run.battle.round)){
    log(run,`${e.name} 暂时抵抗${STATUS[id].name}。`,'muted');return false;
  }
  const old=e.status[id];e.status[id]={turns:Math.max(turns,old?.turns||0),power:Math.max(power,old?.power??0),applied:run.battle?.serial||0,...extra};return true;
}
function cleanseEntity(e){for(const id of Object.keys(e.status))if(STATUS[id]?.negative)delete e.status[id];}
function heal(run,e,amount){
  if(e.hp<=0)return 0;const n=Math.min(e.maxHp-e.hp,Math.max(0,Math.round(amount)));e.hp+=n;
  if(n)run.fx.push({id:e.id,type:'heal',amount:n});return n;
}
function revivePhoenix(run,e){
  if(e.hp<=0&&e.weapon?.effect==='phoenix'&&!e.phoenixUsed){e.phoenixUsed=true;e.hp=Math.ceil(e.maxHp*.35);e.status={};log(run,`${e.name} 的「返魂」发动！`,'special');return true;}return false;
}
function hurt(run,e,amount,source=null,{direct=false}={}){
  if(e.hp<=0)return 0;
  let n=Math.max(1,Math.round(amount));
  if(direct&&e.barrier>0){const absorb=Math.min(e.barrier,n);e.barrier-=absorb;n-=absorb;}
  if(direct&&e.status.laststand&&n>=e.hp){n=Math.max(0,e.hp-1);delete e.status.laststand;log(run,`${e.name} 以「不归」抵住了致命伤。`,'special');}
  if(e.boss){
    const boss=e.boss,spec=BOSS_SPECS[boss.spec];
    for(let i=0;i<spec.hp.length;i++){
      const hp=Math.ceil(e.maxHp*spec.hp[i].at);
      if(!boss.hpTriggered.includes(i)&&e.hp-n<=hp){
        n=Math.max(0,e.hp-hp);boss.hpTriggered.push(i);boss.queued.push({...spec.hp[i],key:`hp-${i}`,hpIndex:i,source:`HP ${Math.round(spec.hp[i].at*100)}%`});
        log(run,`${e.name} 到达 ${Math.round(spec.hp[i].at*100)}% 血线：相位锁吸收过量伤害；「${spec.hp[i].name}」将在下一个可用回合预告。`,'danger');break;
      }
    }
    if(e.hp-n<=0&&boss.hpResolved.length<spec.hp.length){
      n=Math.max(0,e.hp-1);
      if(!boss.lockNotice){log(run,'相位锁：尚未结算的血线预兆保护首领最后 1 HP；先完成应对。','danger');boss.lockNotice=true;}
    }
  }
  n=Math.min(e.hp,Math.max(0,n));e.hp-=n;if(n)run.fx.push({id:e.id,type:'damage',amount:n});
  if(e.hp<=0&&!revivePhoenix(run,e)){
    log(run,`${e.name}${e.job?' 倒下了。':' 被击败。'}`,e.job?'danger':'battle');
    if(!e.job){run.kills++;if(source?.weapon?.effect==='soulsteal'){heal(run,source,source.maxHp*.18);source.mp=Math.min(source.maxMp,source.mp+6);}}
  }
  return n;
}
function tickStart(run,e){
  e.guard=false;
  for(const id of ['burn','poison'])if(e.hp>0&&e.status[id]){const n=hurt(run,e,e.status[id].power);log(run,`${e.name} 受到 ${n} 点${STATUS[id].name}伤害。`,'muted');}
  if(e.job&&e.hp>0)e.mp=Math.min(e.maxMp,e.mp+(e.job==='chrono'?1:0)+boonCount(run,'focus'));
}
function tickEnd(run,e){
  for(const [id,s]of Object.entries(e.status)){
    if(s.expiresRound!==undefined||s.persistent||s.applied===run.battle.serial)continue;
    s.turns--;if(s.turns<=0){delete e.status[id];if(['headbind','armbind'].includes(id))e.resists[id]=run.battle.round+2;}
  }
}
function dispel(run,e,count){
  // Ritual barrier first: the response window is never hidden behind irrelevant buffs.
  const ids=Object.keys(e.status).filter(id=>STATUS[id]?.dispellable).sort((a,b)=>(a==='veil'?-1:0)-(b==='veil'?-1:0));
  for(const id of ids.slice(0,count)){delete e.status[id];log(run,`${e.name} 的「${STATUS[id].name}」被驱散。`,'special');}
  return Math.min(count,ids.length);
}
function planEnemy(run,e){
  e.plannedIntent=e.intent[e.intentIndex%e.intent.length];
  const living=live(run.party);
  const marked=living.filter(p=>p.status.marked||p.status.poison);
  const target=e.plannedIntent==='hunt'&&marked.length?marked[0]:e.plannedIntent==='mark'?living.slice().sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0]:pick(run,living);
  e.targetId=target?.id||null;
}
function summon(run,owner,type,ritualFor=null){
  if(live(run.battle.enemies).length>=6)return null;
  const e=makeEnemy(run,type,{packId:ritualFor?null:owner.packId});e.readyRound=run.battle.round+1;e.ritualFor=ritualFor;
  run.battle.enemies.push(e);
  if(owner.packId&&!ritualFor){const p=run.dungeon.packs.find(p=>p.id===owner.packId);p?.members?.push(e);}
  log(run,`${owner.name} 召来 ${e.name}，下一回合开始行动。`,'danger');return e;
}
function armTrigger(run,e,event){
  const boss=e.boss;event={...event,id:`${e.id}-omen-${++boss.eventSerial}`,bornRound:run.battle.round,dueRound:run.battle.round,hits:0,required:run.party.length+1,delayed:false};
  if(['dispel','seal'].includes(event.counter))addStatus(run,e,'veil',99,1,{ritual:event.id});
  if(event.counter==='adds'){
    const count=run.solo?1:2;event.addIds=[];
    for(let i=0;i<count;i++){const add=summon(run,e,i%2?'moth':'wisp',event.id);if(add)event.addIds.push(add.id);}
    // Summons cannot make a crowded encounter unanswerable; the warning states the actual count.
  }
  boss.pending=event;
  log(run,`预兆「${event.name}」· ${event.source} · 第 ${event.dueRound} 回合末发动。${counterText(event)}`,'danger');
}
export function counterText(omen){
  return {guard:'全队防御或架设壁垒降低伤害。',dispel:'驱散「仪式结界」即可取消；否则重创全队并强化首领。',hits:`对首领累计 ${omen.required} 次直接命中可取消；未达标时需防御。`,adds:`击败标记为「仪式」的侍从可取消（${omen.addIds?.length??0} 体）；否则需防御。`,seal:'封头或驱散仪式结界可取消；否则首领造成群伤并自我治疗。'}[omen.counter];
}
export function bossWarnings(run){
  if(!run.battle)return [];
  return live(run.battle.enemies).filter(isBoss).map(e=>({enemyId:e.id,name:e.name,trait:BOSS_SPECS[e.boss.spec].trait,thresholds:BOSS_SPECS[e.boss.spec].hp.map((t,i)=>({at:t.at,done:e.boss.hpResolved.includes(i)})),pending:e.boss.pending,queued:e.boss.queued.map(q=>q.name),nextTurn:e.boss.nextTurn}));
}
function bossHit(run,e){
  const o=e.boss?.pending;if(o&&o.counter==='hits')o.hits++;
}
function enemyDamage(run,e,target,power,magic=false,{trigger=false}={}){
  if(target.hp<=0||e.hp<=0)return;
  if(target.status.dodge?.power>0){target.status.dodge.power--;if(!target.status.dodge.power)delete target.status.dodge;log(run,`${target.name} 的残影避开了 ${e.name}。`,'special');return;}
  let dmg=Math.max(3,(magic?e.mag:e.atk)*power-target.def*(magic?.3:.65))*(.94+next(run)*.12);
  if(target.guard)dmg*=.35;if(target.status.protect)dmg*=1-(target.status.protect.power||.4);
  if(target.job==='knight'&&!magic)dmg*=.82;
  if(target.status.break&&!magic)dmg*=1.3;if(target.status.marked)dmg*=1.2;
  if(e.status.fury)dmg*=1.3;if(e.status.weak)dmg*=.75;if(e.status.rage)dmg*=e.status.rage.power;
  const dealt=hurt(run,target,dmg,e,{direct:true});
  log(run,`${e.name}${trigger?' · 预兆':''} → ${target.name} ${dealt} 伤害`,'enemy');
  if(target.hp>0&&target.status.counter&&e.hp>0){
    const counter=target.status.counter;const n=hurt(run,e,heroStats(target).atk*(counter.power||1.1),target,{direct:true});bossHit(run,e);
    log(run,`${target.name} 反击 ${e.name} ${n} 伤害。`,'special');
    if(counter.charges){counter.charges--;if(counter.charges<=0)delete target.status.counter;}
  }
}
function enemyAct(run,e){
  const intent=intentOf(e);
  if(intent==='delay'){e.skipActions--;log(run,`${e.name} 的行动被延后。`,'special');return;}
  // A seal consumes the original action, rather than stockpiling casts until it expires.
  e.intentIndex++;
  if(intent==='cover'){
    for(const ally of live(run.battle.enemies))addStatus(run,ally,'protect',2,.35);
    e.coverUntil=run.battle.round;log(run,`${e.name} 守护全队，并分担本回合单体攻击。`,'enemy');return;
  }
  if(intent==='bless'){for(const ally of live(run.battle.enemies))addStatus(run,ally,'fury',3);log(run,'敌方支援者为全队施加狂热。','danger');return;}
  if(intent==='enemyHeal'){
    const ally=live(run.battle.enemies).slice().sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
    const n=heal(run,ally,e.mag*1.15+run.floor*4);log(run,`${e.name} 治疗 ${ally.name} ${n} 生命。`,'enemy');return;
  }
  if(['thorns','mirror','guard'].includes(intent)){
    if(intent==='guard')e.guard=true;else addStatus(run,e,intent,3);
    log(run,`${e.name} 展开${intent==='thorns'?'荆棘反甲':intent==='mirror'?'魔镜':'防御'}。`,'danger');return;
  }
  if(intent==='summon'){
    if(!e.summoned){const add=summon(run,e,'moth');if(add)e.summoned=true;return;}
    heal(run,e,e.mag*.6);return;
  }
  if(intent==='charge'){e.charged=true;return;}
  const party=live(run.party);let target=party.find(p=>p.id===e.targetId)||party[0];
  const bait=party.find(p=>p.status.taunt);if(bait)target=bait;
  const targets=['sweep','sweepMagic'].includes(intent)?party:[target];
  for(const p of targets){
    if(!p||e.hp<=0)break;
    if(intent==='mark'){addStatus(run,p,'marked',3);log(run,`${e.name} 标记了 ${p.name}；猎手将追击。`,'danger');continue;}
    const power=intent==='heavy'?1.5:intent==='hunt'?(p.status.marked||p.status.poison?1.75:1.15):['sweep','sweepMagic'].includes(intent)?.85:intent==='bound'?.5:1;
    enemyDamage(run,e,p,power*(e.charged?1.8:1),['hex','drain','sweepMagic'].includes(intent));
    if(p.hp>0){
      if(intent==='hex')addStatus(run,p,'burn',2,Math.max(3,Math.round(e.mag*.25)));
      if(intent==='poison')addStatus(run,p,'poison',3,Math.max(4,Math.round(e.atk*.3)));
      if(intent==='corrode')addStatus(run,p,'break',3);
    }
  }
  e.charged=false;
}
function resolveTrigger(run,e){
  const o=e.boss.pending;if(!o||o.dueRound>run.battle.round)return;
  const cancelled=o.counter==='dispel'?!e.status.veil:o.counter==='seal'?!!e.status.headbind||!e.status.veil:o.counter==='hits'?o.hits>=o.required:o.counter==='adds'?!run.battle.enemies.some(a=>a.hp>0&&a.ritualFor===o.id):false;
  if(cancelled){
    log(run,`预兆解除：「${o.name}」！首领失衡，获得 2 次行动破甲与衰弱。`,'special');
    addStatus(run,e,'break',2);addStatus(run,e,'weak',2);delete e.status.veil;
  }else{
    log(run,`预兆发动：「${o.name}」！${o.counter==='guard'?'防御与壁垒正在减轻伤害。':'未满足解除条件。'}`,'danger');
    for(const p of live(run.party)){
      enemyDamage(run,e,p,2.65,e.boss.spec===1||e.boss.spec===2||e.boss.spec===4,{trigger:true});
      if(p.hp>0&&e.boss.spec===1)addStatus(run,p,'poison',2,Math.round(e.mag*.25));
      if(p.hp>0&&e.boss.spec===3)addStatus(run,p,'slow',2);
    }
    if(o.counter==='dispel')addStatus(run,e,'fury',3);
    if(o.counter==='seal')heal(run,e,e.maxHp*.08);
  }
  if(o.hpIndex!==undefined)e.boss.hpResolved.push(o.hpIndex);
  e.boss.pending=null;e.boss.lockNotice=false;
}
function newRound(run){
  const b=run.battle;b.round++;b.roundClosed=false;b.chain=0;b.chainActor=null;b.chainTarget=null;
  for(const e of live(b.enemies))if(e.boss){
    const boss=e.boss,spec=BOSS_SPECS[boss.spec];
    if(b.round>=13)addStatus(run,e,'rage',99,1+(b.round-12)*.12);
    if(!boss.pending){
      if(boss.queued.length)armTrigger(run,e,boss.queued.shift());
      else if(b.round>=boss.nextTurn){armTrigger(run,e,{key:`turn-${b.round}`,name:spec.turnName,counter:spec.turnCounter,source:`第 ${b.round} 回合`});boss.nextTurn=b.round+spec.period;}
    }
  }
  for(const e of live(b.enemies))planEnemy(run,e);
  const units=[...live(run.party),...live(b.enemies).filter(e=>e.readyRound<=b.round)];
  b.queue=units.map(e=>({id:e.id,speed:e.job?heroStats(e).spd:e.spd*(e.status.haste?1.5:1)*(e.status.slow?.6:1),tie:next(run)})).sort((a,c)=>c.speed-a.speed||c.tie-a.tie).map(e=>e.id);
}
function closeRound(run){
  const b=run.battle;if(b.roundClosed||b.round===0)return;
  b.roundClosed=true;b.queue=[];
  for(const e of live(b.enemies))if(e.boss)resolveTrigger(run,e);
  // Round-long defenses persist through the trigger, then expire; this order is intentional.
  for(const e of [...run.party,...b.enemies])for(const [id,s]of Object.entries(e.status))if(s.expiresRound!==undefined&&s.expiresRound<=b.round)delete e.status[id];
  if(live(run.party).length)joinPacks(run,stepPacks(run,{battle:true}));
}
function checkFinish(run){
  const b=run.battle;if(!b)return true;
  if(!live(run.party).length){run.phase='ended';run.ending='defeat';b.active=null;log(run,'星灯熄灭了。下一次，带着新的战术重新出发。','danger');return true;}
  if(!live(b.enemies).length){
    closeRound(run); // Even the final partial round advances nearby packs once before victory.
    if(!live(run.party).length)return checkFinish(run);
    if(!live(b.enemies).length){finishBattle(run);return true;}
  }
  return false;
}
function nextActor(run){
  for(let i=0;i<180&&run.phase==='battle';i++){
    if(checkFinish(run))return;const b=run.battle;
    if(!b.queue.length){if(b.round&&!b.roundClosed)closeRound(run);if(checkFinish(run))return;newRound(run);}
    const id=b.queue.shift(),e=[...run.party,...b.enemies].find(e=>e.id===id);
    if(!e||e.hp<=0)continue;
    b.serial++;b.active=id;tickStart(run,e);if(checkFinish(run))return;if(e.hp<=0)continue;
    if(e.job)return;
    enemyAct(run,e);tickEnd(run,e);if(checkFinish(run))return;
  }
  if(run.phase==='battle'&&!activeHero(run))throw new Error('Turn scheduler did not reach a player action.');
}
function applySkillStatus(run,h,target,s){
  if(!s.status||target.hp<=0)return;
  const stats=heroStats(h),offense=s.kind==='magic'?stats.mag:stats.atk;
  const power=['burn','poison'].includes(s.status)?Math.max(3,Math.round(offense*(s.status==='burn'?.28:.44)*(1+boonCount(run,'embers')*.2))):1;
  addStatus(run,target,s.status,s.turns||2,power);
}
function damageTarget(run,h,target,s,rank,extraScale=1){
  if(target.hp<=0)return;
  const stats=heroStats(h),isMagic=s.kind==='magic'||(s.kind==='attack'&&['mage','shrine','chrono'].includes(h.job));
  const offense=isMagic?stats.mag*(s.kind==='attack'?.55:1):stats.atk;
  const power=s.kind==='attack'&&isMagic?1:(s.power||1);
  if(s.dispel)dispel(run,target,s.dispel);
  const burning=!!target.status.burn,poisoned=!!target.status.poison,negative=negativeCount(target),effect=h.weapon.effect;
  const ignores=h.status.pierce&&s.kind==='physical';
  let damage=Math.max(2,offense*power*(1+rank*.12)-target.def*(ignores?0:s.revenge?.3:isMagic?.35:.7))*(.94+next(run)*.12)*extraScale;
  if(run.solo)damage*=1.2;
  if(h.status.fury)damage*=1.3;if(h.status.haste)damage*=1.1;if(h.status.weak)damage*=.75;
  if(target.status.break&&!isMagic)damage*=1.3;if(target.status.marked)damage*=1.15;
  if(h.job==='ninja'&&negative)damage*=1.2;if(h.job==='reaver'&&h.hp<h.maxHp*.5)damage*=1.3;
  if(s.exploit)damage*=1+Math.min(4,negative)*.15;if(s.revenge)damage*=1+(1-h.hp/h.maxHp)*1.4;
  if(s.element===target.weak&&s.element)damage*=1.4*(h.job==='mage'?1.2:1);
  if(s.element==='ice'&&burning){damage*=1.5;delete target.status.burn;if(s.freezeSeal)addStatus(run,target,'headbind',1);log(run,'融解：冰焰交汇，消耗燃烧并提高伤害。','special');}
  if(effect==='execution'&&target.hp<target.maxHp*.4)damage*=1.5;
  if(effect==='frostbite'&&target.status.slow)damage*=1.4;
  if(effect==='firstlight'&&run.battle.round<=2)damage*=1.4;
  if(effect==='bloodmoon'&&h.hp<h.maxHp*.5)damage*=1.45;
  if(effect==='overload'&&s.kind!=='attack')damage*=1.4;if(effect==='affliction')damage*=1+negative*.18;
  const b=run.battle;
  if(s.kind!=='attack'){
    if(b.chainTarget===target.id&&b.chainActor!==h.id){b.chain=Math.min(3,b.chain+1);damage*=1+b.chain*.08+boonCount(run,'harmony')*.1;}
    else if(b.chainActor!==h.id||b.chainTarget!==target.id)b.chain=0;
    b.chainTarget=target.id;b.chainActor=h.id;
  }else{b.chain=0;b.chainTarget=null;b.chainActor=null;}
  const crit=next(run)<Math.min(.35,.05+boonCount(run,'critical')*.05+(h.job==='ninja'?.04:0));if(crit)damage*=1.5;
  if(target.guard)damage*=.5;if(target.status.protect)damage*=1-target.status.protect.power;
  if(target.status.moonarmor&&!isMagic&&!target.status.break)damage*=.35;
  if(target.status.mirror&&isMagic)damage*=.2;if(target.status.veil)damage*=.45;
  const cover=s.target==='enemy'?live(b.enemies).find(e=>e.id!==target.id&&e.coverUntil>=b.round):null;
  if(cover){hurt(run,cover,damage*.4,h,{direct:true});damage*=.6;log(run,`${cover.name} 分担了对 ${target.name} 的攻击。`,'muted');}
  const dealt=hurt(run,target,damage,h,{direct:true});bossHit(run,target);
  log(run,`${h.name} · ${s.name} → ${target.name} ${dealt}${crit?' 暴击':''}`,'player');
  const drain=(s.drain||0)+(effect==='vampire'?.08:0)+boonCount(run,'siphon')*.03;if(drain)heal(run,h,dealt*drain);
  if(target.status.thorns&&!isMagic&&dealt>0){hurt(run,h,Math.max(3,dealt*.25),target);log(run,`${target.name} 的荆棘反甲反噬 ${h.name}。`,'danger');}
  if(target.hp>0){
    applySkillStatus(run,h,target,s);
    if(s.weaken)addStatus(run,target,'weak',2);
    const procs={guardbreak:['break',.3],kindle:['burn',.25],toxin:['poison',.25],frostbite:['slow',.3]};
    if(procs[effect]&&next(run)<procs[effect][1]){const id=procs[effect][0];addStatus(run,target,id,2,['burn','poison'].includes(id)?Math.max(3,Math.round(offense*.25)):1);}
    if(effect==='echo'&&next(run)<.28){const n=hurt(run,target,dealt*.45,h,{direct:true});bossHit(run,target);log(run,`武器回响追加 ${n} 伤害。`,'special');}
  }
  if(s.spread)for(const other of live(b.enemies).filter(e=>e!==target))applySkillStatus(run,h,other,{...s,status:'burn'});
  if(s.spreadPoison&&poisoned)for(const other of live(b.enemies).filter(e=>e!==target))applySkillStatus(run,h,other,s);
  if(effect==='cleave'&&s.target==='enemy')for(const other of live(b.enemies).filter(e=>e!==target)){hurt(run,other,dealt*.25,h,{direct:true});bossHit(run,other);}
}
export function act(run,skillId,targetId=null){
  if(run.phase!=='battle')return {ok:false,error:'不在战斗中。'};
  const h=activeHero(run);if(!h)return {ok:false,error:'尚未轮到我方行动。'};
  if(skillId==='escape')return escapeBattle(run,h);
  const problem=skillProblem(run,h,skillId);if(problem)return {ok:false,error:problem};
  const s=effectiveSkill(h,skillId),b=run.battle;
  let targets=[];
  if(s.target==='enemy'){const e=b.enemies.find(e=>e.id===targetId&&e.hp>0);if(!e)return {ok:false,error:'请选择存活的敌人。'};targets=[e];}
  else if(s.target==='enemies')targets=live(b.enemies);
  else if(s.target==='self')targets=[h];
  else if(s.target==='allies')targets=live(run.party);
  else if(s.target==='ally'){const p=run.party.find(p=>p.id===targetId&&(p.hp>0||s.kind==='revive'));if(!p)return {ok:false,error:'请选择有效队友。'};targets=[p];}
  if(s.kind==='dispel'&&!Object.keys(targets[0].status).some(id=>STATUS[id]?.dispellable))return {ok:false,error:'这个目标没有可驱散的强化。'};
  if(s.kind==='delay'){
    const e=targets[0];
    if(e.boss&&(!e.boss.pending||e.boss.pending.delayed))return {ok:false,error:'没有可延后的预兆；每个预兆只能延后一次。'};
    if(!e.boss&&(e.skipActions>0||e.delayReadyRound>b.round))return {ok:false,error:'目标暂时抵抗行动延后。'};
  }
  // No RNG or resources are touched until all ownership, target and availability checks pass.
  h.mp-=skillCost(h,skillId);if(s.supply)run.supplies[s.supply]--;run.fx=[];b.lastSkill=skillId;
  const rank=h.ranks[skillId]||0,scale=1+rank*.12,stats=heroStats(h);
  const roundBuff=(p,id,power=1,extra={})=>addStatus(run,p,id,1,power,{expiresRound:b.round,...extra});
  if(['physical','magic','attack'].includes(s.kind)){
    const focused=s.kind==='magic'&&!!h.status.focus,echo=s.kind!=='attack'&&!!h.status.echo;
    const repeats=focused?2:1,hits=s.hits||1;
    if(focused)delete h.status.focus;if(echo)delete h.status.echo;
    for(let pass=0;pass<repeats+(echo?1:0);pass++)for(let hit=0;hit<hits;hit++)for(const e of targets)if(h.hp>0&&e.hp>0)damageTarget(run,h,e,s,rank,pass>=repeats?.6:focused?.9:1);
    if(s.kind==='physical')delete h.status.pierce;
    if(skillId==='attack')h.mp=Math.min(h.maxMp,h.mp+1);
    if(skillId==='starfall')roundBuff(h,'counter',1.1,{charges:1});
  }else if(s.kind==='guard'){h.guard=true;h.mp=Math.min(h.maxMp,h.mp+3);log(run,`${h.name} 防御，回复 3 MP。`,'heal');}
  else if(s.kind==='aegis'){
    for(const p of live(run.party))roundBuff(p,'protect',.4);
    addStatus(run,h,'taunt',2);if(s.retaliate)roundBuff(h,'counter',1.1,{charges:1});log(run,`${h.name} 展开壁垒：本回合全队减伤，自己吸引攻击。`,'special');
  }else if(s.kind==='counter'){roundBuff(h,'protect',.5);roundBuff(h,'counter',1.1);addStatus(run,h,'taunt',2);}
  else if(s.kind==='intercept'){for(const p of targets){roundBuff(p,'protect',.6);roundBuff(p,'immune');}}
  else if(s.kind==='heal'){
    const p=targets[0],amount=(stats.mag*1.65+12)*scale*(h.job==='shrine'?1.15:1),actual=heal(run,p,amount);
    if(s.overflow){p.barrier=Math.min(Math.ceil(p.maxHp*.25),p.barrier+Math.max(0,Math.round(amount)-actual));log(run,`${p.name} 获得 ${p.barrier} 点余辉护盾。`,'special');}
  }else if(s.kind==='cleanse'){for(const p of targets){cleanseEntity(p);if(s.immunity)roundBuff(p,'immune');}log(run,'净铃解除了全队异常。','heal');}
  else if(s.kind==='revive'){
    const p=targets[0];if(p.hp<=0){p.hp=Math.min(p.maxHp,Math.ceil(p.maxHp*.35*scale));p.status={};run.fx.push({id:p.id,type:'heal',amount:p.hp});}else heal(run,p,p.maxHp*.35*scale);
  }else if(s.kind==='sanctuary'){for(const p of targets){heal(run,p,(stats.mag+12)*scale*1.15);cleanseEntity(p);roundBuff(p,'immune');}}
  else if(s.kind==='seal'){for(const e of targets)addStatus(run,e,'headbind',s.turns);}
  else if(s.kind==='phantom'){roundBuff(h,'dodge',2);roundBuff(h,'taunt');}
  else if(s.kind==='haste'){for(const p of targets)addStatus(run,p,'haste',3);}
  else if(s.kind==='dispel')dispel(run,targets[0],s.dispel);
  else if(s.kind==='delay'){
    const e=targets[0];if(e.boss){e.boss.pending.dueRound++;e.boss.pending.delayed=true;log(run,`预兆延至第 ${e.boss.pending.dueRound} 回合末，仍须完成解除条件。`,'special');}
    else{e.skipActions++;e.delayReadyRound=b.round+3;}
  }else if(s.kind==='focus')addStatus(run,h,'focus',99,1,{persistent:true});
  else if(s.kind==='echoTime')addStatus(run,targets[0],'echo',99,1,{persistent:true});
  else if(s.kind==='bloodpact'){
    h.hp=Math.max(1,h.hp-Math.ceil(h.maxHp*.18));h.mp=Math.min(h.maxMp,h.mp+8+rank*2);addStatus(run,h,'fury',3);
    if(s.pierce)addStatus(run,h,'pierce',99,1,{persistent:true});
  }else if(s.kind==='laststand'){h.laststandUsed=true;roundBuff(h,'laststand');}
  else if(s.kind==='itemHeal')heal(run,targets[0],targets[0].maxHp*.35);
  else if(s.kind==='itemMp')targets[0].mp=Math.min(targets[0].maxMp,targets[0].mp+14);
  if(h.hp>0){
    if(h.weapon.effect==='lifewell')heal(run,h,h.maxHp*.02);
    if(h.weapon.effect==='mana')h.mp=Math.min(h.maxMp,h.mp+1);
    if(h.weapon.effect==='chorus'){const p=live(run.party).sort((a,c)=>a.hp/a.maxHp-c.hp/c.maxHp)[0];if(p)heal(run,p,8);}
  }
  tickEnd(run,h);if(!checkFinish(run))nextActor(run);return {ok:true};
}
function escapeBattle(run,h){
  const b=run.battle;if(['guardian','boss'].includes(b.type))return {ok:false,error:'月门封闭，首领战不能撤退。'};
  run.fx=[];b.escapeAttempts++;
  if(b.escapeAttempts>=2||next(run)<.7){
    for(const p of run.dungeon.packs.filter(p=>b.packIds.includes(p.id))){p.members=b.enemies.filter(e=>e.packId===p.id);p.defeated=!live(p.members).length;p.engaged=false;p.cooldown=2;}
    for(const p of run.party){p.status={};p.guard=false;p.barrier=0;}
    run.battle=null;run.phase='explore';log(run,'成功撤退。敌人保留剩余生命，在原地整顿两次移动；现在应离开这一格。','muted');return {ok:true};
  }
  log(run,'撤退失败；下次撤退必定成功。','danger');tickEnd(run,h);nextActor(run);return {ok:true};
}
function finishBattle(run){
  const b=run.battle;run.battles++;
  for(const p of run.dungeon.packs.filter(p=>b.packIds.includes(p.id))){p.defeated=true;p.engaged=false;p.members=b.enemies.filter(e=>e.packId===p.id);}
  const xp=18+run.floor*8+b.enemies.length*7+(b.type!=='normal'?25:0),coins=int(run,12,22)*run.floor;run.xp+=xp;run.gold+=coins;
  for(const p of run.party){
    if(p.hp<=0)p.hp=Math.ceil(p.maxHp*.1);
    p.hp=Math.min(p.maxHp,p.hp+Math.ceil(p.maxHp*(.02+boonCount(run,'victory')*.04)));p.mp=Math.min(p.maxMp,p.mp+1);p.status={};p.resists={};p.guard=false;p.barrier=0;
  }
  while(run.xp>=run.nextXp&&run.level<12){
    run.xp-=run.nextXp;run.level++;run.nextXp=65+run.level*35;
    for(const p of run.party){p.maxHp+=5;p.hp=Math.min(p.maxHp,p.hp+5);p.maxMp+=2;p.mp=Math.min(p.maxMp,p.mp+2);p[JOBS[p.job].growth]++;if(p.job==='knight'&&run.level%2===0)p.def++;}
    log(run,`Lv.${run.level}：职业主属性成长；不再大量回满生命与 MP。`,'special');
  }
  log(run,`战斗胜利 · 经验 +${xp} · 星砂 +${coins}`,'loot');
  if(b.origin&&run.dungeon.events[b.origin]&&['guardian','boss'].includes(b.type))run.guardianDefeated=true;
  if(b.type==='boss'){run.phase='ended';run.ending='victory';b.active=null;log(run,'最后的预兆崩解，月蚀终于结束。','special');return;}
  run.battle=null;openRewards(run,b.type==='normal'?'battle':'elite');
}
export function growthChoices(run){
  const choices=[];
  for(const p of run.party){
    for(const id of JOBS[p.job].advanced)if(!p.skills.includes(id)&&run.floor>=(SKILLS[id].minFloor||1))choices.push({type:'learn',heroId:p.id,skillId:id});
    for(const id of p.skills)if(EVOLUTIONS[id]&&(p.ranks[id]||0)>=1&&!p.evolutions[id])choices.push({type:'evolve',heroId:p.id,skillId:id});
  }
  return choices;
}
function upgradeReward(run){
  const pairs=run.party.flatMap(p=>p.skills.filter(id=>(p.ranks[id]||0)<2).map(id=>({type:'skill',heroId:p.id,skillId:id})));
  return pairs.length?pick(run,pairs):null;
}
function weaponReward(run,source){
  const legendary=source==='altar'||(run.floor>=3&&next(run)<.25)||(source==='elite'&&run.floor>=2&&next(run)<.3);
  const pool=Object.keys(WEAPONS).filter(id=>WEAPONS[id].rarity===(legendary?'legendary':'rare'));
  return {type:'weapon',weapon:makeWeapon(pick(run,pool),run.floor,++run.serial)};
}
export function openRewards(run,source='battle'){
  run.phase='reward';run.rewardSource=source;run.event=null;
  const boons=shuffle(run,BOONS.filter(b=>boonCount(run,b.id)<b.cap));
  const growth=shuffle(run,growthChoices(run));
  const first=growth[0]||upgradeReward(run)||weaponReward(run,source);
  // Solitary medic is explicitly offered its first attack art in the first treasure.
  if(run.solo&&run.party[0].job==='shrine'&&source==='treasure'&&!run.party[0].skills.includes('ray'))Object.assign(first,{type:'learn',heroId:run.party[0].id,skillId:'ray'});
  const options=[first,boons[0]?{type:'boon',id:boons[0].id}:weaponReward(run,source)];
  options.push(['treasure','altar','elite'].includes(source)?weaponReward(run,source):upgradeReward(run)||weaponReward(run,source));
  // Reject repeated upgrade cards without consuming the player's entire choice slot.
  if(options[0].type===options[2].type&&options[0].heroId===options[2].heroId&&options[0].skillId===options[2].skillId)options[2]=weaponReward(run,source);
  run.rewards=shuffle(run,options);return run.rewards;
}
export function takeReward(run,index,heroId=null){
  if(run.phase!=='reward'||!Number.isInteger(index)||!run.rewards[index])return {ok:false,error:'奖励无效。'};
  const r=run.rewards[index];
  if(r.type==='boon'){
    const boon=BOONS.find(b=>b.id===r.id);if(!boon||boonCount(run,boon.id)>=boon.cap)return {ok:false,error:'祝福已达到上限。'};
    run.boons[boon.id]=boonCount(run,boon.id)+1;
    if(boon.type==='stat')for(const p of run.party){p[boon.stat]+=boon.value;if(boon.stat==='maxHp')p.hp=Math.min(p.maxHp,p.hp+boon.value);if(boon.stat==='maxMp')p.mp=Math.min(p.maxMp,p.mp+boon.value);}
    log(run,`获得祝福「${boon.name}」。`,'loot');
  }else if(['skill','learn','evolve'].includes(r.type)){
    const p=run.party.find(p=>p.id===r.heroId),allowed=p&&[...JOBS[p.job].skills,...JOBS[p.job].advanced].includes(r.skillId);
    if(!allowed)return {ok:false,error:'技能不属于此职业。'};
    if(r.type==='learn'){
      if(p.skills.includes(r.skillId)||run.floor<(SKILLS[r.skillId].minFloor||1))return {ok:false,error:'当前不能习得此技能。'};
      p.skills.push(r.skillId);log(run,`${p.name} 习得新技能「${SKILLS[r.skillId].name}」！`,'special');
    }else if(r.type==='evolve'){
      if(!p.skills.includes(r.skillId)||!EVOLUTIONS[r.skillId]||p.evolutions[r.skillId]||(p.ranks[r.skillId]||0)<1)return {ok:false,error:'尚未满足觉醒条件。'};
      p.evolutions[r.skillId]=true;log(run,`${p.name} 觉醒「${EVOLUTIONS[r.skillId].name}」：${EVOLUTIONS[r.skillId].desc}`,'special');
    }else{
      if(!p.skills.includes(r.skillId)||(p.ranks[r.skillId]||0)>=2)return {ok:false,error:'技能熟练度已达上限或尚未习得。'};
      p.ranks[r.skillId]=(p.ranks[r.skillId]||0)+1;log(run,`${p.name} 的「${SKILLS[r.skillId].name}」熟练度 +${p.ranks[r.skillId]}，初始技能 +1 后可抽取机制觉醒。`,'loot');
    }
  }else if(r.type==='weapon'){
    const p=run.party.find(p=>p.id===heroId);if(!p)return {ok:false,error:'请选择武器持有者。'};
    run.inventory.push(p.weapon);p.weapon=r.weapon;log(run,`${p.name} 装备「${r.weapon.name}」· 固有效果「${r.weapon.effectName}」。`,'loot');
  }else return {ok:false,error:'未知奖励。'};
  run.phase='explore';run.rewards=[];return {ok:true};
}
export function equipWeapon(run,heroId,uid){
  if(run.phase!=='explore')return false;const p=run.party.find(p=>p.id===heroId),i=run.inventory.findIndex(w=>w.uid===uid);
  if(!p||i<0)return false;[p.weapon,run.inventory[i]]=[run.inventory[i],p.weapon];log(run,`${p.name} 换上了「${p.weapon.name}」。`,'loot');return true;
}
export function serializeRun(run){return JSON.stringify(run);}
export function restoreRun(text){
  let r;try{r=JSON.parse(text);}catch{throw new Error('存档无法读取。');}
  if(r?.version!==VERSION)throw new Error('v0.2 战术规则需要新的一局；v0.1 存档未删除，但不兼容新规则。');
  const fail=msg=>{throw new Error(`存档损坏：${msg}`);};
  if(!['explore','battle','reward','event','ended'].includes(r.phase)||!Array.isArray(r.party)||r.party.length<1||r.party.length>3||!Number.isInteger(r.floor)||r.floor<1||r.floor>MAX_FLOOR||!Number.isInteger(r.rng))fail('冒险结构');
  const d=r.dungeon;
  if(!d||!Number.isInteger(d.size)||d.size<5||d.size>31||!Array.isArray(d.tiles)||d.tiles.length!==d.size||d.tiles.some(row=>!Array.isArray(row)||row.length!==d.size||row.some(v=>v!==0&&v!==1)))fail('地图');
  for(const field of ['visited','zones'])if(!Array.isArray(d[field])||d[field].length!==d.size||d[field].some(row=>!Array.isArray(row)||row.length!==d.size))fail(field);
  if(d.zones.some(row=>row.some(z=>!Number.isInteger(z)||z<0||z>3))||!d.events||!Array.isArray(d.packs)||!Array.isArray(d.landmarks)||!Number.isInteger(d.elapsed))fail('区域与明雷');
  if(!isFloor(d,r.x,r.y)||!Number.isInteger(r.dir)||r.dir<0||r.dir>3)fail('位置');
  if(new Set(r.party.map(p=>p.id)).size!==r.party.length||new Set(r.party.map(p=>p.job)).size!==r.party.length)fail('重复队员');
  for(const p of r.party){
    if(!JOBS[p.job]||!WEAPONS[p.weapon?.id]||!Array.isArray(p.skills)||!p.ranks||!p.evolutions||!p.status||!p.resists)fail('角色');
    const allowed=[...JOBS[p.job].skills,...JOBS[p.job].advanced];
    if(new Set(p.skills).size!==p.skills.length||p.skills.some(id=>!allowed.includes(id))||Object.entries(p.ranks).some(([id,n])=>!p.skills.includes(id)||!Number.isInteger(n)||n<0||n>2)||Object.keys(p.evolutions).some(id=>!EVOLUTIONS[id]||!p.skills.includes(id)))fail('技能');
    for(const k of ['hp','maxHp','mp','maxMp','atk','mag','def','spd','barrier'])if(!Number.isFinite(p[k])||p[k]<0)fail('角色数值');
    if(p.maxHp<1||p.hp>p.maxHp||p.mp>p.maxMp)fail('角色上限');
  }
  if(!r.supplies||['tonic','ether','salt'].some(k=>!Number.isInteger(r.supplies[k])||r.supplies[k]<0||r.supplies[k]>99))fail('补给');
  if(!Array.isArray(r.log)||!Array.isArray(r.inventory)||!Array.isArray(r.rewards)||!r.boons)fail('记录');
  if(Object.entries(r.boons).some(([id,n])=>!BOONS.some(b=>b.id===id&&Number.isInteger(n)&&n>=0&&n<=b.cap)))fail('祝福');
  if(new Set(d.packs.map(p=>p.id)).size!==d.packs.length||d.packs.some(p=>!isFloor(d,p.x,p.y)||!Array.isArray(p.troop)||p.troop.some(id=>!ENEMY_TYPES[id])))fail('敌方小队');
  if(r.phase==='battle'){
    const b=r.battle;
    if(!b||!Array.isArray(b.enemies)||!Array.isArray(b.queue)||!Number.isInteger(b.round)||b.round<1||!r.party.some(p=>p.id===b.active&&p.hp>0))fail('战斗');
    if(new Set(b.enemies.map(e=>e.id)).size!==b.enemies.length||b.enemies.some(e=>!ENEMY_TYPES[e.type]||!Number.isFinite(e.hp)||e.hp<0||e.hp>e.maxHp||!e.status||!e.resists))fail('敌人');
    const ids=[...r.party,...b.enemies].map(e=>e.id);if(b.queue.some(id=>!ids.includes(id)))fail('行动序列');
    for(const e of b.enemies)if(e.boss){const x=e.boss;if(!BOSS_SPECS[x.spec]||!Array.isArray(x.queued)||!Array.isArray(x.hpTriggered)||!Array.isArray(x.hpResolved))fail('首领');if(x.pending&&(!Number.isInteger(x.pending.dueRound)||x.pending.dueRound<x.pending.bornRound))fail('预兆');}
    // JSON loses object identity. Re-link active map packs to live combat actors for retreat/resume.
    for(const p of d.packs)if(p.engaged)p.members=b.enemies.filter(e=>e.packId===p.id);
  }
  if(r.phase==='event'&&(!r.event||!d.events[r.event.key]))fail('事件');
  if(r.phase==='reward'&&(r.rewards.length!==3||r.rewards.some(x=>!['boon','weapon','skill','learn','evolve'].includes(x.type))))fail('奖励');
  r.fx=[];return r;
}
