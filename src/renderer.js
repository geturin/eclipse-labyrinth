import { FLOORS } from './data.js';
import { objectSvg, enemySvg, svgUri } from './art.js';

/** Grid movement is rendered as a smooth first-person raycast, not a top-down imitation. */
export class DungeonRenderer {
  constructor(canvas,getState) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.getState=getState;
    this.active=true;this.floor=0;this.x=1.5;this.y=1.5;this.angle=0;this.last=0;this.frame=0;this.images={};this.textures=[];this.flash=0;
    for(const type of ['chest','stairs','shrine','fountain','altar','elite']) {
      const img=new Image();img.src=svgUri(type==='elite'?enemySvg('sentinel','#c9a7bd'):objectSvg(type,type==='shrine'?'#bba7ec':'#b9cbea'));this.images[type]=img;
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
  pulse(){this.flash=0.2;}
  makeTextures(floor) {
    const palettes=[['#323750','#242a41','#48516b'],['#2c434b','#202f3d','#456171'],['#453346','#302739','#64465c'],['#3a344e','#292739','#555078'],['#443e4d','#302e3b','#625b6e']];
    const [brick,mortar,edge]=palettes[floor-1];
    this.textures=[];
    for(let kind=0;kind<4;kind++){
      const c=document.createElement('canvas');c.width=128;c.height=128;const t=c.getContext('2d');
      t.fillStyle=mortar;t.fillRect(0,0,128,128);
      for(let row=0;row<4;row++)for(let col=-1;col<3;col++) {
        const xx=col*64+(row%2)*32,yy=row*32;t.fillStyle=brick;t.fillRect(xx+1,yy+1,62,30);
        t.fillStyle=edge;t.globalAlpha=0.27;t.fillRect(xx+2,yy+2,60,2);t.fillRect(xx+2,yy+2,1,27);t.globalAlpha=1;
        t.fillStyle='#000';t.globalAlpha=.18;t.fillRect(xx+2,yy+29,61,2);t.globalAlpha=1;
        for(let i=0;i<16;i++){const n=(row*937+col*647+i*181+kind*31)>>>0;t.fillStyle=i%2?'#b1afd2':'#090b1a';t.globalAlpha=.06;t.fillRect(xx+4+(n%55),yy+5+(n%22),1+(n%4),1);t.globalAlpha=1;}
      }
      if(kind===1){t.fillStyle='#161c2c';t.fillRect(52,0,24,128);t.fillStyle=edge;t.fillRect(49,0,4,128);t.fillRect(76,0,3,128);t.fillStyle=brick;t.fillRect(55,0,18,128);}
      if(kind===2){
        t.fillStyle='#182133';t.fillRect(60,37,8,50);t.fillStyle='#909db5';t.fillRect(57,62,14,4);
        const glow=t.createRadialGradient(64,40,2,64,40,45);glow.addColorStop(0,'#cfbadeaa');glow.addColorStop(1,'#8b78dd00');t.fillStyle=glow;t.fillRect(18,0,92,86);
        t.fillStyle='#968ba8';t.beginPath();t.moveTo(53,33);t.lineTo(75,33);t.lineTo(70,60);t.lineTo(58,60);t.closePath();t.fill();
        t.fillStyle='#e5d4ed';t.fillRect(59,35,10,19);t.fillStyle='#f5ecfa';t.fillRect(61,36,5,16);
      }
      if(kind===3){t.strokeStyle=FLOORS[floor-1].color;t.globalAlpha=.32;t.lineWidth=1.5;t.beginPath();t.moveTo(64,36);t.lineTo(81,62);t.lineTo(64,88);t.lineTo(47,62);t.closePath();t.moveTo(40,62);t.lineTo(88,62);t.moveTo(64,28);t.lineTo(64,96);t.stroke();t.globalAlpha=1;}
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
    this.angle+=delta*.28;this.x+=(run.x+.5-this.x)*.3;this.y+=(run.y+.5-this.y)*.3;
    this.draw(run,time);
  }
  floorTile(ctx,w,h,points,fill){
    if(points.some(p=>p.z<.14))return;
    ctx.beginPath();points.forEach((p,i)=>{const x=w/2+p.lateral/p.z*w/.66/2,y=h/2+h/p.z/2;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle='#a1a2c011';ctx.lineWidth=1;ctx.stroke();
  }
  draw(run,time) {
    const ctx=this.ctx,w=this.canvas.width,h=this.canvas.height;
    if(!w||!h)return;
    const dx=Math.cos(this.angle),dy=Math.sin(this.angle),planeX=-dy*.66,planeY=dx*.66;
    const floorGrad=ctx.createLinearGradient(0,h*.4,0,h);floorGrad.addColorStop(0,'#121727');floorGrad.addColorStop(1,'#292b40');ctx.fillStyle=floorGrad;ctx.fillRect(0,0,w,h);
    const sky=ctx.createLinearGradient(0,0,0,h/2);sky.addColorStop(0,'#121724');sky.addColorStop(1,'#242639');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h/2);
    for(let y=Math.max(0,Math.floor(this.y)-9);y<Math.min(run.dungeon.size,Math.floor(this.y)+10);y++)for(let x=Math.max(0,Math.floor(this.x)-9);x<Math.min(run.dungeon.size,Math.floor(this.x)+10);x++){
      if(run.dungeon.tiles[y][x]!==0)continue;
      const ps=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]].map(([xx,yy])=>({z:(xx-this.x)*dx+(yy-this.y)*dy,lateral:-(xx-this.x)*dy+(yy-this.y)*dx}));
      this.floorTile(ctx,w,h,ps,(x+y)%2?'#262b3e':'#2b2e43');
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
      ctx.drawImage(this.textures[type],texX,0,1,128,col,top,2,height);
      ctx.fillStyle=`rgba(8,12,25,${Math.min(.88,dist*.075+(side===1?.09:0))})`;ctx.fillRect(col,top,2,height);
      if(dist<4){ctx.fillStyle=`rgba(167,163,207,${.035*(1-dist/4)})`;ctx.fillRect(col,top,2,height);}
    }
    const sprites=Object.entries(run.dungeon.events).filter(([,event])=>!event.used).map(([key,event])=>{
      const [x,y]=key.split(',').map(Number),sx=x+.5-this.x,sy=y+.5-this.y;
      return {event,z:sx*dx+sy*dy,lateral:-sx*dy+sy*dx};
    }).filter(s=>s.z>.25&&s.z<10).sort((a,b)=>b.z-a.z);
    for(const s of sprites){
      const image=this.images[s.event.type];if(!image?.complete||!image.naturalWidth)continue;
      const scale=s.event.type==='stairs'?.95:s.event.type==='elite'?.85:.65,sh=h/s.z*scale,sw=sh*(image.naturalWidth/image.naturalHeight);
      const sx=w/2*(1+s.lateral/(s.z*.66))-sw/2,sy=h/2+h/s.z/2-sh;
      ctx.globalAlpha=Math.max(.2,1-s.z*.065);
      for(let col=Math.max(0,Math.floor(sx));col<Math.min(w,sx+sw);col+=2){if(s.z<this.z[col]+.08){const sourceX=Math.max(0,Math.min(image.naturalWidth-1,(col-sx)/sw*image.naturalWidth));const sourceW=Math.min(image.naturalWidth-sourceX,image.naturalWidth/sw*2.2);if(sourceW>0)ctx.drawImage(image,sourceX,0,sourceW,image.naturalHeight,col,sy,2.2,sh);}}
      ctx.globalAlpha=1;
    }
    const vignette=ctx.createRadialGradient(w/2,h*.48,h*.12,w/2,h*.5,Math.max(w*.67,h*.8));vignette.addColorStop(0,'#10142a00');vignette.addColorStop(.65,'#090d1830');vignette.addColorStop(1,'#070915ee');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
    const haze=ctx.createLinearGradient(0,h*.25,0,h*.8);haze.addColorStop(0,'#aaa0d000');haze.addColorStop(.45,'#909bd20c');haze.addColorStop(1,'#aba9d300');ctx.fillStyle=haze;ctx.fillRect(0,0,w,h);
    ctx.fillStyle=FLOORS[run.floor-1].color;
    for(let i=0;i<24;i++){const px=((i*157.7+time*.002*(i%3+1))%w),py=((i*97.4-time*.006+100000)%h);ctx.globalAlpha=.15+(Math.sin(time*.001+i)*.5+.5)*.32;ctx.beginPath();ctx.arc(px,py,i%6===0?1.8:.7,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
    if(run.phase==='battle'){ctx.fillStyle='#07091577';ctx.fillRect(0,0,w,h);}
    if(this.flash>0){ctx.fillStyle=`rgba(206,193,243,${this.flash})`;ctx.fillRect(0,0,w,h);this.flash*=.72;if(this.flash<.005)this.flash=0;}
  }
}
