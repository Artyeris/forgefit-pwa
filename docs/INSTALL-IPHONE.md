# Install ForgeFit 0.1.0 on your iPhone

## What you have

A ready-built PWA, not an App Store app or an IPA. The files have not been deployed to a public website yet. A one-time HTTPS hosting setup is required. Do not try to install the ZIP itself or open its HTML in the Files app.

There is no ForgeFit subscription, Apple Developer membership, Expo Go dependency, or backend to run. The prebuilt app fits easily within Cloudflare Pages' documented free-plan file and asset limits. Hosting account terms and limits remain the provider's responsibility. [1, 2]

## 1. Upload the prebuilt website

Use `ForgeFit-0.1.0-ready-to-upload.zip`, NOT the source ZIP. It already contains the production files; no npm command or framework build is required.

In the Cloudflare dashboard, open **Workers & Pages → Create application → Get started → Drag and drop your files**. Name the project, select/upload the ready-to-upload ZIP, and choose **Deploy site**. The dashboard supports a ZIP or a folder for this method. [1]

Choose a stable project name. Use the project's permanent production address, shaped like `https://your-project.pages.dev`, not a per-deployment preview address. Keep this same project/address for later updates. The dashboard upload is a one-time setup; a desktop browser can be more convenient for managing files, but no computer runs the app during workouts.

Do not add paid services, server functions, a database, a build pipeline, or a custom domain just for this build. Direct Upload is sufficient. Do not upload exported workout backups into the hosted site: those JSON files are your personal data, not web assets.

## 2. Add the hosted site to your iPhone

Open the permanent production address in **Safari**. Use a regular tab, not Private Browsing.

Open the page menu/Share sheet → **Add to Home Screen** → leave **Open as Web App** enabled → **Add**. The exact placement of Share depends on Safari's layout. [3]

Install before recording your real sessions. Do not assume data entered in Safari automatically appears in the Home Screen app. When transferring between contexts, export in the original context and restore in the destination.

## 3. Prepare the installed app for offline use

Launch **ForgeFit from its new Home Screen icon** while connected to the internet. Complete the welcome screen inside that app. The home-training templates are optional and fully editable.

Open **More** and wait until the app status says **Offline ready**. This means the app has observed its cached shell; it is not a substitute for the cold-launch check below.

Switch to Airplane Mode and ensure Wi-Fi is off. Close and reopen ForgeFit from its Home Screen icon. It should load its interface. Start a disposable workout, complete one set, close/reopen, and confirm the entry remains. Finish it and verify it appears in history. Delete that disposable workout afterward.

If any of these checks fails, reconnect, reopen the permanent production URL in the installed app, and retry after offline preparation. Do not clear site data as a first troubleshooting step. Preserve any existing records by exporting before destructive troubleshooting.

## 4. Train without a computer

Open Workout, choose a routine, and tap Start workout. Enter kg/reps and tap the checkmark for each completed set. Tap a set number for its type and optional RIR. Timed exercises use seconds. Rest starts after a checked set.

Changes are intended to save automatically. Confirm the saved status before terminating the app. A save warning must be treated as a problem: keep the app open and export a backup. Finish stores the checked sets in history; unchecked sets are omitted. Pause excludes the paused interval from session duration.

The intended daily workflow does not require a PC, a development server, or internet. The first installation and future software updates do require internet. Real iPhone validation is still part of this initial test release.

## 5. Keep a portable backup

Open **More → Export backup**. On iPhone, choose **Save to Files** in the share sheet when available. Keep the resulting `.json` file in your chosen backup location. Check that the file actually exists; the app's export date does not prove it was saved successfully.

To restore: **More → Restore from backup**, choose the JSON file, review its counts, then confirm replacement. Restore replaces the entire local dataset rather than merging. The prior data is retained as one local pre-import snapshot. Export a separate copy for protection against total site-data loss.

WebKit documents best-effort storage and possible eviction under storage pressure. The persistence request is helpful when granted but is not an unconditional data-retention guarantee. [4]

## 6. Apply future app versions without losing your history

First export your backup. Upload the next ready-to-upload ZIP to the **same Cloudflare Pages project as a production deployment**, keeping the permanent hostname unchanged. Do not delete the project, clear website data, or reinstall the icon as an update mechanism.

Reconnect ForgeFit and choose **More → Check for updates**. Finish the active workout and save/close any open edit before applying the update. The app keeps workout records separate from its cached app files. Recheck your history and offline launch afterward. Changing domains/contexts requires backup export/import.

## Known first-version boundaries

- Kilograms only; no cloud sync, Health integration, or automatic coaching/progression.
- Foreground rest sound only. Do not depend on a sound while the phone is locked. Time is recalculated when reopening.
- Screen wake lock is optional and only works when the browser permits it.
- Removing the app, clearing site data, or storage pressure may remove local records. [4]
- The app's code is publicly accessible on its static URL, but its code does not upload your workout records. The hosting provider may retain ordinary request logs.

## Sources checked for this build

[1] Cloudflare Pages, Direct Upload: https://developers.cloudflare.com/pages/get-started/direct-upload/
[2] Cloudflare Pages, Limits: https://developers.cloudflare.com/pages/platform/limits/
[3] Apple, Turn a website into an app in Safari on iPhone: https://support.apple.com/en-lamr/guide/iphone/iphea86e5236/ios
[4] WebKit, Updates to Storage Policy: https://webkit.org/blog/14403/updates-to-storage-policy/

See `TEST-REPORT.md` for the exact distinction between tests performed here and checks still required on your iPhone.
