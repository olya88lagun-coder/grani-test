# Задача 3 — Страницы под поиск: типы, уровни черт, совместимость, sitemap, robots

**Files:**
- Create: `apps/web/src/lib/seo.ts`, `apps/web/src/lib/seo.test.ts`
- Create: `apps/web/src/components/JsonLd.tsx`
- Create: `apps/web/src/app/types/page.tsx`, `apps/web/src/app/types/[slug]/page.tsx`
- Create: `apps/web/src/app/traits/[slug]/page.tsx`
- Create: `apps/web/src/app/compatibility/page.tsx`
- Create: `apps/web/src/app/sitemap.ts`, `apps/web/src/app/robots.ts`
- Modify: `apps/web/src/app/page.tsx`, `consent/page.tsx`, `offer/page.tsx`, `contacts/page.tsx`, `privacy/page.tsx` (`publicMetadata`)
- Modify: `apps/web/src/app/layout.tsx` (комментарий про индексацию)

**Interfaces:**
- Consumes: `ALL_TYPE_CODES`, `TYPE_NAMES`, `TYPE_TRAITS`, `TRAITS`, `COMPATIBILITY_LEVELS` из `@grani/core`; `getLibrary` из `@grani/content/data`; `typeTexts`, `traitPageIntro`, `compatibilityTexts`, `typeCodeToDir`, `TRAIT_LABELS`, `PAGE_POLES` из `@grani/content`; `TYPE_VISUALS`, `TypeGem`, `Paragraphs`.
- Produces (`seo.ts`):
  - `SITE_URL = "https://grani-test.ru"`;
  - `TYPE_SLUGS: Record<TypeCode, string>`, `typeBySlug(slug): TypeCode | null`, `typePath(code)`;
  - `TRAIT_PAGES: readonly { slug; trait; pole }[]`, `traitPageBySlug(slug)`, `traitPath(trait, pole)`;
  - `publicMetadata({ title, description, path }): Metadata`;
  - `PUBLIC_PATHS(): string[]` — все индексируемые адреса (sitemap берёт их отсюда, задача 4 дополнит статьями);
  - `breadcrumbs(items: { name; path }[])` — объект schema.org `BreadcrumbList`.

## Зачем

Спецификация 1 п. 8 и 5.3: 16 страниц типов, 10 страниц уровней черт, страница «Тест на совместимость пары» (статьи — задача 4). Статическая генерация из `packages/content`, `sitemap.xml`, `robots.txt`, мета-теги, schema.org. Тексты уже есть в библиотеке: `types/<dir>/{short,long}.md`, `trait-pages/<trait>/{high,low}.md`, `compatibility/<level>`.

Адреса — транслитерация названия типа: Яндекс учитывает слова в адресе, и ссылка читается в мессенджере. Страницы черт — `/traits/<trait>-<pole>` (например, `/traits/openness-high`), где `<trait>` — английский ключ черты: так адрес совпадает с ключами библиотеки.

## Шаги

- [ ] **Шаг 1. Тест `seo.test.ts` (RED).**

```ts
import { ALL_TYPE_CODES, TRAITS } from "@grani/core";
import { describe, expect, it } from "vitest";
import { breadcrumbs, PUBLIC_PATHS, publicMetadata, SITE_URL, TRAIT_PAGES, traitPageBySlug, TYPE_SLUGS, typeBySlug, typePath } from "./seo";

describe("seo", () => {
  it("gives every type a unique latin slug that maps back to the type", () => {
    const slugs = ALL_TYPE_CODES.map((code) => TYPE_SLUGS[code]);
    expect(new Set(slugs).size).toBe(16);
    for (const code of ALL_TYPE_CODES) {
      expect(TYPE_SLUGS[code]).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(typeBySlug(TYPE_SLUGS[code])).toBe(code);
    }
    expect(typeBySlug("unknown")).toBeNull();
  });

  it("has a high and a low page for each of the five traits", () => {
    expect(TRAIT_PAGES).toHaveLength(10);
    for (const trait of TRAITS) {
      expect(traitPageBySlug(`${trait}-high`)).toEqual({ slug: `${trait}-high`, trait, pole: "high" });
      expect(traitPageBySlug(`${trait}-low`)?.pole).toBe("low");
    }
    expect(traitPageBySlug("openness-borderline")).toBeNull();
  });

  it("lists home, 16 types, 10 traits, compatibility and documents as public paths", () => {
    const paths = PUBLIC_PATHS();
    expect(paths).toContain("/");
    expect(paths).toContain("/types");
    expect(paths).toContain(typePath("++++"));
    expect(paths).toContain("/traits/stability-low");
    expect(paths).toContain("/compatibility");
    expect(paths).toEqual(expect.arrayContaining(["/privacy", "/consent", "/offer", "/contacts"]));
    expect(paths.filter((p) => p.startsWith("/types/"))).toHaveLength(16);
    expect(paths.filter((p) => p.startsWith("/traits/"))).toHaveLength(10);
    expect(paths.some((p) => /^\/(result|report|pair|p|f|me|test|login)\b/.test(p))).toBe(false);
  });

  it("builds indexable metadata with a canonical url and open graph", () => {
    const meta = publicMetadata({ title: "Вдохновитель", description: "Описание типа", path: "/types/vdokhnovitel" });
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.alternates?.canonical).toBe("/types/vdokhnovitel");
    expect(meta.openGraph).toMatchObject({ title: "Вдохновитель", description: "Описание типа", url: "/types/vdokhnovitel", locale: "ru_RU", siteName: "Грани" });
  });

  it("builds a schema.org breadcrumb list with absolute urls", () => {
    const list = breadcrumbs([{ name: "Типы", path: "/types" }, { name: "Искра", path: "/types/iskra" }]);
    expect(list).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Типы", item: `${SITE_URL}/types` },
        { "@type": "ListItem", position: 2, name: "Искра", item: `${SITE_URL}/types/iskra` },
      ],
    });
  });
});
```

Запуск: `pnpm vitest run apps/web/src/lib/seo.test.ts` → FAIL.

- [ ] **Шаг 2. `seo.ts`.**

```ts
import { ALL_TYPE_CODES, TRAITS, type Trait, type TypeCode } from "@grani/core";
import { PAGE_POLES, type PagePole } from "@grani/content";
import type { Metadata } from "next";

export const SITE_URL = "https://grani-test.ru";
export const SITE_NAME = "Грани";

export const TYPE_SLUGS: Readonly<Record<TypeCode, string>> = {
  "++++": "vdokhnovitel",
  "+++-": "reformator",
  "++-+": "sozidatel",
  "++--": "arkhitektor",
  "+-++": "iskra",
  "+-+-": "buntar",
  "+--+": "mechtatel",
  "+---": "izobretatel",
  "-+++": "opora",
  "-++-": "komandir",
  "-+-+": "tikhiy-khranitel",
  "-+--": "master",
  "--++": "dusha-kompanii",
  "--+-": "igrok",
  "---+": "tikhaya-gavan",
  "----": "nablyudatel",
};

const TYPE_BY_SLUG = new Map(ALL_TYPE_CODES.map((code) => [TYPE_SLUGS[code], code]));
export const typeBySlug = (slug: string): TypeCode | null => TYPE_BY_SLUG.get(slug) ?? null;
export const typePath = (code: TypeCode) => `/types/${TYPE_SLUGS[code]}`;

export type TraitPage = { slug: string; trait: Trait; pole: PagePole };
export const TRAIT_PAGES: readonly TraitPage[] = TRAITS.flatMap((trait) => PAGE_POLES.map((pole) => ({ slug: `${trait}-${pole}`, trait, pole })));
export const traitPageBySlug = (slug: string): TraitPage | null => TRAIT_PAGES.find((page) => page.slug === slug) ?? null;
export const traitPath = (trait: Trait, pole: PagePole) => `/traits/${trait}-${pole}`;

const DOCUMENT_PATHS = ["/contacts", "/offer", "/privacy", "/consent"] as const;

// Задача 4 добавит сюда статьи
export function PUBLIC_PATHS(): string[] {
  return ["/", "/types", ...ALL_TYPE_CODES.map(typePath), ...TRAIT_PAGES.map((p) => `/traits/${p.slug}`), "/compatibility", ...DOCUMENT_PATHS];
}

export function publicMetadata(p: { title: string; description: string; path: string }): Metadata {
  return {
    title: p.title,
    description: p.description,
    robots: { index: true, follow: true },
    alternates: { canonical: p.path },
    openGraph: { title: p.title, description: p.description, url: p.path, type: "website", locale: "ru_RU", siteName: SITE_NAME },
  };
}

export function breadcrumbs(items: readonly { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: `${SITE_URL}${item.path}` })),
  };
}
```

Если `PAGE_POLES`/`PagePole` не экспортируются из `@grani/content`, экспортировать их из `packages/content/src/index.ts` (`keys.ts` уже экспортируется через `export * from "./keys"`). Прогнать тест: PASS.

- [ ] **Шаг 3. `JsonLd.tsx`.**

```tsx
// JSON.stringify не экранирует «<», поэтому «</script>» в тексте закрыл бы тег
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
```

- [ ] **Шаг 4. `/types/[slug]`.** Статическая страница:

```tsx
export const dynamicParams = false;
export function generateStaticParams() {
  return ALL_TYPE_CODES.map((code) => ({ slug: TYPE_SLUGS[code] }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const code = typeBySlug((await params).slug);
  if (!code) return {};
  const { name, feminine } = TYPE_NAMES[code];
  const title = `${name}${feminine ? ` / ${feminine}` : ""} — тип личности`;
  return publicMetadata({ title, description: firstSentences(typeTexts(getLibrary(), code).short, 160), path: typePath(code) });
}
```

`firstSentences(text, max)` добавить в `seo.ts` и покрыть тестом: берёт целые предложения, пока длина ≤ `max`; если первое предложение длиннее — режет по слову и ставит «…».

Содержимое страницы:
1. «Хлебные крошки» «Типы личности → {название}» ссылками.
2. Метка «Тип личности · Большая пятёрка», `h1` с названием (обе формы, если есть женская), `TypeGem` (`TYPE_VISUALS[typeCodeToDir(code)].shape`, 96px).
3. Строка кода: четыре черты `TYPE_TRAITS` с уровнем «высокая»/«низкая» по знаку в коде. Каждая — ссылка на `traitPath(trait, pole)`.
4. `short` — абзац `lead`, `long` — `Paragraphs`.
5. Абзац об уточнении: пятая шкала, эмоциональная устойчивость, делит каждый тип на «спокойный» и «чувствительный». Ссылки на `/traits/stability-high` и `/traits/stability-low`.
6. Карточка `card` с кнопкой «Пройти тест» → `/test` и пометкой «10 минут, бесплатно».
7. «Другие типы»: 15 ссылок.
8. `JsonLd`: `breadcrumbs([...])` и `{ "@context": "https://schema.org", "@type": "Article", headline: title, description, inLanguage: "ru", mainEntityOfPage: SITE_URL + path, author: { "@type": "Organization", name: "Грани" } }`.

- [ ] **Шаг 5. `/types`.** `publicMetadata({ title: "16 типов личности по Большой пятёрке", description: …, path: "/types" })`. Короткое введение: 4 черты задают тип, пятая — уточнение, ссылки на страницы черт. Дальше сетка 16 карточек, сгруппированная по семьям `TYPE_VISUALS[dir].family` (фон `--surface` … `--surface-4`, как в `visual-direction.md`): знак, название, первая фраза `short`, ссылка. На 375px — одна колонка, от 760px — две. Кнопка «Пройти тест». Крошки в JSON-LD.

- [ ] **Шаг 6. `/traits/[slug]`.** `generateStaticParams` из `TRAIT_PAGES`, `dynamicParams = false`. Заголовок — «Высокая открытость опыту» или «Низкая открытость опыту». Название черты берётся из `TRAIT_LABELS` со строчной буквы; у «Эмоциональная устойчивость» получится «Высокая эмоциональная устойчивость».

Содержимое:
1. Крошки.
2. `traitPageIntro(library, trait, pole)` через `Paragraphs`.
3. Для четырёх черт типа — список «Типы с {высокой/низкой} {черта}»: восемь типов, у которых в коде на позиции черты `+` или `-`, ссылками.
4. Для `stability` — вместо типов абзац: «Эмоциональная устойчивость не входит в код типа, а уточняет его: {спокойный|чувствительный} вариант любого из 16 типов», ссылка на `/types`.
5. Ссылка на противоположный полюс.
6. CTA «Пройти тест».
7. `description` — `firstSentences(intro, 160)`.

- [ ] **Шаг 7. `/compatibility`.** `data-palette="pair"` на `<main>`. `publicMetadata({ title: "Тест на совместимость пары", description: "Пройдите тест вдвоём и узнайте процент совместимости по Большой пятёрке. Бесплатно, без регистрации до конца теста.", path: "/compatibility" })`.

Содержимое:
1. Как это работает: вы проходите тест, отправляете партнёру ссылку, партнёр проходит тест и соглашается на взаимный показ. Бесплатно — типы обоих и процент совместимости; разбор пары — {`formatRub(PRODUCT_PRICES.pair)`}, открывается обоим.
2. Из чего складывается процент — две части по 50%:
   - «ресурс» — доброжелательность и устойчивость обоих;
   - «похожесть» — открытость, экстраверсия и добросовестность.

   Цифры брать из констант `RESOURCE_TRAITS` и `SIMILARITY_TRAITS` с `TRAIT_LABELS`, а не писать руками.
3. Пять уровней из `COMPATIBILITY_LEVELS` (порог «от N%») с `compatibilityTexts(library, level).phrase` и `.text`.
4. Честная оговорка: процент — ориентир для разговора, а не приговор отношениям.
5. CTA «Пройти тест» → `/test` (приглашение партнёра — на странице результата).
6. JSON-LD крошки.

- [ ] **Шаг 8. Главная и документы.** `page.tsx` главной — `publicMetadata({ title: "Грани — тест личности: 16 типов и как тебя видят другие", description: "Бесплатный тест личности по Большой пятёрке: 50 вопросов, один из 16 типов, пять шкал и анкета для друзей. 10 минут.", path: "/" })`, а в `title` использовать `{ absolute: … }`, чтобы шаблон «%s — Грани» не удваивал название. Под кнопкой добавить блок ссылок «Типы личности», «Тест на совместимость пары». Документам (`/contacts`, `/offer`, `/privacy`, `/consent`) — `publicMetadata` с их заголовками.

- [ ] **Шаг 9. `robots.ts` и `sitemap.ts`.**

```ts
// robots.ts
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

const PRIVATE = ["/api/", "/test", "/login", "/me", "/result/", "/report/", "/pair/", "/p/", "/f/", "/purchases/", "/cards/", "/dev/"];

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE }], sitemap: `${SITE_URL}/sitemap.xml`, host: SITE_URL };
}
```

```ts
// sitemap.ts
import type { MetadataRoute } from "next";
import { PUBLIC_PATHS, SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS().map((path) => ({ url: path === "/" ? SITE_URL : `${SITE_URL}${path}`, changeFrequency: "monthly", priority: path === "/" ? 1 : 0.7 }));
}
```

Проверить в документации Next.js 16 (Context7, `/vercel/next.js`, «metadata files robots sitemap»), что `host` поддерживается и оба файла по умолчанию статические.

- [ ] **Шаг 10. `layout.tsx`.** Заменить комментарий у `robots` на: «По умолчанию страницы закрыты от поиска: результаты, разборы и ссылки-приглашения личные. Публичные страницы включают индексацию через publicMetadata». Значение `{ index: false, follow: false }` оставить.

- [ ] **Шаг 11. Проверка.**
  - `pnpm typecheck`, `pnpm vitest run apps/web`.
  - `pnpm --filter @grani/web build`: в выводе `/types/[slug]` — 16 путей ●, `/traits/[slug]` — 10 путей ●, `/compatibility` и `/types` — ○ (static). Предупреждений нет.
  - В превью:
    - `/types`, `/types/iskra`, `/traits/openness-high`, `/traits/stability-low`, `/compatibility` на 375px и десктопе;
    - `curl -s localhost:3000/types/iskra | grep -E 'canonical|robots|ld\+json'` — canonical `https://grani-test.ru/types/iskra` (`metadataBase` из `APP_URL` локально — `localhost`, это нормально), `index, follow`, два JSON-LD;
    - `curl -s localhost:3000/result/x | grep robots` — `noindex`;
    - `/sitemap.xml` — 32 адреса;
    - `/robots.txt`.
  - Скриншоты `/types` и `/types/iskra` на 375px.

- [ ] **Шаг 12. Коммит.**

```bash
git add apps/web/src/lib/seo.ts apps/web/src/lib/seo.test.ts apps/web/src/components/JsonLd.tsx apps/web/src/app/types apps/web/src/app/traits apps/web/src/app/compatibility apps/web/src/app/sitemap.ts apps/web/src/app/robots.ts apps/web/src/app/page.tsx apps/web/src/app/layout.tsx apps/web/src/app/consent apps/web/src/app/offer apps/web/src/app/contacts apps/web/src/app/privacy apps/web/src/app/globals.css packages/content/src/index.ts
git commit -m "feat(seo): type, trait level and compatibility pages, sitemap, robots, schema.org"
```
