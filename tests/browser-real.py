"""Native Chromium integration smoke test — NOT RUN in the delivery environment.
Requires a normal, unrestricted browser environment and an empty test profile.
Run the preview server separately: node scripts/serve.mjs
Then: python tests/browser-real.py
Optionally set FORGEFIT_URL to your dedicated TEST deployment, never your daily profile.
This script uses a fresh browser context and disposable training data.
Requires: pip install playwright; python -m playwright install chromium
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os, json
URL = os.environ.get('FORGEFIT_URL', 'http://127.0.0.1:4173/')
ROOT = Path(__file__).resolve().parents[1]
results=[]
def passed(name):
    results.append({'test':name,'result':'PASS'})
    print('PASS',name,flush=True)
with sync_playwright() as p:
    options={'headless':True}
    if os.environ.get('CHROMIUM_PATH'):
        options['executable_path']=os.environ['CHROMIUM_PATH']
    browser=p.chromium.launch(**options)
    context=browser.new_context(viewport={'width':430,'height':932},is_mobile=True,has_touch=True)
    page=context.new_page()
    page.set_default_timeout(15000)
    click=lambda name: page.get_by_role('button',name=name,exact=True).click()
    try:
        page.goto(URL,wait_until='networkidle')
        page.locator('#sheet input[name="name"]').fill('Disposable integration test')
        click('Set up my tracker')
        if page.get_by_role('button',name='Dismiss installation tip',exact=True).count():
            click('Dismiss installation tip')
        page.wait_for_function("navigator.serviceWorker.controller !== null")
        page.evaluate('navigator.serviceWorker.ready')
        passed('Real service-worker registration and control')
        click('Workout')
        page.locator('[data-to="routine:home-push"]').click()
        click('Start workout')
        page.get_by_label('Set 1 weight',exact=True).fill('12.5')
        page.get_by_label('Set 1 reps',exact=True).fill('10')
        click('Complete set 1')
        page.wait_for_function("[...document.querySelectorAll('[data-save-status]')].some(e=>e.textContent.includes('Saved'))")
        page.reload(wait_until='networkidle')
        page.wait_for_selector('[data-action="finish-open"]')
        assert page.get_by_label('Set 1 weight',exact=True).input_value()=='12.5'
        assert page.get_by_role('button',name='Uncomplete set 1',exact=True).get_attribute('aria-pressed')=='true'
        passed('Native IndexedDB restores unfinished workout after reload')
        context.set_offline(True)
        page.reload(wait_until='domcontentloaded')
        page.wait_for_selector('[data-action="finish-open"]')
        assert page.get_by_label('Set 1 weight',exact=True).input_value()=='12.5'
        page.get_by_label('Set 2 weight',exact=True).fill('15')
        click('Complete set 2')
        click('Finish');click('Save workout')
        page.wait_for_selector('[data-action="history-meta"]')
        assert page.locator('.history-set').count()==2
        passed('Offline reload, logging, and finish through native APIs')
        page.close();page=context.new_page()
        click=lambda name: page.get_by_role('button',name=name,exact=True).click()
        page.goto(URL,wait_until='domcontentloaded')
        click('Progress');page.locator('[data-to="history"]').first.click()
        assert page.locator('.history-card').count()==1
        passed('Saved history survives closing and reopening page while offline')
        context.set_offline(False)
        click('More')
        page.locator('[data-action="export"]').click()
        # File saving differs across browsers/platforms. Exercise import/restore
        # and Home Screen installation manually using docs/TEST-REPORT.md.
    finally:
        (ROOT/'docs/native-integration-results.json').write_text(json.dumps({'environment':'Native browser, isolated test context','results':results},indent=2))
        browser.close()
