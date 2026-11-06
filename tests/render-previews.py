"""Render the real UI with the explicit memory test adapter; not iPhone screenshots."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os
ROOT=Path(__file__).resolve().parents[1]
shots=ROOT/'docs/screenshots'
html='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>'''+(ROOT/'src/styles.css').read_text()+'''</style></head><body><div id="app"></div><dialog id="sheet" aria-labelledby="dialog-title"></dialog><div id="toast" role="status" aria-live="polite"></div><input id="import-file" type="file" accept="application/json,.json" hidden></body></html>'''
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    c=b.new_context(viewport={'width':430,'height':932},device_scale_factor=2,is_mobile=True,has_touch=True)
    page=c.new_page();page.set_content(html);page.add_script_tag(content=(ROOT/'tests/ui-harness.js').read_text())
    def click(name):page.get_by_role('button',name=name,exact=True).click()
    click('Set up my tracker');click('Dismiss installation tip')
    page.screenshot(path=str(shots/'dashboard.png'))
    click('Workout');page.screenshot(path=str(shots/'workouts.png'))
    page.locator('[data-to="routine:home-push"]').click();click('Start workout')
    page.get_by_label('Set 1 weight',exact=True).fill('20');page.get_by_label('Set 1 reps',exact=True).fill('10');click('Complete set 1')
    page.screenshot(path=str(shots/'logger.png'))
    click('Minimize workout');click('Discard workout') if page.get_by_role('button',name='Discard workout',exact=True).count() else None
    click('More');click('Dark');page.screenshot(path=str(shots/'dark-settings.png'))
    b.close()
