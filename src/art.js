/** Original, self-contained vector artwork. No remote assets or third-party character art. */
const ART_PALETTES={
  knight:{hair:'#dddfee',shade:'#939bc4',light:'#fbfaff',eye:'#8b97e8',accent:'#bac6ff',cloth:'#263345',skin:'#f0d4d0',style:0},
  mage:{hair:'#b75248',shade:'#592b42',light:'#ecb399',eye:'#e8ad68',accent:'#e7a685',cloth:'#402437',skin:'#efcebd',style:1},
  shrine:{hair:'#243342',shade:'#142232',light:'#6a8e9d',eye:'#81c5c0',accent:'#a7d6ca',cloth:'#f3e8df',skin:'#f5d8cc',style:2},
  ninja:{hair:'#796291',shade:'#392e54',light:'#b2a1d1',eye:'#d2a4cf',accent:'#c8ade7',cloth:'#282535',skin:'#ead1ce',style:3},
  chrono:{hair:'#d9b98e',shade:'#8e6a55',light:'#f3dfb6',eye:'#70afa6',accent:'#e9cf95',cloth:'#37404d',skin:'#f0d3bc',style:4},
  reaver:{hair:'#332735',shade:'#160f23',light:'#83617b',eye:'#e57b91',accent:'#e79aa9',cloth:'#34212f',skin:'#edccca',style:5},
};
export function svgUri(svg) {return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;}
export function icon(name,size=20) {
  const paths={
    sword:'<path d="m5 19 3-3m1-1L19 5l-4 1-8 8M5 13l6 6M4 20l-1 1"/>',
    shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
    star:'<path d="m12 2 2.8 6.2L22 10l-5.3 4.8.5 7.2L12 18l-5.2 4 .5-7.2L2 10l7.2-1.8z"/>',
    flame:'<path d="M12 3c2 6-4 7-2 11 2 1 4-1 4-4 7 6 5 11-2 11S2 14 6 9c0 4 2 4 3 2 1-3 0-5 3-8Z"/>',
    ice:'<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M3 10l4-1-1-4M21 14l-4 1 1 4M6 19l1-4-4-1M18 5l-1 4 4 1"/>',
    heart:'<path d="M20.8 4.6c-2-2-5.5-1.5-8.8 2-3.3-3.5-6.8-4-8.8-2C-1 9 5 15 12 21 19 15 25 9 20.8 4.6Z"/>',
    venom:'<path d="M9 3h6m-5 0v6l-6 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-9V3M7 15h10"/><path d="M10 18h.1M14 17h.1"/>',
    moon:'<path d="M20 15A9 9 0 0 1 9 3 9.5 9.5 0 1 0 20 15Z"/><path d="m17 3 1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    drop:'<path d="M12 2C10 7 4 10 4 15a8 8 0 0 0 16 0c0-5-6-8-8-13Z"/><path d="M8 14q-1 4 3 4"/>',
    wind:'<path d="M3 8h12c5 0 5-6 1-5M3 12h16c5 0 5 7 0 7M3 16h7c5 0 5 6 1 5"/>',
    flower:'<path d="M12 8C5-3 0 8 8 12c-11 7 0 12 4 4 7 11 12 0 4-4 11-7 0-12-4-4Z"/><circle cx="12" cy="12" r="2"/>',
    eye:'<path d="M2 12S6 5 12 5s10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    link:'<path d="m9 15 6-6M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 1 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(1 0)"/>',
    map:'<path d="m3 5 6-2 6 3 6-3v16l-6 2-6-3-6 3zM9 3v15m6-12v15"/>',
    bag:'<path d="M7 7V5a5 5 0 0 1 10 0v2M4 7h16l1 14H3zM9 11h6"/>',
    stairs:'<path d="M3 21v-6h6V9h6V3h6M4 4h6M4 4v6M4 4l8 8"/>',
    chest:'<path d="M3 10V7c0-3 18-3 18 0v13H3zM3 10h18M9 10v4h6v-4M7 5v5m10-5v5"/>',
    sound:'<path d="m3 9 4 0 6-5v16l-6-5H3zM17 8q5 4 0 8m2-11q8 7 0 14"/>',
    mute:'<path d="m3 9 4 0 6-5v16l-6-5H3zM17 9l5 6m0-6-5 6"/>',
    arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    up:'<path d="m5 15 7-7 7 7"/>',
    down:'<path d="m5 9 7 7 7-7"/>',
    left:'<path d="m15 5-7 7 7 7"/>',
    right:'<path d="m9 5 7 7-7 7"/>',
    turnleft:'<path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12"/>',
    turnright:'<path d="m16 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    check:'<path d="m4 12 5 5L20 6"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 0 1 6 0c0 3-3 2-3 5m0 4h.01"/>',
    exit:'<path d="M9 3H3v18h6m5-15 6 6-6 6M8 12h12"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.star}</svg>`;
}
export function portraitSvg(job='knight') {
  const p=ART_PALETTES[job]||ART_PALETTES.knight;
  const long=[0,1,2,5].includes(p.style);
  const hairBack=long?`<path d="M113 157C92 230 110 338 58 446L116 421 98 483 162 446 246 458 302 486 293 421 344 458C294 338 313 257 290 158Z" fill="url(#hair)"/><path d="M126 227Q86 371 116 429M267 230q40 100 23 207" stroke="${p.shade}" stroke-width="8" fill="none"/>`:`<path d="M115 168 97 275l37-15-12 39 51-33 71 17 42 17-5-35 25 10-20-117Z" fill="url(#hair)"/>`;
  const bangs=p.style===2?`<path d="M114 173Q129 77 201 98q101 0 92 94l-18 29-9-60-3 51-22-40-7 36-26-40-8 33-25-40-8 35-27-13-7 43-17-8Z" fill="url(#hair)"/>`:
  p.style===4?`<path d="M111 173Q96 99 173 97L221 83l-10 17c58-7 99 32 76 110l-30-49-7 46-20-55-30 41-1-47-45 65 9-49-42 52Z" fill="url(#hair)"/>`:
  `<path d="M114 183C101 125 137 91 185 95c79-21 121 27 103 104l-18 29-8-62-17 50-19-64-38 66 8-62-57 64 10-46-24 69Z" fill="url(#hair)"/><path d="m208 118-45 71 20-57m37-16-6 45 13-36" fill="${p.light}" opacity=".48"/>`;
  let accessory='';
  if(p.style===0)accessory=`<path d="m121 171-12-27 27 10 26-31-4 31 30-5-23 24z" fill="#c9b58d"/><path d="m137 156 12-13 4 16-12 10z" fill="${p.accent}"/><path d="M63 465 296 170l10 4L92 479Z" fill="#bcc3d4" stroke="#687c9d" stroke-width="2"/><path d="m264 195 56 40 6-10-57-40Z" fill="#d9c08d"/><path d="m301 176 29-36 8 6-29 34" fill="#525372"/>`;
  if(p.style===1)accessory=`<path d="M87 149 154 102 190 21l66 84 72 58q-128-28-241-14Z" fill="#362b4a" stroke="#bb8a7c" stroke-width="2"/><path d="m151 108 113 9-9-16-95-8Z" fill="#c99a81"/><path d="m211 61 8 15 16 4-13 10-2 17-11-12-17 2 8-15Z" fill="#e2bf8d"/><path d="M315 487 331 239" stroke="#6e4159" stroke-width="12"/><circle cx="330" cy="218" r="28" stroke="#d4af85" stroke-width="6" fill="none"/><path d="m330 189 14 29-14 25-14-25Z" fill="#f3ac88"/>`;
  if(p.style===2)accessory=`<path d="m111 168-34-38 7 52-10 16 41-13m173-17 34-38-7 52 10 16-41-13" fill="#ad5364"/><circle cx="114" cy="174" r="9" fill="#e9c492"/><circle cx="287" cy="174" r="9" fill="#e9c492"/><path d="m114 183-5 80m177-80 7 80" stroke="#d2ab7e" stroke-width="3"/><path d="M294 488 330 254" stroke="#936f69" stroke-width="9"/><circle cx="335" cy="229" r="25" fill="none" stroke="#cfae7f" stroke-width="5"/><path d="m330 252-19 45 19-10 5 17 11-49" fill="#f4e2d7"/>`;
  if(p.style===3)accessory=`<path d="m117 157 14 12 145-7 16-15-4 31-160 9Z" fill="#4e4967"/><path d="m184 162 40-2 1 22-40 2Z" fill="#b6b6c8"/><path d="m195 172 9-8 10 7-10 8z" fill="#615873"/><path d="m269 178 52 60-5 24-43-66 15 80-19-17-11-79" fill="#a783aa"/><path d="m89 459 51-147 12 3-36 152Z" fill="#c3becf"/><path d="m128 347 31 8" stroke="#d4c199" stroke-width="6"/>`;
  if(p.style===4)accessory=`<g fill="none" stroke="#d7bb8d" stroke-width="2"><ellipse cx="163" cy="215" rx="25" ry="18"/><ellipse cx="236" cy="215" rx="25" ry="18"/><path d="M188 211q10-5 23 0m-73 0-18-8m141 8 20-10"/></g><path d="M303 463V278" stroke="#7b6464" stroke-width="9"/><circle cx="303" cy="256" r="33" fill="#293547" stroke="#dfbf7e" stroke-width="5"/><path d="m303 233 0 24 16 10" stroke="#e0c891" stroke-width="3" fill="none"/><circle cx="303" cy="256" r="4" fill="#e0c891"/>`;
  if(p.style===5)accessory=`<path d="m122 170-14-39 33 24 16-35 3 44-24 25Z" fill="#392130" stroke="#b96888" stroke-width="2"/><path d="M70 496 266 199l24 7L109 511Z" fill="#382d44" stroke="#bc829a" stroke-width="3"/><path d="m89 482 181-270" stroke="#e69ab8" stroke-width="3"/><path d="m246 230 63 44 4-14-60-46z" fill="#d2a995"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520" fill="none">
  <defs><linearGradient id="hair" x1="140" y1="100" x2="290" y2="448" gradientUnits="userSpaceOnUse"><stop stop-color="${p.light}"/><stop offset=".23" stop-color="${p.hair}"/><stop offset="1" stop-color="${p.shade}"/></linearGradient><linearGradient id="coat" x1="165" y1="300" x2="258" y2="517" gradientUnits="userSpaceOnUse"><stop stop-color="${p.cloth}"/><stop offset="1" stop-color="#131725"/></linearGradient><linearGradient id="face" x1="150" y1="172" x2="235" y2="274" gradientUnits="userSpaceOnUse"><stop stop-color="${p.skin}"/><stop offset="1" stop-color="#dcaeb0"/></linearGradient><linearGradient id="iris" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#34314d"/><stop offset=".6" stop-color="${p.eye}"/><stop offset="1" stop-color="${p.accent}"/></linearGradient></defs>
  ${hairBack}
  <path d="M164 282 150 314 95 336 55 487 136 520h140l68-43-49-141-60-24-8-34Z" fill="url(#coat)" stroke="#191b2b" stroke-width="2"/>
  <path d="m156 297-8 21 51 48 46-50-12-20Z" fill="${p.skin}"/><path d="m161 286 1 21q33 20 65 0l-1-24" fill="#d1a6a9"/>
  <path d="m150 311 45 34-28 74-42-91m119-17-45 34 28 74 39-91" fill="${p.cloth}" stroke="${p.accent}" stroke-width="2"/>
  <path d="M197 351v162" stroke="${p.accent}" stroke-width="2" opacity=".6"/>
  <path d="m116 337 14 149-24 34-42-32 29-129Zm162 0-6 163 39-13-13-120Z" fill="${p.cloth}" stroke="${p.accent}" stroke-width="1.5" opacity=".8"/>
  <path d="m161 360 37 17 38-17-20 44h-35Z" fill="#424253" stroke="#d7bc89" stroke-width="2"/>
  <path d="m198 365 12 19-12 20-12-20Z" fill="${p.accent}"/>
  <path d="m139 434 137 0-1 19H133Z" fill="#3d3540" stroke="#b7a58a" stroke-width="2"/>
  <path d="m191 433 27 0v24h-27Z" fill="#d8bd8f"/><path d="m197 439 14 0v12h-14Z" fill="#4b4151"/>
  <path d="M124 192c-20-7-21 24-5 39l14 2m142-41c20-7 21 24 5 39l-14 2" fill="${p.skin}" stroke="#b68899" stroke-width="1.5"/>
  <path d="M127 172C127 126 268 128 273 172l-7 66c-6 26-41 52-66 60-25-9-61-34-67-62Z" fill="url(#face)"/>
  <path d="M133 191q60-32 133 0l-2-25c-27-35-99-37-132 0Z" fill="${p.shade}" opacity=".19"/>
  <path d="m143 192 35-3m45 0 33 5" stroke="${p.shade}" stroke-width="3" stroke-linecap="round"/>
  <path d="M140 211q16-16 40-1l-2 15q-20 8-34-3Zm80-1q22-15 40 1l-4 12q-17 11-34 1Z" fill="#fff5ee"/>
  <ellipse cx="162" cy="215" rx="10" ry="15" fill="url(#iris)"/><ellipse cx="240" cy="215" rx="10" ry="15" fill="url(#iris)"/>
  <ellipse cx="163" cy="216" rx="4" ry="10" fill="#292333"/><ellipse cx="239" cy="216" rx="4" ry="10" fill="#292333"/>
  <circle cx="158" cy="207" r="4" fill="white"/><circle cx="236" cy="207" r="4" fill="white"/><circle cx="167" cy="224" r="2" fill="#fffbe3"/><circle cx="244" cy="224" r="2" fill="#fffbe3"/>
  <path d="m137 207 5 4q16-15 38-1m-38 1-4-5m83 4q21-16 39 1l5-5" stroke="#3e3045" stroke-width="4" stroke-linecap="round"/>
  <path d="M146 229q16 5 27 0m54 1q16 4 27-2" stroke="#bc8a99" stroke-width="1.2"/>
  <path d="m199 222-4 19 6 2" stroke="#c99a9f" stroke-width="1.8" stroke-linecap="round"/>
  <path d="m188 262q11 4 22-1" stroke="#af7483" stroke-width="2" stroke-linecap="round"/>
  <path d="m190 266 16 0" stroke="#f1c5c1" stroke-width="2"/>
  <ellipse cx="146" cy="245" rx="15" ry="6" fill="#de93a3" opacity=".23"/><ellipse cx="251" cy="245" rx="15" ry="6" fill="#de93a3" opacity=".23"/>
  ${bangs}
  <path d="M126 188q-14 51 23 125l-11-68m130-67q23 72-13 137l13-64" fill="${p.hair}"/>
  <path d="M146 116q-24 28-21 48m35-57q-11 4-14 9m94-8q33 10 39 36" stroke="${p.light}" stroke-width="3" stroke-linecap="round" opacity=".7"/>
  <path d="m140 237 3 24m117-24-3 24" stroke="#d9ba88" stroke-width="2"/><path d="m142 255 5 8-5 10-5-10m121-18 5 8-5 10-5-10" fill="${p.accent}"/>
  ${accessory}
  <path d="M90 473q-7-30 8-34 15-3 16 20l10 13-13 18Z" fill="${p.skin}" stroke="#b28391" stroke-width="1.5"/>
  </svg>`;
}
export function portraitUri(job) {return svgUri(portraitSvg(job));}
export function enemySvg(kind='slime',color='#b89cd9') {
  const defs=`<defs><radialGradient id="body"><stop stop-color="${color}"/><stop offset="1" stop-color="#333049"/></radialGradient><linearGradient id="wing" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="#282639"/></linearGradient><radialGradient id="orb"><stop stop-color="#fffde1"/><stop offset=".35" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs>`;
  let body='';
  if(kind==='slime')body=`<ellipse cx="160" cy="252" rx="118" ry="15" fill="#000" opacity=".25"/><path d="M42 232c-7-36 17-60 28-81 8-17 1-62 39-68 35-3 23 34 54 31 49-4 44 49 64 61 72 44 48 80-10 83H94c-24 0-45-5-52-26Z" fill="url(#body)" stroke="${color}" stroke-width="2"/><path d="M70 200q-4-41 33-50m-10 72-4 7" stroke="#daccec" stroke-width="7" stroke-linecap="round" opacity=".38"/><ellipse cx="135" cy="194" rx="13" ry="19" fill="#191825"/><ellipse cx="197" cy="194" rx="13" ry="19" fill="#191825"/><circle cx="138" cy="189" r="5" fill="#e7e0fa"/><circle cx="200" cy="189" r="5" fill="#e7e0fa"/><path d="M151 222q15 13 30 0" stroke="#292030" stroke-width="5" fill="none"/><path d="m92 94 5-45 25 29 19-28 15 57" fill="#8d77ad" stroke="${color}" stroke-width="2"/><circle cx="33" cy="185" r="6" fill="${color}" opacity=".4"/><circle cx="270" cy="153" r="9" fill="${color}" opacity=".4"/>`;
  else if(kind==='wisp')body=`<circle cx="160" cy="158" r="128" fill="url(#orb)" opacity=".24"/><path d="M159 37c-3 41-58 49-55 84-3 21 4 30-17 55-33 53 9 101 67 101 85 1 99-45 80-92-5-19-31-29-21-49-33 11-15 41-33 42-32 0 21-61-21-141Z" fill="url(#body)" stroke="${color}" stroke-width="2"/><path d="M150 91c-24 36-9 42-31 59" stroke="#ddd8ff" stroke-width="6" opacity=".55"/><path d="m118 202 27 4-2 21-14-1Zm61 4 27-5-11 26-13-1Z" fill="#fff5d2"/><path d="m151 239 12 5 9-8" stroke="#48365c" stroke-width="3"/><ellipse cx="160" cy="281" rx="65" ry="8" fill="${color}" opacity=".16"/>`;
  else if(kind==='moth')body=`<path d="M143 133C116 39 25 10 26 91c-9 55 45 80 91 85-48 0-106 49-56 94 51 35 87-51 99-66 23 39 57 79 88 45 42-57-4-68-43-78 56-19 104-61 75-100-25-51-83-5-106 61Z" fill="url(#wing)" stroke="${color}" stroke-width="2"/><path d="m136 150-77-76 51 84-60-14 75 24-44 69 63-50m40-37 61-76-33 84 52-24-63 44 25 48-45-35" stroke="#eacbe7" stroke-width="2" opacity=".6"/><ellipse cx="79" cy="107" rx="17" ry="24" transform="rotate(-30 79 107)" fill="#514461" stroke="#d0adc7" stroke-width="4"/><ellipse cx="242" cy="107" rx="17" ry="24" transform="rotate(30 242 107)" fill="#514461" stroke="#d0adc7" stroke-width="4"/><path d="M152 123q-4-38-27-50m42 50q7-34 31-42" stroke="${color}" stroke-width="5"/><ellipse cx="159" cy="178" rx="18" ry="51" fill="#47425d" stroke="${color}" stroke-width="2"/><circle cx="152" cy="145" r="5" fill="#fff4ca"/><circle cx="170" cy="145" r="5" fill="#fff4ca"/><path d="m147 176 26 0m-26 16h24" stroke="${color}" stroke-width="2"/>`;
  else if(kind==='sentinel')body=`<ellipse cx="164" cy="289" rx="109" ry="9" fill="#0c0d14" opacity=".4"/><path d="m117 229-13 55h42l14-64 13 64h40l-12-61Z" fill="#484c60" stroke="${color}" stroke-width="2"/><path d="m103 129-28 28 15 70 47-3 27 22 35-24 39 3 9-72-26-25Z" fill="url(#body)" stroke="${color}" stroke-width="2"/><path d="m106 144 54 34 52-34-6 66-42 24-45-22Z" fill="#3e4157" stroke="${color}" stroke-width="2"/><path d="m160 166-13 25 14 28 13-28Z" fill="#dac393"/><path d="M121 124 116 70l24-34 47 2 25 32-11 53-41 26Z" fill="url(#body)" stroke="${color}" stroke-width="3"/><path d="m119 79 41 11 50-11-16 31-34 14-30-17Z" fill="#242633"/><path d="m136 91 17 5-2 8-14-4m36-4 18-5-3 11-15 2" fill="#e2cf9d"/><path d="m140 37-9-25 21 23m25 0 14-24-2 31" stroke="${color}" stroke-width="5"/><path d="M46 274 62 115l14-19 12 19-27 162Z" fill="#b4b9c9" stroke="#626d83" stroke-width="2"/><path d="m45 139 47 5" stroke="#d5bd8e" stroke-width="7"/><path d="m239 145 44 17-8 68-34 26-25-39Z" fill="#4b5063" stroke="${color}" stroke-width="4"/><path d="m239 165 21 14-5 44-16 12-12-29Z" fill="#86839a"/>`;
  else if(kind==='ghost')body=`<ellipse cx="160" cy="284" rx="79" ry="10" fill="${color}" opacity=".15"/><path d="M106 113C89 203 111 213 65 276l50-13 11 22 34-14 29 14 16-22 44 17c-41-78-29-104-40-166Z" fill="url(#wing)" stroke="${color}" stroke-width="2"/><path d="M109 101c-2-83 107-73 102 1l-20 65h-60Z" fill="#413a59"/><path d="m126 95 69-1-9 47-27 19-27-20Z" fill="#cac1d5"/><path d="m131 110 17 0m24 0h17" stroke="#6c6089" stroke-width="4"/><path d="M100 136q53 27 119 0l-11 24q-57 27-102-3Z" fill="#aea0c6"/><path d="m123 210 28-28 10 8 14-9 27 31-17 12-24-21-25 21Z" fill="#c6bbd3"/><circle cx="161" cy="171" r="27" fill="url(#orb)"/><path d="M120 263q37-37 10-54m62 59q-41-29-4-52" stroke="${color}" stroke-width="3" opacity=".6"/>`;
  else body=`<circle cx="160" cy="82" r="70" fill="none" stroke="#d5b9e6" stroke-width="2"/><circle cx="160" cy="82" r="63" fill="none" stroke="#a989c8" opacity=".5"/><path d="m65 84 16-13m165 13-17-13M160 0v17M90 11l14 18m128-17-16 18" stroke="#d2b6e5" stroke-width="3"/><path d="M119 71 76 259l33-16 19 27 32-15 36 15 14-26 38 16-48-190Z" fill="url(#wing)" stroke="#b99dce" stroke-width="2"/><path d="m96 128-57 6L8 212l68-35 23 55 43-42m81-58 59 2 31 78-67-35-23 54-43-43" fill="#4d375c" stroke="#b49ac4" stroke-width="2"/><path d="m38 147 49 6-21 34M282 147l-49 6 21 34" stroke="#d8b7d0" stroke-width="2"/><path d="M124 93q-7-53 34-57 51-4 43 59l-13 31-29 20-26-19Z" fill="#e3cbdc"/><path d="M120 91q-14-70 40-64 58-7 42 67l-20-45-22 47 4-46-39 54Z" fill="#e4d6ed"/><path d="m134 94 17 2m21 0 17-2" stroke="#7c4589" stroke-width="4"/><path d="m150 122 16 0" stroke="#b0769d" stroke-width="2"/><path d="m131 37 1-22 26 13 26-13 6 27" fill="#685174" stroke="#e5c096" stroke-width="2"/><path d="m143 146 17 17 18-17 15 66-34 24-34-24Z" fill="#2e253d" stroke="#d8b9c7" stroke-width="2"/><path d="m158 161-13 22 13 20 15-20Z" fill="#e1c1f4"/><path d="m95 154 43 34-12 13-37-21m134-26-43 34 12 13 37-21" fill="#dfc4d7"/><circle cx="160" cy="215" r="43" fill="url(#orb)" opacity=".8"/><path d="m160 193 9 16 18 6-18 5-9 17-9-17-18-5 18-6Z" fill="#f9e9fc"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 300">${defs}${body}</svg>`;
}
export function enemyUri(kind,color) {return svgUri(enemySvg(kind,color));}
export function objectSvg(type,color='#bac0e9') {
  const styles=`fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"`;
  const body=type==='chest'?`<path d="m45 91 88-20 38 22v70l-88 22-38-23Z" fill="#453744" stroke="#bfab88" stroke-width="3"/><path d="m45 107 88-19 38 20m-88-11v87m50-97v69" ${styles}/><path d="m47 92 16-24 71-16 35 26 2 16-87 21Z" fill="#64516a" stroke="#c3ac89" stroke-width="3"/><path d="m102 116 20-5v26l-20 5Z" fill="#dcc083"/><path d="m111 121 3-1v10l-3 1Z" fill="#695677"/>`:
    type==='stairs'?`<path d="M46 179V63Q47 15 106 16q55-1 55 48v115Z" fill="#151a2a" stroke="#9890ac" stroke-width="9"/><path d="M57 177V65q0-37 49-37 42 0 42 37v112Z" fill="#686385" opacity=".5"/><path d="M56 177h93v-18H70v-18h62v-18H84v-18h39" ${styles}/><path d="m106 51-12 20 12 20 12-20Z" fill="${color}"/><path d="m22 188 158 0" ${styles}/>`:
    type==='shrine'?`<path d="m43 173 127 0-12 15H53Zm25-20 73 0 13 20H54ZM92 87h26v65H92Z" fill="#5c637a" stroke="#a3abc0" stroke-width="2"/><path d="M62 91h84l-12 11H73Z" fill="#929bb5"/><path d="m86 61 18-28 18 28-18 28Z" fill="${color}"/><circle cx="104" cy="61" r="43" fill="${color}" opacity=".12"/><circle cx="104" cy="61" r="30" fill="none" stroke="${color}" stroke-width="1"/>`:
    type==='fountain'?`<ellipse cx="104" cy="164" rx="71" ry="25" fill="#525774" stroke="#a8b6cd" stroke-width="4"/><ellipse cx="104" cy="155" rx="65" ry="16" fill="#76afc3" opacity=".7"/><path d="M95 153V74h19v79" fill="#8b95b0"/><ellipse cx="104" cy="74" rx="42" ry="12" fill="#788ba5" stroke="#bdc2d4" stroke-width="3"/><path d="m66 79 0 60m76-60 0 62M94 67q-5-30 10-45 17 16 9 42" stroke="#95d1dd" stroke-width="3" opacity=".8"/>`:
    `<path d="m45 179 125 0-14-17H60Zm25-22 68 0-12-35H82ZM88 79 80 121h46l-9-42Z" fill="#777289" stroke="#b0a3b8" stroke-width="2"/><circle cx="104" cy="63" r="22" fill="#8c7e9c"/><path d="m78 53 7-29 22 16 19-16 6 30" fill="#a08aab"/><path d="m80 104-25 25 20 8 19-22m30-11 29 23-22 11-16-23" fill="#8b7e9c"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 210">${body}</svg>`;
}
