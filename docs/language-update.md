# Hindi / English audience switch

Both applications now have a language switch at the top right:

- [Inventory on Azure](https://thankful-bay-05dfcb500.1.azurestaticapps.net/?lang=en)
- [Local voice help console](http://127.0.0.1:4300/?lang=en)
- [Corrected inventory preview](http://127.0.0.1:4310/?lang=en)

Choose **हिन्दी / हिंदी** or **English**. The interface changes immediately and remembers the selection across reloads. Links between the store, support console and fixed preview carry the selected language. Product names, units, stock forms, ledger, bug briefs and progress use the chosen language. Inventory quantities, form input, background jobs and original conversation transcripts are preserved.

The console also uses language-specific Gemini Live instructions. Switching during a conversation pauses the microphone and visual stream. Press **Start conversation / बात शुरू करें** to continue in the new language. It does not cancel a confirmed repair. Hindi and English reports follow the same read-back and explicit approval gate.

## Verification

- Console: **120 tests pass**, with type checking and build passing. Regressions include switching while token/connection/permission requests are pending and microphone capture across reconnection.
- Inventory baseline: **49 tests pass**, with the one intentional sugar-sale regression still failing. Baseline verification, type checking and build pass.
- Corrected PR commit: **50 tests pass** in independent Docker verification, with type checking and build passing.
- Real Gemini Live calls returned Hindi and English audio/transcripts. An actual English structured brief, read-back validation and approval classification passed.
- Azure and local production browser checks passed at desktop and mobile widths: language persistence, state preservation, localized reports/ledger, matching navigation links and no page overflow or browser errors.
- The Azure baseline still demonstrates **15 → 17 kg** after a 2 kg sugar sale. The corrected preview demonstrates **15 − 2 = 13 kg**, including after reload, in both interface languages.

## Current preview identity and attribution

Inventory main/UI base: `3f05f51a8355be962d84458fc955c8c7ee2f32eb`.

[Draft PR #1](https://github.com/monuminu/kirana-saathi-demo/pull/1) now includes that UI base while retaining the original arithmetic fix. Its current commit is `432e04483b10506400e98139652ebd7286af6233`. The independently verified candidate and exact-commit preview share artifact SHA-256 `c1e904fe172b5ce0ae06a39b12dc234dadcfa15d096d9df89ad15ec37053ef95`.

Managed Antigravity generated the original sale arithmetic fix. This later language interface and prompt update was implemented in response to the audience request, then carried into the existing draft and independently reverified. No additional coding agent or PR was created, and the PR has not been merged. The initial repair receipts remain historical evidence; `preview_revision` records the refreshed UI base and preserves the original publication/checks.
