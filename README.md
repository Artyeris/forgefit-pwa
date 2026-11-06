# ForgeFit 0.1.0

An independent, iPhone-focused workout tracker with familiar dashboard, routine, and focused set-logging flows. The working name is **ForgeFit**. It is not affiliated with MacroFactor and does not contain its branding, assets, source code, or coaching algorithms.

**Delivery status:** built and packaged for initial testing; not deployed to a public URL. This is a first test release, not a fully validated daily-use release.

## Start here

Use **ForgeFit-0.1.0-ready-to-upload.zip** for installation. It contains a complete prebuilt website, with `index.html` at the root. Upload it to a static HTTPS host, then install the hosted site from Safari. A ZIP or local HTML file cannot be installed directly as this PWA.

Read **docs/INSTALL-IPHONE.md**. No build tools are needed to use the prebuilt upload. After its initial online installation and successful offline smoke test, the app is designed to work without an active PC or internet connection. Internet is required for installation and software updates.

## Included

- Dashboard with weekly workout/set/exercise targets, calendar activity, and real training summaries.
- Focused logger: previous working results, kg/reps or timed holds, check-off sets, warm-up/drop types, optional RIR, rest timer, pause/resume, and session/exercise notes.
- Editable routines: create, duplicate, delete, reorder routines and exercises, change targets, replace exercises during a session.
- 56 built-in exercises and custom exercise creation/search/filtering.
- Optional starter split: Pull, Legs A, Push, Core, Shoulders & Arms, Legs B, Active Rest. The templates are editable examples, not an automated prescription.
- Unfinished-session recovery implementation; completed history and set/date/duration/note corrections.
- Basic progress views, per-exercise history, and working-set counts by primary muscle.
- Light, dark, and system appearance; kilograms only in this version.
- Local JSON export/import, validation before replacement, and a pre-import recovery snapshot.
- Local storage status, persistence request, optional foreground timer sound, optional screen wake lock, update prompt, and privacy-conscious diagnostics export.

No sample workout history, personal profile, or test weights are bundled. Screenshots use a disposable test context; the logger preview contains an illustrative entry only.

## Deliberate limits

This release does **not** reproduce all MacroFactor features. There is no adaptive progression, automated program generation, nutrition tracking, Health/Apple Watch integration, cloud sync, account, subscription, exercise-video library, or guaranteed lock-screen alarm. No native iOS binary is included.

Rest time is calculated from timestamps when the app is visible again. iOS may suspend web code in the background, so sound while locked is not promised. Native iPhone behavior still needs the device checks below.

Stored load volume is **entered external kilograms × repetitions** for working and drop sets. Warm-ups and timed holds are excluded. Body mass is not estimated. Paired dumbbells use the entered per-dumbbell load without an automatic ×2 multiplier. These conventions are visible in the app.

## Data and privacy

The shipped code has no backend, remote runtime scripts, remote fonts, advertising, or analytics. The static host serves the app files; workout records remain in this device/browser's IndexedDB. Ordinary hosting request logs can still exist on the hosting provider. Whoever can unlock your device and open the app can see its locally stored data; this is not an encrypted medical record vault.

Keep the same production hostname for every update. Browser storage is tied to its origin. A new preview hostname, custom domain, browser, or Home Screen installation can have a separate store. Export from the old installation and import into the new one rather than assuming data follows automatically.

Use **More → Export backup → Save to Files** regularly, particularly before updates, moving domains, clearing browser data, or removing the icon. Persistent storage requests reduce some risks when granted, but exported backups remain necessary. A local pre-import snapshot is not protection against the device losing all site data.

## Implementation

The earlier React/Vite architecture proposal was simplified for this first build: **strict TypeScript + browser-native DOM, IndexedDB, and Service Worker APIs**. There are **zero runtime dependencies**. TypeScript 5.8.3 is the only build dependency. This is not a React or Expo project.

The source is separated into pure domain logic, storage, views/dialogs, interaction controllers, and styles. Data schema 1 is versioned and independent of the rendering layer. See **docs/ARCHITECTURE.md**.

## Validation

| Check | Result and scope |
|---|---|
| Strict TypeScript check and production build | Passed |
| Pure logic tests | 40 passed |
| Static production-package integrity tests | 5 passed |
| Browser-rendered UI scenarios | 24 passed, with an explicit test-only in-memory storage adapter |
| Runtime errors in those UI scenarios | None observed |
| Real IndexedDB, service worker, offline cold launch, iPhone install | **Not validated in this environment** |
| Physical iPhone/Safari behavior, lock-screen timer, backup share sheet, updates on device | **Not yet tested** |

The available Chromium is managed with a navigation-blocking policy. It was not modified or bypassed. Interface tests used `about:blank` rendering and a clearly isolated memory adapter. The production package always uses the actual IndexedDB adapter; no test harness is shipped in it. A real-browser integration smoke-test script is included but **was not run here**.

Read **docs/TEST-REPORT.md** before entrusting important training history to this version.

## Developer commands (optional)

Node.js 20.11 or newer is required only for local development/preview, not for daily use of the installed app.

```sh
npm install --ignore-scripts
npm run typecheck
npm run build
npm test
node --test tests/package.test.mjs
npm run preview
```

`npm run preview` serves the existing `dist` folder at `http://127.0.0.1:4173`. Do not open `dist/index.html` as a local file. This preview binds to loopback and is not the iPhone deployment method.

Windows helpers: `PREVIEW-WINDOWS.cmd` previews the already built files. `BUILD-WINDOWS.cmd` installs the pinned development compiler if needed, then type-checks, rebuilds, and runs the logic/package tests. They do not deploy a site, change system settings, or require administrator privileges.

Optional UI testing uses Python Playwright and Chromium. The harness generator and the explicit memory adapter are confined to `tests/`:

```sh
node tests/build-ui-harness.mjs
python tests/browser-ui.py
```

For native APIs in a normal unrestricted test environment, run the preview server and then `python tests/browser-real.py`. This creates disposable test data in a fresh browser context. It does not certify iPhone Home Screen behavior.

## Layout

- `src/`: maintainable application source and styles.
- `public/`: HTML, manifest, icons, hosting headers.
- `build/`: compiled ES modules, included for inspection and unit tests without rebuilding.
- `dist/`: prebuilt production files; this is the folder to host.
- `scripts/`: dependency-free Node build/preview helpers.
- `tests/`: domain, static package, explicit memory-adapter UI, and unrun native integration tests.
- `docs/`: install guide, architecture, acceptance checks, actual test output, browser-rendered screenshots.

## Feedback

Include the app version, a screenshot, what you tapped, and what happened instead of the expected result. More → Diagnostics exports environment details without workout records. A workout backup contains personal training information; share it only when needed.
