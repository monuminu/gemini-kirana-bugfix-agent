# Gemini DevEx friction log

Timestamps: Asia/Kolkata. observed = reproduced in this journey; hypothesis = unverified; not_tested = pending.
Time-lost values of 0 mean no separately measured time-loss estimate was recorded. Probe durations and exact replay times are in verification-report.md. Severity is the potential effect in this demo; P3 passed checks are journey observations, not defects. The log separates Gemini/API issues, application defects, local setup problems and unexecuted exercises. Non-probe timestamps record when this entry was captured rather than an inferred incident time.

## SDK release selected from GitHub was not published to npm

- ID: F01
- Time: 2026-11-01T13:57:34+05:30
- Classification: observed
- Stage: Discovery and onboarding
- Severity: P2; frequency: Exact-version lookup reproduced; one implementation journey; time lost: 0 minutes

**Reproduction:** Install the initially planned @google/genai@2.32.0, then query the npm registry for that exact version.

**Expected:** The planned version should install reproducibly.

**Actual:** npm returned ETARGET. Version 2.31.0 was the published release and met the skill minimum of 2.29.1. The 2.32.0 choice came from GitHub main, not a recommendation in the skill.

**Workaround:** Pin 2.31.0 and commit the lockfile with public registry URLs.

**Product recommendation:** Show published SDK versions beside export examples and distinguish development main from released packages.

**Evidence IDs:** SDK_LOOKUP_01, SKILL_PIN_01

**Error ID:** npm ETARGET

## AI Studio Build required a signed-in browser

- ID: F02
- Time: 2026-11-01T13:57:34+05:30
- Classification: observed
- Stage: Discovery and onboarding
- Severity: P3; frequency: One browser navigation; time lost: 0 minutes

**Reproduction:** Open the AI Studio welcome page, then enter Build at /apps in the available browser.

**Expected:** Continue into a prototype and export with an authenticated session.

**Actual:** The welcome page was accessible. Build redirected to Google sign-in. The API key worked for API calls but did not authenticate the browser journey.

**Workaround:** Implement against the pinned skills and hosted documentation. Leave the authenticated Studio exercise pending.

**Product recommendation:** Explain browser identity, project/API key identity and Build prerequisites together. This is an onboarding observation, not evidence of an AI Studio product defect.

**Evidence IDs:** STUDIO_NAVIGATION_01

**Error ID:** none

## Quota dashboard and key creation UX remain pending

- ID: F03
- Time: 2026-11-01T13:57:34+05:30
- Classification: not_tested
- Stage: Discovery and onboarding
- Severity: P3; frequency: Not executed; time lost: 0 minutes

**Reproduction:** In a signed-in AI Studio browser, inspect project selection, create a repository-demo key and inspect limits/quota visibility.

**Expected:** Project, key scope and usable model quotas should be clear before coding.

**Actual:** The supplied key was used successfully. Key generation UI, quota dashboard and quota exhaustion were not exercised.

**Workaround:** The preflight checks real model calls without deliberately exhausting quota.

**Product recommendation:** Evaluate whether onboarding exposes key scope, supported models and quotas in one place; do not treat this hypothesis as an observed defect.

**Evidence IDs:** PREFLIGHT_01

**Error ID:** none

## Ephemeral token warning disagreed with the working API revision

- ID: F04
- Time: 2026-11-01T13:07:37+05:30
- Classification: observed
- Stage: Transition to code
- Severity: P2; frequency: Warning on token-based connection; two successful Live exercises; time lost: 0 minutes

**Reproduction:** Use SDK 2.31.0 to create a constrained ephemeral token and connect Gemini Live with v1beta.

**Expected:** SDK guidance should match the usable API revision.

**Actual:** The SDK warned that ephemeral tokens only work with v1alpha. The actual v1beta Live connection returned Hindi transcript and PCM audio, and the browser media session also worked.

**Workaround:** Retain the tested v1beta path and preserve the warning as evidence.

**Product recommendation:** Align SDK warnings and API-revision documentation, with a tested token-plus-Live example.

**Evidence IDs:** PREFLIGHT_01, LIVE_REPLAY_01

**Error ID:** SDK ephemeral-token v1alpha warning

## Hindi quantity corrections and Hinglish extraction preserved the revised scope

- ID: F05
- Time: 2026-11-01T13:49:42+05:30
- Classification: observed
- Stage: Prompting
- Severity: P3; frequency: Two actual structured API probes passed; time lost: 0 minutes

**Reproduction:** Create a structured brief after changing two kilos to ढाई किलो, with 15 initial, 17.5 observed and 12.5 expected. Separately use Roman-script chini.

**Expected:** The latest correction should control the repair scope and preserve quantities across Hindi and English.

**Actual:** The brief used a 2.5 kg sale and expected 12.5 kg. Its quantity list retained earlier values with explicit historical labels. Hinglish extraction produced a valid bilingual brief for sugar and 15/17/13.

**Workaround:** Validate the JSON with Zod and read back the current summary, observed and expected behavior.

**Product recommendation:** Provide a Hindi/Hinglish correction example and distinguish active quantities from corrected historical values in starter schemas.

**Evidence IDs:** PROBES_01

**Error ID:** none

## Search and URL context worked on a separate Interactions path

- ID: F06
- Time: 2026-11-01T13:49:12+05:30
- Classification: observed
- Stage: Prompting
- Severity: P3; frequency: Four actual API probes passed; time lost: 0 minutes

**Reproduction:** Run search for official Live tool support, URL context on the public hosted documentation, a .invalid URL, and the authentication-gated GitHub settings page.

**Expected:** Public sources should include citations and unavailable or private content should not be invented.

**Actual:** Search returned call/result steps and citations. The public document returned success metadata. The unavailable and authentication-gated URLs returned retrieval status error with explicit inability to read content. No private profile values were invented.

**Workaround:** Keep these probes outside Live; inspect URL retrieval metadata rather than relying only on narrative text.

**Product recommendation:** Include public, unavailable and login-gated URL fixtures in the Interactions starter. Explain the separate path for Live applications.

**Evidence IDs:** PROBES_01

**Error ID:** none

## Invalid structured schema returned an imprecise payload error

- ID: F07
- Time: 2026-11-01T13:50:08+05:30
- Classification: observed
- Stage: Errors and observability
- Severity: P2; frequency: One intentionally malformed API request; time lost: 0 minutes

**Reproduction:** Send a response-format JSON schema with the invalid type definitely_not_json_schema.

**Expected:** A 400 response should identify the offending schema field.

**Actual:** The API rejected the request with 400 Invalid JSON payload: syntax error in request body. No schema field path was supplied in the observed message.

**Workaround:** Validate supported schemas in code before calling Gemini and retain the HTTP error.

**Product recommendation:** Return a field path and schema validation reason instead of describing this semantic schema error as a body syntax error.

**Evidence IDs:** PROBES_01

**Error ID:** HTTP 400 Invalid JSON payload

## Expired Live token exposed a clear start-deadline reason

- ID: F08
- Time: 2026-11-01T13:50:08+05:30
- Classification: observed
- Stage: Errors and observability
- Severity: P3; frequency: One intentionally expired token probe; time lost: 0 minutes

**Reproduction:** Mint an unused token with a 2.5-second new-session deadline, wait four seconds, then attempt Live connection.

**Expected:** The expired token should be rejected with an actionable reason.

**Actual:** The WebSocket closed with code 1011 and reason new_session_expire_time deadline exceeded.

**Workaround:** Issue tokens immediately before connection; request a new token for a fresh session.

**Product recommendation:** Document the new-session deadline separately from overall token expiry and show this exact recovery flow.

**Evidence IDs:** PROBES_01

**Error ID:** WebSocket 1011: new_session_expire_time deadline exceeded

## Real Hindi media session reached managed repair and publication

- ID: F09
- Time: 2026-11-01T13:36:14+05:30
- Classification: observed
- Stage: Advanced features
- Severity: P3; frequency: One actual managed repair; synthetic media source; time lost: 0 minutes

**Reproduction:** Replay synthesized Hindi speech through browser microphone PCM capture. Send one-per-second canvas frames from the actual rendered Azure bug screen and select one image. Speak the report and explicit repair approval.

**Expected:** Gemini should read back 15/2/17/13, then dispatch once after approval while the conversation can continue.

**Actual:** Actual Gemini Live produced Hindi transcript, prepare/read-back/dispatch and a durable job. Managed Antigravity diagnosed the code, submitted a patch and reached independent Docker checks, draft PR #1 and a corrected exact-commit preview. Physical shopkeeper hardware was not used.

**Workaround:** Use explicit synthetic media for repeatable integration automation and a separate manual hardware checklist.

**Product recommendation:** Publish an end-to-end sample covering Hindi PCM, visual selection, non-blocking tools, managed environment IDs and safe PR handoff.

**Evidence IDs:** LIVE_REPLAY_01, PUBLICATION_01, PREVIEW_RECOVERY_01

**Error ID:** none

## Consent and reload races were implementation defects found in review

- ID: F10
- Time: 2026-11-01T13:57:34+05:30
- Classification: observed
- Stage: Advanced features
- Severity: P1; frequency: Deterministic tests plus two real reload exercises; time lost: 0 minutes

**Reproduction:** Exercise fragmented transcript order, interrupted read-back validation, correction during consent classification and competing brief preparation. Reload with an active persisted job.

**Expected:** Only the current fully read-back brief and a subsequent explicit turn should dispatch once; reload should recover the same job.

**Actual:** Initial application code needed stable turn ordering, snapshot checks, a report generation counter and read-back epoch. These were fixed and covered by domain tests. Real reload retained the same session/job, three turns and one image. This finding belongs to this application, not Gemini.

**Workaround:** Reject stale asynchronous results; finalize turns once; rotate CSRF while retaining the session and durable job.

**Product recommendation:** Provide a reference consent state machine and adversarial turn/reload tests in voice-agent samples.

**Evidence IDs:** CONSENT_TESTS_01, PREVIEW_RECOVERY_01

**Error ID:** none

## Docker was installed but waiting for initial setup

- ID: F11
- Time: 2026-11-01T13:57:34+05:30
- Classification: observed
- Stage: Advanced features
- Severity: P2; frequency: One workstation setup; time lost: 0 minutes

**Reproduction:** Run Docker server version before completing Docker Desktop setup.

**Expected:** Installed Docker should expose a usable daemon or a clear setup prerequisite.

**Actual:** The engine was unavailable while the setup wizard remained unfinished. User-level setup started the daemon without a privileged helper. This was local environment setup, not Gemini friction.

**Workaround:** Complete user-level Docker setup and verify the daemon before repair dispatch.

**Product recommendation:** Add a preflight that distinguishes installed CLI, running daemon and incomplete Desktop onboarding.

**Evidence IDs:** DOCKER_SETUP_01

**Error ID:** none

## Local Docker credentials and npm transport blocked isolated setup

- ID: F12
- Time: 2026-11-01T13:57:34+05:30
- Classification: observed
- Stage: Advanced features
- Severity: P2; frequency: Repeated setup attempts in this workstation environment; time lost: 0 minutes

**Reproduction:** Pull the public Node image through the default Docker configuration, then install canonical locked npm packages in the verifier.

**Expected:** Public dependency setup should require no credentials and preserve isolation.

**Actual:** The local Docker credential helper hung for a public pull. Public npm downloads also produced ECONNRESET/TLS failures in this environment. The project lockfiles had to use canonical public URLs rather than the host mirror. These were local transport/configuration issues.

**Workaround:** Use an empty task-local Docker CLI configuration and existing context socket. Trusted backend code fetches exact lockfile tarballs anonymously from the known public Microsoft npm mirror, checks SRI, then performs offline no-script container installation.

**Product recommendation:** Include anonymous registry preflight, immutable package caching and clear dependency-network diagnostics in secure sandbox starter projects.

**Evidence IDs:** DOCKER_VERIFIER_01

**Error ID:** ECONNRESET / TLS / Docker credential-helper hang

## Missing browser dependency interrupted the first preview check

- ID: F13
- Time: 2026-11-01T13:47:59+05:30
- Classification: observed
- Stage: Errors and observability
- Severity: P2; frequency: One real preview failure followed by successful recovery; time lost: 0 minutes

**Reproduction:** After validated PR publication, launch the trusted Playwright browser assertion without its bundled Chromium runtime.

**Expected:** The exact published commit should reach 13 kg browser proof before completion.

**Actual:** The browser executable was missing. The job became needs_attention and retained the draft PR. Browser setup/fallback was fixed; operator recovery reverified the same saved patch and PR, and the preview passed 13 kg plus reload. No additional managed coding job or PR was created.

**Workaround:** Install Chromium during setup or use installed Chrome. Run resume-preview only for a saved publication; it grants a new bounded preview-only deadline and records the original deadline.

**Product recommendation:** Preflight browser availability and demonstrate recovery after publication separately from redispatching an agent. This was a local demo dependency issue.

**Evidence IDs:** PUBLICATION_01, PREVIEW_RECOVERY_01

**Error ID:** Playwright missing chromium_headless_shell-1248 executable

## Independent checks preserved the original regression and exact artifact

- ID: F14
- Time: 2026-11-01T13:57:34+05:30
- Classification: observed
- Stage: Errors and observability
- Severity: P3; frequency: Actual managed patch plus controlled verifier fixture and seven tamper probes; time lost: 0 minutes

**Reproduction:** Verify the baseline and submitted patch in offline secrets-free containers. Attempt writes to original test/source/configuration/dependencies, then build the recorded PR commit and replay the sale.

**Expected:** One baseline regression should fail; the candidate should pass all original assertions and the preview artifact should match.

**Actual:** The baseline had 40 passing tests and one intentional failure. The patch had 41 passing tests, passing typecheck/build, and the preview matched artifact SHA-256 af64a43969a8776f8cc932bc04caff66efa2c06bab8afa21ac36df40f7a6cb8f. Seven actual mutation attempts returned EROFS with unchanged hashes.

**Workaround:** Read-only tracked inputs/dependencies, immutable assertion inventory, fixed commands and artifact identity checks.

**Product recommendation:** Supply a verifiable patch-handoff example rather than treating agent stdout as test proof.

**Evidence IDs:** DOCKER_VERIFIER_01, TAMPER_01, PUBLICATION_01, PREVIEW_RECOVERY_01

**Error ID:** none

## Azure static deployment preserved the reproducible inventory bug

- ID: F15
- Time: 2026-11-01T13:32:52+05:30
- Classification: observed
- Stage: Deployment
- Severity: P3; frequency: One deployment plus real browser checks; time lost: 0 minutes

**Reproduction:** Deploy the inventory dist to Azure Static Web Apps Free tier. Reset, record a two-kilo sugar sale, reload, then reset again.

**Expected:** The public demo should load in Hindi and preserve the baseline bug independently of the PR preview.

**Actual:** HTML/assets returned HTTP 200 and matched dist bytes. Real browser checks showed 15 to 17 kg, persistence, and reset to 15 kg/eight products/empty ledger. The PR preview separately showed 13 kg.

**Workaround:** Deploy the intentional baseline manually; review PRs separately without automatic merging or Azure publishing.

**Product recommendation:** Keep an unchanged reproduction origin and an exact-commit fixed preview in developer-agent demonstration templates.

**Evidence IDs:** AZURE_01, PREVIEW_RECOVERY_01

**Error ID:** none

## Zero-shot Studio prototype, few-shot comparison and original export need a manual pass

- ID: F16
- Time: 2026-11-01T13:57:34+05:30
- Classification: not_tested
- Stage: Playground and transition to code
- Severity: P3; frequency: Not executed; time lost: 0 minutes

**Reproduction:** In authenticated AI Studio, generate the initial Hindi prototype, compare zero-shot/few-shot prompts and preserve the original Get Code/Build export before corrections.

**Expected:** Original export and subsequent corrections should be traceable to actual UI behavior.

**Actual:** Source was implemented using the pinned skills and current hosted documentation. No original Studio-generated export was produced. No claims are made about Build context drift or export cleanliness.

**Workaround:** Use the runbook to perform and record this separately with a signed-in browser.

**Product recommendation:** Evaluate prompt ownership, SDK pinning and export reproducibility only after this exercise; current suggestions remain hypotheses.

**Evidence IDs:** SKILL_PIN_01

**Error ID:** none

## Physical shopkeeper microphone, webcam, interruption and shop noise remain manual

- ID: F17
- Time: 2026-11-01T13:57:34+05:30
- Classification: not_tested
- Stage: Advanced features
- Severity: P3; frequency: Manual scenarios not executed; time lost: 0 minutes

**Reproduction:** Use a consenting Hindi-speaking shopkeeper with a physical microphone and real screen permission picker. Try webcam, background shop noise, interruption and quantity correction mid-speech.

**Expected:** Hindi intent and quantities should remain clear, with ambiguity and interrupted consent handled safely.

**Actual:** Browser PCM/video wiring was exercised with synthetic media. Audio reducers, tool cancellation, session handles, transcript fragments and consent interruption have automated tests. Physical microphone/accent, real webcam/permission UX, noise robustness and a long-session resumption were not validated.

**Workaround:** Run the explicit manual acceptance checklist; synthetic replay is not hardware evidence.

**Product recommendation:** Add Hindi noise/accent and interrupted-approval fixtures to official Live evaluations; measure turn latency and recovery on physical devices.

**Evidence IDs:** LIVE_REPLAY_01, CLIENT_TESTS_01

**Error ID:** none

## Destructive failure and rate-limit paths have tests but need real-provider drills

- ID: F18
- Time: 2026-11-01T13:57:34+05:30
- Classification: not_tested
- Stage: Errors and observability
- Severity: P3; frequency: Unit-tested; real failure drills not executed; time lost: 0 minutes

**Reproduction:** Induce quota limits, an uncertain provider-create outcome, cancellation during active execution, stale base before publication and a failing candidate patch in separate disposable runs.

**Expected:** No duplicate dispatch or publication after cancellation, stale base or failed checks.

**Actual:** The unit tests cover these boundaries using controlled provider/GitHub ports. Known provider IDs survived real backend restarts during this run, but real provider cancellation, quota exhaustion, lost-create response and live stale-base publication were not intentionally induced.

**Workaround:** Do controlled drills in a disposable repository and avoid automatically retrying an unknown create outcome.

**Product recommendation:** Provide idempotency/recovery guidance and deterministic error-injection support for managed-agent samples.

**Evidence IDs:** RUNNER_TESTS_01

**Error ID:** none
