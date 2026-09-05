import {createRun,startBattle,act,attackRound,cooldownLeft,intentOf,skillProblem} from '../src/engine.js';
import {SKILLS} from '../src/data.js';
// Isolated, fixed-policy diagnostics: not human win rates or complete five-floor balance.
const reports=[];
for(const type of ['normal','guardian'])for(const tactical of [false,true]){
 let wins=0,rounds=0;
 for(let seed=0;seed<40;seed++){
  const r=createRun(['knight','mage','shrine'],`BENCH-${seed}`);r.dungeon.packs=[];startBattle(r,type);let turns=0;
  while(r.phase==='battle'&&turns++<35){
   if(tactical){
    for(const h of r.party){
     if(r.phase!=='battle'||h.hp<=0)continue;
     const boss=r.battle.enemies.find(e=>e.hp>0&&e.boss),omen=boss?.boss.pending;
     if(omen&&['dispel','seal'].includes(omen.counter)&&boss.status.veil&&r.supplies.salt>0)act(r,'salt',boss.id,h.id);
     for(const id of h.skills){
      if(r.phase!=='battle'||skillProblem(r,h,id))continue;
      const target=r.battle.enemies.find(e=>e.hp>0&&intentOf(e)==='alarm')||r.battle.enemies.find(e=>e.hp>0);
      const ally=r.party.filter(p=>p.hp>0).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
      if(id==='mend'&&ally.hp/ally.maxHp>.65)continue;
      if(id==='cleanse'&&!r.party.some(p=>Object.keys(p.status).some(id=>['poison','burn','marked','break'].includes(id))))continue;
      if(id==='aegis'&&!omen&&turns%2===0)continue;
      act(r,id,SKILLS[id].target==='ally'?ally.id:target.id,h.id);
     }
     if(r.phase==='battle'&&omen?.counter==='guard')act(r,'guard',null,h.id);
    }
   }
   if(r.phase==='battle')attackRound(r);
  }
  if(r.phase==='reward'||r.ending==='victory')wins++;rounds+=turns;
 }
 reports.push({encounter:type,policy:tactical?'fixed skills/counters':'normal attacks only',wins,samples:40,meanRound:rounds/40});
}
console.log(JSON.stringify({conditions:'Level 1, full fresh resources, default three jobs; each encounter isolated, no map packs, no reward growth. Not a human win rate or full-run validation.',reports},null,2));
