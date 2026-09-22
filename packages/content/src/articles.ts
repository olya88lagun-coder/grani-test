import { z } from "zod";
import { LibraryError } from "./library";
import { parseBlocks, type TextBlock } from "./markdown";

export type Article = { slug: string; title: string; description: string; date: string; body: string; blocks: TextBlock[] };

const FrontMatter = z.strictObject({
  title: z.string().min(10).max(90),
  description: z.string().min(50).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const ARTICLE_LENGTH = { min: 4000, max: 9000 } as const;
const MIN_HEADINGS = 3;

function splitFrontMatter(slug: string, raw: string): { head: string; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw.replace(/\r\n/g, "\n").trim());
  if (!match) throw new LibraryError(`articles/${slug}.md: no front matter`);
  return { head: match[1]!, body: match[2]!.trim() };
}

// Заголовок статьи сам может содержать двоеточие, поэтому строка делится по первому
function parseHead(slug: string, head: string) {
  const fields = Object.fromEntries(
    head.split("\n").map((line) => {
      const at = line.indexOf(":");
      return at < 0 ? [line.trim(), ""] : [line.slice(0, at).trim(), line.slice(at + 1).trim()];
    }),
  );
  const parsed = FrontMatter.safeParse(fields);
  if (!parsed.success) {
    throw new LibraryError(`articles/${slug}.md: ${parsed.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("; ")}`);
  }
  return parsed.data;
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
