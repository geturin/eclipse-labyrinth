import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';
import { JOBS, SKILLS, EVOLUTIONS, BOSS_SPECS, BOONS, DIRECTIONS } from '../src/data.js';
import { stepPacks, nearbyPacks, regionAt, visiblePacks } from '../src/world.js';
const copy=x=>JSON.parse(JSON.stringify(x));
function fixture(job='knight',troop=['slime']){
  const r=E.createRun([job,job==='chrono'?'shrine':'chrono'],'TACTICAL');r.dungeon.packs=[];
  for(const [i,p] of r.party.entries()){p.spd=200-i*10;p.weapon.effect='none';}
  const pack={id:'fixture',troop,name:'Test formation',x:r.x,y:r.y,engaged:false,defeated:false,members:null};
  E.startBattle(r,'normal',null,[pack]);
  for(const e of r.battle.enemies){e.hp=e.maxHp=10000;e.atk=e.mag=2;}
  return r;
}
function cast(r,id,target){return E.act(r,id,target??r.battle.enemies.find(e=>e.hp>0)?.id);}
function again(r){r.battle.active=r.party[0].id;r.battle.queue=[r.party[1].id];r.party[0].mp=r.party[0].maxMp;}
function bossFixture(floor=1,job='chrono'){
 const r=E.createRun([job,...['knight','shrine','ninja'].filter(j=>j!==job).slice(0,2)],'OMEN');r.dungeon.packs=[];r.floor=floor;
 r.party.forEach((p,i)=>{p.spd=200-i*10;p.hp=p.maxHp=1500;p.weapon.effect='none';});
 E.startBattle(r,floor===5?'boss':'guardian');const boss=r.battle.enemies[0];boss.atk=boss.mag=15;
 return r;
}
function arm(r,counter){
 const b=r.battle,e=b.enemies[0];e.hp=e.maxHp=10000;e.boss.hpTriggered=BOSS_SPECS[e.boss.spec].hp.map((_,i)=>i);e.boss.hpResolved=[...e.boss.hpTriggered];
 e.boss.nextTurn=100;e.boss.queued=[{key:'test',name:'Test Omen',counter,source:'fixture'}];e.status={};b.queue=[];assert.ok(cast(r,'guard').ok);
 assert.equal(b.round,2);assert.equal(e.boss.pending.bornRound,2);return e;
}
function finishRound(r,choose=()=>['guard']){
 const round=r.battle.round;let count=0;
 while(r.phase==='battle'&&r.battle.round===round&&count++<10){const h=E.activeHero(r),[id,target]=choose(h,r);assert.ok(E.act(r,id,target).ok,`${id} at round ${round}`);}
 assert.ok(count<=10);
}
function openField(r){
 const d=r.dungeon;for(let y=1;y<d.size-1;y++)for(let x=1;x<d.size-1;x++)d.tiles[y][x]=0;
 r.x=5;r.y=5;r.dir=1;r.dungeon.packs=[];return r;
}
function pack(id,x,y,troop=['slime']){return {id,x,y,home:{x,y},previous:null,kind:'normal',troop,name:id,alert:0,cooldown:0,engaged:false,defeated:false,members:null};}

test('roles: only medic starts with a healing spell; no shared attack/heal/guard triplets',()=>{
 assert.deepEqual(Object.values(JOBS).filter(j=>j.skills.some(id=>SKILLS[id].kind==='heal')).map(j=>j.id),['shrine']);
 assert.equal(new Set(Object.values(JOBS).map(j=>j.skills.join(','))).size,6);
 for(const j of Object.values(JOBS)){assert.equal(j.skills.length,2);assert.equal(j.advanced.length,3);assert.ok(j.skills.every(id=>!j.advanced.includes(id)));}
});
for(const [job,j] of Object.entries(JOBS))test(`${job}: all advanced arts are earned, floor-gated and not inherited`,()=>{
 const r=E.createRun([job],'LEARN');const h=r.party[0];
 for(const id of j.advanced){assert.ok(!h.skills.includes(id));r.phase='reward';r.rewards=[{type:'learn',heroId:h.id,skillId:id}];
  if(SKILLS[id].minFloor>1){assert.equal(E.takeReward(r,0).ok,false);r.floor=SKILLS[id].minFloor;}
  assert.ok(E.takeReward(r,0).ok);assert.ok(h.skills.includes(id));r.phase='reward';r.rewards=[{type:'learn',heroId:h.id,skillId:id}];assert.equal(E.takeReward(r,0).ok,false);
 }
 assert.deepEqual(E.createRun([job],'LEARN').party[0].skills,j.skills);
});
test('rewards guarantee an eligible new skill or evolution, with no duplicate numerical cards',()=>{
 for(let i=0;i<100;i++){const r=E.createRun(['knight','mage','shrine'],`reward-${i}`);E.openRewards(r);assert.equal(r.rewards.length,3);assert.ok(r.rewards.some(x=>x.type==='learn'));assert.equal(new Set(r.rewards.map(x=>JSON.stringify(x))).size,3);}
});
test('solo medic gets a guaranteed attack-art option from its first chest',()=>{const r=E.createRun(['shrine'],'medic');E.openRewards(r,'treasure');assert.ok(r.rewards.some(x=>x.type==='learn'&&x.skillId==='ray'));});
test('mastery is capped at two and evolution requires mastery one',()=>{
 const r=E.createRun(['knight'],'rank'),p=r.party[0];r.phase='reward';r.rewards=[{type:'evolve',heroId:p.id,skillId:'cleave'}];assert.equal(E.takeReward(r,0).ok,false);
 p.ranks.cleave=1;assert.ok(E.takeReward(r,0).ok);assert.ok(p.evolutions.cleave);
 r.phase='reward';r.rewards=[{type:'skill',heroId:p.id,skillId:'cleave'}];assert.ok(E.takeReward(r,0).ok);
 r.phase='reward';r.rewards=[{type:'skill',heroId:p.id,skillId:'cleave'}];assert.equal(E.takeReward(r,0).ok,false);
});
test('blessing caps are enforced rather than infinite multiplicative growth',()=>{for(const b of BOONS){const r=E.createRun(['knight'],'cap');r.boons[b.id]=b.cap;r.phase='reward';r.rewards=[{type:'boon',id:b.id}];assert.equal(E.takeReward(r,0).ok,false);}});
for(const id of Object.keys(EVOLUTIONS))test(`evolution ${id} changes the effective art without mutating shared definitions`,()=>{
 const job=Object.values(JOBS).find(j=>j.skills.includes(id)).id,r=fixture(job),h=r.party[0],base=copy(SKILLS[id]);h.evolutions[id]=true;
 assert.notDeepEqual(E.effectiveSkill(h,id),SKILLS[id]);assert.deepEqual(SKILLS[id],base);
});
test('evolved knight strike dispels before applying damage',()=>{const r=fixture(),e=r.battle.enemies[0];e.status.veil={turns:99,power:1};r.party[0].evolutions.cleave=true;assert.ok(cast(r,'cleave').ok);assert.equal(e.status.veil,undefined);assert.ok(e.status.break);});
test('evolved fire spreads actual burn to other enemies',()=>{const r=fixture('mage',['slime','sentinel']);r.party[0].evolutions.fire=true;assert.ok(cast(r,'fire').ok);assert.ok(r.battle.enemies.every(e=>e.status.burn?.power>0));});
test('evolved frost consumes burn and applies a head seal',()=>{const r=fixture('mage'),e=r.battle.enemies[0];r.party[0].evolutions.frost=true;e.status.burn={turns:2,power:4};assert.ok(cast(r,'frost').ok);assert.equal(e.status.burn,undefined);assert.ok(e.status.headbind);});
test('evolved heal stores bounded overheal as a real damage shield',()=>{const r=fixture('shrine'),h=r.party[0];h.evolutions.mend=true;assert.ok(E.act(r,'mend',h.id).ok);assert.equal(h.barrier,Math.ceil(h.maxHp*.25));});
test('evolved cleanse grants same-round immunity, but does not heal',()=>{const r=fixture('shrine'),h=r.party[0];h.evolutions.cleanse=true;h.hp=20;assert.ok(cast(r,'cleanse').ok);assert.equal(h.hp,20);assert.ok(r.party.every(p=>p.status.immune));});
test('evolved poison spreads only after the primary target is already poisoned',()=>{const r=fixture('ninja',['slime','wisp']);r.party[0].evolutions.venom=true;cast(r,'venom');assert.equal(r.battle.enemies[1].status.poison,undefined);again(r);cast(r,'venom');assert.ok(r.battle.enemies[1].status.poison);});
test('evolved seal and haste change targeting to a whole side',()=>{const a=fixture('ninja',['slime','wisp']);a.party[0].evolutions.seal=true;assert.ok(E.act(a,'seal').ok);assert.ok(a.battle.enemies.every(e=>e.status.headbind));const b=fixture('chrono');b.party[0].evolutions.haste=true;assert.ok(E.act(b,'haste').ok);assert.ok(b.party.every(p=>p.status.haste));});
test('evolved pulse really weakens enemy damage',()=>{const r=fixture('chrono');r.party[0].evolutions.pulse=true;cast(r,'pulse');assert.ok(r.battle.enemies[0].status.weak);});
test('evolved rend emits two direct hits, not just a power multiplier',()=>{const r=fixture('reaver');r.party[0].evolutions.rend=true;cast(r,'rend');assert.equal(r.log.filter(x=>x.tone==='player').length,2);});
test('evolved blood pact stores and then consumes armor penetration',()=>{const r=fixture('reaver');r.party[0].evolutions.bloodpact=true;cast(r,'bloodpact');assert.ok(r.party[0].status.pierce);again(r);cast(r,'rend');assert.equal(r.party[0].status.pierce,undefined);});
test('focused spells perform two casts and consume focus exactly once',()=>{const r=fixture('mage');r.party[0].skills.push('focuscast');cast(r,'focuscast');again(r);cast(r,'fire');assert.equal(r.log.filter(x=>x.tone==='player').length,2);assert.equal(r.party[0].status.focus,undefined);});
test('time echo adds one sixty-percent cast and cannot persist forever',()=>{const r=fixture('mage');r.party[0].status.echo={turns:99,persistent:true,power:1};cast(r,'fire');assert.equal(r.log.filter(x=>x.tone==='player').length,2);assert.equal(r.party[0].status.echo,undefined);});
test('sealed spells are rejected without consuming resources or RNG',()=>{const r=fixture('mage');r.party[0].status.headbind={turns:2,power:1};const before=E.serializeRun(r);assert.equal(cast(r,'fire').ok,false);assert.equal(E.serializeRun(r),before);assert.ok(cast(r,'attack').ok);});
test('reapplying a seal never refreshes its duration; after-expiry resistance prevents a lock',()=>{const r=fixture('ninja'),e=r.battle.enemies[0];cast(r,'seal');e.status.headbind.turns=1;again(r);cast(r,'seal');assert.equal(e.status.headbind.turns,1);delete e.status.headbind;e.resists.headbind=r.battle.round+2;again(r);cast(r,'seal');assert.equal(e.status.headbind,undefined);});
test('finite supplies consume an action, reject invalid recipients and cannot be used below zero',()=>{const r=fixture(),h=r.party[0];h.hp=1;r.supplies.tonic=1;const before=E.serializeRun(r);assert.equal(cast(r,'tonic').ok,false);assert.equal(E.serializeRun(r),before);assert.ok(E.act(r,'tonic',h.id).ok);assert.ok(h.hp>1);assert.equal(r.supplies.tonic,0);again(r);assert.equal(E.act(r,'tonic',h.id).ok,false);});
test('dispel rejects an unbuffed target and prioritizes the ritual barrier',()=>{const r=fixture(),e=r.battle.enemies[0];const before=E.serializeRun(r);assert.equal(cast(r,'salt').ok,false);assert.equal(E.serializeRun(r),before);e.status.fury={turns:2,power:1};e.status.veil={turns:99,power:1};cast(r,'salt');assert.equal(e.status.veil,undefined);assert.ok(e.status.fury);});
for(let floor=1;floor<=5;floor++)test(`B${floor} has a unique persistent trait and real HP gates`,()=>{const r=bossFixture(floor,'shrine'),e=r.battle.enemies[0],h=r.party[0];assert.ok(e.status[BOSS_SPECS[floor-1].buff]);h.mag=10000;h.skills.push('ray');cast(r,'ray');assert.equal(e.hp,Math.ceil(e.maxHp*BOSS_SPECS[floor-1].hp[0].at));assert.equal(e.boss.queued.length,1);assert.equal(e.boss.pending,null);assert.equal(e.boss.hpTriggered.length,1);});
test('turn trigger is armed before any player acts and resolves only after all player turns',()=>{const r=bossFixture(),e=r.battle.enemies[0];finishRound(r);finishRound(r);assert.equal(r.battle.round,3);assert.ok(e.boss.pending);const round=r.battle.round;cast(r,'guard');assert.equal(r.battle.round,round);assert.ok(e.boss.pending);finishRound(r);assert.equal(e.boss.pending,null);assert.ok(r.log.some(l=>l.text.includes('预兆发动')));});
test('barrier dispel cancels an omen and leaves the boss vulnerable',()=>{const r=bossFixture(),e=arm(r,'dispel');cast(r,'salt');finishRound(r);assert.equal(e.boss.pending,null);assert.ok(e.status.break);assert.ok(e.status.weak);assert.ok(r.log.some(l=>l.text.includes('预兆解除')));});
test('ignoring a barrier trigger does real team damage and buffs the boss',()=>{const r=bossFixture(),e=arm(r,'dispel'),hp=r.party.map(p=>p.hp);finishRound(r);assert.ok(e.status.fury);assert.ok(r.party.every((p,i)=>p.hp<hp[i]));assert.ok(r.log.some(l=>l.text.includes('未满足解除条件')));});
test('head seal cancels a seal-type omen without spending a dispel',()=>{const r=bossFixture(3,'ninja'),e=arm(r,'seal');cast(r,'seal');finishRound(r);assert.ok(r.log.some(l=>l.text.includes('预兆解除')));assert.equal(e.status.veil,undefined);});
test('multi-hit arts count independently toward hit-based cancellation',()=>{const r=bossFixture(4,'ninja'),e=arm(r,'hits');r.party[0].skills.push('execute');cast(r,'execute');assert.equal(e.boss.pending.hits,3);finishRound(r,()=>['attack',e.id]);assert.ok(r.log.some(l=>l.text.includes('预兆解除')));});
test('ritual adds have explicit identity and killing them cancels the add omen',()=>{const r=bossFixture(2,'shrine'),e=arm(r,'adds');const o=e.boss.pending;assert.equal(o.addIds.length,2);for(const add of r.battle.enemies.filter(a=>a.ritualFor===o.id)){assert.equal(add.readyRound,r.battle.round+1);add.hp=1;}finishRound(r,()=>{const target=r.battle.enemies.find(a=>a.hp>0&&a.ritualFor===o.id);return target?['attack',target.id]:['guard'];});assert.ok(r.log.some(l=>l.text.includes('预兆解除')));});
test('delay grants exactly one extra full round and rejects a second delay',()=>{const r=bossFixture(),e=arm(r,'dispel');r.party[0].skills.push('delay');cast(r,'delay');assert.equal(e.boss.pending.dueRound,3);again(r);assert.equal(cast(r,'delay').ok,false);finishRound(r);assert.ok(e.boss.pending);finishRound(r,()=>['guard']);assert.equal(e.boss.pending,null);});
test('guard and wall reduce trigger damage without making a party invulnerable',()=>{const r=bossFixture(1,'knight'),e=arm(r,'guard'),hp=r.party.map(p=>p.hp);cast(r,'aegis');finishRound(r);assert.ok(r.party.every((p,i)=>p.hp<hp[i]));const reduced=r.party.map((p,i)=>hp[i]-p.hp);const a=bossFixture(1,'knight');arm(a,'guard');const hp2=a.party.map(p=>p.hp);finishRound(a,()=>['attack',a.battle.enemies[0].id]);assert.ok(reduced.every((n,i)=>n<(hp2[i]-a.party[i].hp)));});
test('Boss damage-over-time uses caster power rather than a percentage of boss HP',()=>{const a=bossFixture(1,'shrine'),b=copy(a);for(const r of [a,b]){const e=r.battle.enemies[0];e.boss=null;e.status={poison:{turns:2,power:9,applied:-1}};e.plannedIntent='guard';r.battle.queue=[e.id,r.party[1].id];}a.battle.enemies[0].hp=a.battle.enemies[0].maxHp=1000;b.battle.enemies[0].hp=b.battle.enemies[0].maxHp=100000;cast(a,'guard');cast(b,'guard');assert.equal(1000-a.battle.enemies[0].hp,9);assert.equal(100000-b.battle.enemies[0].hp,9);});
test('turn thirteen introduces escalating boss pressure',()=>{const r=bossFixture(),e=r.battle.enemies[0];r.battle.round=12;r.battle.queue=[];e.boss.nextTurn=100;cast(r,'guard');assert.equal(r.battle.round,13);assert.ok(e.status.rage.power>1);});
test('enemy support really buffs the formation before a hunter attacks',()=>{const r=fixture('knight',['revenant','moth']);const [s,m]=r.battle.enemies;s.plannedIntent='bless';m.plannedIntent='hunt';r.battle.queue=[s.id,m.id,r.party[1].id];cast(r,'guard');assert.ok(m.status.fury);assert.ok(r.log.some(l=>l.text.includes('狂热')));});
test('head seal suppresses support behavior instead of replaying it later',()=>{const r=fixture('ninja',['revenant']);const e=r.battle.enemies[0];e.plannedIntent='bless';r.battle.queue=[e.id,r.party[1].id];cast(r,'seal');assert.equal(e.status.fury,undefined);assert.equal(e.intentIndex,1);});
test('enemy heal picks the most injured ally and restores actual HP',()=>{const r=fixture('knight',['revenant','moth']);const [s,m]=r.battle.enemies;s.plannedIntent='enemyHeal';m.hp=100;r.battle.queue=[s.id,r.party[1].id];cast(r,'guard');assert.ok(m.hp>100);});
test('each generated floor has all four material regions and reachable landmarks',()=>{for(let i=1;i<=5;i++){const r=E.createRun(['knight'],`zones-${i}`);r.dungeon=E.generateDungeon(r,i);assert.equal(new Set(r.dungeon.zones.flat()).size,4);assert.equal(new Set(r.dungeon.landmarks.map(l=>regionAt(r.dungeon,l.x,l.y).style)).size,4);}});
test('one step advances each roaming pack by at most one walkable cardinal cell',()=>{for(let i=0;i<40;i++){const r=E.createRun(['knight'],`move-${i}`),prev=r.dungeon.packs.map(p=>({...p}));stepPacks(r);r.dungeon.packs.forEach((p,n)=>{assert.ok(Math.abs(p.x-prev[n].x)+Math.abs(p.y-prev[n].y)<=1);assert.ok(E.walkable(r.dungeon,p.x,p.y));});assert.equal(r.dungeon.elapsed,1);}});
test('turning and wall collisions never move monsters or consume RNG',()=>{const r=E.createRun(['knight'],'CLOCK'),before=copy(r.dungeon.packs),rng=r.rng;r.dir=0;assert.equal(E.move(r),false);E.turn(r,1);assert.deepEqual(r.dungeon.packs,before);assert.equal(r.dungeon.elapsed,0);assert.equal(r.rng,rng);});
test('a player stepping into a visible pack initiates its exact formation',()=>{const r=openField(E.createRun(['knight','shrine'],'CONTACT')),p=pack('contact',6,5,['wisp','moth']);r.dungeon.packs=[p];assert.ok(E.move(r));assert.equal(r.phase,'battle');assert.deepEqual(r.battle.enemies.map(e=>e.type),p.troop);assert.ok(p.engaged);});
test('waiting advances world time without a player step and lets a pursuer initiate contact',()=>{const r=openField(E.createRun(['knight'],'WAIT'));r.dungeon.packs=[pack('hunter',6,5)];assert.ok(E.waitTurn(r));assert.equal(r.steps,0);assert.equal(r.phase,'battle');assert.equal(r.dungeon.elapsed,1);});
test('battle noise moves only packs within eight path steps, one cell per completed round',()=>{const r=openField(E.createRun(['knight','shrine'],'NOISE'));const near=pack('near',9,5),far=pack('far',13,13);r.dungeon.packs=[near,far];r.party.forEach(p=>p.spd=100);E.startBattle(r);r.battle.enemies.forEach(e=>{e.hp=e.maxHp=10000;e.atk=e.mag=1;});const round=r.battle.round;cast(r,'guard');assert.equal(r.battle.round,round);assert.equal(near.x,9);cast(r,'guard');assert.equal(near.x,8);assert.deepEqual([far.x,far.y],[13,13]);assert.equal(r.dungeon.elapsed,1);});
test('arriving reinforcements join once and start on the next round, not immediately',()=>{const r=openField(E.createRun(['knight','shrine'],'JOIN'));const p=pack('joining',6,5,['wisp','moth']);r.dungeon.packs=[p];r.party.forEach(h=>h.spd=200);E.startBattle(r);const oldIds=r.battle.enemies.map(e=>e.id);r.battle.enemies.forEach(e=>{e.hp=e.maxHp=10000;e.atk=e.mag=1;});finishRound(r);const adds=r.battle.enemies.filter(e=>!oldIds.includes(e.id));assert.equal(adds.length,2);assert.ok(adds.every(e=>e.readyRound===2&&e.intentIndex===0));assert.equal(r.battle.packIds.filter(id=>id===p.id).length,1);finishRound(r);assert.equal(r.battle.packIds.filter(id=>id===p.id).length,1);});
test('last kill still advances nearby packs before awarding loot',()=>{const r=openField(E.createRun(['ninja','shrine'],'LAST'));r.dungeon.packs=[pack('last',6,5)];r.party.forEach(h=>h.spd=200);E.startBattle(r);r.battle.enemies.forEach(e=>e.hp=0);r.battle.enemies[0].hp=1;cast(r,'attack',r.battle.enemies[0].id);assert.equal(r.phase,'battle');assert.ok(r.battle.enemies.some(e=>e.packId==='last'&&e.hp>0));assert.equal(r.dungeon.elapsed,1);});
test('enemy cap keeps whole additional packs waiting instead of deleting or duplicating them',()=>{const r=openField(E.createRun(['knight'],'CAP'));r.dungeon.packs=[pack('waiting',6,5,['wisp','moth'])];r.party[0].spd=200;E.startBattle(r);const e=r.battle.enemies[0];e.hp=e.maxHp=10000;e.atk=e.mag=1;r.battle.enemies=Array.from({length:5},(_,i)=>({...copy(e),id:`fixed-${i}`}));r.battle.queue=r.battle.enemies.map(e=>e.id);cast(r,'guard');assert.equal(r.battle.enemies.length,5);assert.equal(r.dungeon.packs[0].engaged,false);assert.deepEqual([r.dungeon.packs[0].x,r.dungeon.packs[0].y],[5,5]);});
test('escape preserves enemy wounds, drops engagement, and does not award loot',()=>{const r=openField(E.createRun(['ninja'],'ESCAPE'));const p=pack('wounded',5,5);r.dungeon.packs=[p];E.startBattle(r,'normal',null,[p]);const e=r.battle.enemies[0];e.hp=20;r.battle.escapeAttempts=1;assert.ok(E.act(r,'escape').ok);assert.equal(r.phase,'explore');assert.equal(p.engaged,false);assert.equal(p.members[0].hp,20);assert.equal(p.cooldown,2);assert.equal(r.battles,0);});
test('map discovery controls visible markers but unexplored nearby packs still make sound',()=>{const r=openField(E.createRun(['knight'],'MARKER'));r.dungeon.packs=[pack('hidden',9,5)];assert.equal(visiblePacks(r).length,0);assert.equal(nearbyPacks(r)[0].known,false);E.reveal(r);assert.equal(visiblePacks(r).length,1);assert.equal(nearbyPacks(r)[0].distance,4);});
test('saved combat relinks live pack members and preserves deterministic reinforcement movement',()=>{const a=openField(E.createRun(['ninja','shrine'],'SAVE-PACK')),p=pack('engaged',5,5),q=pack('incoming',8,5);a.dungeon.packs=[p,q];a.party.forEach(h=>h.spd=200);E.startBattle(a,'normal',null,[p]);const b=E.restoreRun(E.serializeRun(a));assert.equal(b.dungeon.packs[0].members[0],b.battle.enemies[0]);finishRound(a);finishRound(b);assert.deepEqual(a,b);});
test('pending boss omen and qualitative evolution survive a save round-trip',()=>{const a=bossFixture(),e=arm(a,'dispel');a.party[0].ranks.haste=1;a.party[0].evolutions.haste=true;const b=E.restoreRun(E.serializeRun(a));assert.deepEqual(b.battle.enemies[0].boss.pending,e.boss.pending);assert.equal(E.effectiveSkill(b.party[0],'haste').target,'allies');cast(a,'salt');cast(b,'salt');finishRound(a);finishRound(b);assert.deepEqual(a,b);});
test('v1 saves are rejected and malformed v2 skill ownership cannot bypass classes',()=>{const r=E.createRun(['knight'],'INVALID');r.version=1;assert.throws(()=>E.restoreRun(E.serializeRun(r)));r.version=2;r.party[0].skills.push('mend');assert.throws(()=>E.restoreRun(E.serializeRun(r)));});
test('successive huge hits cannot skip all HP gates or kill an unresolved boss',()=>{
 const r=bossFixture(1,'shrine'),e=r.battle.enemies[0],h=r.party[0];h.mag=10000;h.skills.push('ray');
 for(let i=0;i<4;i++){r.battle.active=h.id;r.battle.queue=[r.party[1].id];h.mp=h.maxMp;assert.ok(cast(r,'ray').ok);}
 assert.equal(e.hp,1);assert.deepEqual(e.boss.hpTriggered,[0,1]);assert.equal(e.boss.queued.length,2);assert.equal(e.boss.hpResolved.length,0);assert.equal(r.phase,'battle');
});
test('an actual gated final boss can reach victory only after its HP omen windows resolve',()=>{
 const r=bossFixture(5,'shrine');const e=r.battle.enemies[0];r.party.forEach(h=>{h.hp=h.maxHp=5000;h.atk=h.mag=1000;});
 let actions=0;while(r.phase==='battle'&&actions++<90){const h=E.activeHero(r);h.mp=h.maxMp;assert.ok(cast(r,'attack',r.battle.enemies.find(a=>a.hp>0).id).ok);}
 assert.equal(r.phase,'ended');assert.equal(r.ending,'victory');assert.equal(e.boss.hpResolved.length,BOSS_SPECS[4].hp.length);
 assert.ok(r.log.some(l=>l.text.includes('预兆发动')||l.text.includes('预兆解除')));
});
