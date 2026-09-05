"""Bilingual regression against the shipped HTML, with test-only fixtures.
Uses actual buttons, browser locale metadata and in-memory Storage. Not Safari/file-storage QA.
"""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
import battle_browser as base
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'dist/index.html').read_text()
OUT=ROOT/'test-results'/'i18n';OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];requests=[]
CJK=r'''() => {const out=[];const w=document.createTreeWalker(document.body,4);
for(let n=w.nextNode();n;n=w.nextNode()){
 if(n.parentElement.closest('script,style,noscript,[data-i18n-skip]'))continue;
 if(n.parentElement.closest('[data-language="zh"]'))continue;
 if(/[\u3400-\u9fff\u3040-\u30ff]/.test(n.nodeValue))out.push(n.nodeValue.trim());
}for(const e of document.querySelectorAll('[title],[aria-label],[alt],[placeholder]')){
 if(e.closest('[data-i18n-skip]'))continue;
 for(const a of ['title','aria-label','alt','placeholder']){const s=e.getAttribute(a)||'';if(/[\u3400-\u9fff\u3040-\u30ff]/.test(s))out.push(a+': '+s)}
}return [...new Set(out)];}'''
def check(name,condition):
 assert condition,name
 checks.append(name);print(name,flush=True)
def english(page,name):
 missing=page.evaluate(CJK);check(name+' translated',not missing or print(missing))
 check(name+' fits width',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
def close(page):page.locator('[data-action="close"]').first.click()
def state(page):return page.evaluate("localStorage.getItem('eclipse-labyrinth.run.v3')")
def setup(browser,mode='landing',width=390,locale='en-US',languages=None,extra='',pref=None,blocked=False):
 page=browser.new_page(locale=locale,viewport={'width':width,'height':1000 if width>600 else 844},reduced_motion='reduce');page.set_default_timeout(7000)
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
 if languages is not None:page.evaluate("v=>Object.defineProperty(navigator,'languages',{get:()=>v,configurable:true})",languages)
 if mode=='landing':
  storage="const values={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>values[k]??null,setItem:(k,v)=>values[k]=String(v)},configurable:true});"
  if pref:storage+=f"values['eclipse-labyrinth.language']={json.dumps(pref)};"
  if blocked:storage="Object.defineProperty(window,'localStorage',{get(){throw Error('Storage disabled')},configurable:true});"
  html=HTML.replace("require('app');})();",storage+"require('app');})();")
 else:
  code=base.SETUP.replace('MODE',json.dumps(mode)).replace('const values=',extra+';const values=')
  if pref:code=code.replace("require('app');",f"values['eclipse-labyrinth.language']={json.dumps(pref)};require('app');")
  html=HTML.replace("require('app');})();",code)
 page.set_content(html,wait_until='load');page.wait_for_timeout(80)
 if mode!='landing':page.locator('[data-action="resume"]').click();page.wait_for_timeout(80)
 return page

def main():
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
  for locale,langs,expected in [('en-US',None,'en'),('zh-CN',None,'zh-CN'),('zh-TW',None,'zh-CN'),('ja-JP',None,'en'),('ja-JP',['ja-JP','zh-CN','en'],'zh-CN'),('zh-CN',['en-GB','zh-CN'],'en')]:
   page=setup(browser,locale=locale,languages=langs);check(str((locale,langs))+' selects '+expected,page.locator('html').get_attribute('lang')==expected)
   check(locale+' game starts without setup dialog',page.locator('[data-action="start"]').is_visible())
   if expected=='en':english(page,locale+' landing')
   page.close()
  page=setup(browser,locale='zh-CN',pref='en');check('saved override wins over browser',page.locator('html').get_attribute('lang')=='en');page.close()
  page=setup(browser,locale='en-US',blocked=True);check('disabled storage still renders English',page.locator('html').get_attribute('lang')=='en');page.locator('[data-action="language"]').click();page.locator('[data-language="zh"]').click();check('disabled storage permits in-session switching',page.locator('html').get_attribute('lang')=='zh-CN');page.close()
  page=setup(browser);page.locator('#seed-input').fill('碎星斩-<moon>');page.locator('[data-action="language"]').click();english(page,'language selector')
  page.locator('[data-language="zh"]').click();check('language switch preserves seed input',page.locator('#seed-input').input_value()=='碎星斩-<moon>');page.locator('[data-language="en"]').click();check('manual switch saved separately',page.evaluate("localStorage.getItem('eclipse-labyrinth.language')")=='en');close(page)
  page.evaluate("Object.defineProperty(navigator,'languages',{get:()=>['zh-CN'],configurable:true});dispatchEvent(new Event('languagechange'))")
  check('manual preference resists browser languagechange',page.locator('html').get_attribute('lang')=='en')
  page.locator('[data-action="language"]').click();page.locator('[data-language="auto"]').click();check('Auto follows browser again',page.locator('html').get_attribute('lang')=='zh-CN');close(page)
  page.evaluate("Object.defineProperty(navigator,'languages',{get:()=>['en-GB'],configurable:true});dispatchEvent(new Event('languagechange'))")
  check('automatic preference follows languagechange',page.locator('html').get_attribute('lang')=='en');check('languagechange preserves seed',page.locator('#seed-input').input_value()=='碎星斩-<moon>')
  page.locator('[data-action="help"]').click();english(page,'help');close(page)
  for i in range(6):
   page.locator('[data-action="classes"]').click();english(page,'classes list');page.locator('[data-action="class-detail"]').nth(i).click();english(page,f'class {i} all five abilities');close(page)
  page.screenshot(path=str(OUT/'title-en.png'),full_page=True);page.close()
  for width in [360,390,768,1440]:
   page=setup(browser,mode='boss',width=width);english(page,f'{width}px boss')
   check(f'{width}px all five skills remain a single row',page.locator('.cooldown-skills .skill-button').evaluate_all('(els)=>els.every(e=>Math.abs(e.getBoundingClientRect().top-els[0].getBoundingClientRect().top)<1)'))
   check(f'{width}px action names not clipped',page.locator('.skill-button').evaluate_all('(els)=>els.every(e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1)'))
   check(f'{width}px round does not overlap encounter heading',page.evaluate("(()=>{let a=document.querySelector('.floor-heading').getBoundingClientRect(),b=document.querySelector('.round-label').getBoundingClientRect();return a.right<=b.left||a.bottom<=b.top||b.right<=a.left})()"))
   check(f'{width}px current boss counter remains visible','Head Seal' in page.locator('.omen-panel').inner_text())
   before=state(page);page.locator('[data-action="hero-detail"]').click();english(page,'hero details with skills, statuses and weapon');close(page)
   page.locator('[data-action="battle-intel"]').click();english(page,'boss intel and saved Chinese logs');close(page);check('reading translated content leaves run unchanged',state(page)==before)
   page.screenshot(path=str(OUT/f'boss-en-{width}.png'),full_page=True);page.close()
  page=setup(browser,mode='battle');before=state(page)
  page.locator('[data-action="language"]').click();page.locator('[data-language="zh"]').click();check('switch to Chinese does not mutate save',state(page)==before);page.locator('[data-language="en"]').click();close(page);check('switch back retains exact state and compact controls',state(page)==before and page.locator('.party-card').count()==3)
  base.skill(page,'cleave');base.settle(page);base.skill(page,'aegis');base.settle(page);english(page,'two free skills and cooldowns')
  check('translated skills still have free preparation',json.loads(state(page))['battle']['round']==1 and json.loads(state(page))['dungeon']['elapsed']==0)
  page.locator('[data-action="toggle-supplies"]').click();page.locator('[data-action="supply-detail"]').click();english(page,'supply descriptions');close(page)
  page.locator('[data-skill="tonic"]').click();english(page,'heal targeting');page.locator('[data-action="party"][data-id="hero-0"]').click();base.settle(page)
  check('English item targeting preserves free item rule',json.loads(state(page))['battle']['round']==1 and json.loads(state(page))['supplies']['tonic']==2)
  base.skill(page,'attack');base.settle(page);english(page,'attack, enemy actions and alarm');check('English Attack commits one round',json.loads(state(page))['battle']['round']==2)
  page.screenshot(path=str(OUT/'battle-en-390.png'),full_page=True);page.close()
  for mode,extra in [
   ('field',"r.inventory=Object.keys(LAB.WEAPONS).map(id=>LAB.makeWeapon(id,5));for(const b of LAB.BOONS)r.boons[b.id]=1"),
   *[('boss',f"r.floor={f};r.phase='explore';r.battle=null;LAB.startBattle(r,'guardian');LAB.attackRound(r);LAB.attackRound(r)") for f in [1,2,4,5]],
   ('field',"r.phase='reward';r.rewards=[{type:'learn',heroId:r.party[0].id,skillId:'intercept'},{type:'evolve',heroId:r.party[1].id,skillId:'venom'},{type:'boon',id:'power'}]"),
   ('field',"r.phase='reward';r.rewards=[{type:'weapon',weapon:LAB.makeWeapon('duet',5)},{type:'skill',heroId:r.party[0].id,skillId:'cleave'},{type:'boon',id:'vitality'}]"),
   *[('field',f"r.dungeon.events[`${{r.x}},${{r.y}}`]={{type:'{t}',used:false}};r.party[0].hp=10;LAB.interact(r)") for t in ['shrine','fountain','altar']]
  ]:
   page=setup(browser,mode=mode,extra=extra);english(page,'content fixture '+extra[:70])
   if "inventory=" in extra:
    before=state(page)
    for action in ['inventory','field','map','menu']:
     page.locator(f'[data-action="{action}"]').first.click();english(page,action+' complete content');close(page)
    check('English field menus are read-only',state(page)==before)
    page.locator('[data-action="menu"]').click();page.locator('[data-action="view-settings"]').click();english(page,'view modes');close(page)
    page.keyboard.press('d');page.wait_for_timeout(400);english(page,'canvas heading after a quarter turn')
    check('heading translates outside modal rendering', 'South' in page.locator('[data-facing]').inner_text())
   page.close()
  for outcome in ['victory','defeat']:
   extra = "r.floor=5;r.battle.type='boss';r.battle.enemies.forEach(e=>{e.hp=1;e.boss=null;e.status={}});r.party.forEach(h=>h.atk=10000)" if outcome=='victory' else "r.party.forEach(h=>h.hp=1);r.battle.enemies.forEach(e=>{e.atk=e.mag=10000;e.intent=['attack'];e.plannedIntent='attack'})"
   page=setup(browser,mode='battle',extra=extra);base.skill(page,'attack');base.settle(page);english(page,outcome+' results')
   check(outcome+' has result screen',json.loads(state(page))['ending']==outcome);page.close()
  page=setup(browser,mode='field',extra="r.seed='碎星斩-<moon>';" );page.locator('[data-action="menu"]').click();check('custom seed is displayed literally, not translated or interpreted as HTML',page.locator('[data-i18n-skip]').last.inner_text()=='碎星斩-<moon>');page.close()
  check('no browser JavaScript errors',not errors)
  check('no external runtime requests',not [r for r in requests if r.startswith(('https:','http:'))])
  browser.close()
 report={'checks':len(checks),'passed':checks,'errors':errors,'limits':'Chromium, fixture states and in-memory storage. No actual Safari or native offline-file storage guarantee.'}
 (OUT/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'passed':len(checks)}))
if __name__=='__main__':main()
