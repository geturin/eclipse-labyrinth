"""Navigation regression against the shipped offline bundle, with test-only instrumentation.
Uses specified maps and in-memory Storage. No production debug API or browser emulation claim.
"""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'dist/index.html').read_text()
OUT=ROOT/'test-results'/'navigation';OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];requests=[]
def check(name,value):
    assert value,name
    checks.append(name);print(name,flush=True)

SETUP="""
window.LAB={...require('engine'),...require('data'),...require('world')};
const r=LAB.createRun(['knight','mage','shrine'],'ORIENTATION-032');
const d=r.dungeon,n=15;d.size=n;
d.tiles=Array.from({length:n},(_,y)=>Array.from({length:n},(_,x)=>(!x||!y||x===n-1||y===n-1)?1:0));
d.visited=d.tiles.map(a=>a.map(()=>true));d.zones=d.tiles.map((a,y)=>a.map((_,x)=>x<8?0:1));
d.events={'12,7':{type:'stairs',used:false},'8,8':{type:'chest',used:false}};
d.landmarks=[{x:9,y:4,zone:1}];d.stairs={x:12,y:7};d.start={x:1,y:1};d.elapsed=0;d.packs=[];
r.x=5;r.y=7;r.dir=1;r.comfort=true;
if(OPTIONS.mode)r.viewMode=OPTIONS.mode;
if(OPTIONS.wall)d.tiles[7][6]=1;
if(OPTIONS.encounter)d.packs=[{id:'contact',name:'守候小队',x:6,y:7,home:{x:6,y:7},kind:'normal',troop:['slime'],route:[{x:6,y:7},{x:7,y:7}],routeIndex:0,alertUntil:0,alert:0,alarmTarget:null,cooldown:0,sleepUntil:0,sleepResistUntil:0,lure:null,engaged:false,defeated:false}];
if(OPTIONS.stairs){r.x=12;r.y=7;r.guardianDefeated=true;}
const values={[LAB.SAVE_KEY]:LAB.serializeRun(r)};
Object.defineProperty(window,'localStorage',{value:{getItem:k=>values[k]??null,setItem:(k,v)=>values[k]=String(v),removeItem:k=>delete values[k]},configurable:true});
window.camFrames=[];window.texBuilds=0;
const proto=require('renderer').DungeonRenderer.prototype,frame=proto.navigationFrame,texture=proto.makeTextures;
proto.navigationFrame=function(pose){frame.call(this,pose);camFrames.push({...pose,time:performance.now(),moving:!!this.travel,marker:document.querySelector('.navigation-map .map-player')?.getAttribute('transform')});};
proto.makeTextures=function(...args){texBuilds++;return texture.apply(this,args);};
require('app');})();
"""
def setup(browser,width=1200,mode=None,reduced='no-preference',**opts):
    page=browser.new_page(viewport={'width':width,'height':950 if width>600 else 844},reduced_motion=reduced)
    page.set_default_timeout(7000)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url))
    config={'mode':mode,**opts}
    page.set_content(HTML.replace("require('app');})();",SETUP.replace('OPTIONS',json.dumps(config))),wait_until='load')
    page.locator('[data-action="resume"]').click();page.wait_for_timeout(120)
    return page

def state(page):return page.evaluate("JSON.parse(localStorage.getItem('eclipse-labyrinth.run.v3'))")
def settle(page):
    page.wait_for_function("!document.getElementById('app').classList.contains('navigation-busy') && document.getElementById('stage').dataset.travel !== 'moving'")
    page.wait_for_timeout(50)
def frames(page):return page.evaluate('camFrames')
def press(page,key):
    page.evaluate('camFrames=[]');page.keyboard.press(key);settle(page);return frames(page)
def moving(fs):return [f for f in fs if f.get('moving') and f.get('progress',1)>0 and f.get('progress',1)<1]
def choose_mode(page,mode):
    page.locator('[data-action="menu"]').click();page.locator('[data-action="view-settings"]').click()
    page.locator(f'[data-mode="{mode}"]').click();page.keyboard.press('Escape')
def close(page):page.close()

def main():
  with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    page=setup(browser);before=state(page);tex=page.evaluate('texBuilds')
    fs=press(page,'w');ms=moving(fs)
    check('Existing v3 comfort save now has visible intermediate forward positions',bool(ms) and all(5.5<f['x']<6.5 for f in ms))
    check('Forward travel holds its heading and horizon, with no lateral drift',all(abs(f['angle'])<1e-8 and f['y']==7.5 for f in fs))
    check('One forward step commits one world tick, never one per animation frame',state(page)['steps']==1 and state(page)['dungeon']['elapsed']==1)
    check('Camera stops exactly at cell center without a spring tail',fs[-1]['x']==6.5 and fs[-1]['y']==7.5)
    check('Snapshot animation reuses wall textures instead of rebuilding twice per step',page.evaluate('texBuilds')==tex)
    fs=press(page,'a');ms=moving(fs)
    check('Left turn contains signed intermediate angles rather than a 90-degree cut',bool(ms) and all(-1.57079633<f['angle']<0 for f in ms))
    check('Turn never translates or consumes a world tick',all(f['x']==6.5 and f['y']==7.5 for f in fs) and state(page)['dungeon']['elapsed']==1)
    check('Direction cue states the previous and next heading',page.locator('.move-cue').inner_text()=='↶ 左转 东 → 北')
    check('Stable north-up minimap arrow follows the same camera pose',len({f['marker'] for f in ms})>1 and page.locator('.navigation-map>span').inner_text()=='北 ↑')
    check('Settled heading agrees with the gameplay heading',page.locator('[data-facing]').inner_text()=='北 N' and state(page)['dir']==0)
    fs=press(page,'s');check('Backward motion remains a straight segment with the same heading',bool(moving(fs)) and all(f['x']==6.5 and abs(f['angle']+1.57079632679)<1e-8 for f in fs) and state(page)['y']==8)
    fs=press(page,'q');check('Strafing moves sideways without turning the camera',bool(moving(fs)) and all(f['y']==8.5 and abs(f['angle']+1.57079632679)<1e-8 for f in fs) and state(page)['x']==5)
    snap=state(page);page.wait_for_timeout(450)
    check('Idle frames never change the saved run, cooldowns or RNG',state(page)==snap)
    before=state(page);choose_mode(page,'deliberate')
    check('Movement setting persists without changing run progress',state(page)['viewMode']=='deliberate' and state(page)['rng']==before['rng'] and state(page)['steps']==before['steps'])
    fs=press(page,'d');check('Deliberate mode uses the same finite motion with a longer response window',bool(moving(fs)) and max(f.get('progress',0) for f in moving(fs))<1)
    page.locator('[data-action="menu"]').click();page.locator('[data-action="return-title"]').click();page.locator('[data-action="resume"]').click();page.wait_for_timeout(120)
    check('Existing v3 run resumes with selected view mode and coordinates',state(page)['viewMode']=='deliberate' and state(page)['x']==5 and state(page)['y']==8)
    close(page)

    page=setup(browser);page.evaluate("camFrames=[]; for(const key of ['w','d','w','a'])document.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));")
    settle(page);fs=frames(page);r=state(page)
    check('Rapid taps buffer at most one next command, not a long movement backlog',r['x']==6 and r['y']==7 and r['dir']==2 and r['dungeon']['elapsed']==1)
    check('Queued turn begins only after the forward segment finishes',all(abs(f['angle'])<1e-8 or f['x']==6.5 for f in fs))
    r=state(page);page.wait_for_timeout(700);check('Releasing input leaves no delayed steps or extra rotations',state(page)==r)
    page.evaluate("for(let i=0;i<12;i++)document.dispatchEvent(new KeyboardEvent('keydown',{key:'d',repeat:true,bubbles:true}));")
    settle(page);check('Holding a turn key cannot repeatedly spin 90 degrees',state(page)['dir']==2)
    close(page)

    for interrupt in ['m','Escape','blur']:
      page=setup(browser);page.evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'w',bubbles:true}));document.dispatchEvent(new KeyboardEvent('keydown',{key:'d',bubbles:true}));")
      if interrupt=='blur':page.evaluate("window.dispatchEvent(new Event('blur'))")
      else:page.keyboard.press(interrupt)
      settle(page);r=state(page);page.wait_for_timeout(450)
      check(f'{interrupt} interruption discards queued input, without undoing the committed step',r['x']==6 and r['dir']==1 and r['dungeon']['elapsed']==1 and state(page)==r)
      if interrupt!='blur':check(f'{interrupt} dialog remains usable after cancelling camera presentation',page.locator('.dialog').count()==1)
      close(page)

    page=setup(browser,wall=True);r=state(page);fs=press(page,'w')
    check('Blocked step does not fake a camera move or advance time',state(page)==r and not moving(fs))
    check('Blocked move gives an explicit no-movement direction cue','未移动' in page.locator('.move-cue').inner_text());close(page)
    page=setup(browser,mode='fade');fs=press(page,'d');ms=moving(fs)
    check('Fade mode uses only start/end orientations without a spatial sweep',bool(ms) and all(min(abs(f['angle']),abs(f['angle']-1.57079632679))<1e-8 for f in fs))
    check('Fade mode draws a bounded dark transition instead of a flash',any(f.get('shade',0)>.75 for f in fs) and all(0<=f.get('shade',0)<=1 for f in fs))
    check('Fade mode still gives the new direction and fixed map',page.locator('[data-facing]').inner_text()=='南 S' and page.locator('.navigation-map').is_visible());close(page)
    page=setup(browser,mode='deliberate',reduced='reduce');fs=press(page,'d')
    check('System reduced-motion overrides both continuous camera modes',not moving(fs) and state(page)['dir']==2)
    check('Reduced-motion preserves explicit orientation cues instead of a bare hard cut','东 → 南' in page.locator('.move-cue').inner_text() and page.locator('.navigation-map').is_visible());close(page)
    page=setup(browser);page.keyboard.press('w');page.emulate_media(reduced_motion='reduce');settle(page)
    check('Changing reduced-motion mid-step completes once without leaving input locked',state(page)['x']==6 and state(page)['dungeon']['elapsed']==1);close(page)

    page=setup(browser,encounter=True);page.evaluate("camFrames=[];document.dispatchEvent(new KeyboardEvent('keydown',{key:'w',bubbles:true}));")
    r=state(page)
    check('Encounter result is saved immediately, but battle UI waits for arrival',r['phase']=='battle' and page.locator('.team-attack').count()==0 and page.locator('.navigation-map').count()==1)
    page.keyboard.press('1');r=state(page)
    check('Invisible battle shortcuts cannot submit a turn during the encounter approach',r['battle']['round']==1 and r['dungeon']['elapsed']==1)
    settle(page);fs=frames(page)
    check('Encounter approach has intermediate camera positions before showing combat',bool(moving(fs)) and page.locator('.team-attack').count()==1)
    page.locator('[data-action="party"][data-id="hero-1"]').click()
    check('Compact party-card selection remains usable after navigation finishes',state(page)['battle']['active']=='hero-1');close(page)
    page=setup(browser,stairs=True);r=state(page);page.keyboard.press('f');settle(page)
    check('Descending to a new floor resets the camera without flying across the map',state(page)['floor']==2 and state(page)['x']==1 and page.locator('.navigation-map').is_visible());close(page)

    for width in [360,390,768,1440]:
      page=setup(browser,width=width)
      check(f'{width}px fixed north map is visible without reopening a sidebar',page.locator('.navigation-map').is_visible() and not page.locator('.side-column .map-card').is_visible())
      check(f'{width}px navigation does not expand the compact bottom UI or page width',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
      rects=page.evaluate("['.navigation-map','.navigation-compass','.floor-heading'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})")
      a,b=rects[:2];check(f'{width}px map and direction cue do not overlap',a['x']+a['w']<=b['x'] or b['x']+b['w']<=a['x'] or a['y']+a['h']<=b['y'] or b['y']+b['h']<=a['y'])
      fs=press(page,'w');check(f'{width}px touch-sized scene still renders intermediate travel',bool(moving(fs)))
      page.locator('.navigation-map').click();check(f'{width}px inset map opens the original full map without a world tick',page.locator('.large-map').count()==1 and state(page)['dungeon']['elapsed']==1)
      page.keyboard.press('Escape')
      if width in [390,1440]:page.screenshot(path=str(OUT/f'explore-{width}.png'),full_page=True)
      close(page)
    check('No JavaScript errors in movement, transitions or compact controls',not errors)
    check('Movement build requests no external resources',not [u for u in requests if u.startswith(('http:','https:'))])
    browser.close()
  report={'count':len(checks),'checks':checks,'errors':errors,'limits':'Actual offline bundle with specified maps and in-memory Storage. Not real iPhone Safari, file storage, low-end performance or human motion-sickness validation.'}
  (OUT/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
  print(json.dumps({'passed':len(checks),'errors':errors}))
if __name__=='__main__':main()
