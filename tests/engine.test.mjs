import test from 'node:test';
import assert from 'node:assert/strict';
import { JOBS, SKILLS, WEAPONS, BOONS, MAX_FLOOR, VERSION } from '../src/data.js';
import { hashSeed, random, createRun, generateDungeon, distances, walkable, move, turn, currentEvent, interact, resolveEvent, startBattle, activeHero, act, heroStats, skillCooldown, attackRound, cooldownLeft, makeWeapon, openRewards, takeReward, equipWeapon, serializeRun, restoreRun, cellKey } from '../src/engine.js';

const copy=x=>JSON.parse(JSON.stringify(x));
function ready(job='knight',seed='TEST'){
  const r=createRun([job,job==='chrono'?'shrine':'chrono'],seed);r.dungeon.packs=[];
  startBattle(r);r.battle.enemies=r.battle.enemies.slice(0,1);
  const enemy=r.battle.enemies[0];enemy.maxHp=enemy.hp=10000;enemy.atk=enemy.mag=0;enemy.intent=['mark'];enemy.plannedIntent='mark';
  r.battle.queue=r.battle.queue.filter(id=>r.party.some(p=>p.id===id)||id===enemy.id);
  return r;
}
function deal(r,id='attack'){const enemy=r.battle.enemies[0],before=enemy.hp;if(id==='attack')for(const h of r.party.slice(1))h.guard=true;assert.equal(act(r,id,enemy.id).ok,true);return before-enemy.hp;}
function killBattle(r){r.dungeon.packs=[];for(const foe of r.battle.enemies){if(foe.boss)foe.boss.hpResolved=[0,1,2];foe.boss=null;foe.status={};}let turns=0;while(r.phase==='battle'&&turns++<100){const h=activeHero(r);h.atk=10000;h.mag=10000;const enemy=r.battle.enemies.find(e=>e.hp>0);assert.equal(act(r,'attack',enemy.id).ok,true);}assert.notEqual(r.phase,'battle');}

// 150 seeds x 5 floor sizes: all walkable cells and all events must be reachable.
test('750 generated floors have sealed borders, connected rooms and reachable stairs',()=>{
  for(let seed=0;seed<150;seed++)for(let floor=1;floor<=MAX_FLOOR;floor++){
    const d=generateDungeon({rng:hashSeed(`map-${seed}`)},floor),dist=distances(d,1,1);
    let count=0;
    for(let y=0;y<d.size;y++)for(let x=0;x<d.size;x++){
      if(x===0||y===0||x===d.size-1||y===d.size-1)assert.equal(d.tiles[y][x],1);
      if(d.tiles[y][x]===0){count++;assert.notEqual(dist[cellKey(x,y)],undefined);}
    }
    assert.equal(Object.keys(dist).length,count);
    for(const key of Object.keys(d.events))assert.ok(dist[key]>0);
    assert.ok(dist[cellKey(d.stairs.x,d.stairs.y)]>=10);
    assert.equal(d.events[cellKey(d.stairs.x,d.stairs.y)].type,'stairs');
    assert.ok(Object.values(d.events).some(x=>x.type==='shrine'));
    assert.ok(Object.values(d.events).some(x=>x.type==='chest'));
  }
});
test('seed + party reproduces identical initial state',()=>assert.deepEqual(createRun(['knight','mage'],'A'),createRun(['knight','mage'],'A')));
test('different seeds produce different maps',()=>assert.notDeepEqual(createRun(['knight'],'A').dungeon.tiles,createRun(['knight'],'B').dungeon.tiles));
test('RNG is serializable and stays in [0, 1)',()=>{const a={rng:123},b={rng:123};for(let i=0;i<200;i++){const x=random(a);assert.ok(x>=0&&x<1);assert.equal(x,random(b));}});
test('invalid and duplicate parties are rejected',()=>{for(const party of [[],['bad'],['mage','mage'],['mage','knight','chrono','shrine']])assert.throws(()=>createRun(party,'x'));});
test('all six classes have two starting and three advanced skills and unique passive text',()=>{assert.equal(Object.keys(JOBS).length,6);for(const j of Object.values(JOBS)){assert.equal(j.skills.length,2);assert.equal(j.advanced.length,3);for(const id of j.skills)assert.ok(SKILLS[id]);assert.ok(j.passiveDesc.length>10);}});
test('only weapon slot exists; every one of 18 weapons has a fixed effect',()=>{assert.equal(Object.keys(WEAPONS).length,18);for(const [id,w]of Object.entries(WEAPONS)){assert.ok(w.effect&&w.effectName&&w.desc);assert.equal(makeWeapon(id).effect,w.effect);}const h=createRun(['ninja'],'x').party[0];assert.ok(h.weapon);assert.equal(h.armor,undefined);assert.equal(h.accessory,undefined);});
test('solo oath scales HP; MP has been removed',()=>{const solo=createRun(['mage'],'solo'),team=createRun(['mage','knight'],'solo');assert.equal(solo.party[0].maxHp,Math.round(team.party[0].maxHp*1.45));assert.equal(solo.party[0].maxMp,undefined);});
test('new runs reset levels, weapon loot, boons and skill ranks',()=>{const a=createRun(['knight'],'reset');a.level=12;a.boons.siphon=3;a.party[0].ranks.cleave=3;a.party[0].weapon=makeWeapon('comet');const b=createRun(['knight'],'reset');assert.equal(b.level,1);assert.deepEqual(b.boons,{});assert.deepEqual(b.party[0].ranks,{});assert.equal(b.party[0].weapon.id,'moonblade');});
test('turning does not advance encounters, steps or RNG',()=>{const r=createRun(['knight'],'turn'),before=r.rng;turn(r,1);turn(r,-1);assert.equal(r.steps,0);assert.equal(r.rng,before);assert.equal(r.dungeon.elapsed,0);});
test('walls block grid movement and do not spend a turn',()=>{const r=createRun(['knight'],'wall');r.dir=0;assert.equal(move(r),false);assert.equal(r.y,1);assert.equal(r.steps,0);});
test('empty space never rolls a hidden encounter',()=>{const r=createRun(['knight'],'move');r.dungeon.packs=[];assert.ok(move(r));assert.equal(r.steps,1);assert.equal(r.dungeon.elapsed,1);assert.equal(r.phase,'explore');});
test('movement and turns are disabled during battle',()=>{const r=ready(),before=[r.x,r.y,r.dir];assert.equal(move(r),false);assert.equal(turn(r,1),false);assert.deepEqual([r.x,r.y,r.dir],before);});
test('basic attack commits one whole turn and never creates MP',()=>{const r=ready('ninja');deal(r);assert.equal(r.battle.round,2);assert.equal(r.party[0].mp,undefined);});
test('guard is a free stance until the committed turn ends',()=>{const r=ready();assert.ok(act(r,'guard').ok);assert.equal(r.party[0].guard,true);assert.equal(r.battle.round,1);attackRound(r);assert.equal(r.party[0].guard,false);});
test('invalid skill/target and active cooldown do not consume a turn or RNG',()=>{const r=ready(),before=serializeRun(r);assert.equal(act(r,'fire','enemy-0').ok,false);assert.equal(serializeRun(r),before);assert.equal(act(r,'cleave','nope').ok,false);assert.equal(serializeRun(r),before);r.party[0].cooldowns.cleave=2;const after=serializeRun(r);assert.equal(act(r,'cleave',r.battle.enemies[0].id).ok,false);assert.equal(serializeRun(r),after);});
test('physical attacks exploit break but magic does not',()=>{const a=ready(),b=copy(a);a.party[0].weapon.effect=b.party[0].weapon.effect='none';b.battle.enemies[0].status.break={turns:3,applied:0};assert.ok(deal(b)>deal(a)*1.2);});
test('frost on a burning enemy triggers melt',()=>{const a=ready('mage'),b=copy(a);a.party[0].weapon.effect=b.party[0].weapon.effect='none';b.battle.enemies[0].status.burn={turns:3,power:1,applied:0};assert.ok(deal(b,'frost')>deal(a,'frost')*1.4);assert.ok(b.log.some(l=>l.text.includes('融解')));});
test('ninja passive benefits from negative statuses',()=>{const a=ready('ninja'),b=copy(a);a.party[0].weapon.effect=b.party[0].weapon.effect='none';b.battle.enemies[0].status.slow={turns:3,applied:0};assert.ok(deal(b)>deal(a)*1.15);});
test('basic attacks do not build free skill chains or rotate selected hero',()=>{const r=ready();deal(r);assert.equal(activeHero(r).id,r.party[0].id);deal(r);assert.equal(r.battle.chain,0);});
test('reaver drains via its skill and blood pact cannot self-kill',()=>{const r=ready('reaver');r.party[0].hp=20;deal(r,'rend');assert.ok(r.party[0].hp>20);const h=r.party[0];h.hp=1;assert.ok(act(r,'bloodpact').ok);assert.equal(h.hp,1);assert.equal(h.cooldowns.rend,2);assert.ok(h.status.fury);});
test('shrine attacks do not heal allies for free',()=>{const r=ready('shrine');r.party[0].skills.push('ray');r.party[0].weapon.effect='none';r.party[1].hp=10;deal(r,'ray');assert.equal(r.party[1].hp,10);});
test('revive brings back a fallen ally and invalid targets do not start its cooldown',()=>{const r=ready('shrine');r.party[0].skills.push('revive');r.party[1].hp=0;assert.equal(act(r,'revive','enemy-0').ok,false);assert.equal(cooldownLeft(r.party[0],'revive'),0);assert.ok(act(r,'revive',r.party[1].id).ok);assert.ok(r.party[1].hp>0);assert.equal(cooldownLeft(r.party[0],'revive'),7);});
test('cleanse removes ailments but does not heal',()=>{const r=ready('shrine');r.party[0].weapon.effect='none';for(const p of r.party){p.hp=25;p.status.burn={turns:3,power:0,applied:0};p.status.poison={turns:3,power:0,applied:0};}assert.ok(act(r,'cleanse').ok);for(const p of r.party){assert.equal(p.hp,25);assert.equal(p.status.burn,undefined);assert.equal(p.status.poison,undefined);}});
test('haste lowers cooldown and boosts damage without a speed initiative',()=>{const r=ready('chrono');r.party[0].cooldowns.pulse=3;assert.ok(act(r,'haste',r.party[0].id).ok);assert.equal(r.party[0].cooldowns.pulse,2);assert.equal(r.party[0].status.haste.turns,2);assert.equal(r.party[1].status.haste,undefined);assert.equal(heroStats(r.party[0]).spd,undefined);});
test('skill upgrades increase damage',()=>{const a=ready(),b=copy(a);b.party[0].ranks.cleave=2;assert.ok(deal(b,'cleave')>deal(a,'cleave')*1.2);});
test('weapon: vampire returns health from damage',()=>{const r=ready();r.party[0].weapon.effect='vampire';r.party[0].hp=20;deal(r);assert.ok(r.party[0].hp>20);});
test('weapon: lifewell regenerates only on completed rounds',()=>{const r=ready();r.party[0].weapon.effect='lifewell';r.party[0].hp=20;act(r,'guard');assert.equal(r.party[0].hp,20);attackRound(r);assert.ok(r.party[0].hp>20);});
test('weapon: clock staff reduces a cooldown every third complete turn',()=>{const r=ready();r.party[0].weapon.effect='mana';r.party[0].cooldowns.aegis=6;for(let i=0;i<3;i++)attackRound(r);assert.equal(r.party[0].cooldowns.aegis,2);assert.equal(r.party[0].mp,undefined);});
test('weapon: chorus heals only once after a full round',()=>{const r=ready();r.party[0].weapon.effect='chorus';r.party[1].hp=5;act(r,'guard');assert.equal(r.party[1].hp,5);attackRound(r);assert.equal(r.party[1].hp,13);});
test('weapon: execution boosts damage below 40% target HP',()=>{const a=ready(),b=copy(a);a.party[0].weapon.effect='none';b.party[0].weapon.effect='execution';a.battle.enemies[0].hp=b.battle.enemies[0].hp=3000;assert.ok(deal(b)>deal(a)*1.4);});
test('weapon: frostbite rewards slow targets',()=>{const a=ready(),b=copy(a);a.party[0].weapon.effect='none';b.party[0].weapon.effect='frostbite';a.battle.enemies[0].status.slow=b.battle.enemies[0].status.slow={turns:2,applied:0};assert.ok(deal(b)>deal(a)*1.3);});
test('weapon: firstlight applies only on the first two rounds',()=>{const a=ready(),b=copy(a);a.party[0].weapon.effect=b.party[0].weapon.effect='firstlight';b.battle.round=3;assert.ok(deal(a)>deal(b)*1.3);});
test('weapon: bloodmoon rewards low HP',()=>{const a=ready(),b=copy(a);a.party[0].weapon.effect=b.party[0].weapon.effect='bloodmoon';b.party[0].hp=10;assert.ok(deal(b)>deal(a)*1.35);});
test('weapon: affliction scales with each negative effect',()=>{const a=ready(),b=copy(a);a.party[0].weapon.effect='none';b.party[0].weapon.effect='affliction';for(const r of [a,b])r.battle.enemies[0].status.slow={turns:2,applied:0};assert.ok(deal(b)>deal(a)*1.1);});
test('weapon: overload increases skill damage and CD, but not attack cooldown',()=>{const a=ready('mage'),b=copy(a);a.party[0].weapon.effect='none';b.party[0].weapon.effect='overload';assert.equal(skillCooldown(b.party[0],'fire'),4);assert.equal(skillCooldown(b.party[0],'attack'),0);assert.ok(deal(b,'fire')>deal(a,'fire')*1.3);});
test('weapon: economy discounts CDs without making skills free',()=>{const r=ready('mage');r.party[0].weapon.effect='economy';assert.equal(skillCooldown(r.party[0],'fire'),2);assert.equal(skillCooldown(r.party[0],'nova'),4);assert.equal(skillCooldown(r.party[0],'attack'),0);});
test('weapon: soulsteal has one kill-healing effect, no MP',()=>{const r=ready();r.battle.enemies.push({...copy(r.battle.enemies[0]),id:'enemy-9'});r.party[0].weapon.effect='soulsteal';r.party[0].hp=10;r.battle.enemies[0].hp=1;deal(r);assert.ok(r.party[0].hp>20);assert.equal(r.party[0].mp,undefined);});
test('weapon: comet splash damages non-target enemies',()=>{const r=ready();r.party[0].weapon.effect='cleave';const other={...copy(r.battle.enemies[0]),id:'enemy-2'};r.battle.enemies.push(other);deal(r);assert.ok(other.hp<other.maxHp);});
test('weapons: random procs (break/burn/poison/slow/echo) are actually reachable',()=>{
  for(const [effect,status]of [['guardbreak','break'],['kindle','burn'],['toxin','poison'],['frostbite','slow'],['echo',null]]){
    let triggered=false;
    for(let seed=0;seed<40&&!triggered;seed++){const r=ready('knight',`proc-${seed}`);r.party[0].weapon.effect=effect;deal(r);triggered=status?Boolean(r.battle.enemies[0].status[status]):r.log.some(l=>l.text.includes('武器回响'));}
    assert.ok(triggered,effect);
  }
});
test('weapon: phoenix revives once per battle, not infinitely',()=>{const r=createRun(['knight'],'phoenix');r.dungeon.packs=[];r.party[0].weapon=makeWeapon('eternity');startBattle(r);const p=r.party[0];r.battle.enemies=r.battle.enemies.slice(0,1);const foe=r.battle.enemies[0];foe.hp=foe.maxHp=10000;foe.atk=foe.mag=10000;foe.intent=['attack'];foe.plannedIntent='attack';attackRound(r);assert.ok(p.phoenixUsed&&p.hp>0);attackRound(r);assert.equal(r.ending,'defeat');});
test('blessings stack and stat blessings increase every party member',()=>{const r=createRun(['knight','mage'],'boon');const before=r.party.map(p=>p.maxHp);for(let i=0;i<2;i++){r.phase='reward';r.rewards=[{type:'boon',id:'vitality'}];assert.ok(takeReward(r,0).ok);}assert.equal(r.boons.vitality,2);r.party.forEach((p,i)=>assert.equal(p.maxHp,before[i]+20));});
test('skill rewards are individual and cannot be claimed twice',()=>{const r=createRun(['knight','mage'],'rank');r.phase='reward';r.rewards=[{type:'skill',heroId:r.party[0].id,skillId:'cleave'}];assert.ok(takeReward(r,0).ok);assert.equal(r.party[0].ranks.cleave,1);assert.equal(r.party[1].ranks.cleave,undefined);assert.equal(takeReward(r,0).ok,false);});
test('weapon rewards require a recipient and place old weapon in inventory',()=>{const r=createRun(['knight'],'loot'),old=r.party[0].weapon.uid;r.phase='reward';r.rewards=[{type:'weapon',weapon:makeWeapon('duet',2,1)}];assert.equal(takeReward(r,0).ok,false);assert.equal(r.phase,'reward');assert.ok(takeReward(r,0,r.party[0].id).ok);assert.equal(r.inventory[0].uid,old);assert.equal(r.party[0].weapon.id,'duet');assert.ok(equipWeapon(r,r.party[0].id,old));assert.equal(r.party[0].weapon.id,'moonblade');});
test('weapon swapping is blocked during battle',()=>{const r=ready();r.inventory.push(makeWeapon('duet',2,8));assert.equal(equipWeapon(r,r.party[0].id,r.inventory[0].uid),false);});
test('treasure rewards are three choices and contain a weapon',()=>{for(let i=0;i<25;i++){const r=createRun(['mage'],`loot-${i}`);openRewards(r,'treasure');assert.equal(r.rewards.length,3);assert.ok(r.rewards.some(x=>x.type==='weapon'));}});
test('altar weapon choices are guaranteed legendary',()=>{const r=createRun(['mage'],'altar');for(let i=0;i<20;i++){openRewards(r,'altar');for(const w of r.rewards.filter(x=>x.type==='weapon'))assert.equal(w.weapon.rarity,'legendary');}});
test('fully upgraded skills fall back to other rewards',()=>{const r=createRun(['chrono'],'all');for(const id of r.party[0].skills)r.party[0].ranks[id]=3;openRewards(r);assert.equal(r.rewards.length,3);assert.equal(r.rewards.some(x=>x.type==='skill'),false);});
test('a chest cannot be opened twice',()=>{const r=createRun(['knight'],'chest');const [key]=Object.entries(r.dungeon.events).find(([,v])=>v.type==='chest');[r.x,r.y]=key.split(',').map(Number);assert.ok(interact(r));assert.equal(r.phase,'reward');assert.equal(r.dungeon.events[key].used,true);const index=r.rewards.findIndex(x=>x.type==='boon');takeReward(r,index);assert.equal(currentEvent(r),null);assert.equal(interact(r),false);});
test('rest point heals once; leaving does not consume it',()=>{const r=createRun(['knight'],'rest');const [key]=Object.entries(r.dungeon.events).find(([,v])=>v.type==='shrine');[r.x,r.y]=key.split(',').map(Number);r.party[0].hp=1;interact(r);resolveEvent(r,'leave');assert.equal(r.dungeon.events[key].used,false);interact(r);resolveEvent(r,'rest');assert.ok(r.party[0].hp>1);assert.equal(r.dungeon.events[key].used,true);});
test('altar rejects insufficient funds and blood cost never kills',()=>{const r=createRun(['knight'],'altar');const [key]=Object.entries(r.dungeon.events).find(([,v])=>v.type==='altar');[r.x,r.y]=key.split(',').map(Number);interact(r);assert.equal(resolveEvent(r,'offer'),false);assert.equal(r.phase,'event');r.party[0].hp=1;assert.ok(resolveEvent(r,'blood'));assert.equal(r.party[0].hp,1);assert.equal(r.phase,'reward');});
test('guardians prevent descent and cannot be escaped',()=>{const r=createRun(['knight'],'gate');r.x=r.dungeon.stairs.x;r.y=r.dungeon.stairs.y;interact(r);assert.equal(r.phase,'battle');assert.equal(r.battle.type,'guardian');assert.equal(act(r,'escape').ok,false);assert.equal(r.floor,1);});
test('victory opens the gate, then explicit interaction descends',()=>{const r=createRun(['knight'],'descend');r.x=r.dungeon.stairs.x;r.y=r.dungeon.stairs.y;interact(r);killBattle(r);assert.equal(r.guardianDefeated,true);assert.equal(r.phase,'reward');takeReward(r,r.rewards.findIndex(x=>x.type==='boon'));assert.equal(r.floor,1);interact(r);assert.equal(r.floor,2);assert.equal(r.guardianDefeated,false);assert.equal(r.x,1);});
test('defeating the fifth-floor boss reaches a real victory ending',()=>{const r=createRun(['knight'],'final');r.floor=5;r.dungeon=generateDungeon(r,5);r.x=r.dungeon.stairs.x;r.y=r.dungeon.stairs.y;interact(r);assert.equal(r.battle.type,'boss');killBattle(r);assert.equal(r.phase,'ended');assert.equal(r.ending,'victory');});
test('whole party defeat ends the run',()=>{const r=createRun(['knight'],'loss');r.party[0].spd=100;startBattle(r);for(const foe of r.battle.enemies){foe.atk=10000;foe.mag=10000;foe.intent=['attack'];foe.plannedIntent='attack';}r.party[0].hp=1;attackRound(r);assert.equal(r.phase,'ended');assert.equal(r.ending,'defeat');});
test('save round-trip preserves deterministic combat continuation',()=>{const a=ready('mage','save'),b=restoreRun(serializeRun(a));deal(a,'fire');deal(b,'fire');assert.deepEqual(a,b);});
test('all persisted gameplay phases can be round-tripped',()=>{const r=createRun(['knight'],'states');assert.equal(restoreRun(serializeRun(r)).phase,'explore');openRewards(r);assert.equal(restoreRun(serializeRun(r)).phase,'reward');r.phase='explore';const [key]=Object.entries(r.dungeon.events).find(([,v])=>v.type==='shrine');[r.x,r.y]=key.split(',').map(Number);interact(r);assert.equal(restoreRun(serializeRun(r)).phase,'event');});
test('corrupted saves and incompatible versions are rejected',()=>{assert.throws(()=>restoreRun('this is not json'));assert.throws(()=>restoreRun('{}'));const r=createRun(['knight'],'bad');r.version=VERSION+1;assert.throws(()=>restoreRun(serializeRun(r)));r.version=VERSION;r.x=-9;assert.throws(()=>restoreRun(serializeRun(r)));});
test('malformed maps and invalid hero bounds are rejected',()=>{const r=createRun(['knight'],'badmap');r.dungeon.tiles[0]=[];assert.throws(()=>restoreRun(serializeRun(r)));const s=createRun(['knight'],'badhp');s.party[0].hp=s.party[0].maxHp+1;assert.throws(()=>restoreRun(serializeRun(s)));});
test('combat fuzz: all jobs keep bounded HP/CD and reach an outcome',()=>{
 for(const job of Object.keys(JOBS))for(let seed=0;seed<10;seed++){
  const r=createRun([job],`fuzz-${seed}`);r.dungeon.packs=[];startBattle(r);let n=0;
  while(r.phase==='battle'&&n++<100){const h=activeHero(r);for(const id of h.skills){if(r.phase!=='battle')break;const s=SKILLS[id],foe=r.battle.enemies.find(p=>p.hp>0);act(r,id,s.target==='ally'?h.id:foe?.id);}if(r.phase==='battle')attackRound(r);for(const p of r.party){assert.ok(p.hp>=0&&p.hp<=p.maxHp);assert.ok(Object.values(p.cooldowns).every(n=>n>=0&&n<=10));}}
  assert.notEqual(r.phase,'battle',`${job} seed=${seed}`);
 }
});
