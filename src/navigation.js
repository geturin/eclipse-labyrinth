/** Cosmetic navigation only. No run, world clock, RNG or combat state is modified here. */
export const VIEW_MODES = Object.freeze({
  step: {name:'标准步进', move:240, turn:300, desc:'连续走一格 / 转 90°，到点即停'},
  deliberate: {name:'舒缓步进', move:340, turn:420, desc:'更长的辨向时间，不增加镜头晃动'},
  fade: {name:'淡入切换', move:180, turn:180, desc:'不旋转镜头，用短暂暗场连接前后画面'},
});
export const NAV_ACTIONS = ['forward','back','strafe-left','strafe-right','turn-left','turn-right'];
export function viewMode(run,reduced=false) {return reduced?'instant':Object.hasOwn(VIEW_MODES,run?.viewMode)?run.viewMode:'step';}
export function poseOf(run) {return {x:run.x+.5,y:run.y+.5,angle:-Math.PI/2+run.dir*Math.PI/2};}
export function headingOf(angle) {return ((Math.round((angle+Math.PI/2)/(Math.PI/2))%4)+4)%4;}
export function easeStep(t) {t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);}
export function moveCue(action,from,to) {
  const names=['北','东','南','西'];
  if(action==='turn-left'||action==='turn-right')return `${action==='turn-left'?'↶ 左转':'↷ 右转'} ${names[from.dir]} → ${names[to.dir]}`;
  return {forward:'↑ 前进 1 格',back:'↓ 后退 1 格','strafe-left':'← 左移 1 格','strafe-right':'→ 右移 1 格',wait:'原地等待',blocked:'碰壁 · 未移动'}[action]??'';
}

/** Finite, wall-clock interpolation. One command follows one straight segment, never a spring. */
export class GridCamera {
  constructor(){this.motion=null;this.pose={x:1.5,y:1.5,angle:-Math.PI/2};}
  reset(run){this.motion=null;this.pose=poseOf(run);return this.pose;}
  begin(from,to,action,time,mode='step'){
    this.reset(from);
    const a=poseOf(from),b=poseOf(to),distance=Math.abs(from.x-to.x)+Math.abs(from.y-to.y);
    const rotation=action==='turn-left'?-Math.PI/2:action==='turn-right'?Math.PI/2:0;
    const valid=from.floor===to.floor&&NAV_ACTIONS.includes(action)&&
      (rotation?distance===0&&headingOf(a.angle+rotation)===to.dir:distance===1&&from.dir===to.dir);
    if(!valid||!Object.hasOwn(VIEW_MODES,mode)){this.reset(to);return false;}
    b.angle=a.angle+rotation;
    this.motion={a,b,time,duration:VIEW_MODES[mode][rotation?'turn':'move'],mode};
    return true;
  }
  sample(time){
    const m=this.motion;if(!m)return {...this.pose,progress:1,mix:1,shade:0,done:true};
    const t=Math.max(0,Math.min(1,(time-m.time)/m.duration)),e=easeStep(t),p=m.mode==='fade'?(t<.5?0:1):e;
    this.pose={x:m.a.x+(m.b.x-m.a.x)*p,y:m.a.y+(m.b.y-m.a.y)*p,angle:m.a.angle+(m.b.angle-m.a.angle)*p};
    if(t===1)this.motion=null;
    return {...this.pose,progress:t,mix:p,shade:m.mode==='fade'?Math.sin(Math.PI*t):0,done:t===1};
  }
}

/** Clip floor polygons, rather than dropping whole tiles when one corner crosses the camera. */
export function clipNearPlane(points,near=.06){
  if(!points.length)return [];
  const result=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],insideA=a.z>=near,insideB=b.z>=near;
    if(insideA)result.push({...a});
    if(insideA!==insideB){const t=(near-a.z)/(b.z-a.z);result.push({z:near,lateral:a.lateral+(b.lateral-a.lateral)*t});}
  }
  return result;
}
export function mixHex(a,b,t){
  const channel=(color,i)=>parseInt(color.slice(i,i+2),16);
  return '#'+[1,3,5].map(i=>Math.round(channel(a,i)+(channel(b,i)-channel(a,i))*t).toString(16).padStart(2,'0')).join('');
}
