# Задача 4 — Статьи

**Files:**
- Create: `packages/content/articles/<slug>.md` — 5 файлов
- Modify: `packages/content/scripts/build-library.mjs` (+ `articles.json`)
- Create: `packages/content/src/generated/articles.json` (генерируется)
- Create: `packages/content/src/articles.ts`, `packages/content/src/articles.test.ts`
- Modify: `packages/content/src/data.ts` (`getArticles()`), `packages/content/src/index.ts`
- Create: `apps/web/src/components/ArticleBody.tsx`
- Create: `apps/web/src/app/articles/page.tsx`, `apps/web/src/app/articles/[slug]/page.tsx`
- Modify: `apps/web/src/lib/seo.ts` (+ статьи в `PUBLIC_PATHS`), `seo.test.ts`

**Interfaces:**
- Produces:
  - `Article = { slug; title; description; date; body: ArticleBlock[] }`;
  - `ArticleBlock = { kind: "h2"; text } | { kind: "p"; text } | { kind: "ul"; items: string[] }`;
  - `parseArticle(slug, raw): Article` — бросает `LibraryError` с именем файла;
  - `getArticles(): readonly Article[]` — в порядке `date` по убыванию;
  - `inlineLinks(text): ({ text } | { text; href })[]` — разбор `[текст](/путь)`, только внутренние адреса.

## Зачем

Спецификация 1 п. 8: 5–10 статей под поиск (план 2 отложил их в план 6). В первой версии — 5 статей по частым запросам, каждая ведёт на тест и на страницы типов и черт. Черновики готовит агент, вычитывает владелица, как блоки библиотеки в плане 2.

## Темы (предложить пользователю, утвердить до написания)

| slug | Заголовок | Запросы |
|---|---|---|
| `big-five` | Большая пятёрка: что это за модель личности и как её измеряют | большая пятерка личности, big five тест |
| `test-lichnosti` | Тест на тип личности: чем научные тесты отличаются от развлекательных | тест на тип личности, тест личности бесплатно |
| `ekstravert-introvert` | Экстраверт или интроверт: что на самом деле измеряет шкала экстраверсии | экстраверт интроверт тест |
| `kak-menya-vidyat` | Как меня видят другие: почему самооценка и взгляд друзей расходятся | как меня видят другие тест |
| `sovmestimost-par` | Совместимость в паре: что говорят исследования о похожести характеров | тест на совместимость пары, совместимость по характеру |

Правила текста:
- 4 000–8 000 знаков, на «ты», как библиотека блоков;
- 3–6 подзаголовков `##`;
- без выдуманных цифр и ссылок на исследования, которые нельзя проверить. Если нужен факт — формулировать общо («исследования показывают, что…» только для общепризнанного: пять черт, умеренная связь с поведением, похожесть в паре важнее противоположностей по открытости и добросовестности);
- без диагнозов и стоп-слов из `safety.ts`;
- в каждой статье 2–4 внутренние ссылки (`/test`, `/types/...`, `/traits/...`, `/compatibility`) и абзац-дисклеймер в конце.

## Формат файла

```markdown
---
title: Большая пятёрка: что это за модель личности и как её измеряют
description: Пять черт, из которых складывается характер, откуда взялась модель и как её измеряют тесты вроде IPIP-50.
date: 2026-09-23
---

Первый абзац…

## Подзаголовок

Абзац со ссылкой на [страницу высокой открытости](/traits/openness-high).

- пункт списка
- ещё пункт
```

## Шаги

- [ ] **Шаг 1. Утвердить темы.** Показать пользователю таблицу тем и спросить, какие оставить или заменить. Остальные шаги — после ответа.

- [ ] **Шаг 2. Тест разбора (RED).** `packages/content/src/articles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { inlineLinks, parseArticle } from "./articles";
import { getArticles } from "./data";
import { findStopWords } from "./safety";

const RAW = `---
title: Заголовок статьи про черты
description: Описание статьи длиной больше пятидесяти знаков, чтобы пройти проверку.
date: 2026-09-23
---

Первый абзац
продолжается на второй строке.

## Раздел

- один
- два

Абзац со [ссылкой](/test).`;

describe("parseArticle", () => {
  it("reads front matter and splits the body into headings, paragraphs and lists", () => {
    const article = parseArticle("demo", RAW, { minLength: 10 });
    expect(article).toMatchObject({ slug: "demo", title: "Заголовок статьи про черты", date: "2026-09-23" });
    expect(article.body).toEqual([
      { kind: "p", text: "Первый абзац продолжается на второй строке." },
      { kind: "h2", text: "Раздел" },
      { kind: "ul", items: ["один", "два"] },
      { kind: "p", text: "Абзац со [ссылкой](/test)." },
    ]);
  });

  it("rejects a file without front matter and names the file", () => {
    expect(() => parseArticle("broken", "Просто текст")).toThrow(/broken/);
  });
});

describe("inlineLinks", () => {
  it("turns internal markdown links into parts and leaves external ones as text", () => {
    expect(inlineLinks("См. [тест](/test) и [сайт](https://example.com).")).toEqual([
      { text: "См. " },
      { text: "тест", href: "/test" },
      { text: " и [сайт](https://example.com)." },
    ]);
  });
});

describe("articles", () => {
  it("has five valid articles with unique slugs, newest first, without stop words", () => {
    const articles = getArticles();
    expect(articles).toHaveLength(5);
    expect(new Set(articles.map((a) => a.slug)).size).toBe(5);
    expect([...articles].sort((a, b) => b.date.localeCompare(a.date))).toEqual(articles);
    for (const article of articles) {
      const text = [article.title, article.description, ...article.body.flatMap((b) => (b.kind === "ul" ? b.items : [b.text]))].join("\n");
      expect(findStopWords(text), article.slug).toEqual([]);
      expect(article.body.filter((b) => b.kind === "h2").length, article.slug).toBeGreaterThanOrEqual(3);
    }
  });
});
```

- [ ] **Шаг 3. `articles.ts`.**

```ts
import { z } from "zod";
import { LibraryError } from "./library";

export type ArticleBlock = { kind: "h2"; text: string } | { kind: "p"; text: string } | { kind: "ul"; items: string[] };
export type Article = { slug: string; title: string; description: string; date: string; body: ArticleBlock[] };

const FrontMatter = z.strictObject({
  title: z.string().min(10).max(90),
  description: z.string().min(50).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const ARTICLE_MIN_LENGTH = 4000;
const ARTICLE_MAX_LENGTH = 8000;

function splitFrontMatter(slug: string, raw: string): { head: string; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw.replace(/\r\n/g, "\n").trim());
  if (!match) throw new LibraryError(`articles/${slug}.md: no front matter`);
  return { head: match[1]!, body: match[2]!.trim() };
}

function parseHead(slug: string, head: string) {
  const fields = Object.fromEntries(
    head.split("\n").map((line) => {
      const at = line.indexOf(":");
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
    }),
  );
  const parsed = FrontMatter.safeParse(fields);
  if (!parsed.success) throw new LibraryError(`articles/${slug}.md: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  return parsed.data;
}

function parseBlock(chunk: string): ArticleBlock {
  const lines = chunk.split("\n").map((line) => line.trim());
  if (lines[0]!.startsWith("## ")) return { kind: "h2", text: lines[0]!.slice(3).trim() };
  if (lines.every((line) => line.startsWith("- "))) return { kind: "ul", items: lines.map((line) => line.slice(2).trim()) };
  return { kind: "p", text: lines.join(" ") };
}

export function parseArticle(slug: string, raw: string, limits: { minLength?: number } = {}): Article {
  const { head, body } = splitFrontMatter(slug, raw);
  const meta = parseHead(slug, head);
  const length = body.length;
  if (length < (limits.minLength ?? ARTICLE_MIN_LENGTH) || length > ARTICLE_MAX_LENGTH) throw new LibraryError(`articles/${slug}.md: body length ${length}`);
  return { slug, ...meta, body: body.split(/\n{2,}/).map(parseBlock) };
}

export type InlinePart = { text: string } | { text: string; href: string };

// Только внутренние ссылки: статьи ведут на тест и страницы типов, а не наружу
export function inlineLinks(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let rest = text;
  for (const match of text.matchAll(/\[([^\]]+)\]\((\/[^)\s]*)\)/g)) {
    const [whole, label, href] = match;
    const at = rest.indexOf(whole);
    if (at > 0) parts.push({ text: rest.slice(0, at) });
    parts.push({ text: label!, href: href! });
    rest = rest.slice(at + whole.length);
  }
  if (rest) parts.push({ text: rest });
  return parts;
}
```

Заголовок статьи может содержать двоеточие («Большая пятёрка: что это…»), поэтому `parseHead` делит строку по **первому** двоеточию — так и написано выше.

- [ ] **Шаг 4. Сборка.** В `build-library.mjs` добавить `collectArticles(articlesDir)` → `{ [slug]: raw }` (без разбора, как библиотека: разбор и проверка в TS). Писать в `src/generated/articles.json`. В `data.ts`:

```ts
import rawArticles from "./generated/articles.json";
import { parseArticle, type Article } from "./articles";

let articles: readonly Article[] | undefined;
export function getArticles(): readonly Article[] {
  articles ??= Object.entries(rawArticles as Record<string, string>)
    .map(([slug, raw]) => parseArticle(slug, raw))
    .sort((a, b) => b.date.localeCompare(a.date));
  return articles;
}
```

В `index.ts` — `export * from "./articles"` (`getArticles` остаётся в `./data`, как `getLibrary`). Проверить, что существующий тест, который сверяет `library.json` с файлами `blocks/` (`data.test.ts` или `check.test.ts`), покрывает и `articles.json`. Если нет — добавить такую же проверку: `collectArticles` по папке равен содержимому json. Тогда забытый `pnpm build:library` уронит CI.

- [ ] **Шаг 5. Черновики статей.** Написать 5 файлов по утверждённым темам и правилам текста. `pnpm build:library`, `pnpm vitest run packages/content` → PASS.

- [ ] **Шаг 6. Вычитка владелицей.** Показать пользователю все пять статей: списком заголовков и ссылками на локальные страницы в превью, после шага 8. Правки владелицы внести в `.md`, пересобрать `articles.json`. Коммитить тексты только после её «ок».

- [ ] **Шаг 7. `ArticleBody.tsx`.** Серверный компонент: `h2` → `<h2>`, `p` → `<p>` с `inlineLinks` (ссылки через `next/link`), `ul` → `<ul><li>` с тем же разбором.

- [ ] **Шаг 8. Страницы.**
  - `/articles`: `publicMetadata({ title: "Статьи о личности и отношениях", …, path: "/articles" })`, список карточек (заголовок, описание, дата `toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })`).
  - `/articles/[slug]`: `generateStaticParams` из `getArticles()`, `dynamicParams = false`, `publicMetadata` с `title`, `description` и `path`; `openGraph.type = "article"`. Под `h1` — дата, затем `ArticleBody`. В конце — карточка «Пройти тест» и «Другие статьи». Добавить `JsonLd`: `breadcrumbs` и `{ "@type": "Article", headline, description, datePublished: date, inLanguage: "ru", author: { "@type": "Organization", name: "Грани" }, mainEntityOfPage }`.
  - В `seo.ts` `PUBLIC_PATHS()` добавить `"/articles"` и `getArticles().map((a) => `/articles/${a.slug}`)`. В `seo.test.ts` добавить ожидание: 6 адресов, начинающихся с `/articles`.

- [ ] **Шаг 9. Проверка.**
  - `pnpm typecheck`, `pnpm vitest run packages/content apps/web`.
  - Сборка сайта: `/articles/[slug]` — 5 путей ●.
  - В превью `/articles` и одна статья на 375px: ссылки внутри текста ведут на существующие страницы (проверить все внутренние ссылки всех статей: `curl -s -o /dev/null -w "%{http_code}"` → 200).
  - `/sitemap.xml` — 38 адресов.

- [ ] **Шаг 10. Коммит** (после «ок» владелицы).

```bash
git add packages/content/articles packages/content/scripts/build-library.mjs packages/content/src/articles.ts packages/content/src/articles.test.ts packages/content/src/data.ts packages/content/src/index.ts packages/content/src/generated/articles.json apps/web/src/components/ArticleBody.tsx apps/web/src/app/articles apps/web/src/lib/seo.ts apps/web/src/lib/seo.test.ts
git commit -m "feat(content): five search articles with internal links"
```
