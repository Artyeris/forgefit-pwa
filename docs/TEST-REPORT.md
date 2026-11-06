# Validation report — ForgeFit 0.1.0

Build date: 6 November 2026. Release designation: **initial test build**.

## What actually ran

| Check | Result |
|---|---|
| Strict TypeScript compilation (`tsc --noEmit`) | Passed |
| Production build and precache generation | Passed |
| Pure domain/model tests | **40 passed, 0 failed** |
| Static production-package checks | **5 passed, 0 failed** |
| Browser-rendered UI scenarios | **24 passed, 0 failed**, using the explicit memory adapter described below |
| Runtime exceptions in those UI scenarios | **0 observed** |
| Dashboard horizontal-overflow checks | Passed at widths 320, 375, 390, 430, 932, and 1280 pixels |
| Narrow routine/library dialog check | Passed at 375 pixels |
| Visual review | Dashboard, routine list, logger, and dark settings browser renders inspected |

Raw results are `unit-test-results.txt`, `package-test-results.txt`, and `ui-test-results.json`. The shell revision is recorded in `BUILD.txt`.

## Exact scope of UI testing

The available Chromium has a managed URL-blocking policy that prevents navigation, including localhost. The policy was not changed or bypassed. Playwright rendered the application's real view/controller code on `about:blank`, with a clearly labelled, **test-only in-memory storage adapter**. That adapter is absent from the production package.

The 24 scenarios cover onboarding, invalid input prevention, decimal-comma loads, set completion, pause/resume controls, warm-up/RIR editing, escaped notes, in-memory minimize/resume, finishing, history corrections, previous-set prefill, discard, routine/custom-exercise/reorder flows, duplicate/delete, goals, themes, invalid/valid import UI, pre-import snapshot UI, replacement confirmation, timed logging, and responsive layout.

These tests prove the exercised controller and view flows work under that adapter. They **do not** prove native IndexedDB durability, crash recovery, cross-window transactions, real browser backup files, service-worker installation/update behavior, offline cold launch, Safari keyboard behavior, iOS Home Screen installation, or locked-screen operation.

`tests/browser-real.py` is provided for native integration testing in an ordinary test environment. It was **not run here**. No native-integration pass result is claimed. The build should not yet be the sole copy of important training records.

## First iPhone acceptance run — still pending

Use a disposable workout and retain any real existing data in a separate backup.

1. **Installation:** publish to a stable HTTPS URL, add it from Safari to Home Screen, and open the icon. Verify the app-style window, notch/home-indicator spacing, large-text behavior, and numeric keyboard.
2. **Offline shell:** while online, wait for More → Offline ready. Enable Airplane Mode with Wi-Fi off, close the app, and reopen from the icon. Verify all screens and the exercise library load.
3. **Native save/recovery:** start a disposable workout, enter a checked set and an unfinished field, confirm the saved status, close/reopen, and verify both. Repeat with the app backgrounded and with the screen locked. Never infer a power-failure guarantee from a normal close test.
4. **Timers:** complete a set, lock the phone, then reopen after the intended rest interval. Verify remaining time recalculates rather than restarting. Do not expect a locked-screen sound. Verify pause/resume does not add paused time to workout duration.
5. **History:** finish, reopen offline, inspect saved sets and correct a weight. Confirm the correction survives another close/reopen.
6. **Files backup:** export through the iOS share sheet to Files and check the JSON exists. Make a harmless test change, restore the export, confirm the review screen and restored data. Verify Before last import recovers the test change. Do not use the only copy of irreplaceable history for this trial.
7. **Two-window safety:** in disposable browser data, make simultaneous edits from two tabs. Verify an older window cannot silently overwrite a newer database revision. A surfaced conflict is acceptable; export the draft before reloading.
8. **Update preservation:** once a later build exists, export first, deploy it to the same production origin, check for updates, finish the active session, and apply. Verify the version, history, routine edits, and offline launch afterward. Do not clear data to update.
9. **Storage errors:** treat any save warning as a failure, not success. Export from the open app and capture diagnostics before clearing or reinstalling anything.

Record pass/fail per step and device/iOS version. Screenshots plus the steps to reproduce are useful feedback. The diagnostics export omits workout records; an actual workout backup does not.

## Remaining limitations

No physical iPhone test, Safari/WebKit runtime test, native integration pass, long-session endurance run, independent security audit, or cloud deployment verification was performed. Background alarms and Health/Watch integration are intentionally outside scope. All screenshot files are browser-rendered previews, not evidence of physical-device testing.
