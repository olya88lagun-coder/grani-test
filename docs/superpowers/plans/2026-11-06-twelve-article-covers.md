# Twelve Article Covers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three generic rubric images shared by 12 published articles with 12 unique editorial covers.

**Architecture:** Generate one source image per approved composition, curate it visually, then normalize it into the existing WebP asset pipeline. Article front matter remains the single source used by catalogue cards, hero images and social metadata.

**Tech Stack:** Built-in image generation, Pillow, WebP, Markdown front matter, Next.js 16, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-06-twelve-article-covers-design.md`

## Global Constraints

- Final production assets are sRGB WebP at exactly 1600 × 900 px.
- No text, letters, numbers, logos, watermarks, frames or decorative borders inside images.
- Preserve all article text, dates, URLs, sources and the 21 existing dedicated covers.
- Do not publish without a separate explicit request.

## Review Focus

- Every target slug maps to the intended subject and filename.
- Card crops keep the primary subject readable at phone width.
- No two final files share a binary hash or a generic fallback path.
- Alt text describes the actual generated image rather than only the article topic.
- Generated front matter and `articles.json` remain byte-for-byte synchronized.

---

### Task 1: Pin the 12-cover contract

**Files:**
- Modify: `apps/web/src/lib/article-visuals.test.ts`

**Interfaces:**
- Consumes: `getArticles()`, `articleCard()`
- Produces: regression coverage for the 12 approved slug-to-file mappings

- [x] Add a failing test named `uses dedicated covers for the twelve legacy fallback articles` that asserts exact paths, meaningful alt text and 12 distinct images.
- [x] Run the focused test and confirm it fails because the articles still use three `/home/` images.
- [x] Commit the approved spec, plan and failing test.

### Task 2: Generate and curate the source artwork

**Files:**
- Create outside repository: `outputs/article-covers-12/source/<slug>.png`
- Create outside repository: `outputs/article-covers-12/contact-sheet-source.jpg`

**Interfaces:**
- Consumes: approved composition and shared visual system from the spec
- Produces: one selected source image for every target slug

- [ ] Generate one landscape raster image per slug with the built-in image tool.
- [ ] Inspect each image for subject accuracy, duplicate compositions, accidental text and crop safety.
- [ ] Regenerate only failed images with one targeted prompt change.
- [ ] Save all 12 selected sources and a labelled contact sheet.

### Task 3: Normalize assets and connect front matter

**Files:**
- Create: `apps/web/public/images/articles/<slug>.webp` for all 12 slugs
- Modify: the 12 matching files under `packages/content/articles/`
- Modify: `packages/content/src/generated/articles.json`

**Interfaces:**
- Consumes: selected source images from Task 2
- Produces: optimized production assets and article data

- [ ] Center-crop sources to 16:9 only when needed, resize to 1600 × 900, convert to sRGB and export WebP.
- [ ] Validate format, dimensions, colour mode, size and SHA-256 uniqueness with a machine-readable manifest.
- [ ] Change only `image` and `imageAlt` in the 12 Markdown files.
- [ ] Run `pnpm build:library` and verify only the intended generated article fields changed.
- [ ] Run the focused cover test and confirm it passes.
- [ ] Commit assets, front matter, generated data and test.

### Task 4: Verify the finished catalogue

**Files:**
- Create outside repository: `outputs/article-covers-12/visual-qa.json`
- Create outside repository: `outputs/article-covers-12/screenshots/`

**Interfaces:**
- Consumes: production assets and article data from Task 3
- Produces: code, build and browser evidence

- [ ] Run the article/content focused Vitest suites.
- [ ] Run `pnpm typecheck`.
- [ ] Run the Next.js production build.
- [ ] Check all 12 catalogue cards, heroes, OG/Twitter metadata and image responses at 390, 768 and 1440 px.
- [ ] Inspect the final contact sheet and representative desktop/mobile screenshots.
- [ ] Run `git diff --check` and review the complete branch diff.
