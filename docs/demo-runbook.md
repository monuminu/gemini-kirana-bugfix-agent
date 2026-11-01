# किराना साथी demonstration runbook

Open the [Azure kirana app](https://thankful-bay-05dfcb500.1.azurestaticapps.net/) and the [local Hindi help console](http://127.0.0.1:4300/). The existing [draft repair](https://github.com/monuminu/kirana-saathi-demo/pull/1) and [corrected preview](http://127.0.0.1:4310/) can be inspected immediately while the local server and Docker are running.

## Start locally

In `outputs/gemini-kirana-bugfix-agent`, use Node 22.13+, start Docker Desktop and verify `docker version`. The supplied Gemini key is already in the ignored, private `.env.local` on this workstation. GitHub credentials are resolved from the local `gh` keychain when `GITHUB_TOKEN` is absent.

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm run dev
```

On a new workstation, first copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`. Use a repository-scoped GitHub token with Contents and Pull requests read/write, or authenticate the allowed repository owner with GitHub CLI. No key belongs in a `VITE_` variable.

The console binds to loopback 4300 and development API 4302. A production local run is `npm run build` followed by `npm start`. A public Azure page's “ऐप सहायता” link opens the separately running local console. Cloud voice-backend deployment is not part of this release.

## Hindi presentation

1. In Azure, press **नमूना फिर से शुरू करें**, then confirm **फिर से शुरू करें**.
2. Select **चीनी**. Show **15 किलो**.
3. Choose **बिक्री हुई**, enter **2**, then press **बिक्री दर्ज करें**. Show **17 किलो** and the movement ledger.
4. Open **ऐप सहायता**, start the microphone and select the app screen. Press **तस्वीर जोड़ें** for evidence that should accompany repair.
5. Say: **“मैंने दो किलो चीनी बेची, लेकिन स्टॉक पंद्रह से सत्रह किलो हो गया। इसे कम होना चाहिए था।”**
6. Wait until the full report and expected remaining quantity have been read back. Then say: **“हाँ, इसे ठीक कर दीजिए।”**
7. Ask **“सुधार कहाँ तक पहुँचा?”** while the job runs. Use **सुधार रोकें** if cancellation is intended.
8. Inspect the draft code change and separate preview. Reset the preview and repeat the 2 kg sale: **13 किलो** should remain, including after reload.

Inventory operations stay in the inventory UI. The voice console reports software bugs. Review/merge is a separate step; the deployed Azure baseline remains reproducible.

## Repeat and recover

`npm run preflight -- --agent` checks real API access. `npm run probe` runs Search/URL and Hindi/consent/error probes and stores results in local `work/probes/`. Optional replay requires installed Google Chrome and ffmpeg:

```sh
npx tsx scripts/synthesize-fixtures.ts
npx tsx scripts/prepare-replay.ts
node scripts/e2e-ui.mjs
```

This uses real Gemini TTS/API calls and explicitly synthetic fixtures, with a 40-second gap for read-back before approval. It is automation evidence, not a shopkeeper hardware test. A slow or incomplete read-back must not dispatch; adjust fixture timing only after recording the observed failure.

A fresh real repair starts a new report and branch. The backend allows only one concurrent job. Do not move the baseline branch while a confirmed repair is awaiting publication. Known provider IDs resume after restart; an unknown create outcome requires inspection rather than automatic redispatch.

For the existing publication's failed-preview recovery only:

```sh
npm run resume-preview -- 13705a29-3fe1-409d-b18a-9e03820a3eaf
```

Use that command only when the published job is failed or needs attention, after fixing the prerequisite. Completed, active and cancelled jobs are refused. It does not create another agent or PR. Reload the help page to reconnect status after an operator recovery.

## Manual acceptance still required

Use a physical microphone and a consenting Hindi-speaking shopkeeper. Exercise the real screen picker and webcam, noisy shop speech, interruption during read-back, and “दो नहीं, ढाई किलो.” Check that uncertain agreement prompts clarification and a correction invalidates pending approval.

In authenticated AI Studio, preserve the initial zero-shot prototype and original export, compare few-shot prompts, inspect quota visibility and record Build context drift. Run real quota/cancellation/lost-create/stale-base drills in disposable scopes. These unexecuted exercises are listed in the friction log, not reported as successes.
