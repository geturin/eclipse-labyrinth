import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, serializeRun, restoreRun } from '../src/engine.js';
import { ENEMY_TYPES } from '../src/data.js';
import { SPRITE_KEYS, explorationSvg } from '../src/sprite-art.js';
import { sceneObjects, sceneDecorations, projectSprite, visibleSpans, spriteMotion, placeLabels, packMembers } from '../src/sprite-scene.js';

for(const key of SPRITE_KEYS)test(`exploration asset ${key}: explicit size, self-contained, complete SVG`,()=>{
  const svg=explorationSvg(key);
  assert.match(svg,/width="320" height="320" viewBox="0 0 320 320"/);
  assert.ok(svg.startsWith('<svg ')&&svg.endsWith('</svg>'));
  assert.doesNotMatch(svg,/<script|<image|<foreignObject|href=|https?:\/\/(?!www\.w3\.org)/i);
});
test('all ten enemy types have a distinct exploration graphic',()=>{
  const shapes=Object.keys(ENEMY_TYPES).map(id=>explorationSvg('mob-'+id).replace(/#[\da-f]{3,8}/gi,''));
  assert.equal(new Set(shapes).size,10);
});
test('objects, marks and decorations do not mutate RNG, world clock or saves',()=>{
  const run=createRun(['knight','mage','shrine'],'VISUAL-SAFE'),before=serializeRun(run);
  for(let i=0;i<30;i++){sceneObjects(run);sceneDecorations(run.dungeon);}
  assert.equal(serializeRun(run),before);
});
test('surviving pack members determine leader, count and companions after a retreat',()=>{
  const run=createRun(['knight'],'VISUAL'),p=run.dungeon.packs[0];
  p.members=[{type:'slime',hp:0},{type:'wisp',hp:10},{type:'moth',hp:8}];p.engaged=false;p.defeated=false;
  assert.deepEqual(packMembers(p),['wisp','moth']);
  const objects=sceneObjects(run),leader=objects.find(o=>o.key===p.id);
  assert.equal(leader.image,'mob-wisp');assert.match(leader.label,/×2$/);
  assert.equal(objects.filter(o=>o.key.startsWith(p.id+':')).length,1);
});
test('defeated or engaged packs and consumed events are invisible',()=>{
  const run=createRun(['knight'],'HIDDEN');for(const p of run.dungeon.packs)p.defeated=true;
  for(const event of Object.values(run.dungeon.events))event.used=true;
  assert.ok(sceneObjects(run).every(o=>o.key.startsWith('landmark:')));
  run.dungeon.packs[0].defeated=false;run.dungeon.packs[0].engaged=true;
  assert.ok(!sceneObjects(run).some(o=>o.key===run.dungeon.packs[0].id));
});
test('closed gate has a guardian silhouette, victory replaces it with open stairs',()=>{
  const run=createRun(['knight'],'GATE');
  assert.ok(sceneObjects(run).some(o=>o.image==='gate'));
  assert.ok(sceneObjects(run).some(o=>o.image==='mob-guardian'));
  run.floor=5;assert.ok(sceneObjects(run).some(o=>o.image==='mob-sovereign'));
  run.guardianDefeated=true;const scene=sceneObjects(run);
  assert.ok(scene.some(o=>o.image==='stairs'));assert.ok(!scene.some(o=>o.key.startsWith('guardian:')));
});
test('elite packs have a crown badge and larger, separate visual treatment',()=>{
  const run=createRun(['knight'],'ELITE');const pack=run.dungeon.packs[0];pack.kind='elite';
  const sprite=sceneObjects(run).find(o=>o.key===pack.id);assert.equal(sprite.icon,'elite');assert.equal(sprite.elite,true);assert.ok(sprite.height>.8);
});
test('landmarks do not overlap an unused interactive event in the same cell',()=>{
  const run=createRun(['knight'],'OVERLAP'),l=run.dungeon.landmarks[0];run.dungeon.events[`${l.x},${l.y}`]={type:'chest',used:false};
  assert.ok(!sceneObjects(run).some(o=>o.key===`landmark:${l.x},${l.y}`));
});
test('decoration is deterministic, wall-adjacent, and avoids interactive cells',()=>{
  for(let seed=0;seed<30;seed++){
    const run=createRun(['knight'],'DECOR-'+seed),d=run.dungeon,a=sceneDecorations(d);
    assert.deepEqual(a,sceneDecorations(d));
    for(const o of a){const x=Math.floor(o.x),y=Math.floor(o.y);assert.equal(d.tiles[y][x],0);assert.ok(!d.events[`${x},${y}`]);assert.ok(!d.landmarks.some(l=>l.x===x&&l.y===y));assert.ok([[0,-1],[1,0],[0,1],[-1,0]].some(([dx,dy])=>d.tiles[y+dy]?.[x+dx]===1));}
  }
});
test('world motion remains disabled by default, and its opt-in survives existing v2 saves',()=>{
  const run=createRun(['knight'],'MOTION');assert.notEqual(run.objectMotion,true);run.objectMotion=true;
  const restored=restoreRun(serializeRun(run));assert.equal(restored.objectMotion,true);assert.equal(restored.comfort,true);
});
test('four cardinal camera directions project a target directly ahead to screen center',()=>{
  for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    const camera={x:6.5,y:6.5,angle},s=projectSprite({x:6.5+Math.cos(angle)*2,y:6.5+Math.sin(angle)*2,height:.8},camera,1000,450);
    assert.ok(Math.abs(s.center-500)<1e-6);assert.ok(Math.abs(s.depth-2)<1e-6);assert.equal(s.sh,s.sw);
  }
});
test('near/far projection is finite and monotonic without blowing up near the camera',()=>{
  const camera={x:0,y:0,angle:0};let last=Infinity;
  for(const depth of [.2,.5,1,2,5,10]){const s=projectSprite({x:depth,y:0,height:.8},camera,1200,480);assert.ok(s.sh<last);assert.ok(Number.isFinite(s.top));last=s.sh;}
  for(const depth of [-5,0,.18,11,Infinity,NaN])assert.equal(projectSprite({x:depth,y:0,height:.8},camera,1200,480),null);
});
test('full visibility is a single clip span, not repeated source-image slices',()=>assert.deepEqual(visibleSpans(new Float32Array(100).fill(10),2,20,30),[[20,30]]));
test('occlusion never allows a billboard or badge to bleed through a near wall',()=>{
  assert.deepEqual(visibleSpans(new Float32Array(100).fill(2),2,0,100),[]);
  assert.deepEqual(visibleSpans(new Float32Array(100).fill(1),2,0,100),[]);
});
test('partial occlusion and both viewport edges are clipped without rescaling artwork',()=>{
  const z=new Float32Array(10).fill(9);z[4]=z[5]=1;
  assert.deepEqual(visibleSpans(z,2,-5,20),[[0,4],[6,4]]);
  assert.deepEqual(visibleSpans(z,2,20,10),[]);assert.deepEqual(visibleSpans(z,2,-20,2),[]);
});
test('non-finite source projection is rejected by the clipper',()=>{
  const z=new Float32Array(10).fill(9);for(const args of [[NaN,0,3],[2,NaN,3],[2,0,0]])assert.deepEqual(visibleSpans(z,...args),[]);
});
test('disabled local animation is identical at every timestamp',()=>{
  for(const image of ['mob-slime','mob-wisp','shrine','fountain'])assert.deepEqual(spriteMotion({image},1,false),spriteMotion({image},9000,false));
});
test('floating, breathing and flame/light motion are small and not camera movement',()=>{
  for(const image of ['mob-wisp','mob-slime','shrine','fountain']){
    assert.notDeepEqual(spriteMotion({image},0,true),spriteMotion({image},930,true));
    for(let t=0;t<12000;t+=137){const m=spriteMotion({image},t,true);assert.ok(Math.abs(m.lift)<.01);assert.ok(Math.abs(m.stretch-1)<.008);assert.ok(m.light>=.93&&m.light<=1.01);}
  }
});
test('labels stay in the viewport and do not overlap on small screens',()=>{
  const candidates=Array.from({length:8},(_,i)=>({center:50+i*25,top:60,width:130,priority:i%3,depth:2+i}));
  const labels=placeLabels(candidates,360,240);assert.ok(labels.length>0&&labels.length<8);
  for(const a of labels){assert.ok(a.x>=0&&a.y>=0&&a.x+a.w<=360&&a.y+a.h<=240);for(const b of labels)if(a!==b)assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);}
});

test('marker layout avoids the existing compass and floor title',()=>{
  const blocked=[{x:0,y:0,w:180,h:125},{x:160,y:80,w:100,h:30}];
  const labels=placeLabels([{center:220,top:120,width:90,priority:3,depth:2}],360,350,1,blocked);
  assert.equal(labels.length,1);const a=labels[0];for(const b of blocked)assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);
});
