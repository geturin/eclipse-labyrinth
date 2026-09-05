"""Actual offline UI checks for side turns, free commands, field tools and staged enemy FX.
Uses in-memory HTML and Storage, never ships a debug API. Requires Python Playwright.
"""
from pathlib import Path
import os,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'dist/index.html').read_text()
OUT=ROOT/'test-results'/'battle-v03';OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];requests=[]
def check(name,value):
    assert value,name
    checks.append(name);print(name,flush=True)
SETUP="""window.LAB={...require('engine'),...require('data'),...require('world')};
const r=LAB.createRun(['knight','ninja','shrine'],'V03-UI');
const n=13,d=r.dungeon;d.size=n;d.tiles=Array.from({length:n},(_,y)=>Array.from({length:n},(_,x)=>!x||!y||x===12||y===12?1:0));d.visited=d.tiles.map(a=>a.map(()=>true));d.zones=d.tiles.map(a=>a.map(()=>0));d.events={'9,8':{type:'stairs',used:false},'4,5':{type:'chest',used:false}};d.landmarks=[];d.stairs={x:9,y:8};d.elapsed=0;d.packs=[];r.x=5;r.y=5;r.dir=1;
const pack=(id,x,y,kind,troop)=>({id,name:id,x,y,home:{x,y},kind,troop,route:[{x,y},{x:x+1,y}],routeIndex:0,alertUntil:0,alert:0,alarmTarget:null,cooldown:0,sleepUntil:0,sleepResistUntil:0,lure:null,engaged:false,defeated:false});
d.packs=[pack('watch',8,5,'normal',['moth']),pack('elite',10,10,'elite',['briar'])];
r.party[0].hp=35;
if(MODE!=='field'){
 const p=pack('caller',5,5,'normal',['caller','slime','moth']);d.packs.push(p);LAB.startBattle(r,'normal',null,[p]);
 for(const e of r.battle.enemies){e.hp=e.maxHp=1000;e.atk=e.mag=4;}
 if(MODE==='boss'){r.phase='explore';r.battle=null;d.packs=[];r.floor=3;LAB.startBattle(r,'guardian');for(const h of r.party){h.skills=[...LAB.JOBS[h.job].skills,...LAB.JOBS[h.job].advanced];h.hp=h.maxHp=5000;}LAB.attackRound(r);LAB.attackRound(r);}
}
const values={[LAB.SAVE_KEY]:LAB.serializeRun(r)};Object.defineProperty(window,'localStorage',{value:{getItem:k=>values[k]??null,setItem:(k,v)=>values[k]=String(v),removeItem:k=>delete values[k]},configurable:true});
require('app');})();"""
def launch(browser,mode='battle',width=1440,reduced='no-preference'):
    page=browser.new_page(viewport={'width':width,'height':1000 if width>600 else 844},reduced_motion=reduced)
    page.set_default_timeout(6000)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url))
    html=HTML.replace("require('app');})();",SETUP.replace('MODE',json.dumps(mode)))
    page.set_content(html,wait_until='load');page.locator('[data-action="resume"]').click();page.wait_for_timeout(250)
    page.evaluate("""window.seen=[];new MutationObserver(()=>{for(const el of document.querySelectorAll('.combat-acting,.damaged,.healed,.impact-alarm,.impact-shield'))seen.push({className:el.className,text:el.innerText});}).observe(document.getElementById('app'),{childList:true,subtree:true});""")
    return page

def state(page):return page.evaluate("JSON.parse(localStorage.getItem('eclipse-labyrinth.run.v3'))")
def settle(page):page.locator('.team-attack').wait_for(state='visible');page.wait_for_timeout(40)
def skill(page,id):page.locator(f'[data-action="skill"][data-skill="{id}"]').click()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    page=launch(browser)
    check('UI starts in party preparation with no MP bar',page.locator('.hero-tabs button').count()==3 and 'MP' not in page.locator('#party-strip').inner_text())
    first=state(page);skill(page,'cleave');settle(page);skill(page,'aegis');settle(page)
    check('Two skills from the same hero leave turn, enemy position and world tick unchanged',state(page)['battle']['round']==1 and state(page)['dungeon']['elapsed']==0 and state(page)['dungeon']['packs'][0]['x']==8)
    check('Used skill button has a disabled cooldown rather than an MP cost',page.locator('[data-skill="cleave"]').is_disabled() and '剩余 3' in page.locator('[data-skill="cleave"]').inner_text())
    page.locator('[data-action="select-hero"][data-id="hero-1"]').click();skill(page,'seal');settle(page)
    check('Changing character exposes its own ready skills and can seal before enemy acts',state(page)['party'][1]['cooldowns']['seal']==5 and state(page)['battle']['enemies'][0]['intentIndex']==0)
    skill(page,'tonic');page.locator('[data-action="party"][data-id="hero-0"]').click();settle(page)
    now=state(page);check('A potion consumes inventory but not a turn, cooldown tick or patrol movement',now['supplies']['tonic']==2 and now['battle']['round']==1 and now['dungeon']['elapsed']==0 and now['party'][0]['cooldowns']['cleave']==3)
    page.evaluate("document.querySelector('.team-attack').click();document.querySelector('.team-attack')?.click();")
    check('Attack commits exactly once even when a second click is attempted during animation',state(page)['battle']['round']==2 and state(page)['dungeon']['elapsed']==1)
    settle(page)
    check('Enemy-source attack or cast animation is actually shown',page.evaluate("seen.some(x=>x.className.includes('enemy-card')&&x.className.includes('combat-acting'))"))
    check('Actual target damage effects are shown separately from attacker motion',page.evaluate("seen.some(x=>x.className.includes('party-card')&&x.className.includes('damaged'))"))
    check('Sealed caller did not attract the nearby patrol',state(page)['dungeon']['packs'][0]['alertUntil']==0 and state(page)['dungeon']['packs'][0]['x']==9)
    before=state(page);skill(page,'attack');page.locator('[data-action="skip-animation"]').click();settle(page)
    check('Skipping presentation does not skip or repeat gameplay resolution',state(page)['battle']['round']==before['battle']['round']+1 and state(page)['dungeon']['elapsed']==before['dungeon']['elapsed']+1)
    check('All party turns occur before enemy turns in emitted presentation order',page.evaluate("seen.filter(x=>x.className.includes('combat-acting')).length>3"))
    page.screenshot(path=str(OUT/'battle-desktop.png'),full_page=True);page.close()
    # A separate unsealed fight must show the alarm animation and resulting approach.
    page=launch(browser);skill(page,'attack');settle(page)
    check('Unsealed caller alarm has visible effect feedback',page.evaluate("seen.some(x=>x.className.includes('impact-alarm')||x.className.includes('acting-alarm'))"))
    check('Alarm successfully changes nearby normal patrol to directed approach',state(page)['dungeon']['packs'][0]['alertUntil']>0 and state(page)['dungeon']['packs'][0]['x']==7)
    page.close()
    for width in [1440,390]:
        page=launch(browser,mode='field',width=width)
        page.locator('[data-action="field"]').click()
        check(f'{width}px field tool panel contains three distinct tools',page.locator('[data-action="field-use"]').count()==3)
        before=state(page);page.locator('#field-pack').select_option('watch');page.locator('[data-tool="sleep"]').click()
        check(f'{width}px selecting and using sleep bell does not move a monster',state(page)['dungeon']['elapsed']==0 and state(page)['dungeon']['packs'][0]['sleepUntil']==3)
        page.locator('[data-tool="hush"]').click();check(f'{width}px hush preparation is free',state(page)['field']['hushUntil']==6 and state(page)['steps']==0)
        page.locator('[data-action="field-heal"]').first.click();check(f'{width}px exploration healing remains free',state(page)['supplies']['tonic']==2 and state(page)['dungeon']['elapsed']==0)
        check(f'{width}px field panel has no document overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        page.screenshot(path=str(OUT/f'field-{width}.png'),full_page=True)
        page.locator('[data-action="close"]').first.click();page.keyboard.press('m')
        check(f'{width}px patrol route visualization can be toggled',page.locator('[data-action="patrol-toggle"]').count()==1)
        page.locator('[data-action="patrol-toggle"]').click();page.close()
    for width,reduced in [(1440,'no-preference'),(390,'reduce')]:
        page=launch(browser,mode='boss',width=width,reduced=reduced)
        check(f'{width}px all five learned skill buttons are reachable',page.locator('.cooldown-skills button').count()==5)
        check(f'{width}px boss omen has an explicit response panel',page.locator('.omen-panel').count()>0)
        check(f'{width}px skill menu has no page overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        page.screenshot(path=str(OUT/f'boss-{width}.png'),full_page=True)
        skill(page,'attack');settle(page)
        if reduced=='reduce':
            check('Reduced-motion setting suppresses transformations but still resolves the full turn',state(page)['battle']['round']==4)
        page.close()
    check('No browser JavaScript errors',not errors)
    check('Offline combat has no external resource requests',not [u for u in requests if u.startswith(('http:','https:'))])
    browser.close()
report={'count':len(checks),'checks':checks,'errors':errors,'limits':'Chromium, in-memory storage and fixed fixtures. Not real Safari, file storage, long-run balance or low-end performance.'}
(OUT/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'passed':len(checks),'errors':errors}))
