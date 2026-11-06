# ForgeFit 0.1.0 — install on iPhone using GitHub Pages

**Status:** App code and a prebuilt PWA are committed to GitHub. GitHub Pages must be enabled in repository settings before the website becomes live. No Codex, Cloudflare, developer server, or ZIP download is required.

## Activate hosting once

1. Sign in to GitHub as **Artyeris**, open https://github.com/Artyeris/forgefit-pwa/settings/pages .
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Choose the **gh-pages** branch and the **/(root)** folder, then tap **Save**.
4. Wait for GitHub to show the published URL in the Pages settings; open that exact URL. With GitHub's standard naming it should be https://artyeris.github.io/forgefit-pwa/ . Do not assume it is live until GitHub reports successful deployment.

The **main** branch holds source, tests and the prebuilt `dist/` folder. The **gh-pages** branch holds only the production app with `index.html` at its root and a `.nojekyll` file. Later releases require publishing the updated `dist/` assets to **gh-pages** too.

## Install and verify on iPhone

1. Open the published site in **Safari** in a normal tab.
2. Safari **Share** → **Add to Home Screen** → enable **Open as Web App** → **Add**.
3. Open the new **ForgeFit** Home Screen icon while online. In **More**, verify the app says **Offline ready**.
4. Turn on Airplane Mode and turn off Wi-Fi. Close and reopen ForgeFit from its Home Screen icon. Verify it loads and preserves a disposable workout, then remove that test session.

Workout history is stored in the installed app's local IndexedDB, **not** the GitHub repository. Export JSON backups regularly using **More → Export backup**. Do not upload personal backups to GitHub. Keep the same production URL and icon for later updates, otherwise the new origin/context may have separate data.

## Privacy and limits

This repository and GitHub Pages site are **public**. The app contains no sample workout history or personal profile data. The static site has no backend or workout telemetry. Hosting request logs may exist.

The initial build passed 40 domain tests and 5 package checks, but actual iOS offline cold-launch, storage persistence, and update behavior are **not yet verified** on your phone. Rest alarms while the phone is locked are not guaranteed.

Detailed testing and restore guidance: [INSTALL-IPHONE.md](INSTALL-IPHONE.md) and [TEST-REPORT.md](TEST-REPORT.md).
