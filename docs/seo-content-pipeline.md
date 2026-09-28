# SEO content pipeline

## Audit snapshot

- The app is a Next.js 16 monorepo with the public site in `apps/web` and reusable content in `packages/content`.
- The root metadata defaults to `robots: { index: false, follow: false }`; public pages opt in through `publicMetadata`.
- `sitemap.ts` is generated from `PUBLIC_PATHS()` in `apps/web/src/lib/seo.ts`.
- Articles are Markdown files in `packages/content/articles`, collected into `src/generated/articles.json`, parsed by `packages/content/src/articles.ts`, and displayed by `/articles` and `/articles/[slug]`.
- Existing article quality checks already covered body length, headings, internal links, stop topics and source lists.

## Architecture

The pipeline is intentionally semi-automatic:

1. Topic queue lives in `packages/content/src/content-plan.ts` as `CONTENT_PLAN`.
2. Every queued topic has `draft | ready_for_review | published`, canonical URL, search intent, title/H1/description, FAQ draft, source keys and internal links.
3. New article Markdown can include structured front matter: `status`, `reviewed`, `canonical`, `cluster`, `intent` and `faq`.
4. `getArticles()` returns only `published` articles; `getAllArticles()` can inspect everything.
5. `PUBLIC_PATHS()` uses published article canonicals, so drafts and review pages do not enter sitemap or `llms.txt`.
6. Explicit publication requires `status: published` and `reviewed: true`.
7. FAQ is rendered on article pages when present and exposed as `FAQPage` JSON-LD.
8. `/big-five-test` is a dedicated SEO landing page for the Big Five test and links to the actual `/test` flow.

## Quality rules

The rules are codified in `QUALITY_RULES` and covered by tests:

- no invented studies, DOI, authors or statistics;
- scientific claims must use existing `ARTICLE_SOURCES` or stay marked `needs-research`;
- no mass template pages with only keyword substitutions;
- no false equivalence between Grani types and MBTI or socionics;
- no diagnosis, medical advice or clinical framing;
- only natural internal links to existing public pages;
- manual review is required before publication.

## How to use

1. Pick a topic from `topicsByStatus("draft")` in `packages/content/src/content-plan.ts`.
2. Write a Markdown draft in `packages/content/articles/<slug>.md` with `status: draft`.
3. Add sources to `ARTICLE_SOURCES` only after verifying the publication details and DOI.
4. Run the content checks locally:

```bash
pnpm --filter @grani/content build:library
pnpm test
pnpm typecheck
```

5. Move the article to `status: ready_for_review` when the draft is complete.
6. After manual editorial approval, set:

```yaml
status: published
reviewed: true
canonical: /articles/<slug>
```

7. Rebuild the generated content and rerun tests. Only then will the article appear in `/articles`, `sitemap.xml` and `llms.txt`.

## First content-plan scope

The initial queue contains 60 unpublished URLs across these clusters:

- Big Five and IPIP-50 basics;
- five trait pages and practical trait explainers;
- Grani type explainers;
- compatibility and relationship topics;
- friend feedback and self/other perception;
- work, stress and self-knowledge topics;
- comparison pages for MBTI/socionics handled carefully as comparisons, not mappings.
