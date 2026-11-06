# Architecture — ForgeFit 0.1.0

## Boundaries

A static, browser-native TypeScript PWA. No server-side component, database service, React/Expo runtime, remote assets, or runtime package loader. Versioned data schema 1 is independent of rendering. The earlier React/Vite proposal was not used in this build.

`app.ts` (events/navigation/timers) → `model.ts` (typed domain operations) → `storage.ts` (journal + IndexedDB commits). `views.ts`/`dialogs.ts`/`components.ts` render escaped state; `styles.css` supplies the responsive design. `seeds.ts` supplies editable examples without historical records.

## Storage and recovery

The IndexedDB database `forgefit-local` contains a `state` store and a `recovery` store. The first version persists one aggregate state document, chosen for simple atomic session/history transitions rather than multiple partially updated tables. This is reasonable for an initial personal tracker; if histories grow large, later schema migrations should move sessions to individually indexed records.

Every mutation clones the current state, applies an operation, and assigns a change ID. A synchronous localStorage draft journal is attempted, followed by serialized IndexedDB writes. Each write reads the expected revision and commits only when it matches. A concurrent window cannot silently overwrite a newer revision. A BroadcastChannel refreshes idle windows. Conflicts and persistence failures remain visible, and the in-memory draft remains exportable.

On load, a matching-revision journal can recover unsaved changes. A conflicting journal is kept separately for export instead of being silently merged. Browsers and operating systems can still lose/evict local storage; the journal is a local recovery mechanism, not a cloud backup or a power-failure guarantee.

Backup files are identified as `forgefit-backup`, versioned, limited in size, and reconstructed using an allowlisted schema. Validation covers ranges, IDs, duplicates, completed sets, routine references, and active/history consistency. Import review precedes replacement. A single pre-import snapshot is written to the separate recovery store first. The previous-import restore is also a replacement, not a merge.

## Exercise and session semantics

Exercise metrics are weight/reps, bodyweight with optional external load/reps, or timed seconds. Historical exercises retain name/equipment/muscle snapshots. Working/drop sets count in working totals; warm-ups remain visible in history but do not inflate those totals. Volume is recorded external kg × repetitions only. No estimated body mass or unilateral/dumbbell multiplier is hidden in the calculation.

Session elapsed time accumulates running intervals, not interval-timer ticks. Rest stores an absolute deadline. Pausing captures elapsed and remaining rest; resuming establishes new timestamps. Background JavaScript execution and locked-screen audio are not assumptions of the timing model. Wall-clock changes on the device can affect deadline-based readings; there is no server clock.

Finishing validates checked sets and commits the completed history entry and removal of the active session together. The app rejects duplicate session IDs. Unchecked sets are intentionally not included in finished history. History corrections update the original local session.

## Interface

Escaped string templates and delegated event handlers provide the UI. Live numeric input does not trigger a full document redraw, preserving the keyboard/focus. Main views use hash routes. Native `dialog` supplies modal focus handling; stacked dialog state supports routine/library flows. Safe-area CSS, visual-viewport sizing, touch controls, and system fonts target iPhone use without downloaded font files.

Targets and progress reflect only stored data. No invented activity, prefilled weighted loads, or fake charts are shipped. Starter RIR/repetition/set targets are editable template values, not measured performance or adaptive coaching.

## Offline shell and updates

The build script compiles native ES modules, copies local assets, hashes the shell, and emits a service worker. The worker precaches its complete required asset list; failed installation removes the incomplete new cache. Cache prefixes include the registration scope, so cleanup targets this app scope's older shells.

Navigation receives the cached app shell; known static resources are cache-first. A changed shell installs as a waiting worker. The UI sends SKIP_WAITING only after user action and a save flush, and blocks that action during an active session/open edit. Initial controller acquisition is not treated as an update. App records are not stored in the shell cache and are not deleted when old shell caches are cleaned.

There is no remote update timer, push subscription, login, or workout-data network API. New application files arrive from the same static origin. The stable production hostname is part of the deployment contract; switching origins requires explicit backup transfer.

## Build and security

The compiler is pinned to TypeScript 5.8.3. The build and loopback preview server use Node's standard library. HTML CSP restricts scripts to this origin; no inline script handlers or eval are used by the production app. Style attributes are permitted for progress widths. HTML-escaping covers user text, and imported identifiers are restricted to safe identifier characters. These measures are not a substitute for a full security review.

Test instrumentation is confined to `tests/`, never the shipped `dist` folder. See the test report for unvalidated native integration and device behavior.
