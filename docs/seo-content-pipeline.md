# SEO content pipeline

## Audit snapshot

- The app is a Next.js 16 monorepo with the public site in `apps/web` and reusable content in `packages/content`.
- The root metadata defaults to `robots: { index: false, follow: false }`; public pages opt in through `publicMetadata`.
- `sitemap.ts` is generated from `PUBLIC_PATHS()` in `apps/web/src/lib/seo.ts`.
- Articles are Markdown files in `packages/content/articles`, collected into `src/generated/articles.json`, parsed by `packages/content/src/articles.ts`, and displayed by `/articles` and `/articles/[slug]`.
- Existing article quality checks already covered body length, headings, internal links, stop topics and source lists.

## Architecture

The pipeline is automatic with guardrails:

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
- publication is automatic, gated by the checks below (owner's decision, 2026-09-28).

## How to use

Since 2026-09-28 publication is automatic (owner's decision): a scheduled Claude agent writes articles on Tuesdays and Fridays and merges its own PR when every check is green. Since 2026-10-07 the quota is three articles per run (each its own branch, PR and merge), up from one. The full procedure the agent follows is `docs/seo-article-writer.md`.

Automated gates that replace manual review:

- every published article has at least two sources in `ARTICLE_SOURCES`, verified against Crossref by DOI;
- front matter carries `tag` and `image`; the site test checks that the image file exists;
- internal links in published articles resolve to public pages or `/test`;
- stop topics, length, headings, unique canonicals, no future dates;
- the content plan is marked `published` exactly when the article is.

After merge the deploy workflow sends changed article URLs to Yandex via IndexNow (key in `apps/web/public/indexnow.txt`).

To write or fix an article by hand, follow the same steps from `docs/seo-article-writer.md`.

## First content-plan scope

The initial queue contains 60 unpublished URLs across these clusters:

- Big Five and IPIP-50 basics;
- five trait pages and practical trait explainers;
- Grani type explainers;
- compatibility and relationship topics;
- friend feedback and self/other perception;
- work, stress and self-knowledge topics;
- comparison pages for MBTI/socionics handled carefully as comparisons, not mappings.
