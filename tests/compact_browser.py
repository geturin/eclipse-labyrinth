"""Compact HUD regression against the actual self-contained build, using shared UI fixtures.
Checks visibility and native keyboard interactions; no production debug hooks are added.
UI_BASELINE_HTML optionally measures the old build on exactly the same fixtures locally.
"""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
import battle_browser as ui

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results'/'compact-ui';OUT.mkdir(parents=True,exist_ok=True)
checks=[];metrics=[]
def check(name,condition):
    assert condition,name
    checks.append(name)
    print(name,flush=True)
def stable(page):
    page.wait_for_function("!document.getElementById('combat-skip')",timeout=15000)
def skip(page):
    button=page.locator('[data-action="skip-animation"]')
    if button.count():button.click()
    stable(page)
def card(page,index):return page.locator(f'[data-action="party"][data-id="hero-{index}"]')
def stats(page):
    return page.evaluate("""() => {
      const box=document.querySelector('.hud-dock')?.getBoundingClientRect();
      const command=document.querySelector('#command-panel').getBoundingClientRect();
      const party=document.querySelector('#party-strip').getBoundingClientRect();
      return {dockHeight:box?.height||party.bottom-command.top,
              pageHeight:document.documentElement.scrollHeight,
              attackBottom:document.querySelector('.team-attack')?.getBoundingClientRect().bottom};
    }""")

def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
        for width in [360,390,768,1440]:
            for mode in ['battle','boss']:
                page=ui.launch(browser,mode,width,'reduce')
                name=f'{width}px {mode}'
                check(name+' has one integrated party selector',page.locator('.party-card').count()==3 and page.locator('.hero-tabs,[data-action="select-hero"]').count()==0)
                check(name+' party appears before skills',page.evaluate("document.querySelector('#party-strip').getBoundingClientRect().bottom <= document.querySelector('.tactical-skills').getBoundingClientRect().top"))
                check(name+' all skills are in one row',page.locator('.skill-button').evaluate_all('(els)=>els.every(el=>Math.abs(el.getBoundingClientRect().top-els[0].getBoundingClientRect().top)<1)'))
                check(name+' no clipped skill text',page.locator('.skill-button').evaluate_all('(els)=>els.every(el=>el.scrollWidth<=el.clientWidth+1&&el.scrollHeight<=el.clientHeight+1)'))
                check(name+' body fits width',page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'))
                check(name+' main action label remains readable',page.locator('.team-attack').evaluate('el=>parseFloat(getComputedStyle(el).fontSize)>=14'))
                check(name+' supplies and repeated intel are absent by default',page.locator('.supply-row,.supply-tray,.enemy-intel,.reinforcement-strip,.battle-command-header').count()==0)
                check(name+' journal is collapsed',not page.locator('.journal-card').evaluate('el=>el.open'))
                measure=stats(page)
                check(name+' lower controls stay compact',measure['dockHeight'] <= (330 if width==1440 else 410))
                if mode=='boss':
                    check(name+' counterplay and deadline are still visible',page.locator('.omen-panel').is_visible() and '本回合末' in page.locator('.omen-panel').inner_text() and '封头' in page.locator('.omen-panel').inner_text())
                old_html=os.environ.get('UI_BASELINE_HTML')
                record={'viewport':width,'mode':mode,'new':measure}
                if old_html:
                    current=ui.HTML
                    try:
                        ui.HTML=Path(old_html).read_text()
                        old=ui.launch(browser,mode,width,'reduce')
                        record['old']=stats(old);old.close()
                        record['reduction_percent']=round(100*(1-measure['dockHeight']/record['old']['dockHeight']),1)
                    finally:ui.HTML=current
                metrics.append(record)
                page.screenshot(path=str(OUT/f'{mode}-{width}.png'),full_page=True)
                page.close()
        page=ui.launch(browser,width=390,reduced='reduce')
        before=ui.state(page)
        card(page,1).click()
        after=ui.state(page)
        check('clicking the HP card selects that hero',after['battle']['active']=='hero-1' and page.locator('[data-skill="seal"]').count()==1 and card(page,1).get_attribute('aria-pressed')=='true')
        check('selection does not advance clocks or resources',after['rng']==before['rng'] and after['dungeon']==before['dungeon'] and after['party']==before['party'] and after['battle']['round']==1)
        before=ui.state(page)
        card(page,2).focus();page.keyboard.press('Enter')
        check('Enter on a party card selects rather than attacks',ui.state(page)['battle']['active']=='hero-2' and ui.state(page)['dungeon']==before['dungeon'] and ui.state(page)['rng']==before['rng'])
        page.keyboard.press(']')
        check('bracket shortcut selects and focuses the new card',ui.state(page)['battle']['active']=='hero-0' and card(page,0).evaluate('el=>el===document.activeElement'))
        before=ui.state(page)
        page.locator('[data-action="hero-detail"]').click()
        check('details includes complete abilities and equipped weapon',page.locator('.skill-detail').count()==5 and before['party'][0]['weapon']['name'] in page.locator('.dialog').inner_text())
        page.keyboard.press('Escape')
        check('read-only details do not modify the saved run',ui.state(page)==before)
        check('closing details restores keyboard focus',page.locator('[data-action="hero-detail"]').evaluate('el=>el===document.activeElement'))
        page.locator('[data-action="toggle-supplies"]').click()
        check('supplies replace the skill row instead of appending another',page.locator('.supply-tray .skill-button').count()==3 and page.locator('.tactical-skills').count()==1 and not page.locator('[data-skill="cleave"]').count())
        page.locator('[data-action="supply-detail"]').click()
        check('touch users can read complete supply descriptions',all(t in page.locator('.dialog').inner_text() for t in ['急救药','时砂滴','破咒盐']))
        page.keyboard.press('Escape')
        check('opening trays and supply help is cosmetic only',ui.state(page)==before)
        page.locator('[data-skill="tonic"]').click()
        check('item targeting uses the same party cards',page.locator('.target-prompt').count()==1 and card(page,0).get_attribute('class').find('targetable')>=0)
        check('attack disabled during target selection',page.locator('.team-attack').is_disabled())
        page.locator('[data-action="cancel-target"]').click()
        check('target cancellation consumes nothing',ui.state(page)==before)
        page.locator('[data-skill="tonic"]').click();card(page,0).click();skip(page)
        after=ui.state(page)
        check('tonic heals through integrated card without moving world',after['party'][0]['hp']>before['party'][0]['hp'] and after['supplies']['tonic']==before['supplies']['tonic']-1 and after['dungeon']==before['dungeon'] and after['battle']['round']==1)
        card(page,2).click();ui.skill(page,'mend');card(page,0).click();skip(page)
        after=ui.state(page)
        check('healing targets do not replace the skill caster',after['battle']['active']=='hero-2' and after['party'][2]['cooldowns']['mend']>0)
        card(page,0).click();before=ui.state(page)
        ui.skill(page,'guard')
        check('guard appears on its own HP card', '防御' in card(page,0).inner_text() and ui.state(page)['party'][0]['guard'])
        ui.skill(page,'guard')
        check('guard toggle remains free and reversible',all(ui.state(page)[k]==before[k] for k in ['party','dungeon','rng','supplies']) and ui.state(page)['battle']['round']==before['battle']['round'])
        before=ui.state(page)
        page.locator('[data-action="battle-intel"]').click()
        check('optional tactics exposes enemy hint, movement and retreat',page.locator('[data-action="flee"]').is_enabled() and '附近动向' in page.locator('.dialog').inner_text() and '首次成功率 70%' in page.locator('.dialog').inner_text())
        page.keyboard.press('Escape')
        check('reading battle intel leaves clocks unchanged',ui.state(page)==before)
        page.evaluate('document.activeElement?.blur()');page.keyboard.press('Enter');skip(page)
        check('global Enter still commits exactly one round',ui.state(page)['battle']['round']==before['battle']['round']+1 and ui.state(page)['dungeon']['elapsed']==before['dungeon']['elapsed']+1)
        page.close()
        original=ui.SETUP
        try:
            ui.SETUP=original.replace('const values=',"r.party[0].hp=0;r.party[2].skills.push('revive');LAB.selectHero(r,'hero-1');const values=")
            page=ui.launch(browser,width=390,reduced='reduce')
            check('knocked-out heroes cannot be selected to cast',card(page,0).is_disabled())
            card(page,2).click();ui.skill(page,'revive')
            check('revive enables the fallen card and disables living targets',card(page,0).is_enabled() and card(page,1).is_disabled())
            card(page,0).click();skip(page)
            check('revive keeps its caster and restores the fallen ally',ui.state(page)['party'][0]['hp']>0 and ui.state(page)['battle']['active']=='hero-2' and ui.state(page)['battle']['round']==1)
            page.close()
        finally:ui.SETUP=original
        page=ui.launch(browser,mode='field',width=390,reduced='reduce')
        before=ui.state(page);page.locator('[data-action="menu"]').click();page.locator('[data-action="journal"]').click()
        check('mobile exploration still exposes action history',page.locator('.dialog').is_visible() and '行动记录' in page.locator('.dialog').inner_text() and ui.state(page)==before)
        page.close()
        check('no JavaScript errors in compact UI checks',not ui.errors)
        check('no external resources used by offline compact UI',not [x for x in ui.requests if x.startswith(('http:','https:'))])
        browser.close()
    report={'count':len(checks),'checks':checks,'metrics':metrics,'errors':ui.errors,'limits':'Chromium, deterministic fixtures, memory Storage; not native file storage or Safari.'}
    (OUT/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'passed':len(checks),'metrics':metrics},ensure_ascii=False))

if __name__=='__main__':main()
