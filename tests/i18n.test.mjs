import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { EN_MESSAGES } from '../src/i18n-en.js';
import { detectLanguage,initLanguage,setLanguage,getLanguage,getLanguagePreference,refreshBrowserLanguage,translate,actionLabel,LANGUAGE_KEY } from '../src/i18n.js';
import * as data from '../src/data.js';
import { REGIONS } from '../src/world.js';
import { VIEW_MODES } from '../src/navigation.js';
import { createRun,serializeRun,restoreRun,startBattle,act,attackRound,skillProblem,effectiveSkill,makeWeapon } from '../src/engine.js';
const cjk=/[\u3400-\u9fff\u3040-\u30ff]/;
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v)}};
const en=()=>initLanguage({navigator:{languages:['en-US']},storage:memory()});
for(const [tags,expected] of [
 [['zh-CN'],'zh'],[['zh-TW'],'zh'],[['zh-Hant-HK'],'zh'],[['ZH_cn'],'zh'],[['en-US'],'en'],[['en-GB','zh'],'en'],[['ja-JP','zh-CN','en'],'zh'],[['ja-JP'],'en'],[['fr','de'],'en'],[[],'en'],[[null,42,'zh'],'zh']
])test(`browser locale negotiation: ${JSON.stringify(tags)} -> ${expected}`,()=>assert.equal(detectLanguage({languages:tags}),expected));
test('navigator.language fallback is used when languages is absent or empty',()=>{
 assert.equal(detectLanguage({language:'zh-HK'}),'zh');assert.equal(detectLanguage({languages:[],language:'zh-CN'}),'zh');assert.equal(detectLanguage(), 'en');
});
test('saved language override, auto restore and invalid preference are safe',()=>{
 const storage=memory(),navigator={languages:['zh-CN']};storage.setItem(LANGUAGE_KEY,'en');assert.equal(initLanguage({storage,navigator}),'en');
 assert.equal(setLanguage('zh'),true);assert.equal(getLanguage(),'zh');assert.equal(storage.getItem(LANGUAGE_KEY),'zh');
 assert.equal(setLanguage('auto'),true);assert.equal(getLanguagePreference(),'auto');assert.equal(getLanguage(),'zh');
 const before=storage.getItem(LANGUAGE_KEY);assert.equal(setLanguage('xx'),false);assert.equal(storage.getItem(LANGUAGE_KEY),before);
 storage.setItem(LANGUAGE_KEY,'<script>');assert.equal(initLanguage({storage,navigator}),'zh');assert.equal(getLanguagePreference(),'auto');
});
test('blocked storage does not prevent startup or an in-session language choice',()=>{
 assert.equal(initLanguage({navigator:{language:'en-US'},storage:{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}}}),'en');
 assert.equal(setLanguage('zh'),true);assert.equal(getLanguage(),'zh');
});
test('browser languagechange only changes automatic preferences',()=>{
 const navigator={languages:['zh-CN']};initLanguage({navigator,storage:memory()});navigator.languages=['en-US'];assert.equal(refreshBrowserLanguage(),true);assert.equal(getLanguage(),'en');
 setLanguage('zh');assert.equal(refreshBrowserLanguage(),false);assert.equal(getLanguage(),'zh');assert.equal(setLanguage('auto'),true);assert.equal(getLanguage(),'en');
});
test('English catalog preserves named slot identities and has no untranslated text',()=>{
 assert.ok(Object.keys(EN_MESSAGES).length>=854);
 const slots=s=>[...new Set([...s.matchAll(/\{(\d+)\}/g)].map(m=>m[1]))].sort();
 for(const [source,target] of Object.entries(EN_MESSAGES)){
  assert.equal(typeof target,'string',source);assert.ok(target.length,source);
  assert.deepEqual(slots(source),slots(target),source);
  if(source!=='简体中文')assert.equal(cjk.test(target),false,source);
 }
});
test('every data description, name, status and floor has an English display translation',()=>{
 en();const visit=v=>{if(typeof v==='string'&&cjk.test(v))assert.equal(cjk.test(translate(v)),false,v);else if(v&&typeof v==='object')Object.values(v).forEach(visit)};
 visit(data);visit(REGIONS);visit(VIEW_MODES);
});
test('ambiguous composites do not confuse role descriptions with numeric CD or weakness',()=>{
 en();for(const text of ['焰咒魔导师 · 弱点 · 元素 · 蓄能',data.JOBS.chrono.role+' / '+data.JOBS.chrono.synopsis,'魔镜：剩余 97 次行动 · 可驱散']){
  const result=translate(text);assert.equal(cjk.test(result),false,text+' -> '+result);
 }
 assert.equal(translate('冷却 3'),'CD 3');
 assert.equal(translate('焰咒魔导师 · 弱点 · 元素 · 蓄能').includes('Weak: 点'),false);
});
test('short action labels cover every ability but leave full descriptive names intact',()=>{
 en();for(const [id,s] of Object.entries(data.SKILLS)){assert.ok(actionLabel(id,s.name).length<=12,id);assert.equal(cjk.test(translate(s.name)),false)}
 setLanguage('zh');for(const [id,s] of Object.entries(data.SKILLS))assert.equal(actionLabel(id,s.name),s.name);
});
test('Chinese rendering is byte-preserving; English does not change canonical saves',()=>{
 const r=createRun(['knight','mage','shrine'],'UNCHANGED-中文'),before=serializeRun(r);en();
 r.party.forEach(h=>{translate(h.name);for(const id of h.skills){translate(effectiveSkill(h,id).name);translate(effectiveSkill(h,id).desc)}});
 translate(r.log.map(l=>l.text).join('\n'));assert.equal(serializeRun(r),before);assert.equal(serializeRun(restoreRun(before)),before);
 setLanguage('zh');for(const key of Object.keys(EN_MESSAGES))assert.equal(translate(key),key);
});
test('existing weapon names and scaled effects translate at every rarity without changing stats',()=>{
 en();for(const id of Object.keys(data.WEAPONS))for(let floor=1;floor<=5;floor++){
  const w=makeWeapon(id,floor,0),before=JSON.stringify(w);for(const k of ['name','desc','effectName','type'])assert.equal(cjk.test(translate(w[k])),false,w[k]);assert.equal(JSON.stringify(w),before);
 }
});
test('interpolated combat records translate for all jobs without advancing the game',()=>{
 en();let count=0;
 for(const job of Object.keys(data.JOBS)){
  const r=createRun([job],'I18N-'+job);r.dungeon.packs=[];r.party[0].skills=[...data.JOBS[job].skills,...data.JOBS[job].advanced];r.party[0].hp=r.party[0].maxHp=10000;startBattle(r,'guardian');
  for(let round=0;round<8&&r.phase==='battle';round++){
   const h=r.party[0];for(const id of h.skills){if(r.phase!=='battle'||skillProblem(r,h,id))continue;const s=data.SKILLS[id],target=['self','ally','allies'].includes(s.target)?h.id:r.battle.enemies.find(e=>e.hp>0)?.id;act(r,id,target,h.id)}
   if(r.phase==='battle')attackRound(r);
  }
  const before=serializeRun(r);
  for(const log of r.log){const text=translate(log.text);assert.equal(cjk.test(text),false,log.text+' -> '+text);count++;}
  assert.equal(serializeRun(r),before);
 }
 assert.ok(count>100);
});
test('static build uses literal replacement callbacks and keeps JavaScript parseable',async()=>{
 const build=await readFile(new URL('../scripts/build.mjs',import.meta.url),'utf8');
 assert.ok(build.includes('()=>'), 'replacement callbacks are required for embedded $ sequences');
 // Match only inline executable scripts, not explanatory HTML or source strings.
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,1);
 assert.doesNotThrow(()=>new Script(scripts[0][1]));
 assert.ok(scripts[0][1].includes("'\\\\$&'"));
 assert.equal(html.includes('<script type="module" src="./src/app.js">'),false);
});
