# Login and self-test visual refinement (C6)

Base: `4bcd97d1eb31e5e373f35fd5a45bc4c3a801ca27`, including merged PRs 54 and 55. Branch: `feat/refined-login-test`.

## Scope and contracts

The behavior owner remains Claude; `docs/ux/login-and-test-contract.md` is unchanged. This package styles `/login` and `/test` in the established cream/green identity with Cormorant Garamond and Golos Text.

- Login: one paper panel with the real context heading and lead, a separate readable consent area, consistent buttons and error presentation. Consent is never preselected. While the existing consent POST is pending, the button shows “Сохраняем…” and both consent controls are disabled; failure restores them. The provider URL and legal copy are unchanged.
- Self-test: calmer introduction and progress, native radio choices in five columns on wider screens and full-width 48px rows on phones. The original five questions per screen and all answer labels remain. Fieldsets, legends, radio groups, heading focus and navigation rules are retained. The progress bar gains an accessible name and pending states expose aria-busy.
- Errors and unavailable-storage messages receive distinct readable surfaces. Reduced motion removes transitions on the refined answer controls and progress.
- CSS overrides are scoped to the self-test page. The friend questionnaire receives semantic/class hooks but no new visual rules. Server/API/database code, context priority, scoring, storage rules, cookies and analytics are untouched.

## Verification on 2026-10-07

- Workspace typecheck passed; final Next production build passed, including TypeScript and 91 generated pages.
- Focused existing tests passed: 6 files, 64 tests (login-context, confirmed cookie context, test-progress, login-service, results-service and database results).
- Browser geometry: `/login` and `/test` at 320, 390, 640, 768, 1024 and 1440px. All 12 views fit the viewport. Five fieldsets / 25 radio choices appear per self-test screen; mobile answer rows are 48px high.
- 12 browser interaction checks passed: keyboard radio selection, restoration on reload, consent enablement, all 10 screens / 50 answers, Back/focus preservation, consent error recovery controls, network-submit error with answers retained, built consent response leading to VK action, answers surviving error and reopening the built app, successful retry leading to confirmed-result introduction, answer cleanup after success, and Together context priority over a pending result.
- Network errors were exercised by stopping the isolated local preview server. Dev hot reload subsequently required fresh browser tabs; no application code was changed to work around that preview behavior. The production build restored all 50 answers from localStorage and successfully submitted them.
- Default, confirmed-result and Together introductions were rendered; the long Together and result headings were inspected at 320/390/1440px. Pair context selection is covered by the existing context tests, not a valid live invite in this run.
- Independent static code review found no P0–P3 issues. Targeted Impeccable TSX scan returned exit 0 without findings. Clean production login/test tabs had no error or warning console messages.

## Limits and release

Real VK login, payment, valid private invitations, actual VK/Telegram embedded browsers and a browser refusing localStorage were not exercised in this run. The unavailable-storage message is retained and styled; this is not a claim that its real browser trigger was verified. Long-running pending states were reviewed in code but not captured under a deliberately delayed response. The full Playwright E2E suite and full unit suite were not rerun here; focused tests and browser interactions above are the performed checks.

Local standalone preview: `http://127.0.0.1:3108/test` and `/login`, with synthetic local data and no production database connected. Draft PR for review; merge and deployment require the owner's approval.
