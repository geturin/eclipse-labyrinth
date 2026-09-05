import { SPRITE_KEYS, explorationSvg, rasterSprite } from './sprite-art.js';
import { sceneObjects, sceneDecorations, projectSprite, visibleSpans, spriteMotion, placeLabels } from './sprite-scene.js';
import { REGIONS, regionAt } from './world.js';
import { GridCamera, headingOf, viewMode, clipNearPlane, mixHex } from './navigation.js';

/** Discrete commands with continuous, finite camera movement and fixed horizon. */
export class DungeonRenderer {
  constructor(canvas,getState) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.getState=getState;
    this.active=true;this.floor=0;this.x=1.5;this.y=1.5;this.angle=0;this.last=0;this.frame=0;this.images={};this.textures=[];this.flash=0;
    this.decorations=[];this.lastLabels=[];this.assetErrors=[];this.camera=new GridCamera();this.travel=null;
    this.reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
    this.ready=Promise.all(SPRITE_KEYS.map(async key=>{
      try{this.images[key]=await rasterSprite(explorationSvg(key));}
      catch(error){
        this.assetErrors.push(key);console.error(`Exploration asset ${key}:`,error);
        const c=document.createElement('canvas');c.width=c.height=320;const t=c.getContext('2d');
        t.fillStyle='#26384c';t.fillRect(70,70,180,225);t.strokeStyle='#f5c889';t.lineWidth=7;t.strokeRect(70,70,180,225);
        t.fillStyle='#ffe4bd';t.font='bold 120px sans-serif';t.textAlign='center';t.fillText('?',160,231);this.images[key]=c;
      }
    }));
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.resize();
    this.loop=this.loop.bind(this);this.request=requestAnimationFrame(this.loop);
  }
  resize() {
    const rect=this.canvas.getBoundingClientRect();
    const ratio=Math.min(window.devicePixelRatio||1,1.5);
    const w=Math.max(320,Math.min(1200,Math.round(rect.width*ratio))),h=Math.max(220,Math.round(rect.height*w/Math.max(1,rect.width)));
    this.uiScale=w/Math.max(1,rect.width);
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.z=new Float32Array(w);}
  }
  destroy(){this.travel=null;this.active=false;cancelAnimationFrame(this.request);this.resizeObserver.disconnect();}
  pulse(){if(this.getState()?.comfort===false&&!this.reducedMotion.matches)this.flash=0.12;}
  makeTextures(floor) {
    this.textures=[];
    for(const zone of REGIONS)for(let kind=0;kind<4;kind++){
      const c=document.createElement('canvas');c.width=128;c.height=128;const t=c.getContext('2d');
      t.fillStyle=zone.mortar;t.fillRect(0,0,128,128);
      for(let row=0;row<4;row++)for(let col=-1;col<3;col++){
        const xx=col*64+(row%2)*32,yy=row*32;t.fillStyle=zone.brick;t.fillRect(xx+1,yy+1,62,30);
        t.fillStyle=zone.edge;t.globalAlpha=.22;t.fillRect(xx+2,yy+2,60,2);t.globalAlpha=1;
      }
      t.fillStyle=zone.edge;t.globalAlpha=.6;t.fillRect(0,112,128,6);t.globalAlpha=1;
      if(zone.style==='garden'){
        t.strokeStyle=zone.color;t.globalAlpha=.42;t.lineWidth=3;
        for(let x=14;x<128;x+=39){t.beginPath();t.moveTo(x,0);t.bezierCurveTo(x+25,37,x-24,70,x+10,118);t.stroke();
          for(let y=18;y<109;y+=26){t.fillStyle=zone.edge;t.beginPath();t.ellipse(x+Math.sin(y)*9,y,8,3,.6,0,Math.PI*2);t.fill();}}
        t.globalAlpha=1;
      }
      if(zone.style==='library'&&kind!==2){
        t.fillStyle='#211d2b';t.fillRect(7,13,114,88);
        for(let row=0;row<2;row++){
          for(let i=0;i<10;i++){t.fillStyle=['#8d716d','#64788c','#968395','#9b956e'][i%4];t.fillRect(12+i*10,18+row*42,7,29-(i%3)*3);t.fillStyle='#d2b88f';t.fillRect(13+i*10,24+row*42,5,1);}
          t.fillStyle=zone.edge;t.fillRect(7,49+row*42,114,4);
        }
      }
      if(zone.style==='arches'){
        t.fillStyle='#282934';t.beginPath();t.moveTo(35,99);t.lineTo(35,55);t.bezierCurveTo(35,10,93,10,93,55);t.lineTo(93,99);t.fill();
        t.strokeStyle=zone.edge;t.lineWidth=5;t.stroke();t.strokeStyle=zone.color;t.lineWidth=2;t.beginPath();t.moveTo(64,27);t.lineTo(64,96);t.moveTo(38,60);t.lineTo(90,60);t.stroke();
      }
      if(kind===1){t.fillStyle=zone.mortar;t.fillRect(8,0,14,128);t.fillStyle=zone.edge;t.fillRect(9,0,3,128);}
      if(kind===2){
        t.fillStyle=zone.mortar;t.fillRect(54,39,20,47);
        const glow=t.createRadialGradient(64,44,3,64,44,39);glow.addColorStop(0,zone.color+'99');glow.addColorStop(1,zone.color+'00');t.fillStyle=glow;t.fillRect(20,0,88,90);
        t.fillStyle=zone.color;t.fillRect(59,36,10,22);t.fillStyle='#fff7e8';t.fillRect(62,37,4,18);
      }
      if(kind===3){t.fillStyle=zone.mortar;t.fillRect(44,36,40,53);t.strokeStyle=zone.color;t.lineWidth=2;t.strokeRect(44,36,40,53);t.fillStyle=zone.color;t.font='bold 30px serif';t.textAlign='center';t.fillText(zone.code,64,73);}
      if(kind===0){
        if(zone.style==='stone'){
          t.fillStyle='#29354d';t.fillRect(46,18,37,58);t.strokeStyle=zone.color;t.lineWidth=2;
          t.beginPath();t.moveTo(64,25);t.lineTo(75,43);t.lineTo(64,61);t.lineTo(53,43);t.closePath();t.stroke();
        }else if(zone.style==='garden'){
          t.fillStyle='#182e30';t.fillRect(14,84,32,26);t.strokeStyle='#78a796';t.lineWidth=2;
          for(let x=19;x<46;x+=7){t.beginPath();t.moveTo(x,85);t.lineTo(x,108);t.stroke();}
        }else if(zone.style==='arches'){
          t.strokeStyle='#352e2c';t.lineWidth=2;t.beginPath();t.moveTo(100,5);t.lineTo(89,26);t.lineTo(105,46);t.lineTo(97,68);t.stroke();
        }
      }
      this.textures.push(c);
    }
  }
  beginTravel(before,after,action,done){
    const mode=viewMode(after,this.reducedMotion.matches);
    if(!this.camera.begin(before,after,action,performance.now(),mode))return false;
    // The snapshot shares geometry with the live dungeon; do not rebuild textures per step.
    if(this.dungeon===after.dungeon)this.dungeon=before.dungeon;
    this.travel={before,after,done};this.last=0;
    Object.assign(this,this.camera.pose);
    return true;
  }
  finishTravel(){
    const travel=this.travel;if(!travel)return;
    this.travel=null;this.dungeon=travel.after.dungeon;Object.assign(this,this.camera.reset(travel.after));
    this.draw(travel.after,performance.now());travel.done();
  }
  navigationFrame(pose){
    const stage=this.canvas.closest('.stage');if(!stage)return;
    stage.dataset.travel=this.travel?'moving':'idle';this.canvas.setAttribute('aria-busy',String(!!this.travel));
    const dir=headingOf(pose.angle),heading=stage.querySelector('[data-facing]');
    if(heading)heading.textContent=['北 N','东 E','南 S','西 W'][dir];
    for(const marker of document.querySelectorAll('.map-player')){
      marker.setAttribute('transform',`translate(${5+(pose.x-.5)*12+6} ${5+(pose.y-.5)*12+6}) rotate(${(pose.angle+Math.PI/2)*180/Math.PI})`);
    }
  }
  loop(time){
    if(!this.active)return;this.request=requestAnimationFrame(this.loop);
    if(document.hidden||(!this.travel&&time-this.last<32))return;this.last=time;
    const run=this.getState();if(!run?.dungeon)return;
    if(this.floor!==run.floor||this.dungeon!==run.dungeon){
      this.floor=run.floor;this.dungeon=run.dungeon;this.makeTextures(run.floor);this.decorations=sceneDecorations(run.dungeon);
      if(!this.travel)this.camera.reset(run);
    }
    let frame;
    if(this.travel){
      if(this.reducedMotion.matches){this.finishTravel();return;}
      frame=this.camera.sample(time);Object.assign(this,{x:frame.x,y:frame.y,angle:frame.angle});
      this.travel.mix=frame.mix;
    }else{Object.assign(this,this.camera.reset(run));frame={...this.camera.pose,done:true,shade:0};}
    this.flash=0;this.draw(run,time);this.navigationFrame(frame);
    if(frame.shade){this.ctx.fillStyle=`rgba(17,23,36,${frame.shade})`;this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);}
    if(this.travel&&frame.done){const {done,after}=this.travel;this.dungeon=after.dungeon;this.travel=null;done();}
  }
  floorTile(ctx,w,h,points,fill){
    const clipped=clipNearPlane(points);if(clipped.length<3)return;
    ctx.beginPath();clipped.forEach((p,i)=>{const x=w/2+p.lateral/p.z*w/.78/2,y=h/2+h/p.z/2;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle='#a1a2c011';ctx.lineWidth=1;ctx.stroke();
  }
  clipSpans(spans) {
    const ctx=this.ctx;ctx.beginPath();
    for(const [x,width] of spans)ctx.rect(x,0,width,this.canvas.height);
    ctx.clip();
  }
  drawObjects(run,time) {
    const ctx=this.ctx,w=this.canvas.width,h=this.canvas.height;
    const animate=run.objectMotion===true&&!this.reducedMotion.matches&&run.phase==='explore';
    let visual=run;
    if(this.travel){
      const {before,after,mix=0}=this.travel;
      const next=new Map(after.dungeon.packs.map(p=>[p.id,p]));
      const packs=before.dungeon.packs.map(p=>{const q=next.get(p.id)||p;return {...p,x:p.x+(q.x-p.x)*mix,y:p.y+(q.y-p.y)*mix};});
      visual={...run,dungeon:{...run.dungeon,packs}};
    }
    const objects=[...this.decorations,...sceneObjects(visual)];
    const sprites=objects.map(o=>projectSprite(o,this,w,h)).filter(Boolean).sort((a,b)=>b.depth-a.depth);
    const candidates=[];
    for(const s of sprites) {
      const image=this.images[s.image];if(!image)continue;
      const spans=visibleSpans(this.z,s.depth,s.left,s.sw);if(!spans.length)continue;
      const motion=spriteMotion(s,time,animate),lift=motion.lift*s.sh,sh=s.sh*motion.stretch;
      const top=s.top+s.sh-sh-lift;
      ctx.save();this.clipSpans(spans);
      if(!s.companion){
        // Ground contact is independent of breathing/hovering; shadows do not hover with the body.
        const foot=s.ground,rx=s.sw*(s.shadow?.34:.29),ry=Math.max(1,h/(s.depth*s.depth)*.028);
        ctx.fillStyle='#080d19';ctx.globalAlpha=s.decor?.22:.42;
        ctx.beginPath();ctx.ellipse(s.center,foot-ry*.18,rx,ry,0,0,Math.PI*2);ctx.fill();
        if(s.shadow){ctx.strokeStyle=s.color??'#c1cce5';ctx.globalAlpha=.45;ctx.lineWidth=1.5*this.uiScale;ctx.stroke();}
      }
      ctx.globalAlpha=Math.max(.44,1-s.depth*.043)*(s.companion?.65:s.decor?.8:1)*motion.light;
      // Draw a COMPLETE cached raster through a screen-space occlusion mask. This fixes the SVG crop bug.
      ctx.drawImage(image,s.left,top,s.sw,sh);
      if(s.image==='shrine'&&this.images['shrine-flame']){
        ctx.save();ctx.translate(s.center,s.top+s.sh*.43);
        const wave=animate?Math.sin(time*.002+s.phase):0;
        ctx.scale(1+wave*.03,1+wave*.055);ctx.translate(-s.center,-s.top-s.sh*.43);
        ctx.drawImage(this.images['shrine-flame'],s.left,s.top,s.sw,s.sh);ctx.restore();
      }
      if(s.elite){
        ctx.globalAlpha=.95;ctx.strokeStyle='#ffe3ac';ctx.fillStyle='#624028';ctx.lineWidth=2*this.uiScale;
        const cy=top+sh*.12,r=Math.max(7*this.uiScale,sh*.065);
        ctx.beginPath();ctx.moveTo(s.center-r,cy);ctx.lineTo(s.center-r*1.3,cy-r);ctx.lineTo(s.center,cy-r*.45);ctx.lineTo(s.center+r*1.3,cy-r);ctx.lineTo(s.center+r,cy);ctx.closePath();ctx.fill();ctx.stroke();
      }
      ctx.restore();
      const center=Math.round(s.center),coverage=spans.reduce((n,[,v])=>n+v,0)/Math.max(1,Math.min(w,s.left+s.sw)-Math.max(0,s.left));
      if(s.label&&coverage>.3&&center>=0&&center<w&&s.depth<this.z[center]-1e-5){
        // Nearer solid sprites take visual priority over markers for objects behind them.
        const hidden=sprites.some(n=>n.depth<s.depth-.1&&!n.decor&&Math.abs(n.center-s.center)<n.sw*.23&&s.top>n.top&&s.top<n.top+n.sh*.88);
        if(!hidden){
          const far=s.depth>=4, text=far?({enemy:'敌群',elite:'强敌',gate:'守卫',stairs:'阶梯',chest:'宝箱',altar:'祭坛',shrine:'星灯',fountain:'泉水'}[s.icon]??s.label):s.label;
          ctx.font=`600 ${12*this.uiScale}px sans-serif`;
          candidates.push({...s,top:top+(image.spriteBounds?.top??0)*sh,width:Math.ceil(ctx.measureText(text).width+41*this.uiScale),text,far});
        }
      }
    }
    this.lastLabels=placeLabels(candidates,w,h,this.uiScale,this.labelObstacles());
    const description='第一人称迷宫'+(this.lastLabels.length?'；前方可见：'+this.lastLabels.map(l=>l.label).join('、'):'；前方暂无可见目标');
    if(this.canvas.getAttribute('aria-label')!==description)this.canvas.setAttribute('aria-label',description);
  }
  labelObstacles() {
    const stage=this.canvas.closest('.stage'),heading=stage?.querySelector('.floor-heading');
    if(!stage)return [];
    const signature=`${this.canvas.width}:${this.canvas.height}`;
    if(this.hudHeading!==heading||this.hudSize!==signature){
      this.hudHeading=heading;this.hudSize=signature;
      const box=this.canvas.getBoundingClientRect(),s=this.uiScale;
      this.hudObstacles=[...stage.querySelectorAll('.floor-heading,.floor-number,.compass,.interaction,.explore-caption,.position-label,.navigation-map')].map(el=>{
        const r=el.getBoundingClientRect();return {x:(r.left-box.left-3)*s,y:(r.top-box.top-3)*s,w:(r.width+6)*s,h:(r.height+6)*s};
      });
    }
    return this.hudObstacles??[];
  }
  drawLabels() {
    const ctx=this.ctx,scale=this.uiScale;
    for(const item of this.lastLabels){
      ctx.save();ctx.globalAlpha=.97;ctx.fillStyle='#111c2e';ctx.strokeStyle=item.color;ctx.lineWidth=scale;
      ctx.beginPath();ctx.roundRect(item.x,item.y,item.w,item.h,5*scale);ctx.fill();ctx.stroke();
      ctx.translate(item.x+14*scale,item.y+12.5*scale);ctx.scale(scale,scale);
      ctx.lineWidth=1.8;ctx.strokeStyle=item.color;ctx.fillStyle=item.color;ctx.beginPath();
      if(item.icon==='chest'){ctx.rect(-6,-3,12,8);ctx.moveTo(-6,-3);ctx.lineTo(-4,-6);ctx.lineTo(4,-6);ctx.lineTo(6,-3);ctx.moveTo(0,-2);ctx.lineTo(0,2);}
      else if(item.icon==='stairs'){ctx.moveTo(-6,6);ctx.lineTo(-6,2);ctx.lineTo(-2,2);ctx.lineTo(-2,-2);ctx.lineTo(2,-2);ctx.lineTo(2,-6);ctx.lineTo(6,-6);}
      else if(item.icon==='gate'||item.icon==='elite'){ctx.moveTo(-6,5);ctx.lineTo(-7,-5);ctx.lineTo(-2,-1);ctx.lineTo(0,-7);ctx.lineTo(3,-1);ctx.lineTo(7,-5);ctx.lineTo(6,5);ctx.closePath();}
      else if(item.icon==='enemy'){ctx.moveTo(0,-7);ctx.lineTo(7,0);ctx.lineTo(0,7);ctx.lineTo(-7,0);ctx.closePath();ctx.moveTo(-3,-1);ctx.lineTo(-1,1);ctx.moveTo(3,-1);ctx.lineTo(1,1);}
      else if(item.icon==='fountain'){ctx.moveTo(0,-7);ctx.bezierCurveTo(-12,5,-2,10,4,5);ctx.bezierCurveTo(8,2,2,-5,0,-7);}
      else {ctx.moveTo(0,-7);ctx.lineTo(2,-2);ctx.lineTo(7,0);ctx.lineTo(2,2);ctx.lineTo(0,7);ctx.lineTo(-2,2);ctx.lineTo(-7,0);ctx.lineTo(-2,-2);ctx.closePath();}
      ctx.stroke();ctx.restore();
      ctx.save();ctx.fillStyle='#eef3ff';ctx.font=`600 ${12*scale}px sans-serif`;ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(item.text,item.x+29*scale,item.y+item.h/2,item.w-34*scale);ctx.restore();
    }
  }
  draw(run,time) {
    const ctx=this.ctx,w=this.canvas.width,h=this.canvas.height;
    if(!w||!h)return;
    const dx=Math.cos(this.angle),dy=Math.sin(this.angle),planeX=-dy*.78,planeY=dx*.78;
    let zone=regionAt(run.dungeon,run.x,run.y);
    if(this.travel){
      const target=regionAt(this.travel.after.dungeon,this.travel.after.x,this.travel.after.y),t=this.travel.mix??0;
      zone={...zone,floor:mixHex(zone.floor,target.floor,t),mortar:mixHex(zone.mortar,target.mortar,t)};
    }
    const floorGrad=ctx.createLinearGradient(0,h*.4,0,h);floorGrad.addColorStop(0,'#121727');floorGrad.addColorStop(1,zone.floor);ctx.fillStyle=floorGrad;ctx.fillRect(0,0,w,h);
    const sky=ctx.createLinearGradient(0,0,0,h/2);sky.addColorStop(0,zone.mortar);sky.addColorStop(1,'#222939');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h/2);
    for(let y=Math.max(0,Math.floor(this.y)-9);y<Math.min(run.dungeon.size,Math.floor(this.y)+10);y++)for(let x=Math.max(0,Math.floor(this.x)-9);x<Math.min(run.dungeon.size,Math.floor(this.x)+10);x++){
      if(run.dungeon.tiles[y][x]!==0)continue;
      const ps=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]].map(([xx,yy])=>({z:(xx-this.x)*dx+(yy-this.y)*dy,lateral:-(xx-this.x)*dy+(yy-this.y)*dx}));
      const tileZone=regionAt(run.dungeon,x,y);this.floorTile(ctx,w,h,ps,tileZone.floor);
    }
    for(let col=0;col<w;col+=2){
      const cameraX=2*col/w-1,rx=dx+planeX*cameraX,ry=dy+planeY*cameraX;
      let mapX=Math.floor(this.x),mapY=Math.floor(this.y);
      const deltaX=Math.abs(1/rx),deltaY=Math.abs(1/ry),stepX=rx<0?-1:1,stepY=ry<0?-1:1;
      let sideX=(rx<0?this.x-mapX:mapX+1-this.x)*deltaX,sideY=(ry<0?this.y-mapY:mapY+1-this.y)*deltaY,side=0;
      for(let step=0;step<80;step++){
        if(sideX<sideY){sideX+=deltaX;mapX+=stepX;side=0;}else{sideY+=deltaY;mapY+=stepY;side=1;}
        if(run.dungeon.tiles[mapY]?.[mapX]!==0)break;
      }
      const dist=Math.max(.06,side===0?sideX-deltaX:sideY-deltaY);this.z[col]=dist;if(col+1<w)this.z[col+1]=dist;
      let wallX=side===0?this.y+dist*ry:this.x+dist*rx;wallX-=Math.floor(wallX);
      let texX=Math.floor(wallX*128);if(side===0&&rx>0||side===1&&ry<0)texX=127-texX;
      const height=h/dist,top=h/2-height/2;
      const code=Math.abs(mapX*13+mapY*7),type=code%9===0?2:code%7===0?3:code%5===0?1:0;
      ctx.drawImage(this.textures[(run.dungeon.zones[mapY]?.[mapX]??0)*4+type],texX,0,1,128,col,top,2,height);
      ctx.fillStyle=`rgba(8,12,25,${Math.min(.76,dist*.06+(side===1?.08:0))})`;ctx.fillRect(col,top,2,height);
      if(dist<4){ctx.fillStyle=`rgba(167,163,207,${.035*(1-dist/4)})`;ctx.fillRect(col,top,2,height);}
    }
    this.drawObjects(run,time);
    const vignette=ctx.createRadialGradient(w/2,h*.48,h*.12,w/2,h*.5,Math.max(w*.67,h*.8));vignette.addColorStop(0,'#10142a00');vignette.addColorStop(.65,'#090d1830');vignette.addColorStop(1,run.comfort!==false?'#07091588':'#070915cc');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
    const haze=ctx.createLinearGradient(0,h*.25,0,h*.8);haze.addColorStop(0,'#aaa0d000');haze.addColorStop(.45,'#909bd20c');haze.addColorStop(1,'#aba9d300');ctx.fillStyle=haze;ctx.fillRect(0,0,w,h);
    if(run.phase!=='battle'&&!this.travel)this.drawLabels();
    if(run.phase==='battle'){ctx.fillStyle='#07091577';ctx.fillRect(0,0,w,h);}
    if(this.flash>0){ctx.fillStyle=`rgba(206,193,243,${this.flash})`;ctx.fillRect(0,0,w,h);this.flash*=.72;if(this.flash<.005)this.flash=0;}
  }
}
