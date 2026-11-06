import { VERSION, clone, uid, numeric, setError, startSession, loggedExercise, finish, elapsed, pause, resume, completed, backup, parseBackup, validateState, day } from './model.js';
import { store } from './storage.js';
import { ui } from './ui.js';
import { renderApp, historyRows } from './views.js';
import { renderDialog, libraryResults } from './dialogs.js';
import { esc, clock } from './components.js';
const root = document.querySelector('#app');
const sheet = document.querySelector('#sheet');
const toastEl = document.querySelector('#toast');
const importInput = document.querySelector('#import-file');
let toastTimeout = 0, busy = false, registration = null;
let audio = null, lastBeepEnd = 0, wake = null;
const topModal = () => ui.dialogs.at(-1);
function toast(message) { toastEl.textContent = message; toastEl.classList.add('visible'); window.clearTimeout(toastTimeout); toastTimeout = window.setTimeout(() => toastEl.classList.remove('visible'), 4500); }
function report(error) { const message = error instanceof Error ? error.message : String(error); toast(message); if (sheet.open) {
    let box = sheet.querySelector('.form-error.dynamic');
    if (!box) {
        box = document.createElement('p');
        box.className = 'form-error dynamic';
        box.setAttribute('role', 'alert');
        sheet.querySelector('.sheet-content')?.prepend(box);
    }
    box.textContent = message;
    box.scrollIntoView({ block: 'nearest' });
} saveStatus(); }
function applyTheme() { const theme = store.state.settings.theme; document.documentElement.dataset.theme = theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme; document.querySelector('meta[name="theme-color"]')?.setAttribute('content', document.documentElement.dataset.theme === 'dark' ? '#17191e' : '#f6f7f8'); }
function renderModal() { const m = topModal(); if (!m) {
    if (sheet.open)
        sheet.close();
    sheet.innerHTML = '';
    document.body.classList.remove('modal-open');
    return;
} const oldScroll = sheet.scrollTop; sheet.innerHTML = renderDialog(store.state, ui, m); document.body.classList.add('modal-open'); if (!sheet.open) {
    sheet.showModal();
    sheet.scrollTop = 0;
    sheet.querySelector('.sheet-header button')?.focus({ preventScroll: true });
}
else
    sheet.scrollTop = oldScroll; }
function render(keepScroll = true) { const y = window.scrollY; applyTheme(); root.innerHTML = renderApp(store.state, ui); renderModal(); saveStatus(); tick(); if (keepScroll)
    window.scrollTo(0, y); }
function openModal(m, replace = false) { if (replace)
    ui.dialogs = []; ui.dialogs.push(m); renderModal(); sheet.scrollTop = 0; }
function closeModal(force = false) { const m = topModal(); if (!m)
    return; if (!force && m.type === 'routine-edit' && ui.routineDraft) {
    const original = store.state.routines.find(r => r.id === ui.routineDraft.id);
    if (JSON.stringify(original) !== JSON.stringify(ui.routineDraft)) {
        openModal({ type: 'confirm', action: 'discard-routine-draft', title: 'Discard routine changes?', message: 'Your saved routine will not be changed.' });
        return;
    }
} if (m.type === 'welcome' && !store.state.settings.onboardingDone)
    store.change(s => { s.settings.onboardingDone = true; }); ui.dialogs.pop(); renderModal(); }
function clearModals() { ui.dialogs = []; renderModal(); }
function routeFromHash() { const raw = decodeURIComponent(location.hash.replace(/^#\/?/, '')); return /^(dashboard|workouts|progress|settings|session|history)$/.test(raw) || /^(routine|detail|exercise):[\w-]+$/.test(raw) ? raw : 'dashboard'; }
function go(route) { ui.dialogs = []; ui.route = route; history.pushState(null, '', `#/${route}`); render(false); window.scrollTo(0, 0); }
function change(fn, redraw = true) { store.change(fn); if (redraw)
    render(); }
function confirm(action, title, message, extra = {}) { openModal({ ...extra, type: 'confirm', action, title, message }); }
function active() { if (!store.state.active)
    throw Error('No workout is in progress.'); return store.state.active; }
function syncRoutine() { const form = sheet.querySelector('[data-form="routine"]'); if (!form || !ui.routineDraft)
    return; if (!form.reportValidity())
    throw Error('Check the routine fields before continuing.'); ui.routineDraft.name = form.elements.namedItem('name').value; ui.routineDraft.subtitle = form.elements.namedItem('subtitle').value; }
function openLibrary(context = 'browse') { if (topModal()?.type === 'routine-edit')
    syncRoutine(); ui.libSearch = ''; ui.libMuscle = 'All'; ui.libEquipment = 'All'; openModal({ type: 'library', context }); }
function refreshLibrary() { const results = sheet.querySelector('#library-results'); if (results)
    results.innerHTML = libraryResults(store.state, ui, topModal()?.context ?? 'browse'); }
function addExercise(id, context) {
    const e = store.state.exercises.find(x => x.id === id);
    if (!e)
        throw Error('Exercise not found.');
    if (context === 'routine') {
        if (!ui.routineDraft)
            throw Error('Open a routine first.');
        if (ui.routineDraft.exercises.length >= 100)
            throw Error('A routine can contain up to 100 exercises.');
        ui.routineDraft.exercises.push({ id: uid(), exerciseId: id, sets: 3, reps: e.metric === 'time' ? 45 : 10, rest: store.state.settings.defaultRest, rir: e.metric === 'time' ? null : 2 });
        while (topModal() && topModal().type !== 'routine-edit')
            ui.dialogs.pop();
        renderModal();
        return;
    }
    if (context === 'active' || context === 'swap') {
        const s = active();
        if (context === 'active' && s.exercises.length >= 100)
            throw Error('A session can contain up to 100 exercises.');
        change(state => { const a = state.active; const ex = loggedExercise(e, undefined, state.history, state.settings.defaultRest); if (context === 'swap') {
            a.exercises[a.current] = ex;
            a.restEnd = null;
            a.pausedRest = null;
        }
        else {
            a.exercises.push(ex);
            a.current = a.exercises.length - 1;
        } }, false);
        go('session');
        return;
    }
    clearModals();
    go(`exercise:${id}`);
}
function start(routine) { if (!store.state.active)
    change(s => { s.active = startSession(s, routine); }, false); go('session'); void updateWake(); }
function move(items, from, to) { if (from < 0 || to < 0 || from >= items.length || to >= items.length)
    return; const [x] = items.splice(from, 1); items.splice(to, 0, x); }
function setDialog(m) { const s = m.context === 'history' ? store.state.history.find(x => x.id === m.id) : store.state.active; const ex = s?.exercises.find(x => x.id === m.exId), set = ex?.sets.find(x => x.id === m.setId); if (!set)
    throw Error('Set not found.'); ui.setDraft = clone(set); openModal({ ...m, type: 'set' }); }
function prepareAudio() { if (!store.state.settings.sound)
    return; try {
    audio ??= new AudioContext();
    void audio.resume();
}
catch { } }
function beep() { if (!audio || audio.state !== 'running')
    return; const osc = audio.createOscillator(), gain = audio.createGain(); osc.connect(gain); gain.connect(audio.destination); osc.frequency.value = 880; gain.gain.setValueAtTime(.06, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .35); osc.start(); osc.stop(audio.currentTime + .35); }
async function updateWake() { const should = store.state.settings.keepAwake && store.state.active?.runningSince != null && document.visibilityState === 'visible'; if (!should) {
    if (wake)
        await wake.release();
    wake = null;
    return;
} if (!('wakeLock' in navigator) || wake)
    return; try {
    wake = await navigator.wakeLock.request('screen');
    wake.addEventListener('release', () => { wake = null; });
}
catch { /* System policy may deny a wake lock; logging does not depend on it. */ } }
function tick() { const s = store.state.active; if (!s)
    return; document.querySelectorAll('[data-live="duration"]').forEach(el => el.textContent = clock(elapsed(s), ui.route === 'session')); const remaining = s.pausedRest ?? (s.restEnd ? Math.max(0, s.restEnd - Date.now()) : 0); document.querySelectorAll('[data-live="rest"]').forEach(el => el.textContent = clock(Math.ceil(remaining / 1000) * 1000)); document.querySelectorAll('[data-live="restbar"]').forEach(el => el.style.width = `${s.restLength ? Math.min(100, remaining / s.restLength * 100) : 0}%`); if (s.restEnd && remaining <= 0 && lastBeepEnd !== s.restEnd) {
    lastBeepEnd = s.restEnd;
    if (store.state.settings.sound && document.visibilityState === 'visible' && Date.now() - s.restEnd < 1500)
        beep();
} }
function saveStatus() { document.querySelectorAll('[data-save-status]').forEach(el => el.textContent = store.error ? 'Save needs attention' : store.saving ? 'Saving…' : 'Saved locally'); const warning = document.querySelector('#save-warning'); if (warning) {
    warning.hidden = !store.error;
    warning.textContent = store.error;
} }
function downloadBlob(blob, name) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
async function exportBackup(data = store.state, record = true) { const name = `ForgeFit-backup-${day(Date.now())}-${new Date().toTimeString().slice(0, 8).replaceAll(':', '')}.json`; const file = new File([JSON.stringify(backup(data), null, 2)], name, { type: 'application/json' }); if (navigator.canShare?.({ files: [file] })) {
    try {
        await navigator.share({ files: [file], title: 'ForgeFit workout backup' });
    }
    catch (e) {
        if (e instanceof Error && e.name === 'AbortError')
            return;
        throw e;
    }
}
else
    downloadBlob(file, name); if (record && !store.conflict)
    change(s => { s.settings.lastExportAt = Date.now(); }, false); toast('Backup prepared. Keep a copy in Files.'); if (ui.route === 'settings')
    render(); }
async function confirmAction(m) {
    switch (m.action) {
        case 'discard-routine-draft':
            ui.routineDraft = null;
            ui.dialogs = [];
            render();
            break;
        case 'delete-routine':
            change(s => { s.routines = s.routines.filter(r => r.id !== m.id); }, false);
            go('workouts');
            toast('Routine deleted. Workout history is unchanged.');
            break;
        case 'discard-session':
            change(s => { s.active = null; }, false);
            go('workouts');
            void updateWake();
            toast('Unfinished workout discarded.');
            break;
        case 'delete-history':
            change(s => { s.history = s.history.filter(x => x.id !== m.id); }, false);
            go('history');
            toast('Workout deleted.');
            break;
        case 'remove-active':
            change(s => { const a = s.active; a.exercises.splice(a.current, 1); a.current = Math.max(0, Math.min(a.current, a.exercises.length - 1)); a.restEnd = null; a.pausedRest = null; }, false);
            go('session');
            break;
        case 'swap-selected':
            addExercise(m.id, 'swap');
            break;
        case 'delete-set': {
            const context = m.context;
            change(s => { const session = context === 'history' ? s.history.find(x => x.id === m.id) : s.active; if (context === 'history' && completed(session, true) <= 1)
                throw Error('Use Delete workout to remove the final recorded set.'); const ex = session.exercises.find(x => x.id === m.exId); ex.sets = ex.sets.filter(x => x.id !== m.setId); if (context === 'history')
                session.exercises = session.exercises.filter(x => x.sets.length); session.current = Math.max(0, Math.min(session.current, session.exercises.length - 1)); }, false);
            ui.dialogs = [];
            render();
            break;
        }
    }
}
async function action(el) {
    const a = el.dataset.action, id = el.dataset.id, m = topModal();
    switch (a) {
        case 'navigate':
            go(el.dataset.to);
            break;
        case 'modal-close':
            closeModal();
            break;
        case 'create':
            openModal({ type: 'create' }, true);
            break;
        case 'install':
            openModal({ type: 'install' });
            break;
        case 'dismiss-install':
            ui.installDismissed = true;
            render();
            break;
        case 'week-current':
            ui.weekOffset = 0;
            render();
            break;
        case 'week-previous':
            ui.weekOffset = -1;
            render();
            break;
        case 'goals':
        case 'profile':
        case 'about':
        case 'diagnostics':
            openModal({ type: a });
            break;
        case 'metric-sets':
            ui.progressMetric = 'sets';
            render();
            break;
        case 'metric-volume':
            ui.progressMetric = 'volume';
            render();
            break;
        case 'new-routine':
            ui.routineDraft = { id: uid(), name: 'New workout', subtitle: '', exercises: [] };
            openModal({ type: 'routine-edit' }, true);
            break;
        case 'edit-routine': {
            const r = store.state.routines.find(x => x.id === id);
            if (!r)
                throw Error('Routine not found.');
            ui.routineDraft = clone(r);
            openModal({ type: 'routine-edit' }, true);
            break;
        }
        case 'duplicate-routine':
            change(s => { const r = clone(s.routines.find(x => x.id === id)); r.id = uid(); r.name = (r.name + ' (copy)').slice(0, 80); r.exercises.forEach(x => x.id = uid()); s.routines.splice(s.routines.findIndex(x => x.id === id) + 1, 0, r); });
            toast('Routine duplicated.');
            break;
        case 'routine-up':
        case 'routine-down':
            change(s => { const i = s.routines.findIndex(x => x.id === id); move(s.routines, i, i + (a === 'routine-up' ? -1 : 1)); });
            break;
        case 'delete-routine':
            confirm('delete-routine', 'Delete this routine?', 'Completed workouts and any active session will stay intact.', { id });
            break;
        case 'plan-up':
        case 'plan-down':
        case 'plan-delete':
            syncRoutine();
            if (ui.routineDraft) {
                const i = ui.routineDraft.exercises.findIndex(x => x.id === id);
                if (a === 'plan-delete')
                    ui.routineDraft.exercises.splice(i, 1);
                else
                    move(ui.routineDraft.exercises, i, i + (a === 'plan-up' ? -1 : 1));
                renderModal();
            }
            break;
        case 'start-empty':
            start(null);
            break;
        case 'start-routine':
            start(store.state.routines.find(x => x.id === id) ?? null);
            break;
        case 'library-open':
            openLibrary(el.dataset.context ?? 'browse');
            break;
        case 'custom-exercise':
            openModal({ type: 'custom', context: el.dataset.context ?? m?.context ?? 'browse' });
            break;
        case 'open-exercise':
            go(`exercise:${id}`);
            break;
        case 'pick-exercise':
            if (m?.context === 'swap')
                confirm('swap-selected', 'Replace this exercise?', 'The current exercise and its logged sets will be removed from this unfinished workout only.', { id });
            else
                addExercise(id, m?.context ?? 'active');
            break;
        case 'select-exercise':
            change(s => { if (s.active)
                s.active.current = Number(el.dataset.index); });
            break;
        case 'previous-exercise':
        case 'next-exercise':
            change(s => { const x = s.active; x.current = Math.max(0, Math.min(x.current + (a === 'previous-exercise' ? -1 : 1), x.exercises.length - 1)); });
            break;
        case 'pause':
            change(s => { const x = s.active; if (x.runningSince === null)
                resume(x);
            else
                pause(x); });
            void updateWake();
            break;
        case 'complete-set': {
            const s = active(), ex = s.exercises[s.current], set = ex.sets.find(x => x.id === el.dataset.set);
            if (s.runningSince === null)
                throw Error('Resume the workout first.');
            if (!set.done) {
                const error = setError(set, ex.metric);
                if (error)
                    throw Error(error);
            }
            prepareAudio();
            change(state => { const x = state.active, e = x.exercises[x.current], r = e.sets.find(r => r.id === el.dataset.set); r.done = !r.done; if (r.done) {
                r.weight = ex.metric === 'time' ? '0' : String(numeric(r.weight));
                r.reps = String(numeric(r.reps));
                x.restLength = e.rest * 1000;
                x.restEnd = e.rest ? Date.now() + e.rest * 1000 : null;
                x.pausedRest = null;
            }
            else {
                x.restEnd = null;
                x.pausedRest = null;
            } });
            break;
        }
        case 'add-set':
        case 'add-warmup':
            change(s => { const ex = s.active.exercises[s.active.current]; if (ex.sets.length >= 100)
                throw Error('Maximum 100 sets per exercise.'); const last = ex.sets.at(-1); const set = { id: uid(), kind: a === 'add-warmup' ? 'warmup' : 'work', weight: last?.weight ?? (ex.metric === 'weight' ? '' : '0'), reps: last?.reps ?? (ex.metric === 'time' ? '45' : '10'), rir: last?.rir ?? '', done: false }; if (a === 'add-warmup')
                ex.sets.unshift(set);
            else
                ex.sets.push(set); });
            break;
        case 'set-details': {
            const ex = active().exercises[active().current];
            setDialog({ type: 'set', context: 'active', exId: ex.id, setId: el.dataset.set });
            break;
        }
        case 'history-set':
            setDialog({ type: 'set', context: 'history', id, exId: el.dataset.ex, setId: el.dataset.set });
            break;
        case 'delete-set':
            if (m)
                confirm('delete-set', 'Remove this set?', 'This removes the set from this workout only.', { context: m.context, id: m.id, exId: m.exId, setId: m.setId });
            break;
        case 'exercise-actions':
            openModal({ type: a, id });
            break;
        case 'exercise-info':
            openModal({ type: a, id });
            break;
        case 'exercise-note':
            openModal({ type: 'note', context: 'exercise', id });
            break;
        case 'session-note':
            openModal({ type: 'note', context: 'session' });
            break;
        case 'swap-exercise':
            openLibrary('swap');
            break;
        case 'move-active-up':
        case 'move-active-down':
            change(s => { const x = s.active, i = x.current, to = i + (a === 'move-active-up' ? -1 : 1); if (to >= 0 && to < x.exercises.length) {
                move(x.exercises, i, to);
                x.current = to;
            } }, false);
            clearModals();
            render();
            break;
        case 'remove-active-exercise':
            confirm('remove-active', 'Remove this exercise?', 'All of its sets will be removed from this unfinished workout.');
            break;
        case 'rest-open':
            openModal({ type: 'rest', context: 'active' });
            break;
        case 'default-rest':
            openModal({ type: 'rest', context: 'default' });
            break;
        case 'rest-preset': {
            const input = sheet.querySelector('input[name="rest"]');
            if (input)
                input.value = el.dataset.value;
            break;
        }
        case 'rest-add':
            change(s => { const x = s.active, remaining = x.pausedRest ?? (x.restEnd ? Math.max(0, x.restEnd - Date.now()) : 0); const n = Math.min(3600000, remaining + 30000); x.restLength = n; if (x.runningSince === null)
                x.pausedRest = n;
            else
                x.restEnd = Date.now() + n; }, false);
            closeModal(true);
            tick();
            prepareAudio();
            break;
        case 'rest-skip':
            change(s => { if (s.active) {
                s.active.restEnd = null;
                s.active.pausedRest = null;
            } }, false);
            closeModal(true);
            tick();
            break;
        case 'finish-open':
            if (store.state.active)
                openModal({ type: 'finish' }, true);
            break;
        case 'discard-session':
            confirm('discard-session', 'Discard this workout?', 'The unfinished workout will be removed. Saved workout history stays intact.');
            break;
        case 'history-meta':
            openModal({ type: 'history-meta', id });
            break;
        case 'delete-history':
            confirm('delete-history', 'Delete this workout?', 'This removes the completed workout and its recorded sets. Export a backup first to keep a separate copy.', { id });
            break;
        case 'confirm-action':
            if (m)
                await confirmAction(m);
            break;
        case 'theme':
            change(s => { s.settings.theme = el.dataset.value; });
            break;
        case 'toggle-sound':
            change(s => { s.settings.sound = !s.settings.sound; });
            prepareAudio();
            break;
        case 'toggle-awake':
            change(s => { s.settings.keepAwake = !s.settings.keepAwake; });
            if (!('wakeLock' in navigator))
                toast('This browser does not expose screen wake lock.');
            await updateWake();
            break;
        case 'export':
            await exportBackup();
            break;
        case 'export-recovery':
            if (store.recoveryJournal)
                await exportBackup(store.recoveryJournal, false);
            break;
        case 'import-open':
            importInput.value = '';
            importInput.click();
            break;
        case 'restore-previous': {
            const old = await store.beforeImport();
            if (!old)
                throw Error('No previous import snapshot exists yet.');
            ui.pendingImport = validateState(old.data);
            openModal({ type: 'import' });
            break;
        }
        case 'apply-import':
            if (ui.pendingImport) {
                await store.replace(ui.pendingImport);
                ui.pendingImport = null;
                ui.dialogs = [];
                ui.routineDraft = null;
                go('dashboard');
                toast('Backup restored. Previous data is kept in Before last import.');
                void updateWake();
            }
            break;
        case 'request-persistence':
            if (navigator.storage?.persist) {
                ui.persistent = await navigator.storage.persist();
                render();
                toast(ui.persistent ? 'Persistent storage granted. Still keep backups.' : 'Storage is best effort. Keep backups in Files.');
            }
            else
                toast('Persistent storage is not available here. Keep exported backups.');
            break;
        case 'check-update':
            if (!navigator.onLine)
                throw Error('Reconnect briefly to check for updates.');
            if (!registration)
                throw Error('Offline app registration is not ready yet. Reload this HTTPS page.');
            await registration.update();
            ui.updateReady = !!registration.waiting;
            render();
            toast(ui.updateReady ? 'An update is ready.' : 'Update check complete. This version is current on your host.');
            break;
        case 'apply-update':
            if (store.state.active)
                throw Error('Finish your workout before applying an update.');
            if (ui.dialogs.length)
                throw Error('Save or close your open edit before updating.');
            await store.flush();
            if (registration?.waiting)
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            else if (ui.updateReady)
                location.reload();
            break;
        case 'export-diagnostics':
            downloadBlob(new Blob([JSON.stringify({ app: 'ForgeFit', version: VERSION, schema: 1, revision: store.revision, saveError: store.error, offlineReady: ui.offlineReady, standalone: ui.standalone, persistence: ui.persistent, online: navigator.onLine, userAgent: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight }, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' }), 'ForgeFit-diagnostics.json');
            toast('Diagnostics exported; no workout records included.');
            break;
    }
}
async function submit(form) {
    const data = new FormData(form), value = (k) => String(data.get(k) ?? ''), m = topModal(), name = form.dataset.form;
    switch (name) {
        case 'welcome':
            change(s => { s.settings.name = value('name').trim(); s.settings.onboardingDone = true; if (!data.has('templates'))
                s.routines = []; }, false);
            ui.dialogs = [];
            render();
            break;
        case 'profile':
            change(s => { s.settings.name = value('name').trim(); }, false);
            closeModal(true);
            render();
            break;
        case 'goals':
            change(s => { s.settings.weeklyWorkouts = Number(value('workouts')); s.settings.weeklySets = Number(value('sets')); s.settings.weeklyExercises = Number(value('exercises')); validateState(s); }, false);
            closeModal(true);
            render();
            break;
        case 'routine': {
            syncRoutine();
            const r = ui.routineDraft;
            r.name = r.name.trim();
            if (!r.name)
                throw Error('Give this routine a name.');
            change(s => { const i = s.routines.findIndex(x => x.id === r.id); if (i < 0)
                s.routines.push(clone(r));
            else
                s.routines[i] = clone(r); validateState(s); }, false);
            ui.routineDraft = null;
            go(`routine:${r.id}`);
            toast('Routine saved.');
            break;
        }
        case 'custom': {
            const name = value('name').trim();
            if (!name)
                throw Error('Enter an exercise name.');
            if (store.state.exercises.some(e => e.name.toLowerCase() === name.toLowerCase()))
                throw Error('That exercise name already exists. Choose a different name.');
            const e = { id: uid(), name, muscle: value('muscle'), equipment: value('equipment'), metric: value('metric'), note: value('note').trim(), custom: true };
            change(s => { s.exercises.push(e); validateState(s); }, false);
            const context = m?.context ?? 'browse';
            if (context === 'browse') {
                ui.dialogs.pop();
                if (topModal()?.type === 'library')
                    renderModal();
                else
                    go(`exercise:${e.id}`);
            }
            else if (context === 'swap') {
                ui.dialogs.pop();
                confirm('swap-selected', 'Replace this exercise?', 'The current exercise’s sets will be removed from this session only.', { id: e.id });
            }
            else
                addExercise(e.id, context);
            toast('Custom exercise created.');
            break;
        }
        case 'set': {
            if (!m || !ui.setDraft)
                throw Error('Set no longer exists.');
            const session = m.context === 'history' ? store.state.history.find(s => s.id === m.id) : active(), ex = session.exercises.find(x => x.id === m.exId);
            const updated = { ...ui.setDraft, weight: ex.metric === 'time' ? '0' : value('weight').replace(',', '.'), reps: value('reps'), rir: value('rir'), kind: value('kind') };
            const error = setError(updated, ex.metric);
            if (error)
                throw Error(error);
            change(s => { const ss = m.context === 'history' ? s.history.find(x => x.id === m.id) : s.active; const e = ss.exercises.find(x => x.id === m.exId); e.sets[e.sets.findIndex(x => x.id === m.setId)] = updated; }, false);
            closeModal(true);
            render();
            break;
        }
        case 'note':
            change(s => { if (m?.context === 'exercise')
                s.active.exercises.find(x => x.id === m.id).note = value('note');
            else
                s.active.note = value('note'); }, false);
            ui.dialogs = [];
            render();
            break;
        case 'rest': {
            const sec = Number(value('rest'));
            if (!Number.isInteger(sec) || sec < 0 || sec > 3600)
                throw Error('Use 0–3,600 seconds.');
            change(s => { if (m?.context === 'default')
                s.settings.defaultRest = sec;
            else if (s.active) {
                const x = s.active, ex = x.exercises[x.current];
                if (ex)
                    ex.rest = sec;
                if (x.restEnd !== null) {
                    x.restEnd = sec ? Date.now() + sec * 1000 : null;
                    x.restLength = sec * 1000;
                }
                if (x.pausedRest !== null) {
                    x.pausedRest = sec * 1000;
                    x.restLength = sec * 1000;
                }
            } }, false);
            closeModal(true);
            render();
            break;
        }
        case 'finish': {
            const s = active();
            const saved = finish({ ...clone(s), note: value('note') });
            change(state => { if (state.history.some(x => x.id === saved.id))
                throw Error('This workout is already saved.'); state.history.push(saved); state.active = null; }, false);
            go(`detail:${saved.id}`);
            await store.flush();
            toast('Workout saved on this device.');
            void updateWake();
            break;
        }
        case 'history-meta': {
            const title = value('name').trim(), start = new Date(value('date')).getTime(), duration = Math.round(Number(value('minutes')) * 60000);
            if (!title || !Number.isFinite(start) || !Number.isFinite(duration) || duration < 0 || duration > 604800000)
                throw Error('Check the name, date, and duration.');
            change(s => { const x = s.history.find(x => x.id === m?.id); x.name = title; x.startedAt = start; x.finishedAt = start + duration; x.duration = duration; x.elapsed = duration; x.note = value('note'); validateState(s); }, false);
            closeModal(true);
            render();
            break;
        }
    }
}
document.addEventListener('click', event => { const el = event.target.closest('[data-action]'); if (!el || el.hasAttribute('disabled'))
    return; if (busy)
    return; busy = true; void action(el).catch(report).finally(() => { busy = false; }); });
document.addEventListener('submit', event => { const form = event.target; if (!form.dataset.form)
    return; event.preventDefault(); if (busy)
    return; busy = true; void submit(form).catch(report).finally(() => { busy = false; }); });
document.addEventListener('input', event => {
    const el = event.target;
    try {
        if (el.hasAttribute('data-library-search')) {
            ui.libSearch = el.value;
            refreshLibrary();
            return;
        }
        if (el.hasAttribute('data-history-search')) {
            ui.historySearch = el.value;
            const results = document.querySelector('#history-results');
            if (results)
                results.innerHTML = historyRows([...store.state.history].filter(x => x.name.toLowerCase().includes(ui.historySearch.toLowerCase())).sort((a, b) => b.startedAt - a.startedAt));
            return;
        }
        if (el.dataset.log) {
            const key = el.dataset.log;
            change(s => { const ex = s.active.exercises[s.active.current], x = ex.sets.find(x => x.id === el.dataset.set); x[key] = el.value; if (x.done && setError(x, ex.metric))
                x.done = false; }, false);
            const ex = active().exercises[active().current], x = ex.sets.find(x => x.id === el.dataset.set);
            const row = el.closest('.set-row');
            row?.classList.toggle('completed', x.done);
            const check = row?.querySelector('.complete-button');
            check?.classList.toggle('checked', x.done);
            check?.setAttribute('aria-pressed', String(x.done));
            return;
        }
        if (el.closest('[data-form="routine"]') && ui.routineDraft) {
            if (el.dataset.planField) {
                const p = ui.routineDraft.exercises.find(p => p.id === el.dataset.id);
                if (p) {
                    const k = el.dataset.planField;
                    if (k === 'rir' && el.value === '')
                        p.rir = null;
                    else if (el.value !== '' && Number.isFinite(Number(el.value)))
                        p[k] = Number(el.value);
                }
            }
            else if (el.name === 'name' || el.name === 'subtitle')
                ui.routineDraft[el.name] = el.value;
        }
    }
    catch (e) {
        report(e);
    }
});
document.addEventListener('change', event => { const el = event.target; if (el.hasAttribute('data-library-muscle')) {
    ui.libMuscle = el.value;
    refreshLibrary();
} if (el.hasAttribute('data-library-equipment')) {
    ui.libEquipment = el.value;
    refreshLibrary();
} });
importInput.addEventListener('change', () => { const file = importInput.files?.[0]; if (!file)
    return; if (file.size > 10 * 1024 * 1024) {
    report(Error('Backup exceeds the 10 MB limit.'));
    return;
} void file.text().then(text => { ui.pendingImport = parseBackup(text); openModal({ type: 'import' }, true); }).catch(report); });
sheet.addEventListener('cancel', event => { event.preventDefault(); closeModal(); });
window.addEventListener('popstate', () => { ui.route = routeFromHash(); ui.dialogs = []; render(false); window.scrollTo(0, 0); });
window.addEventListener('online', () => { ui.online = true; if (!sheet.open)
    render(); });
window.addEventListener('offline', () => { ui.online = false; if (!sheet.open)
    render(); });
window.addEventListener('pagehide', () => { void store.flush().catch(() => { }); });
document.addEventListener('visibilitychange', () => { tick(); void store.flush().catch(() => { }); void updateWake(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
window.visualViewport?.addEventListener('resize', () => { document.documentElement.style.setProperty('--visual-height', `${window.visualViewport?.height ?? innerHeight}px`); document.body.classList.toggle('keyboard-open', (window.visualViewport?.height ?? innerHeight) < innerHeight * .75); });
async function setupServiceWorker() {
    if (!('serviceWorker' in navigator) || !isSecureContext)
        return;
    try {
        let hadController = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.addEventListener('controllerchange', () => { if (!hadController) {
            hadController = true;
            return;
        } if (!store.state.active && !ui.dialogs.length)
            location.reload();
        else {
            ui.updateReady = true;
            toast('Updated app files are ready. Your workout is safe; reload after finishing.');
        } });
        registration = await navigator.serviceWorker.register(new URL('../sw.js', import.meta.url).href, { scope: new URL('../', import.meta.url).pathname, updateViaCache: 'none' });
        ui.updateReady = !!registration.waiting;
        registration.addEventListener('updatefound', () => { const worker = registration?.installing; worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            ui.updateReady = !!registration?.waiting;
            if (!sheet.open)
                render();
        } }); });
        await navigator.serviceWorker.ready;
        const cached = await caches.match(new URL('../index.html', import.meta.url).href);
        ui.offlineReady = !!cached;
        if (!sheet.open)
            render();
    }
    catch (e) {
        console.warn('Offline registration:', e);
        toast('Offline files could not be prepared. Keep this page online and reload.');
    }
}
async function boot() { try {
    await store.init();
    ui.route = routeFromHash();
    store.onStatus = saveStatus;
    store.onExternal = () => { render(); toast('Changes from your other window are loaded.'); };
    if (!store.state.settings.onboardingDone)
        ui.dialogs = [{ type: 'welcome' }];
    render();
    if (store.recovered)
        toast('Your unfinished changes were recovered.');
    if (navigator.storage?.persisted)
        void navigator.storage.persisted().then(v => { ui.persistent = v; }).catch(() => { ui.persistent = false; });
    void setupServiceWorker();
    void updateWake();
    window.setInterval(tick, 250);
}
catch (e) {
    root.innerHTML = `<main class="fatal-screen"><h1>Local storage needs attention</h1><p>${esc(e instanceof Error ? e.message : e)}</p><p>No existing workout data was overwritten. Close other ForgeFit windows and reload. Use a normal Safari tab, not Private Browsing, for installation.</p><button class="button primary" id="reload-app">Reload safely</button></main>`;
    document.querySelector('#reload-app')?.addEventListener('click', () => location.reload());
} }
void boot();
