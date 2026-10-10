# Personality Atlas v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate the approved nine-section atlas with real Big Five results and private server drafts, preserving existing ownership, purchase, generated report and chapter contracts.

**Architecture:** A deterministic editorial model selects diverse insights from the 15 base and 12 pair rules in v0.3. The existing owner-only report route mounts a scoped React atlas only when `PERSONALITY_ATLAS_V2=1` and the full report is ready. Draft API access requires an authenticated owner with a purchased full report. PostgreSQL stores one private versioned draft per result; optimistic concurrency prevents silent overwrites.

**Tech Stack:** Existing Next.js 16.3.5 / React 19.3.0 / TypeScript 6 / Drizzle / PostgreSQL / Vitest. No new dependencies.

**Spec:** Approved concept and Sofia content in this chat on 2026-10-10; `outputs/atlas-prototype` contains the approved visual reference. User approved server persistence in this stage.

## Global Constraints

- Preserve authentication, owner checks, purchase eligibility, prices, waiting states, generated reports, friends and separately purchased chapters.
- Feature off by default. No production migration, merge or deployment in this stage.
- Use actual `TraitScores`; thresholds 0–44 low, 45–55 borderline, 56–100 high. H/L/M and pair minimum are editorial selection weights, never confidence or percentiles.
- Interpretations are hypotheses, with basis, practice and limits. Do not infer health or duplicate deep paid chapters.
- Private drafts have no public URL. Browser UI must report saving, saved, error and conflict honestly.
- New migration may run only in disposable local test databases. No existing local database is changed.

## Review Focus

- Different owners and unpaid users cannot read, write or export another result's notes.
- Two tabs and requests with stale revisions must return conflict without losing the current server draft.
- Boundary/flat profiles still receive three distinct, cautious insights; Sofia receives the approved three.
- Oversized/unexpected request data is rejected; plain text never becomes HTML.
- Existing reports, chapter purchases and preparing states remain reachable with the feature on and unchanged with it off.

### Task 1: Editorial model

**Files:** `apps/web/src/lib/personality-atlas.ts`, `personality-atlas.test.ts`.

**Interfaces:** `buildPersonalityAtlas(scores: TraitScores): PersonalityAtlas`; pure selection, 15 base rules + 12 pair rules.

- [x] Test Sofia selection, boundary categories, formulas, all rule ids, invalid input and diverse flat/extreme profiles; observe failures.
- [x] Implement validated scores, editorial coefficients, grouping and profile-dependent content.
- [x] Run model tests and existing report-view baseline.

### Task 2: Private server drafts

**Files:** `packages/db/src/personality-atlas.ts`, `schema.ts`, `index.ts`, new `0014_personality_atlas.sql` and journal entry; `apps/web/src/server/personality-atlas-service.ts` and tests; `apps/web/src/app/api/report/[resultId]/atlas/route.ts` and route tests.

**Interfaces:** `AtlasDraftData`, `AtlasDraftRecord`, `loadAtlasDraft`, `writeAtlasDraft(expectedRevision)`, `readPersonalAtlas`, `savePersonalAtlas`; API GET/PUT with private no-store, same-origin writes, strict payload bounds.

- [x] Test owner/unpaid/unknown result isolation, strict validation, persistence, create/update conflicts and cascade deletion in disposable PGlite.
- [x] Implement additive draft table and atomic compare-and-set writes; do not change purchases or auth.
- [x] Test route session/origin/body limits and disabled feature before using the database.

### Task 3: React atlas and route integration

**Files:** `apps/web/src/components/personality-atlas/*`; report page and route tests.

**Interfaces:** `PersonalityAtlas({ resultId, displayName, typeName, gemDir, model, initialDraft })`; serializable owner-checked props. `useAtlasDraft` saves explicit snapshots serially, debounces edits, reports conflicts and retries without success fiction.

- [x] Test SSR nine-section structure, owner route and off/preparing fallbacks.
- [x] Build responsive scoped components matching the approved emerald/gold prototype.
- [x] Preserve original generated report content and purchased chapters. Mount only behind flag.
- [x] Test all interactive edits, scenarios, checklist, reload persistence and conflict recovery with local browser fixtures.

### Task 4: Verification and handoff

- [x] Run targeted tests, package typechecks and web build.
- [x] Check desktop/mobile, keyboard, overflow, actual stored draft, unauthorized requests and no feature-off queries.
- [x] Review branch diff and security boundaries; fix material findings.
- [x] Commit isolated branch and report evidence, migration/feature activation steps and remaining PDF work. No production activation.
