import { z } from "zod";
import { LibraryError } from "./library";
import { parseBlocks, type TextBlock } from "./markdown";

export const ARTICLE_STATUSES = ["draft", "ready_for_review", "published"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];
export type ArticleFaq = { readonly question: string; readonly answer: string };

// seoTitle — короткий заголовок для вкладки и выдачи, когда title (он же H1) длиннее 52 знаков.
// Новые статьи могут проходить полуавтоматический конвейер через status/canonical/faq, но в сайт и sitemap попадают только published.
export type Article = {
  slug: string;
  title: string;
  seoTitle?: string;
  description: string;
  date: string;
  status: ArticleStatus;
  reviewed: boolean;
  canonical: string;
  cluster?: string;
  intent?: string;
  // Рубрика и иллюстрация карточки; картинка — ассет сайта из /home, наличие файла проверяет тест сайта
  tag?: string;
  image?: string;
  faq: readonly ArticleFaq[];
  body: string;
  blocks: TextBlock[];
};

const RawFrontMatter = z.strictObject({
  title: z.string().min(10).max(90),
  seoTitle: z.string().min(10).max(52).optional(),
  description: z.string().min(50).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(ARTICLE_STATUSES).optional(),
  reviewed: z.enum(["true", "false"]).optional(),
  canonical: z.string().regex(/^\/[a-z0-9/-]+$/).optional(),
  cluster: z.string().min(2).max(40).optional(),
  intent: z.string().min(4).max(80).optional(),
  tag: z.string().min(3).max(24).optional(),
  image: z.string().regex(/^\/home\/[a-z0-9-]+\.webp$/).optional(),
  faq: z.string().min(20).max(1200).optional(),
});

export const ARTICLE_LENGTH = { min: 4000, max: 9000 } as const;
const MIN_HEADINGS = 3;

function splitFrontMatter(slug: string, raw: string): { head: string; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw.replace(/\r\n/g, "\n").trim());
  if (!match) throw new LibraryError(`articles/${slug}.md: no front matter`);
  return { head: match[1]!, body: match[2]!.trim() };
}

function parseFaq(slug: string, raw: string | undefined): readonly ArticleFaq[] {
  if (raw === undefined) return [];
  return raw.split(" || ").map((item, index) => {
    const [question, answer, extra] = item.split(" => ").map((part) => part.trim());
    if (!question || !answer || extra !== undefined) throw new LibraryError(`articles/${slug}.md: faq item ${index + 1} must be "question => answer"`);
    if (question.length < 8 || answer.length < 20) throw new LibraryError(`articles/${slug}.md: faq item ${index + 1} is too short`);
    return { question, answer };
  });
}

// Заголовок статьи сам может содержать двоеточие, поэтому строка делится по первому.
function parseHead(slug: string, head: string) {
  const fields = Object.fromEntries(
    head.split("\n").map((line) => {
      const at = line.indexOf(":");
      return at < 0 ? [line.trim(), ""] : [line.slice(0, at).trim(), line.slice(at + 1).trim()];
    }),
  );
  const parsed = RawFrontMatter.safeParse(fields);
  if (!parsed.success) {
    throw new LibraryError(`articles/${slug}.md: ${parsed.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("; ")}`);
  }
  const statusWasExplicit = Object.hasOwn(fields, "status");
  const status = parsed.data.status ?? "published";
  const reviewed = parsed.data.reviewed === "true" || !statusWasExplicit;
  if (status === "published" && statusWasExplicit && !reviewed) {
    throw new LibraryError(`articles/${slug}.md: published articles require reviewed: true`);
  }
  return {
    ...parsed.data,
    status,
    reviewed,
    canonical: parsed.data.canonical ?? `/articles/${slug}`,
    faq: parseFaq(slug, parsed.data.faq),
  };
}

export function parseArticle(slug: string, raw: string, length: { min: number; max: number } = ARTICLE_LENGTH): Article {
  const { head, body } = splitFrontMatter(slug, raw);
  const meta = parseHead(slug, head);
  if (body.length < length.min || body.length > length.max) throw new LibraryError(`articles/${slug}.md: body length ${body.length}`);
  const blocks = parseBlocks(body);
  if (length === ARTICLE_LENGTH && blocks.filter((block) => block.kind === "h2").length < MIN_HEADINGS) {
    throw new LibraryError(`articles/${slug}.md: fewer than ${MIN_HEADINGS} headings`);
  }
  return { slug, ...meta, body, blocks };
}

export function parseArticles(raw: Readonly<Record<string, string>>): Article[] {
  return Object.entries(raw)
    .map(([slug, text]) => parseArticle(slug, text))
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

export function publishedArticles(articles: readonly Article[]): Article[] {
  return articles.filter((article) => article.status === "published");
}
