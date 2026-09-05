"""Pixel/scene regression tests for the offline exploration renderer.
Run after npm run build: CHROMIUM_PATH=/usr/bin/chromium python tests/render_browser.py
The actual bundled modules run in an in-memory page; no production debug hook is added.
App tests use a Storage double, not native file: storage. Requires Python Playwright.
"""
from pathlib import Path
import json, os, re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'dist/index.html').read_text()
BUNDLE=re.search(r'<script>\n(.*?)\n</script>',HTML,re.S)[1]
BUNDLE=BUNDLE.replace("require('app');})();", "window.LAB={...require('renderer'),...require('engine'),...require('sprite-scene'),...require('sprite-art'),...require('art')};})();")
OUT=ROOT/'test-results'/'visual';OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];requests=[];metrics={}
def check(name,value):
    assert value,name
    checks.append(name)
    print(name,flush=True)
def rig(browser,width=1200,height=480,dpr=1,reduced='reduce'):
    page=browser.new_page(locale='zh-CN',viewport={'width':width,'height':height+20},device_scale_factor=dpr,reduced_motion=reduced)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url))
    page.set_content(f'<style>body{{margin:0;background:#111c2e}}canvas{{display:block;width:{width}px;height:{height}px}}</style><canvas id="view"></canvas>')
    page.add_script_tag(content=BUNDLE)
    page.evaluate('''async()=>{
      window.run=LAB.createRun(['knight','mage','shrine'],'VISUAL-RENDER');run.x=6;run.y=10;run.dir=0;
      const size=13;run.dungeon.size=size;
      run.dungeon.tiles=Array.from({length:size},(_,y)=>Array.from({length:size},(_,x)=>x===0||y===0||x===size-1||y===size-1?1:0));
      run.dungeon.zones=Array.from({length:size},(_,y)=>Array.from({length:size},(_,x)=>x<6?(y<6?1:0):(y<6?2:3)));
      run.dungeon.visited=run.dungeon.tiles.map(row=>row.map(()=>true));
      run.dungeon.events={};run.dungeon.packs=[];run.dungeon.landmarks=[];run.dungeon.stairs={x:8,y:7};
      window.renderer=new LAB.DungeonRenderer(document.getElementById('view'),()=>run);await renderer.ready;renderer.destroy();
      renderer.makeTextures(1);renderer.x=6.5;renderer.y=10.5;renderer.angle=-Math.PI/2;renderer.decorations=[];
    }''')
    return page

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    page=rig(browser)
    check('All 25 exploration raster assets loaded without fallback',page.evaluate('renderer.assetErrors.length===0 && Object.keys(renderer.images).length===LAB.SPRITE_KEYS.length'))
    result=page.evaluate('''async()=>{
      const out=[];
      for(const type of ['slime','chest','stairs','altar']){
        const svg=type==='slime'?LAB.enemySvg(type):LAB.objectSvg(type);
        const img=new Image();img.src=LAB.svgUri(svg);await img.decode();
        const raster=await LAB.rasterSprite(svg);const ref=document.createElement('canvas');ref.width=ref.height=320;
        ref.getContext('2d').drawImage(img,0,0,320,320);
        const a=ref.getContext('2d').getImageData(0,0,320,320).data,b=raster.getContext('2d').getImageData(0,0,320,320).data;
        let diff=0;for(let i=0;i<a.length;i++)diff+=Math.abs(a[i]-b[i]);
        const old=document.createElement('canvas');old.width=old.height=320;const ctx=old.getContext('2d');
        for(let col=0;col<320;col+=2){const x=col/320*img.naturalWidth,sw=Math.min(img.naturalWidth-x,img.naturalWidth/320*2.2);ctx.drawImage(img,x,0,sw,img.naturalHeight,col,0,2.2,320);}
        const c=ctx.getImageData(0,0,320,320).data;let legacy=0;for(let i=0;i<a.length;i++)legacy+=Math.abs(a[i]-c[i]);
        out.push({type,newMeanError:diff/a.length,legacyMeanError:legacy/a.length});
      }
      return out;
    }''')
    metrics['svg_crop_regression']=result
    for row in result:check('Full raster preserves all original '+row['type']+' pixels',row['newMeanError']==0)
    # Independent expected pixel mask, including a clipped viewport edge and a wall splitting the sprite.
    pixel_tests=page.evaluate('''()=>{
      const out=[];
      for(const key of ['mob-slime','mob-wisp','chest','stairs','altar','mob-briar'])for(const left of [-70,43,215]){
        const w=400,h=340,img=renderer.images[key],z=new Float32Array(w).fill(10);z.fill(1,150,199);
        const ref=document.createElement('canvas');ref.width=w;ref.height=h;const rc=ref.getContext('2d');rc.fillStyle='#000';rc.fillRect(0,0,w,h);rc.drawImage(img,left,10,260,290);
        const expected=rc.getImageData(0,0,w,h).data;
        const dst=document.createElement('canvas');dst.width=w;dst.height=h;const ctx=dst.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);ctx.save();ctx.beginPath();
        for(const [x,n] of LAB.visibleSpans(z,2,left,260))ctx.rect(x,0,n,h);ctx.clip();ctx.drawImage(img,left,10,260,290);ctx.restore();
        const actual=ctx.getImageData(0,0,w,h).data;let errors=0;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(let c=0;c<4;c++){
          const i=(y*w+x)*4+c,masked=z[x]<=2,exp=masked?(c===3?255:0):expected[i];if(actual[i]!==exp)errors++;
        }
        out.push({key,left,errors});
      }return out;
    }''')
    for row in pixel_tests:check(f"Pixel-exact wall/edge clipping: {row['key']} at {row['left']}",row['errors']==0)
    for kind in ['chest','stairs','altar','shrine','fountain']:
        page.evaluate("kind=>{run.guardianDefeated=true;run.dungeon.events={'6,8':{type:kind,used:false}};renderer.draw(run,1000)}",kind)
        check(kind+' is a named visible scene object',page.evaluate('renderer.lastLabels.length===1'))
        page.screenshot(path=str(OUT/f'{kind}.png'))
    page.evaluate("run.dungeon.events={};run.dungeon.packs=[{id:'pack',x:6,y:9,kind:'normal',troop:['slime','wisp','moth']}];renderer.draw(run,1000)")
    check('Leader name and actual three-member count displayed',page.evaluate("renderer.lastLabels.some(l=>l.label.includes('×3'))"))
    page.screenshot(path=str(OUT/'enemy-near.png'))
    page.evaluate("run.dungeon.packs=[];run.dungeon.events={'5,7':{type:'chest'},'6,7':{type:'altar'},'7,7':{type:'stairs'}};run.guardianDefeated=false;renderer.draw(run,1000)")
    check('Chest, altar and guarded gate have distinct labels',page.evaluate('renderer.lastLabels.length===3'))
    page.screenshot(path=str(OUT/'props-guardian.png'))
    page.evaluate("run.dungeon.events={};run.dungeon.packs=[{id:'p',x:6,y:8,kind:'elite',troop:['briar','prism','caller']}];renderer.draw(run,1000)")
    check('Elite encounter uses distinct crown label',page.evaluate("renderer.lastLabels[0].icon==='elite'"))
    page.screenshot(path=str(OUT/'elite.png'))
    page.evaluate("run.dungeon.packs=[];run.dungeon.events={'6,4':{type:'chest'}};renderer.draw(run,1000)")
    check('Distant visible chest receives compact icon',page.evaluate("renderer.lastLabels.some(l=>l.far&&l.text==='宝箱')"))
    # A separating wall must hide the image AND its badge. Compare whole frames with/without target.
    page.evaluate("run.dungeon.events={};for(let x=1;x<12;x++)run.dungeon.tiles[7][x]=1;renderer.draw(run,1000);window.emptyFrame=renderer.canvas.toDataURL();run.dungeon.events={'6,4':{type:'chest'}};renderer.draw(run,1000)")
    check('Wall fully hides distant sprite and marker, pixel for pixel',page.evaluate('renderer.canvas.toDataURL()===emptyFrame && renderer.lastLabels.length===0'))
    page.evaluate("run.dungeon.tiles[7].fill(0,1,12);run.dungeon.events={};run.dungeon.packs=[{id:'p',x:6,y:8,kind:'normal',troop:['slime']}];run.objectMotion=true;window.before=LAB.serializeRun(run);renderer.draw(run,0);window.frame0=renderer.canvas.toDataURL();renderer.draw(run,990)")
    check('Reduced-motion freezes opted-in object animations',page.evaluate('frame0===renderer.canvas.toDataURL()'))
    check('Rendering does not change HP, RNG, world steps, pack state or saved run',page.evaluate('before===LAB.serializeRun(run)'))
    page.close()
    page=rig(browser,reduced='no-preference')
    page.evaluate("run.objectMotion=true;run.dungeon.packs=[{id:'p',x:6,y:8,kind:'normal',troop:['wisp']}];renderer.draw(run,0);window.first=renderer.canvas.toDataURL();renderer.draw(run,950)")
    check('Opt-in local floating animation changes pixels without moving the camera',page.evaluate('first!==renderer.canvas.toDataURL() && renderer.x===6.5 && renderer.y===10.5 && renderer.angle===-Math.PI/2'))
    for kind in ['shrine','fountain']:
        page.evaluate("kind=>{run.dungeon.packs=[];run.dungeon.events={'6,8':{type:kind}};renderer.draw(run,0);window.first=renderer.canvas.toDataURL();renderer.draw(run,950)}",kind)
        check(kind+' has local animated light/flame pixels',page.evaluate('first!==renderer.canvas.toDataURL()'))
    page.close()
    for width,dpr in [(360,1),(390,2),(768,1),(1200,1.5)]:
        page=rig(browser,width=width,height=400,dpr=dpr)
        page.evaluate("run.dungeon.events={'6,8':{type:'chest'}};renderer.draw(run,1000)")
        check(f'{width}px DPR {dpr}: scene image and badge render',page.evaluate('renderer.lastLabels.length===1 && renderer.assetErrors.length===0'))
        check(f'{width}px DPR {dpr}: label fits canvas',page.evaluate('renderer.lastLabels.every(l=>l.x>=0&&l.x+l.w<=renderer.canvas.width)'))
        for angle in [0,1.5707963267948966,3.141592653589793,-1.5707963267948966,.42]:
            page.evaluate('angle=>{renderer.angle=angle;renderer.x=6.5;renderer.y=6.5;renderer.draw(run,1000)}',angle)
        check(f'{width}px: cardinal/diagonal turns draw without exception',True)
        metrics[f'draw_ms_{width}_dpr{dpr}']=page.evaluate('()=>{const t=performance.now();for(let i=0;i<30;i++)renderer.draw(run,1000);return (performance.now()-t)/30}')
        page.close()
    # Actual production UI, with a deterministic scene fixture and in-memory save.
    maker=rig(browser);saved=maker.evaluate("()=>{run.guardianDefeated=false;run.dungeon.events={'5,7':{type:'chest'},'6,7':{type:'altar'},'7,7':{type:'stairs'}};return run}");maker.close()
    for width,height in [(1440,1000),(390,844)]:
        page=browser.new_page(locale='zh-CN',viewport={'width':width,'height':height},reduced_motion='reduce')
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda r:requests.append(r.url))
        page.evaluate('''saved=>{const values={'eclipse-labyrinth.run.v3':JSON.stringify(saved)};Object.defineProperty(window,'localStorage',{value:{getItem:k=>values[k]??null,setItem:(k,v)=>values[k]=String(v),removeItem:k=>delete values[k]},configurable:true});}''',saved)
        page.set_content(HTML,wait_until='load');page.locator('[data-action="resume"]').click();page.wait_for_timeout(600)
        check(f'{width}px production UI uses new identifiable sprites', '宝箱' in page.locator('#dungeon-canvas').get_attribute('aria-label'))
        check(f'{width}px production UI has no page overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        page.screenshot(path=str(OUT/f'app-{width}.png'),full_page=True)
        page.locator('[data-action="menu"]').click()
        toggle=page.locator('[data-action="object-motion"]');check(f'{width}px local animation toggle is initially off','关闭' in toggle.inner_text());toggle.click()
        check(f'{width}px animation preference saves independently from comfort',page.evaluate("(()=>{const r=JSON.parse(localStorage.getItem('eclipse-labyrinth.run.v3'));return r.objectMotion===true&&r.comfort===true;})()"))
        page.close()
    check('No browser JavaScript errors',not errors)
    check('Offline game performs no external resource requests',not [r for r in requests if r.startswith(('http:','https:'))])
    browser.close()
report={'checks':len(checks),'passed':checks,'metrics':metrics,'errors':errors,'external_requests':[r for r in requests if r.startswith(('http:','https:'))],'limits':'Chromium, in-memory HTML and Storage double; fixture scenes, not a natural run or native file/Safari verification.'}
(OUT/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({'checks':len(checks),'metrics':metrics,'errors':errors},indent=2))
