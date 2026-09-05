import { enemySvg } from './art.js';
import { ENEMY_TYPES } from './data.js';

// Exploration assets have a fixed viewport and intrinsic size. Body feet end at y=300.
// Battle/portrait art is deliberately untouched. Every asset is rasterized once before raycasting.
export const SPRITE_SIZE=320;
export const SPRITE_KEYS=[
  'chest','stairs','gate','altar','shrine','shrine-flame','fountain',
  ...Object.keys(ENEMY_TYPES).map(id=>'mob-'+id),
  ...[0,1,2,3].flatMap(i=>['landmark-'+i,'decor-'+i]),
];
const zones=['#a8bcff','#a3e6bd','#d9b5fa','#eaca91'];
const shell=(body,color='#cdd9f3')=>`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
<defs>
 <linearGradient id="stone" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#aab9ce"/><stop offset=".45" stop-color="#627792"/><stop offset="1" stop-color="#26364e"/></linearGradient>
 <linearGradient id="gold" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#fff0b7"/><stop offset=".4" stop-color="#d6aa58"/><stop offset="1" stop-color="#79501f"/></linearGradient>
 <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ad644d"/><stop offset="1" stop-color="#4e2c36"/></linearGradient>
 <linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#cafff5"/><stop offset="1" stop-color="#2a8f9e"/></linearGradient>
 <linearGradient id="veil" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="#36334f"/></linearGradient>
 <radialGradient id="aura"><stop stop-color="${color}" stop-opacity=".25"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>
 <filter id="rim" x="-15%" y="-15%" width="130%" height="130%"><feMorphology in="SourceAlpha" operator="dilate" radius="1.6" result="edge"/><feFlood flood-color="${color}" flood-opacity=".82"/><feComposite in2="edge" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>${body}</svg>`;
const base=`<path d="m49 276 110-19 113 18-11 23H61Z" fill="#283348" stroke="#a1b3ce" stroke-width="3"/><path d="m49 276 109 9 114-10-112-19Z" fill="#8c9db3"/><path d="M159 285v13" stroke="#e1e4ef" stroke-width="2"/>`;

function chest() {
 return `<g stroke="#ffe2a2" stroke-width="3" stroke-linejoin="round">
 <path d="m43 152 161-24 72 36v104l-163 31-70-46Z" fill="url(#wood)"/>
 <path d="m43 152 70 41 163-29-70-36Z" fill="#e2bb75"/>
 <path d="m113 193 163-29v104l-163 31Z" fill="#633b3b"/>
 <path d="M43 152V119q0-43 42-53l108-19q42-6 58 39l25 78-163 29Z" fill="url(#wood)"/>
 <path d="m43 150 70 43v-29q-2-38-26-63Q65 76 50 105Z" fill="#673f42"/>
 <path d="m86 65 33-6q43 17 57 118l-29 5Q135 91 86 65Z" fill="url(#gold)"/>
 <path d="m194 47 22 6q36 20 60 111l-24 5Q235 72 194 47Z" fill="url(#gold)"/>
 <path d="m47 147 67 40 159-29v17l-160 29-66-40Z" fill="url(#gold)"/>
 <path d="m174 188 35-7v47l-35 7Z" fill="url(#gold)"/><path d="m188 198 9-2v20l-9 2Z" fill="#322637"/>
 <path d="m122 214 0 66m145-91v64" stroke="#dfa65f" stroke-width="8"/>
 <path d="m49 232 18 10v16l-18-11Zm82 46 18-3v17l-18 3Zm125-26 17-3v16l-17 4Z" fill="url(#gold)"/>
 </g><path d="m203 99 8 17 18 5-17 8-5 18-8-17-18-5 17-8Z" fill="#fff3bd"/>`;
}
function doorway(closed) {
 const c=closed?'#eac083':'#9becee';
 return `<path d="M39 296V100Q39 22 146 17Q247 18 261 97v193Z" fill="#253248" stroke="${c}" stroke-width="7"/>
 <path d="M57 288V102q0-64 93-67 91 5 91 65v186Z" fill="url(#stone)"/>
 <path d="M82 269V108q0-45 69-47 63 0 63 48v158Z" fill="#101d30" stroke="${c}" stroke-width="3"/>
 <path d="m35 292 50-25 131 0 67 24-11 14H43Z" fill="url(#stone)" stroke="${c}" stroke-width="3"/>
 ${closed?`<path d="M92 264V108q0-35 59-38 52 1 52 38v156Z" fill="#373448"/><path d="M116 86v176M145 74v188M174 81v181M88 142h116M88 204h116" stroke="#ccae79" stroke-width="7"/><path d="m151 102 19 31-19 32-19-32Z" fill="url(#gold)"/><circle cx="151" cy="211" r="18" fill="#584332" stroke="#f8d98e" stroke-width="3"/>`:
 `<path d="M122 138h59v14h-69v18h81v21H102v24h100v26H90v29h126" fill="none" stroke="#a9dbe3" stroke-width="6"/><path d="m121 140-11 29-10 45-10 53m90-127 13 49 9 50 14 31" stroke="#46667f" stroke-width="3"/><path d="m136 91 15 17 15-17m-30 16 15 17 15-17" fill="none" stroke="#bafff6" stroke-width="6"/>`}
 <path d="M60 115H78M58 169H79M59 229H78M219 116H239M220 171H241M219 228H242" stroke="#bbc7d6" stroke-width="3"/>
 <path d="m151 21-16 18 16 14 15-14Z" fill="${c}"/>`;
}
function altar() {
 return `${base}<g stroke="#e0c8ff" stroke-width="3" stroke-linejoin="round">
 <path d="m110 252 9-109h80l10 109-50 28Z" fill="url(#stone)"/>
 <path d="m132 160-16 90 44 28 40-28-14-91" fill="url(#veil)"/>
 <path d="M121 140q-13-55 9-79 27-32 57-3 22 21 13 83l-40 28Z" fill="#a4a2c7"/>
 <path d="M132 99q-5-43 28-44 30 0 29 44l-12 32h-33Z" fill="#e3ddec"/>
 <path d="m122 93 10-56 28 21 27-21 11 55-37-18Z" fill="#9b8aaf"/>
 <path d="m118 152-32 50 39 15 35-22 35 22 33-18-30-45-37 27Z" fill="url(#stone)"/>
 <path d="m139 177 22 14 21-14-4 30-16 10-18-10Z" fill="#ebe0f3"/>
 </g><path d="M180 28a60 60 0 1 0 0 117 50 50 0 0 1 0-117" fill="#d6b6ee" opacity=".65"/>
 <circle cx="161" cy="228" r="17" fill="url(#aura)"/><path d="m161 211 8 16-8 16-8-16Z" fill="#ebd0ff"/>`;
}
function shrine() {
 return `${base}<path d="m107 260 19-34h68l21 34-53 19Z" fill="url(#stone)" stroke="#c0d9fa" stroke-width="3"/><path d="M139 227V152h45v75l-23 14Z" fill="url(#stone)" stroke="#d1dfff" stroke-width="3"/><path d="m101 152 13-24h95l13 24-61 18Z" fill="#a4bcd5" stroke="#dae5ff" stroke-width="3"/><path d="M105 92 128 53h65l23 39-54 11Z" fill="url(#stone)" stroke="#d1def5" stroke-width="3"/><path d="M115 89v49m93-49v49" stroke="#a7bbd7" stroke-width="7"/><circle cx="161" cy="47" r="9" fill="#d8eafa"/>`;
}
function flame() {
 return `<circle cx="161" cy="115" r="48" fill="url(#aura)"/><path d="M140 137q-14-15 3-33 14-13 17-34 27 20 19 37 20 18-2 32Z" fill="#72ccf6"/><path d="M149 134q-10-15 13-32-4 14 9 21 8 13-7 17Z" fill="#eeffff"/>`;
}
function fountain() {
 return `<ellipse cx="160" cy="272" rx="116" ry="27" fill="#355771" stroke="#bbe9f1" stroke-width="4"/><path d="M44 249q4 52 116 51 114 0 116-51" fill="url(#stone)" stroke="#a0d7e5" stroke-width="3"/><ellipse cx="160" cy="247" rx="116" ry="36" fill="#8cb2c8" stroke="#ccf7ff" stroke-width="4"/><ellipse cx="160" cy="247" rx="99" ry="25" fill="url(#water)"/><path d="M146 240V149h28v91" fill="url(#stone)" stroke="#cce6ee" stroke-width="3"/><path d="M94 144q0 40 66 39 68 0 68-39" fill="url(#stone)" stroke="#b4e0e9" stroke-width="3"/><ellipse cx="160" cy="143" rx="67" ry="20" fill="#8ddede" stroke="#d8f4f1" stroke-width="4"/><path d="M151 137q-8-52 9-89 21 32 9 88M100 153v83m120-83v83" fill="none" stroke="#91eeee" stroke-width="5"/><path d="M125 248q34 13 71-2m-98 2q-5 19 54 23m42-35q33 5 27 18" fill="none" stroke="#e1fff9" stroke-width="3"/>`;
}
function beast() {
 return `<g stroke="#c4e59e" stroke-width="3" stroke-linejoin="round"><path d="m52 217-14 63 34 9 30-64m105-4 17 65 34-7-12-77" fill="#4e6954"/><path d="m43 230 24-97 63-54 85 18 57 98-37 50-96 25Z" fill="#577866"/><path d="m74 155 19-53 34 22 27-64 26 56 44-14-5 48 47 26-43 28 7 44-58-13-42 19-15-46-55-16Z" fill="url(#veil)"/><path d="m114 192 78-2 28 44-23 43h-72l-31-40Z" fill="#354c49"/><path d="m108 217 32 9-10 11-17-5m80-15-29 9 9 11 17-5" fill="#f0da9a"/><path d="m131 256 14-6 16 7 18-7 13 7" fill="none" stroke="#d5dabc" stroke-width="4"/></g>`;
}
function prism() {
 return `<circle cx="160" cy="153" r="112" fill="url(#aura)"/><g stroke="#b8fff2" stroke-width="3"><path d="m157 53 52 93-48 107-58-103Z" fill="#447e98"/><path d="m157 53 2 102-56-5Z" fill="#a1f0ee"/><path d="m157 53 52 93-50 9Z" fill="#66b4c5"/><path d="m159 155 2 98 48-107Z" fill="#2f526b"/><path d="m58 121 25 31-21 48-22-40Zm195-47 23 45-20 25-23-28Zm-35 140 15 17-12 34-16-27Z" fill="#82c7cc"/></g><ellipse cx="160" cy="156" rx="101" ry="30" fill="none" stroke="#98e5e1" stroke-width="4" transform="rotate(-22 160 156)"/><path d="m160 125 14 26-14 31-13-30Z" fill="#f5fff7"/>`;
}
function caller() {
 return `<g stroke="#f5d5b0" stroke-width="3" stroke-linejoin="round"><path d="m123 142-47 146 67-14 47 21 52-18-32-146Z" fill="url(#veil)"/><path d="m141 149-9 108 43 23 7-136Z" fill="#d4bb92"/><path d="M115 131 111 73l47-41 49 41-2 60-42 32Z" fill="#68495d"/><path d="m137 92 48 0-6 43-22 11-19-14Z" fill="#f0dbc5"/><path d="m142 104 11 0m14 0h11" stroke="#553b59" stroke-width="5"/><path d="m132 162-50 37-21-12 55-48m67 22 36 29 16-8-36-43" fill="#a98989"/><path d="M65 273 51 75" stroke="#ddb775" stroke-width="8"/></g><path d="M64 25A33 33 0 1 0 64 85 28 28 0 0 1 64 25" fill="#fff0b8"/><circle cx="53" cy="58" r="10" fill="#cbd7ef"/>`;
}
function guardian() {
 return `<g stroke="#f5d397" stroke-width="3" stroke-linejoin="round"><path d="m114 220-9 76h41l15-62 13 62h44l-18-81Z" fill="#475970"/><path d="m96 118-43 40 32 82 46-21 30 30 38-24 34 9 23-83-48-34Z" fill="url(#stone)"/><path d="m110 139 52 38 41-40-5 68-35 27-40-20Z" fill="#39556e"/><path d="M113 116 118 65l27-30 39 0 27 31-3 52-47 36Z" fill="url(#gold)"/><path d="m122 83 41 12 39-12-7 29-33 16-32-14Z" fill="#202d43"/><path d="m136 98 17 4m20 0 17-4" stroke="#effaff" stroke-width="5"/><path d="m145 37-14-26 31 16 34-16-12 26Z" fill="#f4deb0"/><path d="m218 137 59 25-10 87-45 36-36-44 5-86Z" fill="#445b79"/><path d="m225 160 29 14-5 64-25 23-20-28 3-63Z" fill="url(#gold)"/><path d="M48 293V89" stroke="#bcd4e3" stroke-width="8"/><path d="m48 35 18 46-18 36-20-36Z" fill="url(#gold)"/></g><path d="m162 177 14 17-14 22-13-22Z" fill="#d4f0f9"/>`;
}
function mob(id) {
 if(id==='briar')return beast();if(id==='prism')return prism();if(id==='caller')return caller();if(id==='guardian')return guardian();
 const data=ENEMY_TYPES[id]??ENEMY_TYPES.slime;
 const inner=enemySvg(data.kind,data.tint).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
 return `<g transform="translate(0 8)" filter="url(#rim)">${inner}</g>`;
}
function landmark(zone) {
 const color=zones[zone],motifs=[
 `<path d="m160 60 24 48 46 17-46 16-24 48-23-48-46-16 46-17Z" fill="${color}"/><path d="M160 85v81m-39-42h78" stroke="#eef7ff" stroke-width="4"/>`,
 `<path d="M160 185C68 143 71 62 137 108Q153 25 210 65Q256 134 160 185" fill="${color}"/><path d="M160 202V93m0 64-45-43m45 15 45-39" stroke="#e6f7d9" stroke-width="4" fill="none"/>`,
 `<path d="M77 99q39-22 83 4 40-26 83-4v94q-46-21-83 0-40-21-83 0Z" fill="${color}" stroke="#e9d9ff" stroke-width="4"/><path d="M160 108v81M94 121l43 6m-43 14 43 6m47-19 40-8m-40 29 40-8" stroke="#765189" stroke-width="4"/>`,
 `<path d="M108 172q11-39 12-65a40 40 0 0 1 80 0q1 37 14 65Z" fill="url(#gold)" stroke="${color}" stroke-width="4"/><ellipse cx="160" cy="177" rx="57" ry="12" fill="#463541" stroke="${color}" stroke-width="4"/><path d="M160 64V43m-10 145q10 19 20 0" stroke="${color}" stroke-width="8" fill="none"/>`,
 ];
 return `${base}<path d="m109 214 103 0 10 54-62 16-62-16Z" fill="url(#stone)" stroke="${color}" stroke-width="3"/>${motifs[zone]}<text x="161" y="252" font-family="serif" font-size="27" text-anchor="middle" fill="#edf0ff">${['I','II','III','IV'][zone]}</text>`;
}
function decoration(zone) {
 if(zone===0)return `<g stroke="#abbddb" stroke-width="3"><path d="m72 281 14-92 35-16 39 39-4 75Z" fill="url(#stone)"/><path d="m125 267 38-111 35 47 7 87Z" fill="#7086a6"/><path d="m196 283 26-59 35 27 9 40Z" fill="#526981"/></g><path d="m165 172 18 35-16 52-16-24Z" fill="#b6cbf3"/>`;
 if(zone===1)return `<path d="m107 291 20-50h66l25 50Z" fill="#426a59"/><g fill="#79b29c" stroke="#bee5c1" stroke-width="3"><path d="M160 276Q31 223 83 139q77 26 77 137Z"/><path d="M162 277q-40-177 35-196 45 96-35 196Z"/><path d="M159 277q27-161 95-109-20 94-95 109Z"/></g><path d="M163 287V142m0 109-57-77m56 99 64-77" fill="none" stroke="#355d50" stroke-width="5"/>`;
 if(zone===2)return `<g stroke="#d9bc9e" stroke-width="3"><path d="m64 263 135-13 60 26-127 22-68-16Z" fill="#846482"/><path d="m82 221 138-7 25 34-135 23-33-29Z" fill="#587d8c"/><path d="m104 185 116 6 17 23-119 12-25-22Z" fill="#aa806c"/></g><path d="M118 203 219 199m-118 43 119-17m-85 59 101-17" stroke="#edd7b5" stroke-width="7"/>`;
 return `<path d="M139 167 130 128h60l-9 39q57 32 45 98-11 34-67 34-57-1-66-34-12-64 46-98Z" fill="url(#gold)" stroke="#dfbf98" stroke-width="4"/><path d="m118 183-37-11-9 44 29 21m103-53 37-14 13 39-24 29" fill="none" stroke="#bb926e" stroke-width="9"/><path d="m148 154 11 61-21 16 22 60" fill="none" stroke="#4d3e3b" stroke-width="4"/><path d="M112 250q46 21 97 0" fill="none" stroke="#ead4a6" stroke-width="5"/>`;
}
export function explorationSvg(key) {
 let body,color='#c3d7ef';
 if(key.startsWith('mob-')){const id=key.slice(4);body=mob(id);color=ENEMY_TYPES[id]?.tint??color;}
 else if(key.startsWith('landmark-')){const zone=Number(key.slice(-1))%4;body=landmark(zone);color=zones[zone];}
 else if(key.startsWith('decor-')){const zone=Number(key.slice(-1))%4;body=decoration(zone);color=zones[zone];}
 else {body=({chest,stairs:()=>doorway(false),gate:()=>doorway(true),altar,shrine,'shrine-flame':flame,fountain}[key]??chest)();color={chest:'#f3cf83',stairs:'#9ae9ed',gate:'#ffd49a',altar:'#dfc1ff',shrine:'#aed9ff','shrine-flame':'#88dfff',fountain:'#a0eee1'}[key];}
 return shell(body,color);
}

/** Raster source has unambiguous pixel coordinates on every browser. An asset failure remains visible. */
export async function rasterSprite(svg,size=SPRITE_SIZE) {
 const image=new Image(),canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d');
 const loaded=new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Exploration SVG failed to load'));});
 image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
 await loaded;
 // Five-argument full-image draw: do not slice an SVG in intrinsic/viewBox coordinates.
 ctx.drawImage(image,0,0,size,size);
 const pixels=ctx.getImageData(0,0,size,size).data;
 let top=size,bottom=0,left=size,right=0;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(pixels[(y*size+x)*4+3]>40){top=Math.min(top,y);bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);}
 canvas.spriteBounds={top:top/size,bottom:bottom/size,left:left/size,right:right/size};
 return canvas;
}
