// Diagnostic only: 50 isolated, full-health level-one starts per scenario.
// A fixed heuristic is not an optimal player and these are NOT human win rates.
// No roaming packs, reward progression or rest stops are simulated here.
import * as E from '../src/engine.js';
import {SKILLS,STATUS} from '../src/data.js';
function policy(r){
 const h=E.activeHero(r),es=r.battle.enemies.filter(e=>e.hp>0),boss=es.find(e=>e.boss),o=boss?.boss.pending;
 const have=id=>h.skills.includes(id)&&h.mp>=E.skillCost(h,id);
 const ally=r.party.filter(p=>p.hp>0).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
 if(o&&['dispel','seal'].includes(o.counter)&&boss.status.veil){if(have('ray'))return ['ray',boss.id];if(have('unweave'))return ['unweave',boss.id];if(r.supplies.salt)return ['salt',boss.id];if(o.counter==='seal'&&have('seal')&&!boss.status.headbind)return ['seal',boss.id];}
 if(have('mend')&&ally.hp/ally.maxHp<.65)return ['mend',ally.id];
 if(o&&o.dueRound===r.battle.round&&((o.counter==='guard')||(o.counter==='hits'&&o.hits<o.required)))return [have('aegis')?'aegis':'guard'];
 if(ally.hp/ally.maxHp<.26&&r.supplies.tonic)return ['tonic',ally.id];
 if(have('cleanse')&&r.party.filter(p=>p.hp>0).some(p=>p.status.poison||p.status.burn))return ['cleanse'];
 const target=es.find(e=>e.ritualFor)||es.find(e=>['revenant','caller'].includes(e.type))||es.reduce((a,b)=>a.hp<b.hp?a:b);
 if(h.job==='knight')return have('cleave')?['cleave',target.id]:['attack',target.id];
 if(h.job==='mage'){let id=target.status.burn?'frost':'fire';if(have(id))return[id,target.id];if(r.supplies.ether)return['ether',h.id];return['guard'];}
 if(h.job==='shrine')return['guard'];
 return['attack',target.id];
}
for(const mode of ['basic','tactical'])for(const scenario of ['normal','guardian']){
 let wins=0,deads=0,totalActs=0,sumHP=0;
 for(let i=0;i<50;i++){
 const r=E.createRun(['knight','mage','shrine'],`BENCH-${i}`);r.dungeon.packs=[];E.startBattle(r,scenario);
 let count=0;while(r.phase==='battle'&&count++<200){const [id,target]=mode==='basic'?['attack',r.battle.enemies.find(e=>e.hp>0).id]:policy(r);const result=E.act(r,id,target);if(!result.ok)throw new Error(result.error+id);}
 if(r.phase==='reward'){wins++;sumHP+=r.party.reduce((t,p)=>t+p.hp/p.maxHp,0)/3;}if(r.phase==='ended')deads++;totalActs+=count;
 }
 console.log(mode,scenario,{wins,deads,acts:totalActs/50,hp:wins?sumHP/wins:0});
}
