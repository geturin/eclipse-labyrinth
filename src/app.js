import { SAVE_KEY, MAX_FLOOR, JOBS, SKILLS, EVOLUTIONS, STATUS, BOONS, INTENTS, RARITIES, DIRECTIONS, FLOORS } from './data.js';
import { createRun, move, turn, interact, currentEvent, resolveEvent, activeHero, act, intentOf, takeReward, equipWeapon, heroStats, skillCost, serializeRun, restoreRun, cellKey, waitTurn, effectiveSkill, skillProblem, reinforcementInfo, bossWarnings, counterText } from './engine.js';
import { icon, portraitUri, enemyUri, objectSvg, svgUri } from './art.js';
import { DungeonRenderer } from './renderer.js';
import { AudioSystem } from './audio.js';
import { REGIONS, regionAt, visiblePacks } from './world.js';

const ROOT=document.getElementById('app'), MODAL=document.getElementById('modal-root');
const AUDIO=new AudioSystem();
const PORTRAITS=Object.fromEntries(Object.keys(JOBS).map(id=>[id,portraitUri(id)]));
const ENEMY_IMAGES=new Map();
let run=null,renderer=null,toastTimer=null,modalKey='',lastFocus=null;
const ui={selection:['knight','mage','shrine'],modal:null,modalData:null,rewardIndex:null,selectedEnemy:null,pendingSkill:null,busy:false,seedDraft:'',screen:'landing',lastMove:0,storageError:false};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e=escapeHtml;
function toast(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3200);}
function readSave(){try{const text=localStorage.getItem(SAVE_KEY);return text?restoreRun(text):null;}catch(error){return null;}}
function save(){if(!run)return;try{localStorage.setItem(SAVE_KEY,serializeRun(run));}catch(error){if(!ui.storageError){ui.storageError=true;toast('浏览器阻止了本地存档。此局仍可继续，但关闭页面会丢失进度。');}}}
function seedCode(){try{const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);return `MOON-${bytes[0].toString(36).toUpperCase().padStart(6,'0')}`;}catch{return `MOON-${Date.now().toString(36).toUpperCase()}`;}}
function brand(){return `<div class="brand"><div class="brand-mark">${icon('moon',23)}</div><div><div class="brand-label">月蝕の迷宮</div><div class="brand-en">ECLIPSE LABYRINTH</div></div></div>`;}
function soundButton(){return `<button class="icon-button" data-action="sound" aria-label="${AUDIO.enabled?'关闭音乐与音效':'开启音乐与音效'}" title="${AUDIO.enabled?'关闭声音':'开启声音（默认静音）'}">${icon(AUDIO.enabled?'sound':'mute',18)}</button>`;}
function selectionDescription(){
  const ids=ui.selection;
  if(!ids.length)return ['旅程由你决定','选择一至三个职业。每个职业都有不同的战斗节奏。'];
  if(ids.length===1)return ['独行者的誓约','单人：生命 +45%、MP +30%、伤害 +20%。敌人强度随队伍人数调整。'];
  const synergies=[];
  if(ids.includes('knight')&&(ids.includes('ninja')||ids.includes('reaver')))synergies.push('破甲 → 物理追击');
  if(ids.includes('mage')&&ids.includes('ninja'))synergies.push('燃烧 → 猎影增伤');
  if(ids.includes('shrine'))synergies.push('治疗与净化分工');
  if(ids.includes('chrono'))synergies.push('全队加速与时间支援');
  if(!synergies.length)synergies.push('让攻击技能衔接，构筑联携；普攻不累积联携');
  return [ids.map(id=>JOBS[id].name).join(' / '),synergies.join('　·　')];
}
function renderLanding(){
  ui.screen='landing';renderer?.destroy();renderer=null;
  const saved=readSave(),canResume=saved&&saved.phase!=='ended';
  const [line,sub]=selectionDescription();
  ROOT.innerHTML=`<header class="page-head">${brand()}<div class="header-actions"><span class="edition"><i class="dot"></i>ROGUELIKE DRPG · 0.2.1</span>${soundButton()}<button class="icon-button" data-action="help" aria-label="游戏说明">${icon('help',18)}</button></div></header>
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
  ui.screen='game';renderer?.destroy();
  ROOT.innerHTML=`<main class="game-shell"><header class="game-head">${brand()}<div id="top-stats" class="head-run"></div><div class="header-actions"><span id="sound-button">${soundButton()}</span><button class="icon-button" data-action="help" aria-label="游戏说明">${icon('help',18)}</button><button class="icon-button" data-action="menu" aria-label="冒险菜单">${icon('menu',18)}</button></div></header>
    <div class="game-grid"><section class="viewport-panel" aria-label="第一人称迷宫视图"><div class="stage" id="stage"><canvas id="dungeon-canvas" aria-label="第一人称三维迷宫"></canvas><div id="stage-hud" class="stage-hud"></div></div><div id="stage-footer" class="stage-footer"></div></section><section id="command-panel" class="command-panel" aria-label="行动指令"></section><section id="party-strip" class="party-strip" aria-label="冒险队伍"></section><aside class="side-column"><section class="side-card map-card"><div class="card-title"><span>${icon('map',14)} 探索地图</span><small id="exploration-percent"></small></div><button class="map-wrapper" id="minimap" data-action="map" aria-label="展开已探索地图"></button><div class="map-legend"><span><i></i> 月门</span><span class="treasure"><i></i> 宝箱</span><span class="rest"><i></i> 休息</span><span class="foe-legend">◆ 明雷</span></div></section><section id="objective" class="side-card objective"></section><section class="side-card journal-card"><div class="card-title"><span>${icon('moon',14)} 旅途回响</span><small>JOURNAL</small></div><div id="journal" class="journal" aria-live="polite" aria-relevant="additions text"></div></section><section class="side-card boon-card"><div class="card-title"><span>${icon('star',14)} 星之祝福</span><button class="ghost" data-action="inventory" aria-label="查看全部祝福">${icon('arrow',12)}</button></div><div id="boon-overview" class="boon-overview"></div></section><div class="side-foot">YOU ARE NOT LOST. NOT YET.</div></aside></div><footer id="game-foot" class="game-foot"></footer></main>`;
  renderer=new DungeonRenderer(document.getElementById('dungeon-canvas'),()=>run);
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
  for(const mob of visiblePacks(run)){
    const cx=pad+mob.x*tile+6,cy=pad+mob.y*tile+6;
    shapes+=`<g><title>${e(mob.name)} · ${mob.troop.length} 体 · ${mob.alert?'追踪':'巡逻'}</title><path d="M${cx},${cy-4.5} ${cx+4.5},${cy} ${cx},${cy+4.5} ${cx-4.5},${cy}Z" fill="${mob.kind==='elite'?'#ffbb65':'#f2869f'}" stroke="#301522" stroke-width=".8"/>${mob.alert?`<circle cx="${cx}" cy="${cy}" r="6" fill="none" stroke="#f2869f" stroke-width=".65"/>`:''}</g>`;
  }
  const px=pad+run.x*tile+6,py=pad+run.y*tile+6;
  shapes+=`<circle cx="${px}" cy="${py}" r="8" fill="#ded0ef22"/><g transform="translate(${px} ${py}) rotate(${run.dir*90})"><path d="M0-5 4.5 4 0 2-4.5 4Z" fill="#f7e7ff" stroke="#514569" stroke-width=".8"/></g>`;
  return `<svg viewBox="0 0 ${width} ${width}" role="img" aria-label="明雷探索地图；你在 ${run.x},${run.y}，面向${DIRECTIONS[run.dir].label}">${shapes}</svg>${large?`<div class="region-legend">${REGIONS.map(z=>`<span style="color:${z.color}">${z.code} ${z.name}</span>`).join('')}</div>`:''}`;
}
function exploration(){let seen=0,total=0;for(let y=0;y<run.dungeon.size;y++)for(let x=0;x<run.dungeon.size;x++)if(run.dungeon.tiles[y][x]===0){total++;if(run.dungeon.visited[y][x])seen++;}return Math.round(seen/total*100);}
function statusHtml(entity){return `<span class="status-list">${entity.guard?'<span class="status-badge" style="--status-color:#b9c6e1">防御</span>':''}${entity.barrier?`<span class="status-badge" style="--status-color:#9bddbf">护盾 ${entity.barrier}</span>`:''}${Object.entries(entity.status).filter(([id])=>STATUS[id]).map(([id,s])=>`<span class="status-badge" style="--status-color:${STATUS[id].color}" title="${STATUS[id].name}：${s.expiresRound!==undefined?'本回合有效':s.persistent?'生效后消耗':`剩余 ${s.turns} 次行动`}${STATUS[id].dispellable?' · 可驱散':''}">${STATUS[id].name}${s.turns<10?`<sup>${s.expiresRound!==undefined?'本轮':s.turns}</sup>`:''}</span>`).join('')}</span>`;}
function popHtml(entity){const effects=run.fx.filter(f=>f.id===entity.id);const damage=effects.filter(f=>f.type==='damage').reduce((s,f)=>s+f.amount,0),healing=effects.filter(f=>f.type==='heal').reduce((s,f)=>s+f.amount,0);return damage?`<span class="damage-pop">${damage}</span>`:healing?`<span class="damage-pop heal-number">+${healing}</span>`:'';}
function effectClass(entity){return run.fx.some(f=>f.id===entity.id&&f.type==='damage')?'damaged':run.fx.some(f=>f.id===entity.id&&f.type==='heal')?'healed':'';}
function eventLabel(event){if(!event)return '';return {chest:'打开遗落的宝箱',shrine:'在星灯下休息',fountain:'饮用月之泉',altar:'聆听神像的低语',elite:'挑战徘徊的精英',stairs:run.guardianDefeated?'走入下一层迷宫':run.floor===5?'面对蚀月的圣女':'挑战月门守卫'}[event.type];}
function eventIcon(type){return {chest:'chest',shrine:'star',fountain:'drop',altar:'moon',elite:'sword',stairs:'stairs'}[type]||'star';}
function renderExploreHud(){
  const floor=FLOORS[run.floor-1],event=currentEvent(run),dir=DIRECTIONS[run.dir],zone=regionAt(run.dungeon,run.x,run.y),threat=reinforcementInfo(run)[0];
  return `<div class="floor-heading"><div class="eyebrow">TACTICAL EXPLORATION / B${run.floor}</div><h2>${floor.name}</h2><div class="zone-badge" style="--zone:${zone.color}">${zone.code} · ${zone.name}</div></div><div class="floor-number"><strong>B${String(run.floor).padStart(2,'0')}</strong><span>OF 05 FLOORS</span></div><div class="compass"><span>${DIRECTIONS[(run.dir+3)%4].short}</span><span class="north">${icon('up',12)} ${dir.short}</span><span>${DIRECTIONS[(run.dir+1)%4].short}</span></div><span class="crosshair"></span><p class="explore-caption">${threat?`${threat.known?e(threat.name):'未知脚步'} · 路径距离 ${threat.distance} 格`:'观察红色明雷，选择开战的位置。'}</p><span class="position-label"><i></i> ${String(run.x).padStart(2,'0')} : ${String(run.y).padStart(2,'0')}</span>${event?`<button class="interaction" data-action="interact">${icon(eventIcon(event.type),18)}<span>${eventLabel(event)}</span><kbd>F</kbd></button>`:''}`;
}
function enemyImage(enemy){const key=`${enemy.kind}|${enemy.tint}`;if(!ENEMY_IMAGES.has(key))ENEMY_IMAGES.set(key,enemyUri(enemy.kind,enemy.tint));return ENEMY_IMAGES.get(key);}
function renderBattleHud(){
  const b=run.battle,alive=b.enemies.filter(p=>p.hp>0);
  if(!alive.some(p=>p.id===ui.selectedEnemy))ui.selectedEnemy=alive[0]?.id||null;
  const units=[...run.party,...b.enemies],order=[b.active,...b.queue.filter(id=>units.find(u=>u.id===id)?.hp>0)].slice(0,9);
  return `<div class="floor-heading"><div class="eyebrow">${['boss','guardian'].includes(b.type)?'PHASE / TRIGGER BATTLE':'VISIBLE ENCOUNTER'}</div><h2>${b.type==='boss'?'无月的终章':b.type==='guardian'?'月门的试炼':'与暗影交锋'}</h2><div class="jp">注意脚步声。战斗不会冻结迷宫。</div></div><div class="round-label"><small>ROUND</small><strong>${String(b.round).padStart(2,'0')}</strong></div><div class="floor-number"><strong>B${String(run.floor).padStart(2,'0')}</strong><span>TACTICAL DRPG</span></div><div class="enemy-line tactical-enemies" aria-label="敌方阵容，可横向滚动">${alive.map(enemy=>{
    const intent=INTENTS[intentOf(enemy)]||INTENTS.attack,weak={ice:'冰',fire:'火',light:'光'}[enemy.weak],target=run.party.find(p=>p.id===enemy.targetId);
    return `<button class="enemy-card ${enemy.boss?'boss':''} ${ui.selectedEnemy===enemy.id?'selected':''} ${effectClass(enemy)}" data-action="target" data-id="${enemy.id}" aria-pressed="${ui.selectedEnemy===enemy.id}" aria-label="选择${e(enemy.name)}，生命 ${enemy.hp}/${enemy.maxHp}，${intent.name}" title="${e(enemy.hint)}"><span class="enemy-intent">${icon(intent.icon,12)} ${intent.name}</span><span class="enemy-art"><img src="${enemyImage(enemy)}" alt="${e(enemy.name)}"></span><span class="enemy-weak">${enemy.ritualFor?'◆ 仪式侍从':enemy.role} · 弱${weak}</span><span class="enemy-caption">${ui.selectedEnemy===enemy.id?'<span class="target-arrow">▾</span>':''}<strong>${e(enemy.name)}</strong><span class="bar"><i style="width:${Math.max(0,enemy.hp/enemy.maxHp*100)}%"></i>${enemy.boss?bossWarnings(run).find(w=>w.enemyId===enemy.id)?.thresholds.map(t=>`<em class="hp-threshold ${t.done?'resolved':''}" style="left:${t.at*100}%" title="${Math.round(t.at*100)}% 血线预兆"></em>`).join(''):''}</span><span class="hp-number">${enemy.hp} / ${enemy.maxHp}</span>${statusHtml(enemy)}</span>${popHtml(enemy)}</button>`;
  }).join('')}</div><div class="battle-stage-bottom"><div class="turn-order"><span>行动顺序</span>${order.map((id,i)=>{const unit=units.find(p=>p.id===id);return unit?`<span class="turn-token ${unit.job?'':'foe'} ${i===0?'current':''}" title="${e(unit.name)}">${unit.job?e(unit.name[0]):icon('sword',12)}</span>`:'';}).join('')}</div>${b.chain>0?`<span class="chain-pill">技能联携 × ${b.chain+1}</span>`:'<span class="combat-note">点击敌人查看战术</span>'}</div>`;
}
function renderExploreCommands(){
  const event=currentEvent(run);
  return `<div class="explore-command"><div class="command-copy"><div class="eyebrow">ONE STEP. ONE WORLD TICK.</div><h3>${event?eventLabel(event):'先选战场，再选对手。'}</h3><p>转向与查看地图不耗时。移动或等待，怪物也前进一步。</p></div><div class="dpad" aria-label="迷宫方向控制"><button data-action="turn-left" aria-label="向左转">${icon('turnleft',17)}<small>A</small></button><button class="move-forward" data-action="forward" aria-label="向前移动">${icon('up',18)}<small>W</small></button><button data-action="turn-right" aria-label="向右转">${icon('turnright',17)}<small>D</small></button><button data-action="strafe-left" aria-label="向左平移">${icon('left',17)}<small>Q</small></button><button data-action="back" aria-label="向后移动">${icon('down',18)}<small>S</small></button><button data-action="strafe-right" aria-label="向右平移">${icon('right',17)}<small>E</small></button></div><div class="command-shortcuts"><button data-action="interact" ${!event?'disabled':''}>${icon(event?eventIcon(event.type):'star',20)}<span>调查 F</span></button><button data-action="wait" title="等待一拍：怪物行动，玩家原地不动">${icon('clock',20)}<span>等待 Space</span></button><button data-action="map">${icon('map',20)}<span>地图 M</span></button><button data-action="inventory">${icon('bag',20)}<span>行囊 I</span></button></div></div>`;
}
function renderBattleCommands(){
  const hero=activeHero(run);if(!hero)return '';
  const selected=run.battle.enemies.find(e=>e.id===ui.selectedEnemy),warnings=bossWarnings(run),incoming=reinforcementInfo(run);
  const omens=warnings.map(w=>{
    const enemy=run.battle.enemies.find(e=>e.id===w.enemyId),o=w.pending;
    if(!o)return `<div class="boss-brief"><b>${e(w.name)}</b><span>${e(w.trait)} 下一轮次预兆：R${w.nextTurn}${w.queued.length?` · 血线预兆待发：${e(w.queued.join(' / '))}`:''}</span></div>`;
    const count=o.counter==='hits'?`${o.hits} / ${o.required} 次命中`:o.counter==='adds'?`${run.battle.enemies.filter(a=>a.hp>0&&a.ritualFor===o.id).length} 体仪式侍从剩余`:o.counter==='dispel'?enemy.status.veil?'结界尚在':'结界已解除':o.counter==='seal'?(enemy.status.headbind||!enemy.status.veil?'已满足解除条件':'封头 / 驱散未完成'):run.party.filter(p=>p.hp>0).map(p=>`${p.name} ${p.guard||p.status.protect?'✓':'未防护'}`).join(' · ');
    const ready=o.counter==='hits'?o.hits>=o.required:o.counter==='adds'?!run.battle.enemies.some(a=>a.hp>0&&a.ritualFor===o.id):o.counter==='dispel'?!enemy.status.veil:o.counter==='seal'?!!enemy.status.headbind||!enemy.status.veil:run.party.filter(p=>p.hp>0).every(p=>p.guard||p.status.protect);
    return `<section class="omen-panel ${ready?'ready':''}" aria-label="首领预兆"><div><span class="omen-tag">${o.dueRound===run.battle.round?'本回合末':`R${o.dueRound} 回合末`} · ${e(o.source)}</span><strong>${e(o.name)}</strong><span class="omen-progress">${e(count)}${o.delayed?' · 已延期':''}</span></div><p>${e(counterText(o))}</p>${w.queued.length?`<small>后续血线预兆：${e(w.queued.join(' / '))}</small>`:''}</section>`;
  }).join('');
  const reinforcements=`<div class="reinforcement-strip ${incoming.some(p=>p.distance<=2)?'urgent':''}">${icon('map',15)} ${incoming.length?incoming.slice(0,3).map(p=>`${p.known?e(p.name):'未知脚步'}：最短 ${p.eta} 回合`).join('　/　'):'附近 8 格路径内无游荡增援'}<span>每个回合末移动 1 格</span></div>`;
  const intel=selected?`<div class="enemy-intel"><b>${e(selected.name)} · ${e(selected.role)}</b><span>${e(selected.hint)}</span>${selected.boss?'':`<small>当前意图：${INTENTS[intentOf(selected)]?.name||'攻击'}${['cover','bless','enemyHeal','summon','mirror','thorns'].includes(intentOf(selected))?'':` → ${['sweep','sweepMagic'].includes(intentOf(selected))?'全队':e(run.party.find(p=>p.id===selected.targetId)?.name||'队伍')}`}</small>`}</div>`:'';
  const title=`<div class="battle-command-header"><span class="turn-title">${icon('star',16)} ${e(hero.name)} 的回合 <small>${JOBS[hero.job].role}</small></span><button class="flee" data-action="flee" ${['guardian','boss'].includes(run.battle.type)||ui.busy?'disabled':''} title="首次 70% 撤退，失败后下次保证成功；首领战不可逃离。">${icon('exit',14)} 撤退</button></div>`;
  if(ui.pendingSkill)return `<div class="battle-command">${omens}${reinforcements}${title}<div class="target-prompt"><span>${icon('heart',22)} ${effectiveSkill(hero,ui.pendingSkill).name}：点击下方队友。</span><button class="secondary" data-action="cancel-target">取消</button></div></div>`;
  const ids=['attack','guard',...hero.skills];
  const buttons=ids.map((id,i)=>{
    const skill=effectiveSkill(hero,id),cost=skillCost(hero,id),rank=hero.ranks[id]||0,problem=skillProblem(run,hero,id);
    return `<button class="skill-button ${id==='attack'?'basic':''} ${hero.evolutions[id]?'evolved':''}" data-action="skill" data-skill="${id}" ${problem||ui.busy?'disabled':''} title="${e(problem||skill.desc)}" aria-label="${e(skill.name)}，消耗 ${cost} MP。${e(skill.desc)}"><span class="skill-top">${icon(skill.icon,18)}<span>${cost?`${cost} MP`:id==='attack'?'+1 MP':id==='guard'?'+3 MP':id==='bloodpact'?`+${8+rank*2} MP`:'0 MP'}</span></span><strong>${e(skill.name)}${rank?`<span class="rank">+${rank}</span>`:''}${hero.evolutions[id]?'<span class="awakened-mark">✦</span>':''}</strong><small class="description">${e(skill.desc)}</small><span class="hotkey">${i+1}</span></button>`;
  }).join('');
  return `<div class="battle-command">${omens}${reinforcements}${intel}${title}<div class="skill-grid tactical-skills">${buttons}</div><div class="supply-row"><small>队伍补给 · 使用消耗行动</small>${['tonic','ether','salt'].map(id=>`<button data-action="skill" data-skill="${id}" ${skillProblem(run,hero,id)||ui.busy?'disabled':''} title="${e(SKILLS[id].desc)}">${icon(SKILLS[id].icon,14)} ${SKILLS[id].name}<b>×${run.supplies[id]}</b></button>`).join('')}</div></div>`;
}
function renderParty(){
  const active=activeHero(run),pending=ui.pendingSkill?effectiveSkill(active,ui.pendingSkill):null;
  return run.party.map(p=>{const job=JOBS[p.job];return `<button class="party-card ${active?.id===p.id?'active':''} ${p.hp<=0?'downed':''} ${pending&&(p.hp>0||pending.kind==='revive')?'targetable':''} ${effectClass(p)}" style="--job-color:${job.color}" data-action="party" data-id="${p.id}" aria-label="${e(p.name)}，${job.name}，生命 ${p.hp}/${p.maxHp}，MP ${p.mp}/${p.maxMp}${pending?'，点击选择为技能目标':'，查看角色信息'}"><span class="party-face"><img src="${PORTRAITS[p.job]}" alt=""></span><span class="party-info"><span class="party-name">${e(p.name)}<small>${active?.id===p.id?'YOUR TURN':job.jp}</small></span><span class="party-role">Lv.${run.level}　${job.name}</span><span class="bar-line"><span class="label">HP</span><span class="bar ${p.hp/p.maxHp<.3?'low':''}"><i style="width:${p.hp/p.maxHp*100}%"></i></span><span class="value">${p.hp}/${p.maxHp}</span></span><span class="bar-line"><span class="label">MP</span><span class="bar mp"><i style="width:${p.mp/p.maxMp*100}%"></i></span><span class="value">${p.mp}/${p.maxMp}</span></span><span class="party-weapon">${icon('sword',10)} ${e(p.weapon.name)}</span>${statusHtml(p)}</span>${popHtml(p)}</button>`;}).join('');
}
function boonChips(limit=Infinity){const entries=Object.entries(run.boons);if(!entries.length)return '<span class="tiny muted">未获得祝福。旅途才刚刚开始。</span>';return entries.slice(0,limit).map(([id,n])=>{const boon=BOONS.find(x=>x.id===id);return boon?`<span class="boon-chip" title="${e(boon.desc)} 已获取 ${n} 次">${icon(boon.icon,12)} ${boon.name}${n>1?`<b>×${n}</b>`:''}</span>`:'';}).join('')+(entries.length>limit?`<span class="boon-chip">+${entries.length-limit}</span>`:'');}
function updateGame(){
  if(!run)return;
  const battle=run.phase==='battle';
  document.getElementById('top-stats').innerHTML=`<span class="level">${icon('star',15)} LV.<b>${run.level}</b></span><span class="gold">${icon('drop',14)} <b>${run.gold}</b> 星砂</span><span class="steps">${run.steps} 步</span><span class="seed">SEED ${e(run.seed)}</span>`;
  ROOT.classList.toggle('comfort-mode',run.comfort!==false);document.getElementById('stage-hud').innerHTML=battle?renderBattleHud():renderExploreHud();
  const incoming=reinforcementInfo(run),event=currentEvent(run);
  document.getElementById('stage-footer').innerHTML=battle?`<span class="path-label">${icon('sword',13)} 战斗 · 回合末预兆与增援</span><span class="combat-note">${ui.pendingSkill?'选择我方目标':'选择目标查看战术说明'}</span>`:`<span class="path-label">${icon('moon',13)} ${run.guardianDefeated?'月门已开启':event?'发现可调查事物':'明雷探索'}</span><span class="combat-note">${incoming[0]?`最近脚步：${incoming[0].distance} 格`:'未听见附近脚步'} · 世界节拍 ${run.dungeon.elapsed}</span>`;
  document.getElementById('command-panel').innerHTML=battle?renderBattleCommands():renderExploreCommands();
  const partyEl=document.getElementById('party-strip');partyEl.style.setProperty('--party-size',run.party.length);partyEl.innerHTML=renderParty();
  document.getElementById('minimap').innerHTML=mapSvg();document.getElementById('exploration-percent').textContent=`${exploration()}%`;
  document.getElementById('objective').innerHTML=`<div class="eyebrow">${run.guardianDefeated?'GATE OPENED':'CURRENT OBJECTIVE'}</div><p>${run.guardianDefeated?'前往月门，深入下一层。':run.floor===5?'找到王座，结束这场月蚀。':'找到月门，击败本层守卫。'}</p><small>${run.guardianDefeated?'回到地图上的绿色月门标记。':'附近敌人会在战斗中靠近；不要在包围圈内开战。'}</small>`;
  const journal=document.getElementById('journal');journal.innerHTML=run.log.slice(-9).map(l=>`<p class="log-entry ${['special','heal','loot','danger','enemy','player','muted','battle'].includes(l.tone)?l.tone:''}">${e(l.text)}</p>`).join('');journal.scrollTop=journal.scrollHeight;
  document.getElementById('boon-overview').innerHTML=boonChips(5);
  document.getElementById('game-foot').innerHTML=`<span>${run.solo?'独行誓约生效 · ':''}本局自动保存 · ${run.battles} 次战斗</span><span class="keyboard-tip">WASD 移动转向　Q/E 平移　Space 等待　M 地图</span><span class="xp-track">LV.${run.level}<i><b style="width:${run.xp/run.nextXp*100}%"></b></i>${run.xp}/${run.nextXp}</span>`;
  renderModal();
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
    const description=reward.type==='learn'?`新增一个可用指令。${art.desc}`:reward.type==='evolve'?EVOLUTIONS[art.id].desc:`${['physical','magic','heal','revive','sanctuary'].includes(art.kind)?`伤害 / 治疗效能 ${100+rank*12}%。`:art.kind==='bloodpact'?`回蓝提高至 ${8+rank*2} MP。`:`MP 消耗减少 ${rank}（最低 1）。`}${EVOLUTIONS[art.id]&&!h.evolutions[art.id]?'达到 +1 后，奖励池加入此技能的机制觉醒。':'不增加状态持续时间。'}`;
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
  const data={shrine:{title:'一盏尚未熄灭的星灯',en:'A MOMENT OF SOLACE',text:'灯火微微摇曳。这里似乎没有黑暗能够靠近。',choices:[['rest','在此休息','全队恢复 45% 生命与 50% MP，倒下的同伴重新醒来。','免费 · 仅一次','heart']]},fountain:{title:'倒映着满月的泉水',en:'THE MOONWELL',text:'抬头是漆黑的穹顶。低头，却是一轮完整的月亮。',choices:[['drink','饮下月之泉','全队 MP 完全恢复，并恢复 18% 生命。','免费 · 仅一次','drop']]},altar:{title:'无名神像的低语',en:'A PRICE FOR A PROMISE',text:'神像没有眼睛，却似乎一直注视着你。它需要一份交换。',choices:[['offer','献上星砂','获得一次祝福选择，武器奖励保证为传说品质。','35 星砂','star'],['blood','以鲜血立誓','全队失去生命上限的 20%（最低剩余 1），换取一次祝福选择。','生命代价','heart']]}}[type];
  const choices=data.choices.map(([choice,title,desc,cost,ico])=>`<button class="event-choice" data-action="event" data-choice="${choice}" ${choice==='offer'&&run.gold<35?'disabled':''}>${icon(ico,23)}<span class="choice-copy"><strong>${title}</strong><small>${desc}</small></span><span class="cost">${cost}</span></button>`).join('');
  return dialog(data.title,data.en,data.text,`<div class="event-art"><img src="${svgUri(objectSvg(type,'#c2b0e8'))}" alt="${data.title}"></div><div class="choice-stack">${choices}<button class="ghost" data-action="event" data-choice="leave">暂时离开 ${icon('arrow',14)}</button></div>`,{narrow:true,closable:false});
}
function endModal(){const win=run.ending==='victory';return dialog(win?'终有黎明。':'星灯，暂时熄灭了。',win?'THE END OF THE ECLIPSE':'EVERY END IS A BEGINNING',win?'你走过没有月亮的夜晚，也把星光带到了故事的尽头。':'迷宫会改变形状，而你会带着新的想法，再一次出发。',`<div class="result-icon">${win?'☼':'☾'}</div><div class="result-party">${run.party.map(p=>`<img src="${PORTRAITS[p.job]}" alt="${e(p.name)}">`).join('')}</div><div class="result-stats"><span><strong>B${run.floor}</strong><small>最深抵达</small></span><span><strong>${run.level}</strong><small>队伍等级</small></span><span><strong>${run.battles}</strong><small>战斗胜利</small></span><span><strong>${run.steps}</strong><small>探索步数</small></span></div><div class="center-actions"><button class="primary" data-action="again">重新点亮星灯 ${icon('arrow',18)}</button><button class="secondary" data-action="object-motion">${icon('star',18)} 物件动画：${run.objectMotion===true?'开启（系统减弱动态优先）':'关闭（静态舒适）'}</button><button class="secondary" data-action="return-title">回到序章</button></div><p class="modal-hint">SEED ${e(run.seed)} · 新一局将清空所有等级、武器、技能强化与祝福。</p>`,{closable:false,extra:win?'result-victory':''});}
function helpModal(){return dialog('这一次，带着战术前行','FIELD GUIDE / v0.2','战斗难在选择、资源与地形，不在猜测隐藏规则。',`<div class="help-grid"><section class="help-block"><h3>01 / 明雷与地形</h3><p>W/S 前后，A/D 转向，Q/E 平移，Space 等待，F 调查，M 地图。红色菱形是游荡小队，金色是强敌。每次成功移动或等待，它们也移动一格。转向、撞墙、查看地图不耗时。怪物只显示在已探索区域；脚步提示提供附近的最短路径距离。</p></section><section class="help-block"><h3>02 / 增援时钟</h3><p>每个战斗回合末，路径 8 格以内的游荡小队移动一格。来到战斗格子后加入，下一轮行动；场上最多 6 个敌人，满员时其他小队原地等待。击杀结束的最后一个未完整回合也结算一次移动。不要背靠多个敌人开战。</p></section><section class="help-block"><h3>03 / Boss 预兆</h3><p>首领有回合触发与血线触发。预兆会在回合开始给出完整应对窗口，在指定回合末发动。驱散仪式结界、封头、击杀仪式侍从或累计命中可以取消对应招式。无法取消时用防御和壁垒止损。血线有一次相位锁，不能一击跳过；最后 1 HP 受未结算的血线预兆保护。</p></section><section class="help-block"><h3>04 / 职业与成长</h3><p>每职业初始只有两个专精技能。奖励池可习得 3 个高阶技能；部分从第 2 / 3 层开放。初始技能熟练度 +1 后可抽取机制觉醒，带来群体化、驱散、连击、传播、溢出护盾等变化。熟练度最多 +2，祝福有层数上限。巫女没有免费攻击治疗，忍者和术士没有自疗。</p></section><section class="help-block"><h3>05 / 资源与操作</h3><p>按 1 普攻、2 防御、3～7 技能，也可点击。普攻只回 1 MP，防御回 3 MP 且承伤 -65%。有限急救药、以太滴、破咒盐为全队共享，使用消耗一次行动。每次下层补充 2 药、1 以太、2 盐，有携带上限。守护可叠加防御，骑士与巫女的时机分工很重要。</p></section><section class="help-block"><h3>06 / 反制与舒适视角</h3><p>封头压制法术、治疗与强化；封腕压制重击、猎杀等动作；解除后 2 回合抗性，不能无限续封。每个预兆只能延期一次。首领从第 13 回合起每轮叠加暴走，不能无限防御耗蓝。菜单的舒适视角默认开启：即时转向、固定镜头、关闭闪屏与漂浮粒子。</p></section></div><div class="help-note">仍是 1～3 人、五层、武器单装备槽、每局从零。每把武器只有一个固有效果。v0.1 存档与新规则不兼容，旧存档保留但不会当作新局读取。单人是高风险挑战，不保证所有编队与种子都能通关。</div>`,{wide:true});}
function classesModal(){return dialog('六种星火，六种答案','JOB COMPENDIUM','明确分工，保留弱点。独行需要有限补给与局内技能弥补短板。',`<div class="choice-stack">${Object.values(JOBS).map(j=>`<button class="event-choice" data-action="class-detail" data-job="${j.id}"><span style="height:48px;width:48px;overflow:hidden;position:relative;border-radius:7px;background:${j.color}11;flex-shrink:0"><img src="${PORTRAITS[j.id]}" style="width:80px;max-width:none;position:absolute;left:-16px;top:-18px" alt=""></span><span class="choice-copy"><strong style="color:${j.color}">${j.name} · ${j.person}</strong><small>${j.role} / ${j.passiveDesc}</small></span>${icon('right',16)}</button>`).join('')}</div>`);}
function heroModal(id,isClass=false){
  const hero=isClass?null:run.party.find(p=>p.id===id),job=JOBS[isClass?id:hero.job],stats=hero?heroStats(hero):job;
  const header=`<div class="hero-detail"><div class="hero-detail-art"><img src="${PORTRAITS[job.id]}" alt="${job.person}"></div><div class="hero-detail-copy"><div class="eyebrow">${job.roman} / ${job.jp}</div><h2>${job.person}</h2><div class="job-title">${job.name} · ${job.role}</div><p>${job.synopsis}</p><div class="hero-stats">${[['生命',hero?`${hero.hp}/${hero.maxHp}`:job.hp],['MP',hero?`${hero.mp}/${hero.maxMp}`:job.mp],['攻击',Math.floor(stats.atk)],['魔力',Math.floor(stats.mag)],['防御',stats.def],['速度',Math.floor(stats.spd)]].map(([label,value])=>`<span class="hero-stat">${label}<b>${value}</b></span>`).join('')}</div><div class="passive"><b>职业被动 · ${job.passive}</b>${job.passiveDesc}</div></div></div>`;
  const skills=[...job.skills,...job.advanced].map(id=>{const s=hero?effectiveSkill(hero,id):SKILLS[id],rank=hero?.ranks[id]||0;const learned=hero?hero.skills.includes(id):job.skills.includes(id);return `<div class="skill-detail ${!learned?'locked-art':''}">${icon(s.icon,21)}<span><strong>${s.name}${!learned?` <small>未习得 · B${SKILLS[id].minFloor||1} 起</small>`:hero?.evolutions[id]?'<small class="gold"> ✦觉醒</small>':''}${rank?` <span class="gold">+${rank}</span>`:''}</strong><p>${s.desc}${rank?` 当前强化 +${rank}。`:''}</p></span><span class="mp">${hero?skillCost(hero,id):s.cost} MP</span></div>`;}).join('');
  return `<div class="modal-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1"><h2 id="dialog-title" class="sr-only">${job.person} 的职业信息</h2><button class="icon-button modal-close" data-action="close" aria-label="关闭">${icon('close',16)}</button>${header}<div class="divider"></div>${skills}${hero?`<div class="help-note">当前武器：${e(hero.weapon.name)}<br>「${e(hero.weapon.effectName)}」${e(hero.weapon.desc)}</div>`:'<p class="modal-hint">以上为职业基础数值，不含起始武器和独行誓约加成。</p>'}</section></div>`;
}
function weaponPanel(w,owner=null){const r=RARITIES[w.rarity];return `<${owner?'div':'button'} class="inventory-weapon" ${!owner?`data-action="choose-bag-weapon" data-uid="${e(w.uid)}" ${run.phase!=='explore'?'disabled':''}`:''}><span class="owner"><span style="color:${r.color}">${r.name} · ${e(w.type)}</span>${owner?`<b>${e(owner)} / 已装备</b>`:'<b>备用武器</b>'}</span><h3>${e(w.name)}</h3><span class="weapon-stats"><span>攻击 +${w.atk}</span><span>魔力 +${w.mag}</span></span><div class="weapon-effect"><b>固有效果 · ${e(w.effectName)}</b>${e(w.desc)}</div>${!owner?`<p>${run.phase==='explore'?'点击选择装备者':'战斗中不可更换武器'}</p>`:''}</${owner?'div':'button'}>`;}
function inventoryModal(){return dialog('沿途拾起的星光','THE TRAVELER’S INVENTORY',`只有武器，没有护甲或饰品槽。现在拥有 ${run.gold} 星砂。`,`<div class="help-note">共享补给：急救药 ×${run.supplies.tonic} / 以太滴 ×${run.supplies.ether} / 破咒盐 ×${run.supplies.salt}。战斗中使用消耗行动。</div><div class="inventory-heading">当前武器 <small>每人只装备一把</small></div><div class="inventory-grid">${run.party.map(p=>weaponPanel(p.weapon,p.name)).join('')}</div><div class="inventory-heading">行囊中的武器 <small>${run.inventory.length} 把</small></div><div class="inventory-grid">${run.inventory.length?run.inventory.map(w=>weaponPanel(w)).join(''):'<p class="empty-note">旧武器会在更换装备后放入这里。</p>'}</div><div class="inventory-heading">本局祝福 <small>仅在这一次冒险中生效</small></div><div class="all-boons">${boonChips()}</div><div class="inventory-heading">技能觉醒</div>${run.party.map(p=>`<p class="small muted" style="margin-bottom:8px"><span style="color:${JOBS[p.job].color}">${e(p.name)}</span>　${p.skills.map(id=>`${effectiveSkill(p,id).name}${p.evolutions[id]?' ✦':p.ranks[id]?` +${p.ranks[id]}`:''}`).join(' / ')}</p>`).join('')}`,{wide:true});}
function menuModal(){return dialog('星灯仍在这里','PAUSE & REFLECT',`SEED ${e(run.seed)} · 第 ${run.floor} 层 · 本局已自动保存`,`<div class="menu-choices"><button class="secondary" data-action="close">${icon('arrow',18)} 继续探索</button><button class="secondary" data-action="inventory">${icon('bag',18)} 查看装备与祝福</button><button class="secondary" data-action="help">${icon('help',18)} 查看冒险指南</button><button class="secondary" data-action="comfort">${icon('eye',18)} 舒适视角：${run.comfort!==false?'开启（即时转向 / 无闪屏）':'关闭（平滑移动）'}</button><button class="secondary" data-action="object-motion">${icon('star',18)} 物件动画：${run.objectMotion===true?'开启（系统减弱动态优先）':'关闭（静态舒适）'}</button><button class="secondary" data-action="return-title">${icon('moon',18)} 返回序章（保留本局存档）</button><button class="secondary danger-text" data-action="restart-confirm">${icon('exit',18)} 放弃本局，重新编队</button></div>`,{narrow:true});}
function renderModal(){
  let html='',key='';
  if(run?.phase==='reward'){html=rewardModal();key=`reward-${run.rewards.map(r=>r.id||r.skillId||r.weapon?.uid).join('-')}-${ui.rewardIndex}`;}
  else if(run?.phase==='event'){html=eventModal();key=`event-${run.event.key}`;}
  else if(run?.phase==='ended'){html=endModal();key=`end-${run.ending}`;}
  else if(ui.modal){key=`${ui.modal}-${ui.modalData||''}`;
    if(ui.modal==='help')html=helpModal();
    else if(ui.modal==='classes')html=classesModal();
    else if(ui.modal==='class')html=heroModal(ui.modalData,true);
    else if(ui.modal==='hero'&&run)html=heroModal(ui.modalData);
    else if(ui.modal==='inventory'&&run)html=inventoryModal();
    else if(ui.modal==='map'&&run)html=dialog('把走过的路，记在心里。','MAP / '+FLOORS[run.floor-1].jp,`已探索 ${exploration()}% · 坐标 ${run.x}, ${run.y} · 面向${DIRECTIONS[run.dir].label}`,`<div class="large-map">${mapSvg(true)}</div><p class="modal-hint">红菱形：游荡小队　金菱形：强敌　圆环：正在追踪<br>Ⅰ～Ⅳ 为区域地标。已探索区域内的明雷位置实时随回合更新；未知区域仍保留迷雾。</p>`,{narrow:true});
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
  MODAL.innerHTML=html;modalKey=key;MODAL.querySelector('.dialog')?.focus({preventScroll:true});
}
function beginRun(){
  run=createRun(ui.selection,ui.seedDraft.trim()||seedCode());ui.modal=null;ui.modalData=null;ui.rewardIndex=null;ui.pendingSkill=null;ui.selectedEnemy=null;ui.busy=false;modalKey='';
  save();mountGame();AUDIO.sfx('magic');
}
function goTitle({clear=false}={}){
  if(run)ui.selection=run.party.map(p=>p.job);
  if(clear){try{localStorage.removeItem(SAVE_KEY);}catch{}}else save();
  run=null;ui.modal=null;ui.modalData=null;ui.pendingSkill=null;ui.rewardIndex=null;ui.busy=false;ui.seedDraft='';modalKey='';renderLanding();
}
function mutateExplore(action){
  if(!run||run.phase!=='explore'||ui.modal||ui.busy)return;
  const before=run.phase;
  let ok;
  if(action==='turn-left')ok=turn(run,-1);
  else if(action==='turn-right')ok=turn(run,1);
  else if(action==='interact')ok=interact(run);
  else if(action==='wait')ok=waitTurn(run);
  else ok=move(run,{'forward':'forward','back':'back','strafe-left':'left','strafe-right':'right'}[action]);
  if(!ok){if(action==='interact')toast('这里没有可以调查的事物。');else if(!action.startsWith('turn'))toast('前方是坚实的石壁。');return;}
  if(run.phase==='battle'&&before!=='battle'){AUDIO.sfx('battle');ui.selectedEnemy=null;ui.pendingSkill=null;}
  else if(run.phase==='reward')AUDIO.sfx('magic');else AUDIO.sfx('move');
  save();updateGame();
}
function useSkill(id,target=null){
  if(!run||run.phase!=='battle'||ui.busy||ui.modal)return;
  const hero=activeHero(run);if(!hero)return;const skill=effectiveSkill(hero,id);
  if(id!=='escape'&&skill?.target==='ally'&&!target){ui.pendingSkill=id;updateGame();toast('请选择下方的一名队友。');return;}
  const targetId=target||ui.selectedEnemy||run.battle.enemies.find(p=>p.hp>0)?.id;
  const result=act(run,id,targetId);
  if(!result.ok){toast(result.error);return;}
  ui.pendingSkill=null;ui.busy=true;
  AUDIO.sfx(run.phase==='reward'||run.ending==='victory'?'victory':['magic','heal','aegis','revive','haste','rewind'].includes(skill?.kind)?'magic':'attack');
  renderer?.pulse();save();updateGame();
  const current=run;
  setTimeout(()=>{if(run!==current)return;ui.busy=false;run.fx=[];if(ui.screen==='game')updateGame();},420);
}
function handleAction(button){
  const action=button.dataset.action;
  if(button.disabled)return;
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
    AUDIO.toggle().then(enabled=>{if(ui.screen==='landing')renderLanding();else document.getElementById('sound-button').innerHTML=soundButton();toast(enabled?'已开启原创合成音乐与音效。':'已关闭声音。');}).catch(()=>toast('当前浏览器未允许播放音频。'));return;
  }
  if(action==='close'){closeModal();return;}
  if(action==='help'){setModal('help');return;}
  if(action==='classes'){setModal('classes');return;}
  if(action==='class-detail'){setModal('class',button.dataset.job);return;}
  if(action==='map'||action==='inventory'||action==='menu'){if(run)setModal(action);return;}
  if(action==='return-title'){goTitle();return;}
  if(action==='again'){goTitle({clear:true});return;}
  if(action==='restart-confirm'){setModal('confirm-abandon');return;}
  if(action==='abandon'){goTitle({clear:true});return;}
  if(['forward','back','turn-left','turn-right','strafe-left','strafe-right','interact','wait'].includes(action)){mutateExplore(action);return;}
  if(!run)return;
  if(action==='object-motion'){run.objectMotion=run.objectMotion!==true;modalKey='';save();updateGame();return;}
  if(action==='comfort'){run.comfort=run.comfort===false;modalKey='';save();updateGame();return;}
  if(action==='target'){ui.selectedEnemy=button.dataset.id;AUDIO.sfx('select');updateGame();return;}
  if(action==='skill'){useSkill(button.dataset.skill);return;}
  if(action==='flee'){useSkill('escape');return;}
  if(action==='cancel-target'){ui.pendingSkill=null;updateGame();return;}
  if(action==='party'){
    if(ui.pendingSkill){useSkill(ui.pendingSkill,button.dataset.id);return;}
    setModal('hero',button.dataset.id);return;
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
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
  if(event.key==='Escape'){if(MODAL.innerHTML)closeModal();else if(ui.pendingSkill){ui.pendingSkill=null;updateGame();}else if(run)setModal('menu');return;}
  if(MODAL.innerHTML||!run)return;
  const key=event.key.toLowerCase();
  if(key==='m'){event.preventDefault();setModal('map');return;}
  if(key==='i'){event.preventDefault();setModal('inventory');return;}
  if(key==='h'){event.preventDefault();setModal('help');return;}
  if(run.phase==='battle'&&/^[1-9]$/.test(key)){event.preventDefault();const p=activeHero(run);const id=p?['attack','guard',...p.skills][Number(key)-1]:null;if(id)useSkill(id);return;}
  if(run.phase!=='explore')return;
  const action={w:'forward',arrowup:'forward',s:'back',arrowdown:'back',a:'turn-left',arrowleft:'turn-left',d:'turn-right',arrowright:'turn-right',q:'strafe-left',e:'strafe-right',f:'interact',enter:'interact',' ':'wait'}[key];
  if(action){event.preventDefault();const now=performance.now();if(now-ui.lastMove<140&&event.repeat)return;ui.lastMove=now;mutateExplore(action);}
});
window.addEventListener('beforeunload',save);
window.addEventListener('pagehide',save);
document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
renderLanding();
