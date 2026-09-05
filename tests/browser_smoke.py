"""Optional browser tests. Requires Python Playwright and a local Chromium binary.
Loads the generated, self-contained HTML into an in-memory document. Web Storage
is replaced with a deterministic in-memory test double; no production debug hooks.
Run: CHROMIUM_PATH=/usr/bin/chromium python tests/browser_smoke.py
"""
from pathlib import Path
import json
import os
import subprocess
from collections import deque
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results'
SHOTS = ROOT / 'docs' / 'screenshots'
OUT.mkdir(exist_ok=True)
SHOTS.mkdir(exist_ok=True)
HTML = (ROOT / 'dist' / 'index.html').read_text()
KEY = 'eclipse-labyrinth.run.v3'
checks = []
errors = []
requests = []

def check(name, condition):
    assert condition, name
    checks.append(name)
    print(name,flush=True)

def node_state(code):
    prefix = "import * as e from './src/engine.js'; import {JOBS,SKILLS} from './src/data.js';"
    text = subprocess.check_output(['node', '--input-type=module', '-e', prefix + code], cwd=ROOT, text=True)
    return json.loads(text)

def state(page):
    return page.evaluate('(k)=>JSON.parse(localStorage.getItem(k))', KEY)

def setup(browser, viewport, saved=None):
    page = browser.new_page(viewport=viewport, device_scale_factor=1, reduced_motion='reduce')
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: requests.append(request.url))
    page.evaluate('''initial => {
      const values = Object.create(null);
      for(const [k,v] of Object.entries(initial)) values[k]=String(v);
      const storage = {getItem(k){return values[k] ?? null;},
        setItem(k,v){values[k]=String(v);},removeItem(k){delete values[k];},
        clear(){for(const k of Object.keys(values))delete values[k];},
        key(i){return Object.keys(values)[i] ?? null;},get length(){return Object.keys(values).length;}};
      Object.defineProperty(window, 'localStorage', {value:storage, configurable:true});
    }''', {KEY: json.dumps(saved, ensure_ascii=False)} if saved else {})
    page.set_content(HTML, wait_until='load')
    page.wait_for_timeout(180)
    return page

def no_overflow(page, name):
    check(name, page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))

def act(page, skill, target=None):
    page.locator(f'[data-action="skill"][data-skill="{skill}"]').click()
    if target:
        page.locator(f'[data-action="party"][data-id="{target}"]').click()
    # Wait for presentation completion rather than race a disappearing Skip control.
    # Escape opens the pause menu when playback finishes before the key event.
    # Dedicated battle_browser tests exercise actual Skip button behavior.
    page.locator('#combat-skip').wait_for(state='hidden', timeout=15000)

def shortest_path(run, destination):
    start = (run['x'], run['y'])
    q = deque([start]); prev = {start: None}
    while q:
        p = q.popleft()
        if p == destination:
            out = []
            while prev[p] is not None:
                out.append(p);p=prev[p]
            return out[::-1]
        for dx,dy in [(0,-1),(1,0),(0,1),(-1,0)]:
            n=(p[0]+dx,p[1]+dy)
            if n not in prev and run['dungeon']['tiles'][n[1]][n[0]] == 0:
                prev[n]=p;q.append(n)
    raise AssertionError('No route to early chest')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    page=setup(browser, {'width':1440,'height':1100})
    check('Six selectable jobs', page.locator('.job-card').count()==6)
    check('Default party has three jobs', page.locator('.job-card.selected').count()==3)
    no_overflow(page,'Desktop title fits viewport')
    page.screenshot(path=str(SHOTS/'title-desktop.png'),full_page=True)
    # Empty party is disabled; single-character and maximum-party constraints.
    for job in ['knight','mage','shrine']:
        page.locator(f'[data-action="job"][data-job="{job}"]').click()
    check('Empty party cannot start', page.locator('[data-action="start"]').is_disabled())
    page.locator('[data-action="job"][data-job="reaver"]').click()
    check('Solo oath shown', '独行者的誓约' in page.locator('.party-description').inner_text())
    page.locator('[data-action="job"][data-job="reaver"]').click()
    for job in ['knight','mage','shrine']:
        page.locator(f'[data-action="job"][data-job="{job}"]').click()
    page.locator('[data-action="job"][data-job="ninja"]').click()
    check('Fourth job is rejected',page.locator('.job-card.selected').count()==3)
    page.locator('#seed-input').fill('FIRST-LIGHT')
    page.locator('[data-action="start"]').click()
    check('Exploration mounted',page.locator('#dungeon-canvas').count()==1)
    check('Seed stored',state(page)['seed']=='FIRST-LIGHT')
    check('Three character cards',page.locator('.party-card').count()==3)
    page.keyboard.press('m')
    check('Map key opens dialog',page.locator('.large-map').count()==1)
    check('Dialog makes background inert',page.locator('#app').get_attribute('inert') is not None)
    page.keyboard.press('Escape')
    check('Escape closes optional dialog',page.locator('.dialog').count()==0)
    page.keyboard.press('i')
    check('Inventory contains only weapon equipment',page.locator('.inventory-weapon').count()==3)
    page.keyboard.press('Escape')
    r=state(page)
    chest=min((tuple(map(int,k.split(','))) for k,ev in r['dungeon']['events'].items() if ev['type']=='chest'),key=lambda xy:len(shortest_path(r,xy)))
    route=shortest_path(r,chest)
    check('Early chest within four steps',len(route)<=4)
    for nx,ny in route:
        r=state(page);dx,dy=nx-r['x'],ny-r['y'];direction=[(0,-1),(1,0),(0,1),(-1,0)].index((dx,dy))
        turns=(direction-r['dir'])%4
        for _ in range(turns):page.keyboard.press('d')
        page.keyboard.press('w')
    check('Movement reaches chest', (state(page)['x'],state(page)['y'])==chest)
    page.wait_for_timeout(650)
    page.screenshot(path=str(SHOTS/'exploration-desktop.png'),full_page=True)
    page.keyboard.press('f')
    check('Investigating chest opens three choices',page.locator('.reward-card').count()==3)
    rewardstate=state(page)
    weapon_index=next(i for i,reward in enumerate(rewardstate['rewards']) if reward['type']=='weapon')
    page.locator(f'[data-action="reward"][data-index="{weapon_index}"]').click()
    check('Weapon choice asks recipient',page.locator('[data-action="equip-reward"]').count()==3)
    page.locator('[data-action="equip-reward"]').first.click()
    check('Reward returns to exploration',state(page)['phase']=='explore')
    check('Old weapon goes to inventory',len(state(page)['inventory'])==1)
    page.keyboard.press('i')
    page.locator('[data-action="choose-bag-weapon"]').first.click()
    page.locator('[data-action="equip-bag"]').first.click()
    check('Inventory weapon can be swapped',page.locator('.inventory-weapon').count()==4)
    page.keyboard.press('Escape')
    check('Comfort mode defaults on',state(page)['comfort'] is True)
    page.locator('[data-action="menu"]').click()
    page.locator('[data-action="comfort"]').click()
    check('Comfort toggle persists',state(page)['comfort'] is False)
    page.locator('[data-action="comfort"]').click()
    page.keyboard.press('Escape')
    before=state(page)['dungeon']['elapsed']
    page.keyboard.press('Space')
    check('Wait advances one world tick',state(page)['dungeon']['elapsed']==before+1)
    saved=state(page)
    page.locator('[data-action="menu"]').click()
    page.locator('[data-action="return-title"]').click()
    check('Return title offers resume',page.locator('[data-action="resume"]').count()==1)
    page.locator('[data-action="resume"]').click()
    check('Resume retains seed and coordinates',all(state(page)[k]==saved[k] for k in ['seed','x','y','rng','inventory']))
    page.locator('[data-action="menu"]').click();page.locator('[data-action="return-title"]').click()
    page.locator('[data-action="start"]').click()
    check('New run requires overwrite confirmation',page.locator('[data-action="confirm-start"]').count()==1)
    page.locator('[data-action="confirm-start"]').click()
    check('New run clears inventory and progress',state(page)['level']==1 and state(page)['inventory']==[] and state(page)['steps']==0)
    page.close()

    # Real, unmodified first encounter. Fight it using the production UI.
    battle=node_state("const r=e.createRun(['knight','mage','shrine'],'FIRST-LIGHT');r.dungeon.packs=[];e.startBattle(r);console.log(e.serializeRun(r));")
    page=setup(browser,{'width':1440,'height':1100},battle)
    page.locator('[data-action="resume"]').click()
    check('Saved battle resumes with active actor',page.locator('.tactical-skills .skill-button').count()==2)
    check('Enemy intent visible',page.locator('.enemy-intent').count()>0)
    no_overflow(page,'Desktop battle fits viewport')
    page.wait_for_timeout(600)
    page.screenshot(path=str(SHOTS/'battle-desktop.png'),full_page=True)
    for step in range(30):
        r=state(page)
        if r['phase']!='battle':break
        for idx,h in enumerate(r['party']):
            r=state(page)
            if r['phase']!='battle':break
            if r['party'][idx]['hp']<=0:continue
            page.locator(f'[data-action="select-hero"][data-id="{h["id"]}"]').click()
            for skill in h['skills']:
                if state(page)['phase']!='battle':break
                button=page.locator(f'[data-skill="{skill}"]')
                if button.is_disabled():continue
                if skill=='mend':
                    injured=min((p for p in state(page)['party'] if p['hp']>0),key=lambda p:p['hp']/p['maxHp'])
                    if injured['hp']/injured['maxHp']>.65:continue
                    act(page,skill,injured['id'])
                else:act(page,skill)
        if state(page)['phase']=='battle':act(page,'attack')
    check('UI combat reaches victory without boosted stats',state(page)['phase']=='reward')
    check('Victory counts battle',state(page)['battles']==1)
    page.locator('[data-action="reward"]').first.click()
    if page.locator('[data-action="equip-reward"]').count():page.locator('[data-action="equip-reward"]').first.click()
    check('Battle reward fully resolves',state(page)['phase']=='explore')
    page.close()

    # Ally-target selection and cancellation on a real time-mage encounter.
    chrono=node_state("const r=e.createRun(['chrono'],'CLOCK-TEST');e.startBattle(r);console.log(e.serializeRun(r));")
    page=setup(browser,{'width':1440,'height':1000},chrono);page.locator('[data-action="resume"]').click()
    page.locator('[data-skill="haste"]').click()
    check('Ally skill enters target selection',page.locator('.target-prompt').count()==1)
    page.locator('[data-action="cancel-target"]').click()
    check('Ally selection cancellation consumes no action',state(page)['rng']==chrono['rng'])
    act(page,'haste','hero-0')
    check('Ally skill applies through party click',state(page)['party'][0]['cooldowns']['haste']==5 and state(page)['battle']['round']==1)
    page.close()

    shrine=node_state("const r=e.createRun(['knight'],'REST');const [key]=Object.entries(r.dungeon.events).find(([k,v])=>v.type==='shrine');[r.x,r.y]=key.split(',').map(Number);e.reveal(r);r.party[0].hp=20;e.interact(r);console.log(e.serializeRun(r));")
    page=setup(browser,{'width':390,'height':844},shrine);page.locator('[data-action="resume"]').click()
    no_overflow(page,'Mobile event fits viewport')
    check('Mandatory event remains after Escape',page.locator('[data-choice="rest"]').count()==1)
    page.keyboard.press('Escape')
    check('Mandatory event cannot be dismissed',page.locator('[data-choice="rest"]').count()==1)
    page.locator('[data-choice="rest"]').click()
    check('Rest heals and resolves',state(page)['phase']=='explore' and state(page)['party'][0]['hp']>20)
    page.close()

    for width in [360,390,768]:
        page=setup(browser,{'width':width,'height':844})
        no_overflow(page,f'{width}px title fits')
        if width==390:page.screenshot(path=str(SHOTS/'title-mobile.png'),full_page=True)
        page.locator('[data-action="start"]').click()
        no_overflow(page,f'{width}px exploration fits')
        page.locator('[data-action="forward"]').click()
        check(f'{width}px touch movement works',state(page)['steps']==1)
        if width==390:
            page.screenshot(path=str(SHOTS/'exploration-mobile.png'),full_page=True)
        page.close()
        page=setup(browser,{'width':width,'height':844},battle);page.locator('[data-action="resume"]').click()
        no_overflow(page,f'{width}px battle fits')
        check(f'{width}px two initial arts and separate team controls accessible',page.locator('.tactical-skills .skill-button').count()==2)
        if width==390:page.screenshot(path=str(SHOTS/'battle-mobile.png'),full_page=True)
        act(page,'attack')
        check(f'{width}px touch battle action works',state(page)['rng']!=battle['rng'])
        page.close()

    # Qualitative progression through real reward buttons, not an in-game debug hook.
    learning=node_state("const r=e.createRun(['mage'],'LEARNING');e.openRewards(r,'treasure');console.log(e.serializeRun(r));")
    page=setup(browser,{'width':390,'height':844},learning);page.locator('[data-action="resume"]').click()
    no_overflow(page,'Mobile advanced-art rewards fit')
    index=next(i for i,c in enumerate(learning['rewards']) if c['type']=='learn')
    skill=learning['rewards'][index]['skillId']
    page.locator(f'[data-action="reward"][data-index="{index}"]').click()
    check('New art acquired through reward UI',skill in state(page)['party'][0]['skills'])
    page.close()

    evolution=node_state("const r=e.createRun(['chrono'],'EVOLVE');r.party[0].ranks.haste=1;e.openRewards(r);r.rewards[0]={type:'evolve',heroId:r.party[0].id,skillId:'haste'};console.log(e.serializeRun(r));")
    page=setup(browser,{'width':390,'height':844},evolution);page.locator('[data-action="resume"]').click()
    check('Evolution explains group targeting', '全队' in page.locator('.evolution-card').first.inner_text())
    page.locator('[data-action="reward"][data-index="0"]').click()
    check('Evolution stored separately from numerical ranks',state(page)['party'][0]['evolutions']['haste'])
    page.close()

    omen=node_state("const r=e.createRun(['chrono','knight','shrine'],'BOSS-PREVIEW');r.dungeon.packs=[];r.party.forEach((h,i)=>h.spd=100-i);e.startBattle(r,'guardian');const b=r.battle.enemies[0];b.boss.hpTriggered=[0];b.boss.queued=[{key:'hp-0',hpIndex:0,name:'星锁仪式',counter:'dispel',source:'HP 70%'}];r.battle.queue=[];e.attackRound(r);console.log(e.serializeRun(r));")
    for width in [360,390,768,1440]:
        page=setup(browser,{'width':width,'height':1000 if width==1440 else 844},omen);page.locator('[data-action="resume"]').click()
        check(f'{width}px explicit boss omen visible',page.locator('.omen-panel').count()==1)
        check(f'{width}px counterplay and deadline visible','驱散' in page.locator('.omen-panel').inner_text() and '本回合末' in page.locator('.omen-panel').inner_text())
        no_overflow(page,f'{width}px boss counter panel fits')
        if width in [390,1440]:page.screenshot(path=str(SHOTS/('boss-mobile.png' if width==390 else 'boss-desktop.png')),full_page=True)
        act(page,'salt')
        check(f'{width}px dispel updates omen progress immediately', '结界已解除' in page.locator('.omen-panel').inner_text())
        check(f'{width}px dispel actually consumes shared supply',state(page)['supplies']['salt']==omen['supplies']['salt']-1)
        page.close()

    crowded=node_state("const r=e.createRun(['mage','knight','shrine'],'CROWD');r.party[0].skills.push(...JOBS.mage.advanced);r.party.forEach((h,i)=>h.spd=100-i);const p={id:'crowd',name:'test',troop:['wisp','moth','sentinel','revenant','briar','prism'],engaged:false,defeated:false,members:null};e.startBattle(r,'normal',null,[p]);console.log(e.serializeRun(r));")
    for width in [360,390,768]:
        page=setup(browser,{'width':width,'height':844},crowded);page.locator('[data-action="resume"]').click()
        no_overflow(page,f'{width}px six enemies and five learned arts fit')
        check(f'{width}px advanced arts are available in battle',page.locator('.tactical-skills .skill-button').count()==5)
        check(f'{width}px six enemy targets are reachable',page.locator('[data-action="target"]').count()==6)
        page.locator('[data-action="target"]').last.click()
        check(f'{width}px offscreen enemy can be selected',page.locator('[data-action="target"]').last.get_attribute('class').find('selected')>=0)
        page.close()
    browser.close()

check('No JavaScript runtime errors',not errors)
check('No external runtime requests',not [u for u in requests if not u.startswith(('data:','about:'))])
result={'passed':len(checks),'checks':checks,'runtimeErrors':errors,'externalRequests':[u for u in requests if not u.startswith(('data:','about:'))],'browser':'Chromium / local binary','storage':'in-memory Storage test double; real native storage not verified by this suite'}
(OUT/'browser-smoke.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False,indent=2))
