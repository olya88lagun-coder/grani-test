# Interactive paid pair map — stage 1

The pair report is now an emerald/gold interactive guide built from real participant profiles. The existing compatibility formula, membership checks, product keys, 399 ₽ server price, one-purchase-for-both rule and additional generated text remain in place.

## Behavior

- Hero uses existing type gemstones, actual participant data and the computed index.
- Big Five charts, perspective controls, eight illustrated scenarios, translator, four conversation steps and three editable drafts are semantic responsive HTML.
- Scenario interpretations are hypotheses from self-reported traits. The index is explicitly not a prediction of relationship success.
- Paid interactive content is withheld by the server without an owned `pair` entitlement, even if a stored report exists. A confirmed purchase unlocks the interactive guide before the additional text finishes.
- Drafts use session storage scoped to the pair and viewer result. They are personal drafts, not shared agreements.
- PDF export, a shared survey and joint confirmation are explicitly unavailable in this stage.
- The compatibility offer describes the implemented product. Legal terms and existing prices remain unchanged.

## Review fixes

The early link from a confirmed purchase could bypass the previous analytics effect, which waited for generated text. Pair revenue is now recorded after payment confirmation independently of text readiness.

Purchase goals also wait for analytics bootstrap. The pending callback survives client navigation, checks consent and owner-device state again, and writes its session deduplication marker only after submitting the goal to the available SDK queue. Free and unconfirmed purchases are excluded. The existing non-pair redirect/polling behavior remains in place.

Both findings were reproduced before correction and rechecked by an independent read-only reviewer.

## Local verification

- Full suite before rebasing: 127 files / 1008 tests passed.
- Payment/auth integration checks: 54 tests passed, including six new real-database pair-payment cases with a controlled gateway.
- All workspace type checks passed after rebasing onto the current `master`.
- Focused post-rebase pair/payment tests: 22 passed.
- Final analytics/purchase unit checks: 35 passed, including eight tests for delayed SDK, deduplication, consent withdrawal, owner device, status, free purchases and unavailable session storage.
- Final production build passed and generated 96 static pages.
- Final production browser checks: 15 passed. Verified both participants, withheld unpaid HTML, signed-out redirect, outsider rejection, perspective-dependent content, editable drafts after reload, keyboard controls, eight WebP responses, widths 320/390/768/1024/1440, analytics bootstrap/early navigation/reopen and negative revenue states.
- Production dev-login and fake-payment endpoints return 404.
- The unchanged `/cards/pppp` route returns HTTP 200, PNG signature and 1080×1920 in standalone production. The reported URL-object error reproduces in local webpack dev; the card generator is outside this PR.
- Production screenshots were manually reviewed. No visible horizontal overflow was found outside the deliberately scrolling menus/card track.
- Backend auth/payment/gateway code, prices, lockfile and card generator are unchanged relative to `master`. Unrelated local deliverables are excluded from the commits.

Browser QA used the real standalone build and an isolated local database with signed session fixtures. Outbound provider requests were blocked. Test payment configuration contained placeholders only. No live charge or external VK login was performed. The isolated database did not run the generated-text worker; access before text readiness was exercised separately.

## Reproduce

Use an isolated local database and session secret matching the local server, never a production database. The existing fixture helper rejects non-local database URLs.

```powershell
pnpm typecheck
pnpm exec vitest run --maxWorkers=4
pnpm --filter @grani/web build

# After starting the standalone build with its public/static assets:
# Set E2E_BASE_URL, RESULT_QA_DATABASE_URL and RESULT_QA_SESSION_SECRET
# to that isolated local server/database. E2E_PRODUCTION_QA=1 enables production guards.
pnpm exec playwright test -c e2e/playwright.config.ts e2e/pair-map.spec.ts e2e/pair-map-visual.spec.ts e2e/pair-release.spec.ts --grep-invert "checkout keeps" --workers=1
```

The fake-checkout browser case runs only against development with `PAYMENTS_FAKE=1`. It was verified in the initial implementation stage; it is deliberately excluded from production QA, where fake payments must remain disabled.

Merge/deploy and live acceptance are separate steps. After an approved deployment, verify the site on desktop/mobile and the actual VK/payment provider flow without treating local fixtures as live-payment evidence.
