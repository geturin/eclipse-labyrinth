import { FLOORS, ENEMY_TYPES } from './data.js';
import { objectSvg, enemySvg, svgUri } from './art.js';
import { REGIONS, regionAt } from './world.js';

/** First-person grid raycaster. Default comfort mode snaps movement and turns without camera bob. */
export class DungeonRenderer {
  constructor(canvas,getState) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.getState=getState;
    this.active=true;this.floor=0;this.x=1.5;this.y=1.5;this.angle=0;this.last=0;this.frame=0;this.images={};this.textures=[];this.flash=0;
    for(const type of ['chest','stairs','shrine','fountain','altar','elite']) {
      const img=new Image();img.src=svgUri(type==='elite'?enemySvg('sentinel','#c9a7bd'):objectSvg(type,type==='shrine'?'#bba7ec':'#b9cbea'));this.images[type]=img;
    }
    for(const [id,data] of Object.entries(ENEMY_TYPES)){const img=new Image();img.src=svgUri(enemySvg(data.kind,data.tint));this.images['mob-'+id]=img;}
    for(let i=0;i<4;i++){
      const z=REGIONS[i],img=new Image();
      const motifs=[`<path d="M80 35 95 71 130 80 95 92 80 125 66 92 30 80 66 68Z" fill="${z.color}"/><path d="M80 48V112M48 80H112" stroke="#fff" opacity=".6"/>`,`<path d="M80 121C18 85 39 41 70 77Q81 21 112 40Q139 87 80 121" fill="${z.color}"/><path d="M80 142V65M80 105 51 75M80 89 112 59" fill="none" stroke="#c8ffe1" stroke-width="4"/>`,`<path d="M30 53Q54 41 80 57Q106 41 130 53V111Q103 99 80 116Q54 100 30 111Z" fill="${z.color}"/><path d="M80 59V110M41 65 67 67M41 78 67 80M93 67 118 65M93 80 118 78" stroke="#503b69" stroke-width="3"/>`,`<path d="M51 107Q52 91 57 68A23 23 0 0 1 103 68Q107 89 110 107Z" fill="${z.color}"/><ellipse cx="80" cy="108" rx="30" ry="6" fill="#5b472b"/><path d="M80 40V27M74 119Q80 128 87 119" fill="none" stroke="${z.color}" stroke-width="5"/>`];
      img.src=svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 200"><ellipse cx="80" cy="184" rx="62" ry="12" fill="#000" opacity=".3"/><path d="M49 133H111L116 179H44Z" fill="#323844" stroke="${z.color}" stroke-width="2"/><path d="M39 177H121V186H39Z" fill="#4a505b"/>${motifs[i]}<text x="80" y="164" text-anchor="middle" fill="${z.color}" font-family="serif" font-size="23">${z.code}</text></svg>`);this.images['landmark-'+i]=img;
    }
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.resize();
    this.loop=this.loop.bind(this);this.request=requestAnimationFrame(this.loop);
  }
  resize() {
    const rect=this.canvas.getBoundingClientRect();
    const ratio=Math.min(window.devicePixelRatio||1,1.5);
    const w=Math.max(320,Math.min(1200,Math.round(rect.width*ratio))),h=Math.max(220,Math.round(rect.height*w/Math.max(1,rect.width)));
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.z=new Float32Array(w);}
  }
  destroy(){this.active=false;cancelAnimationFrame(this.request);this.resizeObserver.disconnect();}
  pulse(){if(this.getState()?.comfort===false)this.flash=0.12;}
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
      this.textures.push(c);
    }
  }
  loop(time){
    if(!this.active)return;this.request=requestAnimationFrame(this.loop);
    if(time-this.last<30||document.hidden)return;this.last=time;
    const run=this.getState();if(!run?.dungeon)return;
    if(this.floor!==run.floor||this.dungeon!==run.dungeon){this.floor=run.floor;this.dungeon=run.dungeon;this.makeTextures(run.floor);this.x=run.x+.5;this.y=run.y+.5;this.angle=-Math.PI/2+run.dir*Math.PI/2;}
    const target=-Math.PI/2+run.dir*Math.PI/2;
    let delta=((target-this.angle+Math.PI*3)%(Math.PI*2))-Math.PI;
    if(run.comfort!==false){this.angle=target;this.x=run.x+.5;this.y=run.y+.5;this.flash=0;}else{this.angle+=delta*.38;this.x+=(run.x+.5-this.x)*.4;this.y+=(run.y+.5-this.y)*.4;}
    this.draw(run,time);
  }
  floorTile(ctx,w,h,points,fill){
    if(points.some(p=>p.z<.14))return;
    ctx.beginPath();points.forEach((p,i)=>{const x=w/2+p.lateral/p.z*w/.78/2,y=h/2+h/p.z/2;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle='#a1a2c011';ctx.lineWidth=1;ctx.stroke();
  }
  draw(run,time) {
    const ctx=this.ctx,w=this.canvas.width,h=this.canvas.height;
    if(!w||!h)return;
    const dx=Math.cos(this.angle),dy=Math.sin(this.angle),planeX=-dy*.78,planeY=dx*.78;
    const zone=regionAt(run.dungeon,run.x,run.y);
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
    const objects=Object.entries(run.dungeon.events).filter(([,ev])=>!ev.used).map(([key,ev])=>{const [x,y]=key.split(',').map(Number);return {x,y,image:ev.type,scale:ev.type==='stairs'?.95:.65};});
    for(const l of run.dungeon.landmarks||[])objects.push({x:l.x,y:l.y,image:'landmark-'+l.zone,scale:.9});
    if(run.phase!=='battle')for(const mob of run.dungeon.packs.filter(p=>!p.defeated&&!p.engaged))objects.push({x:mob.x,y:mob.y,image:'mob-'+mob.troop[0],scale:mob.kind==='elite'?1.05:.8,mob});
    const sprites=objects.map(object=>{const sx=object.x+.5-this.x,sy=object.y+.5-this.y;return {...object,z:sx*dx+sy*dy,lateral:-sx*dy+sy*dx};}).filter(s=>s.z>.2&&s.z<10).sort((a,b)=>b.z-a.z);
    for(const s of sprites){
      const image=this.images[s.image];if(!image?.complete||!image.naturalWidth)continue;
      const scale=s.scale,sh=h/s.z*scale,sw=sh*(image.naturalWidth/image.naturalHeight);
      const sx=w/2*(1+s.lateral/(s.z*.78))-sw/2,sy=h/2+h/s.z/2-sh;
      ctx.globalAlpha=Math.max(.2,1-s.z*.065);
      for(let col=Math.max(0,Math.floor(sx));col<Math.min(w,sx+sw);col+=2){if(s.z<this.z[col]+.08){const sourceX=Math.max(0,Math.min(image.naturalWidth-1,(col-sx)/sw*image.naturalWidth));const sourceW=Math.min(image.naturalWidth-sourceX,image.naturalWidth/sw*2.2);if(sourceW>0)ctx.drawImage(image,sourceX,0,sourceW,image.naturalHeight,col,sy,2.2,sh);}}
      ctx.globalAlpha=1;
      const center=Math.round(sx+sw/2);
      if(s.mob&&center>=0&&center<w&&s.z<this.z[center]+.08){ctx.fillStyle=s.mob.kind==='elite'?'#ffca8d':'#ffadc1';ctx.font=`bold ${Math.max(11,Math.min(20,28/s.z))}px sans-serif`;ctx.textAlign='center';ctx.fillText(`${s.mob.kind==='elite'?'强敌':'敌群'} ×${s.mob.troop.length}`,center,Math.max(18,sy-4));}
    }
    const vignette=ctx.createRadialGradient(w/2,h*.48,h*.12,w/2,h*.5,Math.max(w*.67,h*.8));vignette.addColorStop(0,'#10142a00');vignette.addColorStop(.65,'#090d1830');vignette.addColorStop(1,run.comfort!==false?'#07091588':'#070915cc');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
    const haze=ctx.createLinearGradient(0,h*.25,0,h*.8);haze.addColorStop(0,'#aaa0d000');haze.addColorStop(.45,'#909bd20c');haze.addColorStop(1,'#aba9d300');ctx.fillStyle=haze;ctx.fillRect(0,0,w,h);
    ctx.fillStyle=FLOORS[run.floor-1].color;
    for(let i=0;run.comfort===false&&i<12;i++){const px=((i*157.7+time*.002*(i%3+1))%w),py=((i*97.4-time*.006+100000)%h);ctx.globalAlpha=.15+(Math.sin(time*.001+i)*.5+.5)*.32;ctx.beginPath();ctx.arc(px,py,i%6===0?1.8:.7,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
    if(run.phase==='battle'){ctx.fillStyle='#07091577';ctx.fillRect(0,0,w,h);}
    if(this.flash>0){ctx.fillStyle=`rgba(206,193,243,${this.flash})`;ctx.fillRect(0,0,w,h);this.flash*=.72;if(this.flash<.005)this.flash=0;}
  }
}
