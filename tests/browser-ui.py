"""UI interaction checks using the explicit TEST-ONLY memory adapter.
These do not assert real IndexedDB persistence, service-worker operation, or Safari support.
Run: node tests/build-ui-harness.mjs && python tests/browser-ui.py
Requires Python Playwright and Chromium. CHROMIUM_PATH can override the browser path.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os, json
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs'
shots = OUT / 'screenshots'
shots.mkdir(exist_ok=True)
html = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#f6f7f8"><title>ForgeFit UI test</title><style>''' + (ROOT/'src/styles.css').read_text() + '''</style></head><body><div id="app"></div><dialog id="sheet" aria-labelledby="dialog-title"></dialog><div id="toast" role="status" aria-live="polite"></div><input id="import-file" type="file" accept="application/json,.json" hidden></body></html>'''
results=[]
def passed(name): results.append({'test':name,'result':'PASS'});print('PASS',name,flush=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':430,'height':932},device_scale_factor=2,is_mobile=True,has_touch=True,accept_downloads=True)
    page=context.new_page();page.set_default_timeout(7000);errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html);page.add_script_tag(content=(ROOT/'tests/ui-harness.js').read_text())
    state=lambda:page.evaluate("__test.require('./storage.js').store.state")
    click=lambda name:page.get_by_role('button',name=name,exact=True).click()
    sheet=page.locator('#sheet')
    def action(name):page.locator(f'[data-action="{name}"]').first.click()
    try:
        sheet.locator('input[name="name"]').fill('Artūras')
        click('Set up my tracker');click('Dismiss installation tip')
        assert state()['settings']['name']=='Artūras' and len(state()['history'])==0
        passed('Onboarding and real empty state')
        page.screenshot(path=str(shots/'dashboard.png'),full_page=False)
        click('Workout');page.screenshot(path=str(shots/'workouts.png'),full_page=False)
        page.locator('[data-to="routine:home-push"]').click();click('Start workout')
        assert state()['active']['name']=='Push'
        click('Complete set 1');assert not state()['active']['exercises'][0]['sets'][0]['done']
        assert 'Enter a weight' in page.locator('#toast').inner_text()
        passed('Empty load validation prevents invalid completion')
        page.get_by_label('Set 1 weight',exact=True).fill('12,5');page.get_by_label('Set 1 reps',exact=True).fill('12');click('Complete set 1')
        x=state()['active']['exercises'][0]['sets'][0];assert x['done'] and x['weight']=='12.5' and x['reps']=='12'
        assert state()['active']['restEnd'] is not None
        passed('Decimal-comma logging and automatic rest start')
        action('pause');assert state()['active']['runningSince'] is None
        assert page.get_by_role('button',name='Complete set 2',exact=True).is_disabled()
        action('pause');assert state()['active']['runningSince'] is not None
        passed('Pause/resume and paused input protection')
        click('Warm-up');assert state()['active']['exercises'][0]['sets'][0]['kind']=='warmup'
        page.get_by_label('Set 1 weight',exact=True).fill('5');click('Complete set 1')
        click('Set 2 details');sheet.locator('input[name="rir"]').fill('1');click('Save set')
        assert state()['active']['exercises'][0]['sets'][1]['rir']=='1'
        passed('Warm-up creation and RIR editing')
        action('exercise-note');sheet.locator('textarea').fill('<script>unsafe()</script> Test cue');click('Save note')
        assert '<script>unsafe()</script>' in page.locator('.note-card').inner_text()
        assert page.locator('.note-card script').count()==0
        passed('Exercise notes escape HTML instead of executing it')
        click('Minimize workout');assert page.locator('.resume-bar').is_visible();page.locator('.resume-bar').click()
        assert state()['active']['exercises'][0]['sets'][1]['done']
        passed('Minimize/resume preserves in-memory session state')
        page.screenshot(path=str(shots/'logger.png'),full_page=False)
        click('Finish');sheet.locator('textarea').fill('UI test session — not user history');click('Save workout')
        assert state()['active'] is None and len(state()['history'])==1
        saved=state()['history'][0];assert len(saved['exercises'])==1 and len(saved['exercises'][0]['sets'])==2
        passed('Finish keeps checked sets and excludes unchecked exercises')
        page.locator('[data-action="history-set"]').nth(1).click();sheet.locator('input[name="weight"]').fill('15');sheet.locator('input[name="reps"]').fill('10');click('Save set')
        assert state()['history'][0]['exercises'][0]['sets'][1]['weight']=='15'
        passed('Saved workout set editing')
        action('history-meta');sheet.locator('input[name="name"]').fill('Edited Push');sheet.locator('input[name="minutes"]').fill('35');click('Save changes')
        assert state()['history'][0]['name']=='Edited Push' and state()['history'][0]['duration']==2100000
        passed('History title and duration correction')
        click('Workout');page.locator('[data-to="routine:home-push"]').click();click('Start workout')
        assert page.get_by_label('Set 1 weight',exact=True).input_value()=='15'
        assert '15 × 10' in page.locator('.previous-value').first.inner_text()
        passed('Previous working performance prefill excludes warm-ups')
        click('Discard workout');click('Confirm');assert state()['active'] is None
        passed('Discard removes only the unfinished workout')
        click('New routine');sheet.locator('input[name="name"]').fill('Custom core')
        click('Add exercise');page.get_by_label('Search exercises',exact=True).fill('plank')
        assert sheet.locator('.library-row').count()==2
        sheet.locator('.library-row').filter(has_text='Side Plank').click()
        assert sheet.locator('.plan-editor').count()==1
        click('Add exercise');click('Create custom exercise')
        sheet.locator('input[name="name"]').fill('Test Hold');sheet.locator('select[name="metric"]').select_option('time');sheet.locator('select[name="muscle"]').select_option('Core');click('Create exercise')
        assert sheet.locator('.plan-editor').count()==2
        sheet.get_by_role('button',name='Move exercise up',exact=True).nth(1).click()
        assert 'Test Hold' in sheet.locator('.plan-editor').first.inner_text()
        click('Save routine');r=next(x for x in state()['routines'] if x['name']=='Custom core')
        assert next(x for x in state()['exercises'] if x['id']==r['exercises'][0]['exerciseId'])['name']=='Test Hold'
        passed('Routine creation, library search, custom exercise, and reordering')
        click('Duplicate');assert len([x for x in state()['routines'] if x['name'].startswith('Custom core')])==2
        click('Delete routine');click('Confirm');assert any(x['name']=='Custom core (copy)' for x in state()['routines'])
        passed('Duplicate and delete routines without deleting history')
        click('More');action('goals');sheet.locator('input[name="workouts"]').fill('5');sheet.locator('input[name="sets"]').fill('70');click('Save targets')
        assert state()['settings']['weeklyWorkouts']==5 and state()['settings']['weeklySets']==70
        passed('Editable dashboard targets')
        click('Dark');assert page.locator('html').get_attribute('data-theme')=='dark'
        page.screenshot(path=str(shots/'dark-settings.png'),full_page=False)
        click('Light');assert page.locator('html').get_attribute('data-theme')=='light'
        passed('Light and dark theme switching')
        before=json.dumps(state(),sort_keys=True)
        page.locator('#import-file').set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':b'{"format":"foreign","schema":1}'})
        assert 'Not a supported ForgeFit backup' in page.locator('#toast').inner_text()
        assert before==json.dumps(state(),sort_keys=True)
        passed('Invalid import leaves current data untouched')
        valid=page.evaluate("JSON.stringify(__test.require('./model.js').backup(__test.require('./storage.js').store.state))")
        data=json.loads(valid);data['data']['settings']['name']='Restored profile'
        page.locator('#import-file').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':json.dumps(data).encode()})
        assert sheet.get_by_role('heading',name='Restore this backup?').is_visible()
        assert state()['settings']['name']=='Artūras'
        click('Replace with backup');assert state()['settings']['name']=='Restored profile'
        passed('Valid import is reviewed before replacement (memory adapter)')
        click('More');action('restore-previous');click('Replace with backup')
        assert state()['settings']['name']=='Artūras'
        passed('Before-import recovery snapshot restores previous state (memory adapter)')
        click('Workout');page.locator('[data-to="routine:home-pull"]').click();click('Start workout');click('Complete set 1')
        action('exercise-actions');action('swap-exercise');page.get_by_label('Search exercises',exact=True).fill('plank');sheet.locator('.library-row').filter(has_text='Side Plank').click()
        assert state()['active']['exercises'][0]['name']=='Pull-up'
        click('Confirm');assert state()['active']['exercises'][0]['name']=='Side Plank'
        assert not any(x['done'] for x in state()['active']['exercises'][0]['sets'])
        passed('Exercise replacement requires confirmation before losing current sets')
        click('Complete set 1');assert state()['active']['exercises'][0]['sets'][0]['done']
        click('Finish');click('Save workout');assert len(state()['history'])==2
        passed('Timed exercise logging and finish')
        click('Dashboard')
        for width,height in [(320,640),(375,812),(390,844),(430,932),(932,430),(1280,900)]:
            page.set_viewport_size({'width':width,'height':height})
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),f'Overflow at {width}'
        passed('No horizontal overflow at 320–1280 px in dashboard layout')
        page.set_viewport_size({'width':375,'height':812});click('Workout');click('New routine');click('Add exercise')
        assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
        assert sheet.locator('.library-row').count()==57
        passed('Narrow-screen routine and exercise-library dialogs')
        assert not errors,errors
        passed('No JavaScript runtime exceptions during the UI scenarios')
    except Exception as e:
        page.screenshot(path=str(OUT/'ui-test-failure.png'),full_page=True)
        results.append({'test':'execution','result':'FAIL','error':str(e)})
        (OUT/'ui-test-results.json').write_text(json.dumps({'adapter':'TEST-ONLY IN-MEMORY, not real IndexedDB or service worker','results':results,'runtime_errors':errors},indent=2))
        raise
    (OUT/'ui-test-results.json').write_text(json.dumps({'adapter':'TEST-ONLY IN-MEMORY, not real IndexedDB or service worker','results':results,'runtime_errors':errors},indent=2))
    browser.close()
print(f'{len(results)} UI scenarios passed.')
