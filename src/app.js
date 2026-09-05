import { actionLabel, initLanguage, getLanguage, getLanguagePreference, setLanguage, refreshBrowserLanguage, localizeDom, translate, syncDocumentLanguage } from './i18n.js';
import { SAVE_KEY, FIELD_TOOLS, MAX_FLOOR, JOBS, SKILLS, EVOLUTIONS, STATUS, BOONS, INTENTS, RARITIES, DIRECTIONS, FLOORS } from './data.js';
import { createRun, move, turn, interact, currentEvent, resolveEvent, activeHero, act, intentOf, takeReward, equipWeapon, heroStats, skillCooldown, cooldownLeft, selectHero, useSupply, serializeRun, restoreRun, cellKey, waitTurn, effectiveSkill, skillProblem, reinforcementInfo, bossWarnings, counterText } from './engine.js';
import { icon, portraitUri, enemyUri, objectSvg, svgUri } from './art.js';
import { DungeonRenderer } from './renderer.js';
import { AudioSystem } from './audio.js';
import { VIEW_MODES, NAV_ACTIONS, moveCue, viewMode } from './navigation.js';
import { REGIONS, regionAt, visiblePacks, packMode, useFieldTool, paths } from './world.js';

let languageStorage;try{languageStorage=window.localStorage;}catch{}
initLanguage({navigator:window.navigator,storage:languageStorage});syncDocumentLanguage(document);
const ROOT=document.getElementById('app'), MODAL=document.getElementById('modal-root');
const AUDIO=new AudioSystem();
const PORTRAITS=Object.fromEntries(Object.keys(JOBS).map(id=>[id,portraitUri(id)]));
const ENEMY_IMAGES=new Map();
const MODE_NAMES={patrol:'定轨巡逻',return:'返回巡线',alarmed:'警报集结',elite:'精英追踪',lured:'诱导中',sleep:'眠缚',rest:'整顿'};
let run=null,renderer=null,toastTimer=null,modalKey='',lastFocus=null;
let navigation=null,queuedMove=null,navigationTrail=[],lastNavigationCue='';
const ui={selection:['knight','mage','shrine'],modal:null,modalData:null,rewardIndex:null,selectedEnemy:null,pendingSkill:null,busy:false,seedDraft:'',screen:'landing',lastMove:0,storageError:false,presentation:null,playback:null,animationToken:0,showPatrol:true,suppliesOpen:false};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e=escapeHtml;
function toast(message){const el=document.getElementById('toast');el.textContent=translate(message);el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3200);}
function readSave(){try{const text=localStorage.getItem(SAVE_KEY);return text?restoreRun(text):null;}catch(error){return null;}}
function save(){if(!run)return;try{localStorage.setItem(SAVE_KEY,serializeRun(run));}catch(error){if(!ui.storageError){ui.storageError=true;toast('浏览器阻止了本地存档。此局仍可继续，但关闭页面会丢失进度。');}}}
function seedCode(){try{const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);return `MOON-${bytes[0].toString(36).toUpperCase().padStart(6,'0')}`;}catch{return `MOON-${Date.now().toString(36).toUpperCase()}`;}}
function brand(){return `<div class="brand"><div class="brand-mark">${icon('moon',23)}</div><div><div class="brand-label">月蝕の迷宮</div><div class="brand-en">ECLIPSE LABYRINTH</div></div></div>`;}
function languageButton(){return `<button class="icon-button language-button" data-action="language" aria-label="Language / 语言" title="Language / 语言">${getLanguage()==='en'?'EN':'中'}</button>`;}
function soundButton(){return `<button class="icon-button" data-action="sound" aria-label="${AUDIO.enabled?'关闭音乐与音效':'开启音乐与音效'}" title="${AUDIO.enabled?'关闭声音':'开启声音（默认静音）'}">${icon(AUDIO.enabled?'sound':'mute',18)}</button>`;}
function selectionDescription(){
  const ids=ui.selection;
  if(!ids.length)return ['旅程由你决定','选择一至三个职业。每个职业都有不同的战斗节奏。'];
  if(ids.length===1)return ['独行者的誓约','单人：生命 +45%、伤害 +20%。敌人强度随队伍人数调整。'];
  const synergies=[];
  if(ids.includes('knight')&&(ids.includes('ninja')||ids.includes('reaver')))synergies.push('破甲 → 物理追击');
  if(ids.includes('mage')&&ids.includes('ninja'))synergies.push('燃烧 → 猎影增伤');
  if(ids.includes('shrine'))synergies.push('治疗与净化分工');
  if(ids.includes('chrono'))synergies.push('冷却调配与时间支援');
  if(!synergies.length)synergies.push('让攻击技能衔接，构筑联携；普攻不累积联携');
  return [ids.map(id=>JOBS[id].name).join(' / '),synergies.join('　·　')];
}
function renderLanding(){
  ui.screen='landing';navigation=null;queuedMove=null;renderer?.destroy();renderer=null;
  const saved=readSave(),canResume=saved&&saved.phase!=='ended';
  const [line,sub]=selectionDescription();
  ROOT.innerHTML=`<header class="page-head">${brand()}<div class="header-actions"><span class="edition"><i class="dot"></i>ROGUELIKE DRPG · 0.3.3</span>${soundButton()}${languageButton()}<button class="icon-button" data-action="help" aria-label="游戏说明">${icon('help',18)}</button></div></header>
  <main class="landing">
    <section class="hero-intro">
      <div class="intro-copy"><div class="eyebrow">A NEW MOON. A NEW BEGINNING.</div><h1>月蝕の迷宮</h1><div class="intro-en">E C L I P S E　L A B Y R I N T H</div><div class="intro-sub">以微小的星火，<br>踏入无月之夜。</div><p>在不断重生的迷宫中，编织属于你的职业、武器与祝福。<br>每一次坠落，都是另一段故事的开端。</p><div class="feature-line"><span>${icon('eye',15)} 第一人称探索</span><span>${icon('sword',15)} 回合制战斗</span><span>${icon('star',15)} 随机构筑</span></div></div>
      <div class="hero-art" aria-hidden="true"><div class="moon-disk"></div><span class="star-orbit">✦</span><span class="star-orbit two">✧</span><img class="echo left" src="${PORTRAITS.mage}" alt=""><img class="echo right" src="${PORTRAITS.ninja}" alt=""><img class="lead" src="${PORTRAITS.knight}" alt=""><span class="vertical-jp">何度でも、星を灯せ。</span><div class="floating-note"><strong>希露菲 · 星剣士</strong><small>THE FIRST LIGHT IN THE DARK</small></div></div>
      <div class="chapter-line"><b>CHAPTER 01</b><span>THE FORGOTTEN CORRIDOR</span></div>
    </section>
    <section class="roster-section"><div class="section-heading"><h2>选择你的同行者 <small>CHOOSE YOUR PARTY</small></h2><div class="roster-meta"><span class="helper">自由编队</span><strong>${ui.selection.length} / 3</strong><button class="ghost" data-action="classes" title="查看所有职业能力">${icon('help',14)}<span class="tiny">职业</span></button></div></div>
      <div class="job-grid">${Object.values(JOBS).map((job,i)=>`<button class="job-card ${ui.selection.includes(job.id)?'selected':''}" style="--job-color:${job.color}" data-action="job" data-job="${job.id}" aria-pressed="${ui.selection.includes(job.id)}" aria-label="${job.name}，${job.role}，${ui.selection.includes(job.id)?'已选择，点击移除':'点击加入'}"><span class="job-number">0${i+1}</span><span class="job-check">${ui.selection.includes(job.id)?icon('check',14):''}</span><img src="${PORTRAITS[job.id]}" alt="${job.person}的原创角色立绘"><span class="job-meta"><span class="jp">${job.jp}</span><strong>${job.name}</strong><span class="role">${job.role}</span></span></button>`).join('')}</div>
    </section>
    <section class="expedition-bar"><div class="party-description"><b>${e(line)}</b><p>${e(sub)}</p></div><div class="start-controls">${canResume?`<button class="secondary resume-button" data-action="resume">${icon('clock',15)} 继续 · 第 ${saved.floor} 层</button>`:''}<div class="seed-box"><label for="seed-input">迷宫种子 · 可留空</label><input id="seed-input" maxlength="48" value="${e(ui.seedDraft)}" placeholder="RANDOM" autocomplete="off" spellcheck="false" aria-label="迷宫种子，留空随机生成"></div><button class="primary" data-action="start" ${!ui.selection.length?'disabled':''}>点亮星灯 · 出发 ${icon('arrow',18)}</button></div></section>
    <footer class="landing-foot"><span>每一局从零开始 · 没有永久属性加成 · 本局自动保存</span><span>ORIGINAL VECTOR ART / OFFLINE READY</span></footer>
  </main>`;
  renderModal();
}
function mountGame(){
  ui.suppliesOpen=false;ui.screen='game';navigation=null;queuedMove=null;navigationTrail=[{x:run.x,y:run.y,floor:run.floor}];lastNavigationCue='';renderer?.destroy();
  ROOT.innerHTML=`<main class="game-shell"><header class="game-head">${brand()}<div id="top-stats" class="head-run"></div><div class="header-actions"><span id="sound-button">${soundButton()}</span>${languageButton()}<button class="icon-button" data-action="help" aria-label="游戏说明">${icon('help',18)}</button><button class="icon-button" data-action="menu" aria-label="冒险菜单">${icon('menu',18)}</button></div></header>
    <div class="game-grid"><section class="viewport-panel" aria-label="第一人称迷宫视图"><div class="stage" id="stage"><canvas id="dungeon-canvas" aria-label="第一人称三维迷宫"></canvas><div id="stage-hud" class="stage-hud"></div></div><div id="stage-footer" class="stage-footer"></div></section><section class="hud-dock" aria-label="队伍与行动"><div id="battle-alerts" aria-live="polite"></div><div id="party-strip" class="party-strip" role="group" aria-label="选择队员或技能目标"></div><div id="command-panel" class="command-panel" aria-label="行动指令"></div></section><aside class="side-column"><section class="side-card map-card"><div class="card-title"><span>${icon('map',14)} 探索地图</span><small id="exploration-percent"></small></div><button class="map-wrapper" id="minimap" data-action="map" aria-label="展开已探索地图"></button><div class="map-legend"><span><i></i> 月门</span><span class="treasure"><i></i> 宝箱</span><span class="rest"><i></i> 休息</span><span class="foe-legend">◆ 明雷</span></div></section><section id="objective" class="side-card objective"></section><details class="side-card journal-card"><summary class="card-title"><span>${icon('moon',14)} 行动记录</span></summary><div id="journal" class="journal"></div></details><section class="side-card boon-card"><div class="card-title"><span>${icon('star',14)} 星之祝福</span><button class="ghost" data-action="inventory" aria-label="查看全部祝福">${icon('arrow',12)}</button></div><div id="boon-overview" class="boon-overview"></div></section><div class="side-foot">YOU ARE NOT LOST. NOT YET.</div></aside></div><footer id="game-foot" class="game-foot"></footer></main>`;
  renderer=new DungeonRenderer(document.getElementById('dungeon-canvas'),()=>navigation?.before||ui.presentation||run);
  updateGame();
}
function mapSvg(large=false){
  const d=run.dungeon,size=d.size,tile=12,pad=5,width=size*tile+pad*2;let shapes='';
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const seen=d.visited[y][x],floor=d.tiles[y][x]===0,zone=regionAt(d,x,y);
    shapes+=`<rect x="${pad+x*tile+1}" y="${pad+y*tile+1}" width="10" height="10" rx="1.5" fill="${seen?(floor?zone.floor:'#293246'):'#161e2d'}" stroke="${seen&&floor?zone.color+'38':'none'}" stroke-width=".5"/>`;
    const ev=d.events[cellKey(x,y)];
    if(seen&&floor&&ev&&!ev.used){const cx=pad+x*tile+6,cy=pad+y*tile+6;
      if(ev.type==='stairs')shapes+=`<rect x="${cx-4}" y="${cy-4}" width="8" height="8" rx="2" fill="${run.guardianDefeated?'#a6e2bd':'#c2a4e5'}"/>`;
      else if(ev.type==='chest')shapes+=`<rect x="${cx-3}" y="${cy-2.5}" width="6" height="5" rx="1" fill="#e2c18d"/>`;
      else if(['shrine','fountain'].includes(ev.type))shapes+=`<path d="m${cx},${cy-4} 3,4 -3,4 -3,-4Z" fill="#9cd1bc"/>`;
      else shapes+=`<circle cx="${cx}" cy="${cy}" r="2.5" fill="#b7acd9"/>`;
    }
  }
  for(const l of d.landmarks||[])if(d.visited[l.y]?.[l.x])shapes+=`<text x="${pad+l.x*tile+6}" y="${pad+l.y*tile+9}" text-anchor="middle" fill="${REGIONS[l.zone].color}" font-size="8" font-weight="bold">${REGIONS[l.zone].code}</text>`;
  if(large&&ui.showPatrol)for(const mob of visiblePacks(run).filter(p=>p.kind!=='elite'))for(const q of mob.route||[])if(d.visited[q.y]?.[q.x])shapes+=`<circle cx="${pad+q.x*tile+6}" cy="${pad+q.y*tile+6}" r="1.4" fill="#92b4ba" opacity=".7"/>`;
  for(const mob of visiblePacks(run)){
    const cx=pad+mob.x*tile+6,cy=pad+mob.y*tile+6;
    shapes+=`<g><title>${e(mob.name)} · ${mob.troop.length} 体 · ${MODE_NAMES[packMode(run,mob)]}</title><path d="M${cx},${cy-4.5} ${cx+4.5},${cy} ${cx},${cy+4.5} ${cx-4.5},${cy}Z" fill="${mob.kind==='elite'?'#ffbb65':'#f2869f'}" stroke="#301522" stroke-width=".8"/>${mob.alert?`<circle cx="${cx}" cy="${cy}" r="6" fill="none" stroke="#f2869f" stroke-width=".65"/>`:''}</g>`;
  }
  for(const p of navigationTrail.filter(p=>p.floor===run.floor&&d.visited[p.y]?.[p.x]).slice(-6))shapes+=`<circle cx="${pad+p.x*tile+6}" cy="${pad+p.y*tile+6}" r="2" fill="#dad5f2" opacity=".6"/>`;
  const px=pad+run.x*tile+6,py=pad+run.y*tile+6;
  shapes+=`<circle cx="${px}" cy="${py}" r="8" fill="#ded0ef22"/><g class="map-player" transform="translate(${px} ${py}) rotate(${run.dir*90})"><path d="M0-5 4.5 4 0 2-4.5 4Z" fill="#f7e7ff" stroke="#514569" stroke-width=".8"/></g>`;
  return `<svg viewBox="0 0 ${width} ${width}" role="img" aria-label="明雷探索地图；你在 ${run.x},${run.y}，面向${DIRECTIONS[run.dir].label}">${shapes}</svg>${large?`<div class="region-legend">${REGIONS.map(z=>`<span style="color:${z.color}">${z.code} ${z.name}</span>`).join('')}</div>`:''}`;
}
function exploration(){let seen=0,total=0;for(let y=0;y<run.dungeon.size;y++)for(let x=0;x<run.dungeon.size;x++)if(run.dungeon.tiles[y][x]===0){total++;if(run.dungeon.visited[y][x])seen++;}return Math.round(seen/total*100);}
function statusHtml(entity){return `<span class="status-list">${entity.guard?'<span class="status-badge" style="--status-color:#b9c6e1">防御</span>':''}${entity.barrier?`<span class="status-badge" style="--status-color:#9bddbf">护盾 ${entity.barrier}</span>`:''}${Object.entries(entity.status).filter(([id])=>STATUS[id]).map(([id,s])=>`<span class="status-badge" style="--status-color:${STATUS[id].color}" title="${STATUS[id].name}：${s.expiresRound!==undefined?'本回合有效':s.persistent?'生效后消耗':`剩余 ${s.turns} 次行动`}${STATUS[id].dispellable?' · 可驱散':''}">${STATUS[id].name}${s.turns<10?`<sup>${s.expiresRound!==undefined?'本轮':s.turns}</sup>`:''}</span>`).join('')}</span>`;}
function popHtml(entity){const effects=run.fx.filter(f=>f.id===entity.id);const damage=effects.filter(f=>f.type==='damage').reduce((s,f)=>s+f.amount,0),healing=effects.filter(f=>f.type==='heal').reduce((s,f)=>s+f.amount,0);return damage?`<span class="damage-pop">${damage}</span>`:healing?`<span class="damage-pop heal-number">+${healing}</span>`:'';}
function effectClass(entity){
  const fx=run.fx||[],style=ui.playback?.style||'slash';
  const classes=[];
  if(ui.playback?.actorId===entity.id)classes.push('combat-acting',`acting-${style}`);
  if(fx.some(f=>f.id===entity.id&&f.type==='damage'))classes.push('damaged',`impact-${style}`);
  if(fx.some(f=>f.id===entity.id&&f.type==='heal'))classes.push('healed','impact-heal');
  if(fx.some(f=>f.id===entity.id&&['buff','debuff','alarm'].includes(f.type)))classes.push(`impact-${style}`);
  return classes.join(' ');
}
function eventLabel(event){if(!event)return '';return {chest:'打开遗落的宝箱',shrine:'在星灯下休息',fountain:'饮用月之泉',altar:'聆听神像的低语',elite:'挑战徘徊的精英',stairs:run.guardianDefeated?'走入下一层迷宫':run.floor===5?'面对蚀月的圣女':'挑战月门守卫'}[event.type];}
function eventIcon(type){return {chest:'chest',shrine:'star',fountain:'drop',altar:'moon',elite:'sword',stairs:'stairs'}[type]||'star';}
function renderExploreHud(){
  const floor=FLOORS[run.floor-1],event=currentEvent(run),dir=DIRECTIONS[run.dir],zone=regionAt(run.dungeon,run.x,run.y),threat=reinforcementInfo(run)[0];
  return `<div class="floor-heading"><div class="eyebrow">TACTICAL EXPLORATION / B${run.floor}</div><h2>${floor.name}</h2><div class="zone-badge" style="--zone:${zone.color}">${zone.code} · ${zone.name}</div></div><div class="floor-number"><strong>B${String(run.floor).padStart(2,'0')}</strong><span>OF 05 FLOORS</span></div><div class="compass navigation-compass"><strong data-facing>${dir.label} ${dir.short}</strong><small class="move-cue" aria-live="polite">${e(lastNavigationCue||'↑ 前进 · ↶↷ 转向')}</small></div><button class="navigation-map" data-action="map" aria-label="北向固定的小地图，点击展开"><span>北 ↑</span>${mapSvg()}<small>${run.x}, ${run.y}</small></button><span class="crosshair"></span><p class="explore-caption">${threat?`${threat.known?e(threat.name):'未知脚步'} · 路径距离 ${threat.distance} 格 · ${MODE_NAMES[threat.mode]}`:'观察红色明雷，选择开战的位置。'}</p><span class="position-label"><i></i> ${String(run.x).padStart(2,'0')} : ${String(run.y).padStart(2,'0')}</span>${event?`<button class="interaction" data-action="interact">${icon(eventIcon(event.type),18)}<span>${eventLabel(event)}</span><kbd>F</kbd></button>`:''}`;
}
function enemyImage(enemy){const key=`${enemy.kind}|${enemy.tint}`;if(!ENEMY_IMAGES.has(key))ENEMY_IMAGES.set(key,enemyUri(enemy.kind,enemy.tint));return ENEMY_IMAGES.get(key);}
function renderBattleHud(){
  const b=run.battle,alive=b.enemies.filter(p=>p.hp>0||(ui.busy&&run.fx.some(f=>f.id===p.id&&f.type==='damage')));
  if(!alive.some(p=>p.id===ui.selectedEnemy))ui.selectedEnemy=alive[0]?.id||null;
  const units=[...run.party,...b.enemies],order=[b.active,...b.queue.filter(id=>units.find(u=>u.id===id)?.hp>0)].slice(0,9);
  return `<div class="floor-heading"><div class="eyebrow">${['boss','guardian'].includes(b.type)?'PHASE / TRIGGER BATTLE':'VISIBLE ENCOUNTER'}</div><h2>${b.type==='boss'?'无月的终章':b.type==='guardian'?'月门的试炼':'与暗影交锋'}</h2><div class="jp">${ui.playback?e(ui.playback.label):''}</div></div><div class="round-label"><small>ROUND</small><strong>${String(b.round).padStart(2,'0')}</strong></div><div class="floor-number"><strong>B${String(run.floor).padStart(2,'0')}</strong><span>TACTICAL DRPG</span></div><div class="enemy-line tactical-enemies" aria-label="敌方阵容，可横向滚动">${alive.map(enemy=>{
    const intent=INTENTS[intentOf(enemy)]||INTENTS.attack,weak={ice:'冰',fire:'火',light:'光'}[enemy.weak],target=run.party.find(p=>p.id===enemy.targetId);
    return `<button class="enemy-card ${enemy.boss?'boss':''} ${ui.selectedEnemy===enemy.id?'selected':''} ${effectClass(enemy)}" data-action="target" data-id="${enemy.id}" aria-pressed="${ui.selectedEnemy===enemy.id}" aria-label="选择${e(enemy.name)}，生命 ${enemy.hp}/${enemy.maxHp}，${intent.name}" title="${e(enemy.hint)}"><span class="enemy-intent">${icon(intent.icon,12)} ${intent.name}</span><span class="enemy-art"><img src="${enemyImage(enemy)}" alt="${e(enemy.name)}"></span><span class="enemy-weak">${enemy.ritualFor?'◆ 仪式侍从':enemy.role} · 弱${weak}</span><span class="enemy-caption">${ui.selectedEnemy===enemy.id?'<span class="target-arrow">▾</span>':''}<strong>${e(enemy.name)}</strong><span class="bar"><i style="width:${Math.max(0,enemy.hp/enemy.maxHp*100)}%"></i>${enemy.boss?bossWarnings(run).find(w=>w.enemyId===enemy.id)?.thresholds.map(t=>`<em class="hp-threshold ${t.done?'resolved':''}" style="left:${t.at*100}%" title="${Math.round(t.at*100)}% 血线预兆"></em>`).join(''):''}</span><span class="hp-number">${enemy.hp} / ${enemy.maxHp}</span>${statusHtml(enemy)}</span>${popHtml(enemy)}</button>`;
  }).join('')}</div><div class="battle-stage-bottom"><div class="turn-order team-phase"><span>${ui.playback?(ui.playback.side==='enemy'?'敌方行动':'我方行动'):'我方准备'}</span></div>${b.chain>0?`<span class="chain-pill">技能联携 × ${b.chain+1}</span>`:''}</div>`;
}
function renderExploreCommands(){
  return `<div class="explore-command compact-explore"><div class="dpad" aria-label="迷宫方向控制">${[
    ['turn-left','turnleft','向左转','A'],['forward','up','向前移动','W'],['turn-right','turnright','向右转','D'],
    ['strafe-left','left','向左平移','Q'],['back','down','向后移动','S'],['strafe-right','right','向右平移','E']
  ].map(([action,image,label,key])=>`<button data-action="${action}" aria-label="${label}" class="${action==='forward'?'move-forward':''}">${icon(image,18)}<small>${key}</small></button>`).join('')}</div><div class="command-shortcuts">${[
    ['map','map','地图','M'],['field','bag','工具','T'],['wait','clock','等待','Space'],['inventory','sword','行囊','I']
  ].map(([action,image,label,key])=>`<button data-action="${action}" title="${label} · ${key}">${icon(image,17)}<span>${label}</span></button>`).join('')}</div></div>`;
}
function renderBattleAlerts(){
  const warnings=bossWarnings(run);
  const omens=warnings.map(w=>{
    const enemy=run.battle.enemies.find(e=>e.id===w.enemyId),o=w.pending;
    if(!o)return '';
    const count=o.counter==='hits'?`${o.hits} / ${o.required} 次命中`:o.counter==='adds'?`${run.battle.enemies.filter(a=>a.hp>0&&a.ritualFor===o.id).length} 体仪式侍从剩余`:o.counter==='dispel'?enemy.status.veil?'结界尚在':'结界已解除':o.counter==='seal'?(enemy.status.headbind||!enemy.status.veil?'已满足解除条件':'封头 / 驱散未完成'):run.party.filter(p=>p.hp>0).map(p=>`${p.name} ${p.guard||p.status.protect?'✓':'未防护'}`).join(' · ');
    const ready=o.counter==='hits'?o.hits>=o.required:o.counter==='adds'?!run.battle.enemies.some(a=>a.hp>0&&a.ritualFor===o.id):o.counter==='dispel'?!enemy.status.veil:o.counter==='seal'?!!enemy.status.headbind||!enemy.status.veil:run.party.filter(p=>p.hp>0).every(p=>p.guard||p.status.protect);
    return `<section class="omen-panel ${ready?'ready':''}" aria-label="首领预兆"><div><span class="omen-tag">${o.dueRound===run.battle.round?'本回合末':`R${o.dueRound} 回合末`}</span><strong>${e(o.name)}</strong><span class="omen-progress">${e(count)}${o.delayed?' · 已延期':''}</span></div><p>${e(counterText(o))}</p></section>`;
  }).join('');
  return omens;
}

function renderBattleCommands(){
  const hero=activeHero(run);if(!hero)return '';
  const ids=ui.suppliesOpen?['tonic','ether','salt']:hero.skills;
  const buttons=ids.map((id,i)=>{
    const skill=effectiveSkill(hero,id),left=cooldownLeft(hero,id),problem=translate(skillProblem(run,hero,id)),rank=hero.ranks[id]||0;
    const label=translate(ui.suppliesOpen?`×${run.supplies[id]}`:left?`冷却 ${left}`:problem?'受限':`就绪`);
    return `<button class="skill-button ${left?'cooling':''} ${hero.evolutions[id]?'evolved':''}" data-action="skill" data-skill="${id}" ${problem||ui.busy||ui.pendingSkill?'disabled':''} title="${ui.suppliesOpen?'即时道具':'CD '+skillCooldown(hero,id)} · ${e(skill.desc)}${problem?' · '+e(problem):''}" aria-label="${e(skill.name)}，${label}。${e(skill.desc)}"><span class="skill-top">${icon(skill.icon,16)}<span>${label}</span></span><strong>${e(actionLabel(id,skill.name))}${rank?`<span class="rank">+${rank}</span>`:''}${hero.evolutions[id]?'<span class="awakened-mark">✦</span>':''}</strong>${!ui.suppliesOpen?`<span class="hotkey">${i+3}</span>`:''}</button>`;
  }).join('');
  const prompt=ui.pendingSkill?`<div class="target-prompt" role="status"><span>${icon('heart',17)} ${e(effectiveSkill(hero,ui.pendingSkill).name)}：选择上方队友</span><button class="ghost" data-action="cancel-target">取消</button></div>`:'';
  const blocked=ui.busy||ui.pendingSkill?'disabled':'';
  return `<div class="battle-command">${prompt}<div class="skill-grid tactical-skills cooldown-skills ${ui.suppliesOpen?'supply-tray':''}" style="--skill-count:${ids.length}" aria-label="${ui.suppliesOpen?'即时道具':e(hero.name)+'的技能'}">${buttons}</div><div class="team-controls">
    <button class="secondary ${hero.guard?'guard-selected':''}" data-action="skill" data-skill="guard" aria-label="${e(hero.name)}：${hero.guard?'取消防御':'本轮防御，不普通攻击'}" aria-pressed="${hero.guard}" ${blocked}>${icon('shield',17)}<span>${hero.guard?'取消防御':'防御'}</span></button>
    <button class="secondary" data-action="toggle-supplies" aria-expanded="${ui.suppliesOpen}" aria-controls="command-panel" ${blocked}>${icon(ui.suppliesOpen?'sword':'bag',17)}<span>${ui.suppliesOpen?'技能':'道具'}</span></button>
    <button class="secondary" data-action="${ui.suppliesOpen?'supply-detail':'hero-detail'}" data-id="${hero.id}" aria-label="${ui.suppliesOpen?'查看道具说明':'查看'+e(hero.name)+'的完整技能说明、状态和装备'}" ${ui.busy?'disabled':''}>${icon('help',17)}<span>详情</span></button>
    <button class="primary team-attack" data-action="skill" data-skill="attack" ${blocked} title="全队攻击，然后敌方行动 · Enter / 1">${icon('sword',19)}<span>${ui.busy?'行动中…':'全队攻击'}</span><kbd>Enter</kbd></button>
  </div></div>`;
}

function renderParty(){
  const battle=run.phase==='battle',active=activeHero(run),pending=ui.pendingSkill&&active?effectiveSkill(active,ui.pendingSkill):null;
  return run.party.map(p=>{
    const job=JOBS[p.job],ready=p.skills.filter(id=>!skillProblem(run,p,id)).length;
    const targetable=pending&&(pending.kind==='revive'?p.hp<=0:p.hp>0);
    const disabled=ui.busy||(battle&&(pending?!targetable:p.hp<=0));
    return `<button class="party-card ${active?.id===p.id?'active':''} ${p.hp<=0?'downed':''} ${targetable?'targetable':''} ${effectClass(p)}" style="--job-color:${job.color}" data-action="party" data-id="${p.id}" ${disabled?'disabled':''} ${battle&&!pending?`aria-pressed="${active?.id===p.id}"`:''} aria-label="${e(p.name)}，${job.name}，生命 ${p.hp}/${p.maxHp}${p.guard?'，防御中':''}${pending?'，选择为'+e(pending.name)+'目标':battle?'，点击切换技能使用者':'，查看角色信息'}"><span class="party-face"><img src="${PORTRAITS[p.job]}" alt=""></span><span class="party-info"><span class="party-name">${e(p.name)}</span><span class="party-role">${job.name}</span><span class="bar-line"><span class="bar ${p.hp/p.maxHp<.3?'low':''}"><i style="width:${p.hp/p.maxHp*100}%"></i></span><span class="value">${p.hp}/${p.maxHp}</span></span>${battle?`<span class="hero-cooldowns">${p.hp<=0?'已倒下':ready+' 技能可用'}</span>`:''}${statusHtml(p)}</span>${popHtml(p)}</button>`;
  }).join('');
}
function boonChips(limit=Infinity){const entries=Object.entries(run.boons);if(!entries.length)return '<span class="tiny muted">未获得祝福。旅途才刚刚开始。</span>';return entries.slice(0,limit).map(([id,n])=>{const boon=BOONS.find(x=>x.id===id);return boon?`<span class="boon-chip" title="${e(boon.desc)} 已获取 ${n} 次">${icon(boon.icon,12)} ${boon.name}${n>1?`<b>×${n}</b>`:''}</span>`:'';}).join('')+(entries.length>limit?`<span class="boon-chip">+${entries.length-limit}</span>`:'');}
function updateGame(){
  const actual=run;
  try{if(navigation)run=navigation.before;else if(ui.presentation)run=ui.presentation;drawGame();}
  finally{run=actual;}
}
function drawGame(){
  if(!run)return;
  const battle=run.phase==='battle';
  ROOT.classList.toggle('battle-mode',battle);ROOT.classList.toggle('explore-mode',!battle);
  ROOT.classList.toggle('navigation-busy',!!navigation);
  const focused=document.activeElement?.closest('.hud-dock [data-action]');
  const focusKey=focused?{action:focused.dataset.action,id:focused.dataset.id,skill:focused.dataset.skill}:null;
  document.getElementById('top-stats').innerHTML=`<span class="level">${icon('star',15)} LV.<b>${run.level}</b></span><span class="gold">${icon('drop',14)} <b>${run.gold}</b> 星砂</span><span class="steps">${run.steps} 步</span><span class="seed">SEED <bdi data-i18n-skip>${e(run.seed)}</bdi></span>`;
  ROOT.classList.toggle('comfort-mode',run.comfort!==false);document.getElementById('stage-hud').innerHTML=battle?renderBattleHud():renderExploreHud();
  const incoming=reinforcementInfo(run),event=currentEvent(run);

  const target=battle?run.battle.enemies.find(p=>p.id===ui.selectedEnemy):null;
  const imminent=incoming.filter(p=>p.distance<=3||['alarmed','elite'].includes(p.mode));
  document.getElementById('stage-footer').innerHTML=battle?`<span class="path-label">${target?e(target.name)+' · '+e(INTENTS[intentOf(target)]?.name||'攻击'):'选择敌方目标'}</span><span class="stage-tools">${imminent[0]?`<span class="incoming-note ${imminent[0].distance<=3?'urgent':''}">${imminent[0].mode==='elite'?'精英':imminent[0].mode==='alarmed'?'警戒':'巡逻'} ${imminent[0].distance} 格</span>`:''}<button class="ghost" data-action="battle-intel">${icon('eye',15)} 战况</button></span>`:`<span class="path-label">${icon('moon',13)} ${run.guardianDefeated?'月门已开启':event?'发现可调查事物':'明雷探索'}</span><span class="combat-note">第 ${run.dungeon.elapsed} 拍</span>`;
  document.getElementById('battle-alerts').innerHTML=battle?renderBattleAlerts():'';
  document.getElementById('command-panel').innerHTML=battle?renderBattleCommands():renderExploreCommands();
  const partyEl=document.getElementById('party-strip');partyEl.style.setProperty('--party-size',run.party.length);partyEl.innerHTML=renderParty();
  document.getElementById('minimap').innerHTML=mapSvg();document.getElementById('exploration-percent').textContent=`${exploration()}%`;
  document.getElementById('objective').innerHTML=`<div class="eyebrow">${run.guardianDefeated?'GATE OPENED':'CURRENT OBJECTIVE'}</div><p>${run.guardianDefeated?'前往月门，深入下一层。':run.floor===5?'找到王座，结束这场月蚀。':'找到月门，击败本层守卫。'}</p><small>${run.guardianDefeated?'回到地图上的绿色月门标记。':'普通怪沿巡线前进；先阻断哨祭报警。精英不需警报就会追来。'}</small>`;
  const journal=document.getElementById('journal');journal.innerHTML=run.log.slice(-9).map(l=>`<p class="log-entry ${['special','heal','loot','danger','enemy','player','muted','battle'].includes(l.tone)?l.tone:''}">${e(l.text)}</p>`).join('');journal.scrollTop=journal.scrollHeight;
  document.getElementById('boon-overview').innerHTML=boonChips(5);
  document.getElementById('game-foot').innerHTML=`<span>${run.solo?'独行誓约生效 · ':''}本局自动保存 · ${run.battles} 次战斗</span><span class="keyboard-tip"></span><span class="xp-track">LV.${run.level}<i><b style="width:${run.xp/run.nextXp*100}%"></b></i>${run.xp}/${run.nextXp}</span>`;
  renderModal();
  if(focusKey&&!MODAL.innerHTML){
    const replacement=[...ROOT.querySelectorAll('.hud-dock [data-action]')].find(el=>el.dataset.action===focusKey.action&&el.dataset.id===focusKey.id&&el.dataset.skill===focusKey.skill&&!el.disabled);
    replacement?.focus({preventScroll:true});
  }
}
function setModal(name,data=null){ui.modal=name;ui.modalData=data;renderModal();}
function closeModal(){
  if(run&&['reward','event','ended'].includes(run.phase)){if(run.phase==='reward'&&ui.rewardIndex!==null){ui.rewardIndex=null;renderModal();}return;}
  ui.modal=null;ui.modalData=null;renderModal();
}
function dialog(title,eyebrow,subtitle,body,{wide=false,narrow=false,closable=true,extra=''}={}){
  return `<div class="modal-backdrop"><section class="dialog ${wide?'wide':''} ${narrow?'narrow':''} ${extra}" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1">${closable?`<button class="icon-button modal-close" data-action="close" aria-label="关闭">${icon('close',16)}</button>`:''}<header class="dialog-head"><div class="eyebrow">${eyebrow}</div><h2 id="dialog-title">${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</header>${body}</section></div>`;
}
function rewardCard(reward,index){
  if(reward.type==='boon'){
    const b=BOONS.find(x=>x.id===reward.id),stacks=run.boons[b.id]||0;
    return `<button class="reward-card" data-action="reward" data-index="${index}"><span class="rarity">${icon('star',12)} 全队祝福${stacks?` · 已有 ×${stacks}`:''}</span><span class="reward-art">${icon(b.icon,42)}</span><h3>${b.name}</h3><p>${b.desc}</p><span class="reward-footer">将星光收入掌心 ${icon('arrow',17)}</span></button>`;
  }
  if(['skill','learn','evolve'].includes(reward.type)){
    const h=run.party.find(p=>p.id===reward.heroId),art=SKILLS[reward.skillId],rank=(h.ranks[art.id]||0)+1;
    const title=reward.type==='learn'?'习得新技能':reward.type==='evolve'?'机制觉醒':'技能熟练度';
    const name=reward.type==='evolve'?EVOLUTIONS[art.id].name:art.name;
    const description=reward.type==='learn'?`新增一个可用指令。${art.desc}`:reward.type==='evolve'?EVOLUTIONS[art.id].desc:`${['physical','magic','heal','revive','sanctuary'].includes(art.kind)?`伤害 / 治疗效能 ${100+rank*12}%。`:`熟练度 +2 时冷却缩短 1 回合（最低 2）；+1 开放觉醒。`}${EVOLUTIONS[art.id]&&!h.evolutions[art.id]?'达到 +1 后，奖励池加入此技能的机制觉醒。':'不增加状态持续时间。'}`;
    return `<button class="reward-card ${reward.type==='evolve'?'evolution-card':''}" data-action="reward" data-index="${index}"><span class="rarity">${icon('star',12)} ${title} · ${e(h.name)}</span><span class="reward-art">${icon(art.icon,42)}</span><h3>${e(name)} ${reward.type==='skill'?`<span class="gold">+${rank}</span>`:''}</h3><p>${e(description)}</p><span class="reward-footer">${reward.type==='learn'?'拓展这个职业的战术':reward.type==='evolve'?'让技能发生质变':'磨练这一门技艺'} ${icon('arrow',17)}</span></button>`;
  }
  const w=reward.weapon,r=RARITIES[w.rarity];
  return `<button class="reward-card ${w.rarity}" data-action="reward" data-index="${index}"><span class="rarity" style="color:${r.color}">${icon('sword',12)} ${r.name}武器 · ${e(w.type)}</span><span class="reward-art">${icon(w.mag>w.atk?'star':'sword',42)}</span><h3>${e(w.name)}</h3><span class="weapon-stats"><span>攻击 +${w.atk}</span><span>魔力 +${w.mag}</span></span><span class="weapon-effect"><b>固有效果 · ${e(w.effectName)}</b>${e(w.desc)}</span><span class="reward-footer">选择持有这把武器的人 ${icon('arrow',17)}</span></button>`;
}
function equipChoices(weapon,action,index=null){
  return `<div class="equip-grid" style="--party-size:${run.party.length}">${run.party.map(p=>{const da=weapon.atk-p.weapon.atk,dm=weapon.mag-p.weapon.mag;return `<button class="equip-card" data-action="${action}" data-id="${p.id}" ${index!==null?`data-index="${index}"`:''}><div class="equip-face"><img src="${PORTRAITS[p.job]}" alt=""></div><h3>${e(p.name)}</h3><span class="small muted">${JOBS[p.job].name}</span><p class="replace">替换 ${e(p.weapon.name)}</p><div class="weapon-stats"><span>攻击 <b class="delta ${da<0?'negative':''}">${da>=0?'+':''}${da}</b></span><span>魔力 <b class="delta ${dm<0?'negative':''}">${dm>=0?'+':''}${dm}</b></span></div></button>`;}).join('')}</div><p class="modal-hint">所有职业均可使用任意武器。旧武器会放入行囊，探索时可再次更换。</p>`;
}
function rewardModal(){
  if(ui.rewardIndex!==null){
    const reward=run.rewards[ui.rewardIndex];
    if(!reward||reward.type!=='weapon'){ui.rewardIndex=null;return rewardModal();}
    const w=reward.weapon;
    return dialog(e(w.name),'CHOOSE A WIELDER',`固有效果「${e(w.effectName)}」：${e(w.desc)}`,`${equipChoices(w,'equip-reward',ui.rewardIndex)}<div class="center-actions" style="margin-top:17px"><button class="ghost" data-action="reward-back">${icon('left',13)} 重新选择祝福</button></div>`,{closable:false});
  }
  const source={battle:'VICTORY REWARD',treasure:'A FORGOTTEN TREASURE',elite:'A WORTHY TRIUMPH',altar:'A WHISPER FROM THE STARS'}[run.rewardSource]||'CHOOSE YOUR FATE';
  return dialog('星光，回应了你。',source,'三份命运，选择其中一份。你获得的一切，只属于这一次旅程。',`<div class="reward-grid">${run.rewards.map(rewardCard).join('')}</div><p class="modal-hint">仅选择一项 · 新技能 / 机制觉醒 / 熟练度 +2 · 没有跨局继承</p>`,{wide:true,closable:false});
}
function eventModal(){
  const type=run.event.type;
  const data={shrine:{title:'一盏尚未熄灭的星灯',en:'A MOMENT OF SOLACE',text:'灯火微微摇曳。这里似乎没有黑暗能够靠近。',choices:[['rest','在此休息','全队恢复 45% 生命，倒下的同伴重新醒来。','免费 · 仅一次','heart']]},fountain:{title:'倒映着满月的泉水',en:'THE MOONWELL',text:'抬头是漆黑的穹顶。低头，却是一轮完整的月亮。',choices:[['drink','饮下月之泉','全队恢复 28% 生命，并补充 1 份急救药。','免费 · 仅一次','drop']]},altar:{title:'无名神像的低语',en:'A PRICE FOR A PROMISE',text:'神像没有眼睛，却似乎一直注视着你。它需要一份交换。',choices:[['offer','献上星砂','获得一次祝福选择，武器奖励保证为传说品质。','35 星砂','star'],['blood','以鲜血立誓','全队失去生命上限的 20%（最低剩余 1），换取一次祝福选择。','生命代价','heart']]}}[type];
  const choices=data.choices.map(([choice,title,desc,cost,ico])=>`<button class="event-choice" data-action="event" data-choice="${choice}" ${choice==='offer'&&run.gold<35?'disabled':''}>${icon(ico,23)}<span class="choice-copy"><strong>${title}</strong><small>${desc}</small></span><span class="cost">${cost}</span></button>`).join('');
  return dialog(data.title,data.en,data.text,`<div class="event-art"><img src="${svgUri(objectSvg(type,'#c2b0e8'))}" alt="${data.title}"></div><div class="choice-stack">${choices}<button class="ghost" data-action="event" data-choice="leave">暂时离开 ${icon('arrow',14)}</button></div>`,{narrow:true,closable:false});
}
function endModal(){const win=run.ending==='victory';return dialog(win?'终有黎明。':'星灯，暂时熄灭了。',win?'THE END OF THE ECLIPSE':'EVERY END IS A BEGINNING',win?'你走过没有月亮的夜晚，也把星光带到了故事的尽头。':'迷宫会改变形状，而你会带着新的想法，再一次出发。',`<div class="result-icon">${win?'☼':'☾'}</div><div class="result-party">${run.party.map(p=>`<img src="${PORTRAITS[p.job]}" alt="${e(p.name)}">`).join('')}</div><div class="result-stats"><span><strong>B${run.floor}</strong><small>最深抵达</small></span><span><strong>${run.level}</strong><small>队伍等级</small></span><span><strong>${run.battles}</strong><small>战斗胜利</small></span><span><strong>${run.steps}</strong><small>探索步数</small></span></div><div class="center-actions"><button class="primary" data-action="again">重新点亮星灯 ${icon('arrow',18)}</button><button class="secondary" data-action="object-motion">${icon('star',18)} 物件动画：${run.objectMotion===true?'开启（系统减弱动态优先）':'关闭（静态舒适）'}</button><button class="secondary" data-action="return-title">回到序章</button></div><p class="modal-hint">SEED <bdi data-i18n-skip>${e(run.seed)}</bdi> · 新一局将清空所有等级、武器、技能强化与祝福。</p>`,{closable:false,extra:win?'result-victory':''});}
function helpModal(){return dialog('先布置，再出手','FIELD GUIDE / v0.3','独立 CD · 我方准备 → 全队攻击 → 敌方行动',`<div class="help-grid"><section class="help-block"><h3>01 / 准备阶段</h3><p>点击人物状态卡切换队员，连续使用不同的就绪技能。「详情」查看完整说明，「道具」切换到即时补给。同一回合可以先破甲、再火冰融解、再治疗。技能没有 MP，使用后进入独立冷却；冷却只随完整战斗回合减少。CD 3 的技能在 R1 用过后，R4 可再次使用。</p></section><section class="help-block"><h3>02 / 全队攻击</h3><p>按 Enter / 1 或点击全队攻击，未防御的存活队员各攻击一次，然后敌方按阵容顺序行动，不看速度。按 2 切换当前队员防御：本轮承伤 -65%，但不普通攻击；仍可释放技能。3～7 使用当前队员技能，[ / ] 切换队员。</p></section><section class="help-block"><h3>03 / 物品与时钟</h3><p>急救药、时砂滴、破咒盐都是有限即时补给，不会让怪物行动、移动或使状态过期。时砂和加速不能无限刷新：冷却操纵技能不互刷，本回合已经用过的技能最低保留 1 CD。武器的回合末治疗每轮只触发一次。</p></section><section class="help-block"><h3>04 / 巡逻与警报</h3><p>普通敌群沿固定路线前进，即使玩家靠近也不自动追击。只有鸣月哨祭的警报成功，路径 8 格内普通敌群才向警报地点移动 6 拍；杀死或封头可阻断。精英始终定位玩家，每拍追一格。巡逻路过战场也可能意外加入；新增援下一轮才行动。</p></section><section class="help-block"><h3>05 / 战前工具</h3><p>T 打开工具：诱导铃在当前格留 5 拍诱饵（普通怪 / 路径 6 格），眠缚铃停住已探明 4 格内的一队（普通 3 拍、精英 1 拍），静音粉阻断未来 6 拍警报。使用不耗时，但后续移动、等待、完整战斗回合消耗持续时间。精英免疫诱导。下层有限补充。</p></section><section class="help-block"><h3>06 / 预兆与舒适</h3><p>Boss 预兆保留完整准备窗口，按提示驱散、封头、清理侍从或多段命中。预兆取代该轮普通攻击；不能取消时防御止损。技能发生血线变化后，下一准备回合才预告。第 13 回合起逐渐暴走。战斗演出可跳过；系统减弱动态关闭位移动画，不影响结算。</p></section></div><div class="help-note">W/S 前后、A/D 转向、Q/E 平移、Space 等待、F 调查、M 地图（可显示已探索巡线）。1～3 人、五层、武器唯一装备槽与单一固有效果不变。探索菜单可选择标准 / 舒缓 / 淡入视角，北向地图保持固定。v0.3.3 沿用 v0.3 存档；v0.2 存档未删除。</div>`,{wide:true});}
function classesModal(){return dialog('六种星火，六种答案','JOB COMPENDIUM','明确分工，保留弱点。独行需要有限补给与局内技能弥补短板。',`<div class="choice-stack">${Object.values(JOBS).map(j=>`<button class="event-choice" data-action="class-detail" data-job="${j.id}"><span style="height:48px;width:48px;overflow:hidden;position:relative;border-radius:7px;background:${j.color}11;flex-shrink:0"><img src="${PORTRAITS[j.id]}" style="width:80px;max-width:none;position:absolute;left:-16px;top:-18px" alt=""></span><span class="choice-copy"><strong style="color:${j.color}">${j.name} · ${j.person}</strong><small>${j.role} / ${j.passiveDesc}</small></span>${icon('right',16)}</button>`).join('')}</div>`);}
function heroModal(id,isClass=false){
  const hero=isClass?null:run.party.find(p=>p.id===id),job=JOBS[isClass?id:hero.job],stats=hero?heroStats(hero):job;
  const header=`<div class="hero-detail"><div class="hero-detail-art"><img src="${PORTRAITS[job.id]}" alt="${job.person}"></div><div class="hero-detail-copy"><div class="eyebrow">${job.roman} / ${job.jp}</div><h2>${job.person}</h2><div class="job-title">${job.name} · ${job.role}</div><p>${job.synopsis}</p><div class="hero-stats">${[['生命',hero?`${hero.hp}/${hero.maxHp}`:job.hp],['攻击',Math.floor(stats.atk)],['魔力',Math.floor(stats.mag)],[getLanguage()==='en'?'DEF':'防御',stats.def]].map(([label,value])=>`<span class="hero-stat">${label}<b>${value}</b></span>`).join('')}</div><div class="passive"><b>职业被动 · ${job.passive}</b>${job.passiveDesc}</div></div></div>`;
  const currentStatus=hero?`<div class="detail-status"><b>当前状态</b>${statusHtml(hero)}${!hero.guard&&!hero.barrier&&!Object.keys(hero.status).length?'无异常':''}</div>`:'';
  const skills=[...job.skills,...job.advanced].map(id=>{const s=hero?effectiveSkill(hero,id):SKILLS[id],rank=hero?.ranks[id]||0;const learned=hero?hero.skills.includes(id):job.skills.includes(id);return `<div class="skill-detail ${!learned?'locked-art':''}">${icon(s.icon,21)}<span><strong>${s.name}${!learned?` <small>未习得 · B${SKILLS[id].minFloor||1} 起</small>`:hero?.evolutions[id]?'<small class="gold"> ✦觉醒</small>':''}${rank?` <span class="gold">+${rank}</span>`:''}</strong><p>${s.desc}${rank?` 当前强化 +${rank}。`:''}</p></span><span class="mp">CD ${hero?skillCooldown(hero,id):s.cd}</span></div>`;}).join('');
  return `<div class="modal-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1"><h2 id="dialog-title" class="sr-only">${job.person} 的职业信息</h2><button class="icon-button modal-close" data-action="close" aria-label="关闭">${icon('close',16)}</button>${header}${currentStatus}<div class="divider"></div>${skills}${hero?`<div class="help-note">当前武器：${e(hero.weapon.name)}<br>「${e(hero.weapon.effectName)}」${e(hero.weapon.desc)}</div>`:'<p class="modal-hint">以上为职业基础数值，不含起始武器和独行誓约加成。</p>'}</section></div>`;
}
function weaponPanel(w,owner=null){const r=RARITIES[w.rarity];return `<${owner?'div':'button'} class="inventory-weapon" ${!owner?`data-action="choose-bag-weapon" data-uid="${e(w.uid)}" ${run.phase!=='explore'?'disabled':''}`:''}><span class="owner"><span style="color:${r.color}">${r.name} · ${e(w.type)}</span>${owner?`<b>${e(owner)} / 已装备</b>`:'<b>备用武器</b>'}</span><h3>${e(w.name)}</h3><span class="weapon-stats"><span>攻击 +${w.atk}</span><span>魔力 +${w.mag}</span></span><div class="weapon-effect"><b>固有效果 · ${e(w.effectName)}</b>${e(w.desc)}</div>${!owner?`<p>${run.phase==='explore'?'点击选择装备者':'战斗中不可更换武器'}</p>`:''}</${owner?'div':'button'}>`;}
function inventoryModal(){return dialog('沿途拾起的星光','THE TRAVELER’S INVENTORY',`只有武器，没有护甲或饰品槽。现在拥有 ${run.gold} 星砂。`,`<div class="help-note">共享补给：急救药 ×${run.supplies.tonic} / 时砂滴 ×${run.supplies.ether} / 破咒盐 ×${run.supplies.salt}。技能与物品使用都不推进回合。</div><div class="inventory-heading">当前武器 <small>每人只装备一把</small></div><div class="inventory-grid">${run.party.map(p=>weaponPanel(p.weapon,p.name)).join('')}</div><div class="inventory-heading">行囊中的武器 <small>${run.inventory.length} 把</small></div><div class="inventory-grid">${run.inventory.length?run.inventory.map(w=>weaponPanel(w)).join(''):'<p class="empty-note">旧武器会在更换装备后放入这里。</p>'}</div><div class="inventory-heading">本局祝福 <small>仅在这一次冒险中生效</small></div><div class="all-boons">${boonChips()}</div><div class="inventory-heading">技能觉醒</div>${run.party.map(p=>`<p class="small muted" style="margin-bottom:8px"><span style="color:${JOBS[p.job].color}">${e(p.name)}</span>　${p.skills.map(id=>`${effectiveSkill(p,id).name}${p.evolutions[id]?' ✦':p.ranks[id]?` +${p.ranks[id]}`:''}`).join(' / ')}</p>`).join('')}`,{wide:true});}
function fieldModal(){
  const nearby=reinforcementInfo(run).filter(p=>p.known&&p.distance<=4),remaining=Math.max(0,(run.field?.hushUntil||0)-run.dungeon.elapsed);
  return dialog('让迷宫成为你的战术','FIELD TOOLS / 不推进时间',`世界节拍 ${run.dungeon.elapsed} · ${remaining?'静音保护剩余 '+remaining+' 拍':'普通怪固定巡逻；精英持续定位'}`,`<div class="field-tools">${Object.entries(FIELD_TOOLS).map(([id,t])=>`<section class="field-tool"><h3>${icon(t.icon,20)} ${t.name}<span>×${run.fieldSupplies[id]}</span></h3><p>${e(t.desc)}</p>${id==='sleep'?`<label>选择敌群<select id="field-pack"><option value="">请选择目标</option>${nearby.map(p=>`<option value="${p.id}">${e(p.name)} / ${p.distance} 格 / ${MODE_NAMES[p.mode]}</option>`).join('')}</select></label>`:''}<button class="secondary" data-action="field-use" data-tool="${id}" ${!run.fieldSupplies[id]?'disabled':''}>使用${t.name}</button></section>`).join('')}</div><div class="help-note">急救药 ×${run.supplies.tonic}：探索中也可不耗时治疗。${run.party.map(p=>`<button class="ghost" data-action="field-heal" data-id="${p.id}" ${!run.supplies.tonic||p.hp<=0||p.hp===p.maxHp?'disabled':''}>治疗 ${e(p.name)}（${p.hp}/${p.maxHp}）</button>`).join('')}</div>`,{wide:true});
}

function battleIntelModal(){
  const selected=run.battle.enemies.find(p=>p.id===ui.selectedEnemy)||run.battle.enemies.find(p=>p.hp>0);
  const incoming=reinforcementInfo(run),warnings=bossWarnings(run);
  const body=`${selected?`<section class="intel-block"><h3>${e(selected.name)} · ${e(selected.role)}</h3><p>${e(selected.hint)}</p><p>当前意图：${e(INTENTS[intentOf(selected)]?.name||'攻击')}</p>${statusHtml(selected)}</section>`:''}
  ${warnings.map(w=>`<section class="intel-block"><h3>${e(w.name)}</h3><p>${e(w.trait)}</p><p>下次定时预兆：R${w.nextTurn}${w.queued.length?' · 待发血线：'+e(w.queued.join(' / ')):''}</p></section>`).join('')}
  <section class="intel-block"><h3>附近动向</h3>${incoming.length?incoming.map(p=>`<p>${p.known?e(p.name):'未知脚步'} · ${MODE_NAMES[p.mode]} · ${p.distance} 格</p>`).join(''):'<p>附近 8 格内没有游荡敌群。</p>'}<p class="muted">普通队伍巡逻，成功报警才集结；完整回合末移动一格。</p><button class="secondary" data-action="map">${icon('map',16)} 查看地图</button></section>
  <details class="intel-block"><summary>最近行动记录</summary>${run.log.slice(-14).map(l=>`<p>${e(l.text)}</p>`).join('')}</details>
  <div class="intel-retreat"><button class="secondary flee" data-action="flee" ${['guardian','boss'].includes(run.battle.type)?'disabled':''}>${icon('exit',16)} 撤退</button><span>${['guardian','boss'].includes(run.battle.type)?'首领战不可撤退':'首次成功率 70%；失败会让敌方行动一次。'}</span></div>`;
  return dialog('战况','TACTICS',`第 ${run.battle.round} 回合 · 查看信息不推进时间`,body,{narrow:true});
}

function viewSettingsModal(){return dialog('探索视角','VIEW & ORIENTATION','固定视线，不摇头、不倾斜。移动与转向使用同一种过渡。',`<div class="menu-choices view-modes">${Object.entries(VIEW_MODES).map(([id,m])=>`<button class="secondary" data-action="view-mode" data-mode="${id}" aria-pressed="${viewMode(run)===id}"><strong>${m.name}</strong><span>${m.desc}</span></button>`).join('')}</div><p class="tiny muted">系统开启“减弱动态”时，自动停用空间过渡，保留方向提示和北向地图。舒缓不一定适合每个人，可比较标准与淡入模式。</p>`,{narrow:true});}
function languageModal(){return dialog('语言 / Language','LANGUAGE','跟随浏览器语言，也可以手动选择。',`<div class="menu-choices">${[['auto','自动 / Browser default'],['zh','简体中文'],['en','English']].map(([id,name])=>`<button class="secondary" data-action="set-language" data-language="${id}" aria-pressed="${getLanguagePreference()===id}">${name}</button>`).join('')}</div>`,{narrow:true});}
function redrawLanguage(){
  syncDocumentLanguage(document);modalKey='';
  if(ui.screen==='landing'){ui.seedDraft=document.getElementById('seed-input')?.value??ui.seedDraft;renderLanding();}
  else if(run)mountGame();
}
function menuModal(){return dialog('星灯仍在这里','PAUSE & REFLECT',`SEED <bdi data-i18n-skip>${e(run.seed)}</bdi> · 第 ${run.floor} 层 · 本局已自动保存`,`<div class="menu-choices"><button class="secondary" data-action="close">${icon('arrow',18)} 继续探索</button><button class="secondary" data-action="inventory">${icon('bag',18)} 查看装备与祝福</button><button class="secondary" data-action="journal">${icon('clock',18)} 行动记录</button><button class="secondary" data-action="help">${icon('help',18)} 查看冒险指南</button><button class="secondary" data-action="view-settings">${icon('eye',18)} 探索视角 · ${VIEW_MODES[viewMode(run)]?.name||'标准步进'}</button><button class="secondary" data-action="object-motion">${icon('star',18)} 物件动画：${run.objectMotion===true?'开启（系统减弱动态优先）':'关闭（静态舒适）'}</button><button class="secondary" data-action="return-title">${icon('moon',18)} 返回序章（保留本局存档）</button><button class="secondary danger-text" data-action="restart-confirm">${icon('exit',18)} 放弃本局，重新编队</button></div>`,{narrow:true});}
function renderModal(){
  localizeDom(ROOT);
  let html='',key='';
  if(run?.phase==='reward'){html=rewardModal();key=`reward-${run.rewards.map(r=>r.id||r.skillId||r.weapon?.uid).join('-')}-${ui.rewardIndex}`;}
  else if(run?.phase==='event'){html=eventModal();key=`event-${run.event.key}`;}
  else if(run?.phase==='ended'){html=endModal();key=`end-${run.ending}`;}
  else if(ui.modal){key=`${ui.modal}-${ui.modalData||''}`;
    if(ui.modal==='language')html=languageModal();
    else if(ui.modal==='help')html=helpModal();
    else if(ui.modal==='classes')html=classesModal();
    else if(ui.modal==='class')html=heroModal(ui.modalData,true);
    else if(ui.modal==='hero'&&run)html=heroModal(ui.modalData);
    else if(ui.modal==='inventory'&&run)html=inventoryModal();
    else if(ui.modal==='map'&&run)html=dialog('把走过的路，记在心里。','MAP / '+FLOORS[run.floor-1].jp,`已探索 ${exploration()}% · 坐标 ${run.x}, ${run.y} · 面向${DIRECTIONS[run.dir].label}`,`<button class="secondary" data-action="patrol-toggle">${ui.showPatrol?'隐藏':'显示'}已探索巡逻路线</button><div class="large-map">${mapSvg(true)}</div><p class="modal-hint">红菱形：游荡小队　金菱形：强敌　圆环：警报集结<br>Ⅰ～Ⅳ 为区域地标。已探索区域内的明雷位置实时随回合更新；未知区域仍保留迷雾。</p>`,{narrow:true});
    else if(ui.modal==='journal'&&run)html=dialog('行动记录','JOURNAL','查看记录不推进时间',`<div class="intel-block">${run.log.slice(-40).map(l=>`<p>${e(l.text)}</p>`).join('')}</div>`,{narrow:true});
    else if(ui.modal==='field'&&run)html=fieldModal();
    else if(ui.modal==='supply-detail'&&run)html=dialog('即时道具','SUPPLIES','使用不耗回合；返回后选择道具与目标。',`<div class="choice-stack">${['tonic','ether','salt'].map(id=>`<section class="intel-block"><h3>${SKILLS[id].name} ×${run.supplies[id]}</h3><p>${SKILLS[id].desc}</p></section>`).join('')}</div>`,{narrow:true});
    else if(ui.modal==='battle-intel'&&run?.phase==='battle')html=battleIntelModal();
    else if(ui.modal==='view-settings'&&run)html=viewSettingsModal();
    else if(ui.modal==='menu'&&run)html=menuModal();
    else if(ui.modal==='equip-bag'&&run){const w=run.inventory.find(w=>w.uid===ui.modalData);if(w)html=dialog(e(w.name),'CHANGE YOUR WEAPON',`「${e(w.effectName)}」${e(w.desc)}`,equipChoices(w,'equip-bag'));}
    else if(ui.modal==='confirm-start')html=dialog('开始一段新的旅程？','A NEW BEGINNING','新的冒险会覆盖当前存档。旧局的等级、武器、祝福和技能强化都不会保留。',`<div class="center-actions"><button class="secondary" data-action="close">保留旧局</button><button class="primary" data-action="confirm-start">从零开始 ${icon('arrow',18)}</button></div>`,{narrow:true});
    else if(ui.modal==='confirm-abandon')html=dialog('让这一次星火熄灭？','RETURN TO THE BEGINNING','当前冒险将被清空。你将回到职业选择，所有成长从零开始。',`<div class="center-actions"><button class="secondary" data-action="close">继续冒险</button><button class="primary" data-action="abandon">确认放弃</button></div>`,{narrow:true});
  }
  if(!html){
    if(MODAL.innerHTML){MODAL.innerHTML='';ROOT.removeAttribute('inert');document.body.style.overflow='';if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});lastFocus=null;}
    modalKey='';return;
  }
  // Do not replace a dialog on every HUD update: preserve focused controls and scroll position.
  if(key===modalKey&&MODAL.innerHTML)return;
  if(!MODAL.innerHTML){lastFocus=document.activeElement;ROOT.setAttribute('inert','');document.body.style.overflow='hidden';}
  MODAL.innerHTML=html;localizeDom(MODAL);modalKey=key;MODAL.querySelector('.dialog')?.focus({preventScroll:true});
}
function beginRun(){
  run=createRun(ui.selection,ui.seedDraft.trim()||seedCode());ui.modal=null;ui.modalData=null;ui.rewardIndex=null;ui.pendingSkill=null;ui.selectedEnemy=null;ui.busy=false;ui.presentation=null;ui.playback=null;ui.animationToken++;modalKey='';
  save();mountGame();AUDIO.sfx('magic');
}
function goTitle({clear=false}={}){
  if(run)ui.selection=run.party.map(p=>p.job);
  if(clear){try{localStorage.removeItem(SAVE_KEY);}catch{}}else save();
  run=null;ui.modal=null;ui.modalData=null;ui.pendingSkill=null;ui.rewardIndex=null;ui.busy=false;ui.presentation=null;ui.playback=null;ui.animationToken++;ui.seedDraft='';modalKey='';renderLanding();
}
function finishNavigation({discardQueue=false}={}){
  if(discardQueue)queuedMove=null;
  renderer?.finishTravel();
}
function mutateExplore(action,{repeat=false}={}){
  if(!run||ui.modal||ui.busy)return;
  if(navigation){
    // Only one deliberate tap may wait. Key-repeat is never queued and cannot create a drift tail.
    if(!repeat&&!queuedMove&&NAV_ACTIONS.includes(action)&&run.phase==='explore')queuedMove=action;
    return;
  }
  if(run.phase!=='explore')return;
  if(repeat&&action.startsWith('turn-'))return;
  const before=structuredClone(run);
  let ok;
  if(action==='turn-left')ok=turn(run,-1);
  else if(action==='turn-right')ok=turn(run,1);
  else if(action==='interact')ok=interact(run);
  else if(action==='wait')ok=waitTurn(run);
  else ok=move(run,{'forward':'forward','back':'back','strafe-left':'left','strafe-right':'right'}[action]);
  if(!ok){lastNavigationCue=moveCue('blocked',before,run);if(action==='interact')toast('这里没有可以调查的事物。');else if(!action.startsWith('turn'))toast('前方是坚实的石壁。');updateGame();return;}
  lastNavigationCue=moveCue(action,before,run);
  save();
  const actual=run;
  const arrived=()=>{
    if(run!==actual)return;
    navigation=null;
    if(before.floor!==run.floor)navigationTrail=[];
    if(before.x!==run.x||before.y!==run.y)navigationTrail=[...navigationTrail,{x:run.x,y:run.y,floor:run.floor}].slice(-6);
    if(run.phase==='battle'){queuedMove=null;AUDIO.sfx('battle');ui.selectedEnemy=null;ui.pendingSkill=null;ui.suppliesOpen=false;}
    else if(run.phase==='reward')AUDIO.sfx('magic');
    updateGame();
    const next=queuedMove;queuedMove=null;
    if(next&&!ui.modal&&run.phase==='explore')mutateExplore(next);
  };
  if(NAV_ACTIONS.includes(action)&&before.floor===run.floor){
    navigation={before,action};
    if(renderer?.beginTravel(before,run,action,arrived)){AUDIO.sfx('move');updateGame();return;}
    navigation=null;
  }
  arrived();
}
function finishPlayback(){
  document.getElementById('combat-skip')?.remove();
  ui.animationToken++;ui.busy=false;ui.presentation=null;ui.playback=null;
  if(run){run.fx=[];run.frames=[];}if(ui.screen==='game')updateGame();
}
async function playFrames(before,frames){
  const actual=run,token=++ui.animationToken;
  ui.busy=true;ui.presentation=before;ui.presentation.phase='battle';ui.presentation.fx=[];
  document.getElementById('combat-skip')?.remove();
  const skip=document.createElement('button');skip.id='combat-skip';skip.className='secondary combat-skip';skip.dataset.action='skip-animation';skip.textContent=translate('跳过演出 · Esc');skip.setAttribute('aria-label',translate('跳过演出，不跳过结算'));document.body.appendChild(skip);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  try{
    for(const frame of frames){
      if(token!==ui.animationToken||run!==actual)return;
      ui.playback={...frame,label:INTENTS[frame.label]?.name||frame.label};ui.presentation.fx=[];
      updateGame();AUDIO.sfx(frame.style==='heal'?'heal':['magic','fire','ice','omen'].includes(frame.style)?'magic':'attack');
      await sleep(reduced?40:140);if(token!==ui.animationToken||run!==actual)return;
      ui.presentation.party=frame.party;ui.presentation.battle=frame.battle;ui.presentation.log=frame.log;ui.presentation.fx=frame.fx;
      updateGame();await sleep(reduced?70:260);
    }
  }finally{if(token===ui.animationToken&&run===actual)finishPlayback();}
}
function useSkill(id,target=null){
  if(!run||run.phase!=='battle'||ui.busy||ui.modal||navigation)return;
  const hero=activeHero(run);if(!hero)return;const skill=effectiveSkill(hero,id);
  if(id!=='escape'&&skill?.target==='ally'&&!target){ui.pendingSkill=id;updateGame();return;}
  const targetId=target||(run.battle.enemies.some(p=>p.id===ui.selectedEnemy&&p.hp>0)?ui.selectedEnemy:null)||run.battle.enemies.find(p=>p.hp>0)?.id;
  const before=structuredClone(run),result=act(run,id,targetId);
  if(!result.ok){toast(result.error);return;}
  ui.pendingSkill=null;save();
  const frames=run.frames||[];
  if(frames.length&&id!=='guard')playFrames(before,frames).catch(error=>{console.error(error);finishPlayback();});
  else{run.fx=[];updateGame();}
}
function handleAction(button){
  const action=button.dataset.action;
  if(button.disabled)return;
  if(navigation&&!NAV_ACTIONS.includes(action)&&action!=='sound')finishNavigation({discardQueue:true});
  if(action==='skip-animation'){finishPlayback();return;}
  if(ui.busy&&action!=='sound')return;
  if(action==='job'){
    ui.seedDraft=document.getElementById('seed-input')?.value||ui.seedDraft;
    const id=button.dataset.job,index=ui.selection.indexOf(id);
    if(index>=0)ui.selection.splice(index,1);else if(ui.selection.length<3)ui.selection.push(id);else{toast('最多选择三个职业。先移除一名同行者，也可以仅用一个职业独行。');return;}
    AUDIO.sfx('select');renderLanding();return;
  }
  if(action==='start'){ui.seedDraft=document.getElementById('seed-input')?.value||'';if(!ui.selection.length)return;const saved=readSave();if(saved&&saved.phase!=='ended')setModal('confirm-start');else beginRun();return;}
  if(action==='confirm-start'){beginRun();return;}
  if(action==='resume'){
    const saved=readSave();if(!saved){toast('未能读取存档。请开始新的冒险。');return;}run=saved;ui.modal=null;ui.rewardIndex=null;ui.pendingSkill=null;ui.busy=false;mountGame();return;
  }
  if(action==='sound'){
    AUDIO.toggle().then(enabled=>{if(ui.screen==='landing')renderLanding();else document.getElementById('sound-button').innerHTML=soundButton();localizeDom(ROOT);toast(enabled?'已开启原创合成音乐与音效。':'已关闭声音。');}).catch(()=>toast('当前浏览器未允许播放音频。'));return;
  }
  if(action==='language'){setModal('language');return;}
  if(action==='set-language'){if(setLanguage(button.dataset.language))redrawLanguage();return;}
  if(action==='close'){closeModal();return;}
  if(action==='help'){setModal('help');return;}
  if(action==='classes'){setModal('classes');return;}
  if(action==='class-detail'){setModal('class',button.dataset.job);return;}
  if(action==='map'||action==='inventory'||action==='menu'||action==='field'||action==='journal'||action==='view-settings'){if(run)setModal(action);return;}
  if(action==='return-title'){goTitle();return;}
  if(action==='again'){goTitle({clear:true});return;}
  if(action==='restart-confirm'){setModal('confirm-abandon');return;}
  if(action==='abandon'){goTitle({clear:true});return;}
  if(['forward','back','turn-left','turn-right','strafe-left','strafe-right','interact','wait'].includes(action)){mutateExplore(action);return;}
  if(!run)return;
  if(action==='object-motion'){run.objectMotion=run.objectMotion!==true;modalKey='';save();updateGame();return;}
  if(action==='view-mode'&&Object.hasOwn(VIEW_MODES,button.dataset.mode)){run.viewMode=button.dataset.mode;run.comfort=true;modalKey='';save();updateGame();return;}
  if(action==='patrol-toggle'){ui.showPatrol=!ui.showPatrol;modalKey='';renderModal();return;}
  if(action==='field-use'){
    const result=useFieldTool(run,button.dataset.tool,document.getElementById('field-pack')?.value||null);
    if(!result.ok){toast(result.error);return;}modalKey='';save();updateGame();return;
  }
  if(action==='field-heal'){
    const result=useSupply(run,'tonic',button.dataset.id);if(!result.ok){toast(result.error);return;}
    modalKey='';save();updateGame();return;
  }
  if(action==='toggle-supplies'){ui.suppliesOpen=!ui.suppliesOpen;ui.pendingSkill=null;updateGame();return;}
  if(action==='supply-detail'){setModal('supply-detail');return;}
  if(action==='hero-detail'){setModal('hero',button.dataset.id);return;}
  if(action==='battle-intel'){setModal('battle-intel');return;}
  if(action==='target'){ui.selectedEnemy=button.dataset.id;AUDIO.sfx('select');updateGame();return;}
  if(action==='skill'){useSkill(button.dataset.skill);return;}
  if(action==='flee'){ui.modal=null;ui.modalData=null;renderModal();useSkill('escape');return;}
  if(action==='cancel-target'){ui.pendingSkill=null;updateGame();return;}
  if(action==='party'){
    if(ui.pendingSkill){useSkill(ui.pendingSkill,button.dataset.id);return;}
    if(run.phase==='battle'){if(selectHero(run,button.dataset.id)){ui.suppliesOpen=false;save();updateGame();}}else setModal('hero',button.dataset.id);return;
  }
  if(action==='reward'){
    const index=Number(button.dataset.index),reward=run.rewards[index];if(!reward)return;
    if(reward.type==='weapon'){ui.rewardIndex=index;modalKey='';renderModal();return;}
    const result=takeReward(run,index);if(!result.ok){toast(result.error);return;}
    ui.rewardIndex=null;ui.busy=false;AUDIO.sfx('magic');save();updateGame();return;
  }
  if(action==='reward-back'){ui.rewardIndex=null;modalKey='';renderModal();return;}
  if(action==='equip-reward'){
    const result=takeReward(run,Number(button.dataset.index),button.dataset.id);if(!result.ok){toast(result.error);return;}
    ui.rewardIndex=null;ui.busy=false;AUDIO.sfx('select');save();updateGame();return;
  }
  if(action==='event'){
    if(!resolveEvent(run,button.dataset.choice)){toast('当前无法进行这个选择。');return;}
    AUDIO.sfx(button.dataset.choice==='leave'?'select':'heal');save();updateGame();return;
  }
  if(action==='choose-bag-weapon'){if(run.phase==='explore')setModal('equip-bag',button.dataset.uid);return;}
  if(action==='equip-bag'){
    if(equipWeapon(run,button.dataset.id,ui.modalData)){AUDIO.sfx('select');ui.modal='inventory';ui.modalData=null;modalKey='';save();updateGame();}return;
  }
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(!button)return;
  try{handleAction(button);}catch(error){console.error('Action failed:',error);toast(`操作未完成：${error.message}`);ui.busy=false;}
});
document.addEventListener('input',event=>{if(event.target.id==='seed-input')ui.seedDraft=event.target.value;});
document.addEventListener('keydown',event=>{
  if(event.key==='Tab'&&MODAL.innerHTML){
    const focusable=[...MODAL.querySelectorAll('button:not(:disabled),input,select,[tabindex="0"]')].filter(el=>el.getClientRects().length),first=focusable[0],last=focusable.at(-1);
    if(!first){event.preventDefault();return;}
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===MODAL.querySelector('.dialog'))){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===MODAL.querySelector('.dialog'))){event.preventDefault();first.focus();}return;
  }
  if(ui.busy){if(event.key==='Escape'){event.preventDefault();finishPlayback();}return;}
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
  if(navigation&&['Escape','m','M','t','T','i','I','h','H'].includes(event.key))finishNavigation({discardQueue:true});
  if(event.key==='Escape'){if(MODAL.innerHTML)closeModal();else if(ui.pendingSkill){ui.pendingSkill=null;updateGame();}else if(run)setModal('menu');return;}
  if(MODAL.innerHTML||!run)return;
  const key=event.key.toLowerCase();
  if(key==='m'){event.preventDefault();setModal('map');return;}
  if(key==='t'&&run.phase==='explore'){event.preventDefault();setModal('field');return;}
  if((key==='enter'||key===' ')&&document.activeElement?.matches('button,summary,a'))return;
  if(navigation&&run.phase!=='explore')return;
  if(run.phase==='battle'&&key==='enter'){event.preventDefault();useSkill('attack');return;}
  if(run.phase==='battle'&&['[',']'].includes(key)){event.preventDefault();const living=run.party.filter(p=>p.hp>0),i=living.findIndex(p=>p.id===run.battle.active);selectHero(run,living[(i+(key===']'?1:living.length-1))%living.length].id);ui.pendingSkill=null;ui.suppliesOpen=false;save();updateGame();ROOT.querySelector('.party-card.active')?.focus({preventScroll:true});return;}
  if(key==='i'){event.preventDefault();setModal('inventory');return;}
  if(key==='h'){event.preventDefault();setModal('help');return;}
  if(run.phase==='battle'&&/^[1-9]$/.test(key)){event.preventDefault();const p=activeHero(run);const id=p?['attack','guard',...p.skills][Number(key)-1]:null;if(id)useSkill(id);return;}
  if(run.phase!=='explore')return;
  const action={w:'forward',arrowup:'forward',s:'back',arrowdown:'back',a:'turn-left',arrowleft:'turn-left',d:'turn-right',arrowright:'turn-right',q:'strafe-left',e:'strafe-right',f:'interact',enter:'interact',' ':'wait'}[key];
  if(action){event.preventDefault();const now=performance.now();if(now-ui.lastMove<140&&event.repeat)return;ui.lastMove=now;mutateExplore(action,{repeat:event.repeat});}
});
window.addEventListener('languagechange',()=>{if(refreshBrowserLanguage()){finishNavigation({discardQueue:true});if(ui.busy)finishPlayback();redrawLanguage();}});
window.addEventListener('beforeunload',save);
window.addEventListener('pagehide',save);
document.addEventListener('visibilitychange',()=>{if(document.hidden){finishNavigation({discardQueue:true});save();}});
window.addEventListener('blur',()=>finishNavigation({discardQueue:true}));
renderLanding();
