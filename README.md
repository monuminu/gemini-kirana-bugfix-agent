# किराना साथी — Hindi voice bug repair

A local developer tool that listens to a Hindi bug report, receives screen/camera frames through Gemini Live, prepares an agreed bug brief, and dispatches managed Antigravity to repair a public kirana inventory application. The backend independently verifies the patch before creating a draft GitHub PR and an isolated preview.

Inventory: [public repository](https://github.com/monuminu/kirana-saathi-demo) and [Azure demo](https://thankful-bay-05dfcb500.1.azurestaticapps.net/).

## Run locally

Use Node.js 22.13 or newer, a running Docker Desktop with a Docker CLI context, and GitHub CLI signed into the repository owner account.

```sh
npm ci --ignore-scripts
npx playwright install chromium
test -f .env.local || cp .env.example .env.local
# Set GEMINI_API_KEY in .env.local. Keep this file private.
# Optionally set a fine-grained GITHUB_TOKEN for the demo repo (Contents and Pull requests read/write).
# For this local release, an existing gh keychain credential is used in memory when GITHUB_TOKEN is absent.
npm run dev
```

On Linux, install the browser's required system libraries with `npx playwright install --with-deps chromium` during machine setup. The preview checker can also use an existing Google Chrome installation when the bundled browser is absent. The verifier requires anonymous access to the public Node image and the public Microsoft npm mirror for integrity-checked package preparation. Candidate installation and checks run offline in Docker.

Open http://127.0.0.1:4300 . Vite serves the console on 4300 and proxies `/api` to the loopback backend on 4302. The inventory app can run separately on 4301 or use its Azure Static Web Apps URL.

The browser receives a short-lived, constrained Live token. The long-lived Gemini key and GitHub credential stay on the backend. `.env.local`, runtime SQLite, media, logs and candidate checkouts are ignored by Git.

```sh
npm test
npm run typecheck
npm run build
npm start
npm run preflight -- --agent
npm run probe
```

The production start command serves the built console and API together on 127.0.0.1:4300. The application intentionally refuses remote network exposure in this release.

## Demo

1. Reset the companion kirana app to synthetic seed data. Sugar starts at 15 kg.
2. Record a 2 kg sale. The deliberately faulty source produces 17 kg.
3. Open app help, start a conversation, and share the app screen. Attach a frame with **तस्वीर जोड़ें** if it should accompany the repair agent.
4. Say: **“मैंने दो किलो चीनी बेची, लेकिन स्टॉक पंद्रह से सत्रह किलो हो गया। इसे तेरह किलो होना चाहिए था।”**
5. Listen to the full bug brief. Then say: **“हाँ, आपने सही समझा। इसे ठीक कर दीजिए।”**
6. The live session continues while the backend repairs and verifies the code. Ask **“सुधार कहाँ तक पहुँचा?”** for actual status.
7. Open the draft PR and separate fixed preview. The preview must show 15 − 2 = 13 kg and retain 13 kg after reload. The PR still requires review before merging.

The microphone can be paused. Typed Hindi works through the same Live session. Screen and webcam are mutually exclusive visual streams, capped at one frame per second. A page refresh restores the existing local session and active job without opening the microphone.

## Interfaces and durable execution

The browser uses same-origin cookie sessions and CSRF-protected POST requests. Live exposes `prepare_bug_fix`, `dispatch_bug_fix`, `get_fix_status`, and `cancel_bug_fix`. Read-back completion and a later explicit user turn are required before dispatch. New corrections, interruptions and stale asynchronous results cannot approve an old brief. A confirmed report dispatches once.

SQLite persists reports, transcript turns, evidence references, jobs, provider IDs, stage changes, request durations and friction notes. Timing records exclude request bodies, queries, cookies and headers. There is one active repair, a 15-minute deadline and at most two revision rounds after the initial attempt. A known provider interaction resumes after backend restart; an unresolved initial or continuation creation requires attention instead of repeating a possibly accepted request.

A second help tab retains the same owner session without revoking the first tab's CSRF token. Up to 64 bootstrap tokens remain valid within the 24-hour local session lifetime.

If publication succeeded but preview setup failed, fix the local prerequisite and run `npm run resume-preview -- <job-id>`, then reload the help page. This operator command only rechecks the saved patch and exact published commit. It grants a new 15-minute preview verification budget, records the original deadline, and creates no agent, branch or PR. Cancelled and active jobs cannot be resumed this way.

Antigravity receives original Hindi statements, an English technical brief and selected inline JPEGs. It gets a public repository clone and no GitHub write credential. A scoped `publish_patch` request submits an ordinary git diff; publication happens on the backend.

Docker verification mounts original source, tests, manifests and configuration read-only. Only dependency setup and dedicated cache/output directories are writable. It checks the exact baseline failure, every candidate assertion, type checking and build output. Forbidden patches, failed checks, stale base commits or cancellation prevent subsequent publication. See [runner details](docs/runner.md).

## Friction evidence

Use **फीडबैक नोट** to record observations, hypotheses and untested scenarios, then export Markdown or CSV. Notes have Asia/Kolkata timestamps, reproduction, expectation, actual outcome, severity/frequency/time lost, workaround and product recommendation. Runtime transcripts and selected frames remain local. Public PRs contain sanitized synthetic reproduction and test evidence.

The requested Google skills are pinned in `.agents/skills`. The running SDK is **@google/genai 2.31.0**: planned 2.32.0 was not published to npm. The version choice and actual API warnings are recorded in the friction report.

## Deployment and scope

The companion inventory app is deployed separately to Azure Static Web Apps. This console remains local. A future authenticated Cloud Run deployment is described in [deployment guide](docs/cloud-run.md); its infrastructure and account setup are not part of this release.

Read the [demo runbook](docs/demo-runbook.md), [verification report](docs/verification-report.md), [Markdown friction log](docs/friction-log.md), [CSV log](docs/friction-log.csv), [roadmap brief](docs/roadmap-brief.md) and [prompt/skill revisions](docs/prompt-revisions.json). The actual managed repair produced [draft PR #1](https://github.com/monuminu/kirana-saathi-demo/pull/1) and an exact-commit local preview. The first continuous browser wait failed after missing browser setup; recovery of that same publication passed.

A synthesized Hindi replay is an automated audio fixture, not evidence that a shopkeeper's physical microphone or accent was tested. AI Studio Build/export work requires a signed-in browser; unexecuted steps are explicitly marked untested.
