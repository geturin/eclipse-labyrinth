import test from 'node:test';
import assert from 'node:assert/strict';
import { GridCamera, poseOf, headingOf, viewMode, VIEW_MODES, clipNearPlane, moveCue, mixHex } from '../src/navigation.js';
import { createRun, serializeRun, restoreRun } from '../src/engine.js';
const pose=(dir=1,x=3,y=5)=>({x,y,dir,floor:1});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('existing v3 comfort saves get continuous step mode; explicit modes survive a save',()=>{
  const r=createRun(['knight'],'CAMERA');assert.equal(viewMode(r),'step');
  r.comfort=false;assert.equal(viewMode(r),'step');
  for(const id of Object.keys(VIEW_MODES)){r.viewMode=id;assert.equal(viewMode(restoreRun(serializeRun(r))),id);}
  r.viewMode='bogus';assert.equal(viewMode(r),'step');assert.equal(viewMode(r,true),'instant');
});
for(let dir=0;dir<4;dir++)for(const side of [-1,1])test(`90 degree turn preserves direction and position: ${dir}/${side}`,()=>{
  const a=pose(dir),b=pose((dir+side+4)%4),c=new GridCamera();
  assert.equal(c.begin(a,b,side>0?'turn-right':'turn-left',100),true);
  const mid=c.sample(250);close(mid.angle,poseOf(a).angle+side*Math.PI/4);close(mid.x,3.5);close(mid.y,5.5);
  const end=c.sample(400);assert.equal(end.done,true);assert.equal(headingOf(end.angle),b.dir);
});
for(const [name,x,y] of [['forward',4,5],['back',2,5],['strafe-left',3,4],['strafe-right',3,6]])test(`${name} is a straight one-cell movement with no turning or bob`,()=>{
  const a=pose(),b=pose(1,x,y),c=new GridCamera();c.begin(a,b,name,100);
  const mid=c.sample(220),end=c.sample(340);close(mid.x,(3+x)/2+.5);close(mid.y,(5+y)/2+.5);close(mid.angle,0);
  close(end.x,x+.5);close(end.y,y+.5);assert.equal(c.motion,null);
  assert.deepEqual(c.sample(90000),end);
});
test('sampling rate cannot change the camera trajectory or final orientation',()=>{
  for(const fps of [24,30,60,144]){
    const c=new GridCamera();c.begin(pose(),pose(2),'turn-right',0);
    for(let t=0;t<147;t+=1000/fps)c.sample(t);
    close(c.sample(150).angle,Math.PI/4);close(c.sample(300).angle,Math.PI/2);
  }
});
test('late frame lands exactly once, with no exponential tail or overshoot',()=>{
  const c=new GridCamera();c.begin(pose(),pose(1,4),'forward',0);
  close(c.sample(-20).x,3.5);const end=c.sample(5000);close(end.x,4.5);assert.equal(end.done,true);
  assert.equal(c.motion,null);assert.deepEqual(end,c.sample(8000));
});
test('fade mode never rotates or translates through intermediate space',()=>{
  const c=new GridCamera();c.begin(pose(),pose(2),'turn-right',0,'fade');
  close(c.sample(40).angle,0);close(c.sample(100).angle,Math.PI/2);assert.ok(c.sample(90).shade>.99);
});
test('reduced motion and floor changes snap to their target, never fly through walls',()=>{
  const c=new GridCamera();assert.equal(c.begin(pose(),pose(2),'turn-right',0,'instant'),false);
  close(c.pose.angle,Math.PI/2);
  assert.equal(c.begin(pose(),{...pose(1,10,10),floor:2},'forward',0),false);close(c.pose.x,10.5);
});
test('invalid diagonal movements are never interpolated as shortcuts',()=>{
  const c=new GridCamera();assert.equal(c.begin(pose(),pose(1,4,6),'forward',0),false);
});
test('clipping preserves a near tile instead of deleting the entire polygon',()=>{
  const p=[{z:-.5,lateral:-.5},{z:.5,lateral:-.5},{z:.5,lateral:.5},{z:-.5,lateral:.5}],copy=structuredClone(p);
  const clipped=clipNearPlane(p);assert.equal(clipped.length,4);assert.ok(clipped.every(v=>v.z>=.06));assert.deepEqual(p,copy);
  assert.deepEqual(clipNearPlane(p.map(v=>({...v,z:-1}))),[]);
});
test('fully visible floor geometry and stationary palette are unchanged',()=>{
  const p=[{z:1,lateral:-1},{z:1,lateral:1},{z:2,lateral:1}];assert.deepEqual(clipNearPlane(p),p);
  assert.equal(mixHex('#123456','#123456',.5),'#123456');assert.equal(mixHex('#000000','#ffffff',.5),'#808080');
});
test('sampling, direction text and view preferences do not advance any game rules',()=>{
  const r=createRun(['knight'],'STILL'),before=serializeRun(r),c=new GridCamera(),to={...r,x:r.x+1};
  c.begin(r,to,'forward',0);for(let t=0;t<1000;t+=16)c.sample(t);
  assert.match(moveCue('back',r,r),/后退/);assert.match(moveCue('turn-left',pose(1),pose(0)),/东 → 北/);
  assert.equal(serializeRun(r),before);
});
