import { LibraryError } from "./library";
import { parseBlocks, type TextBlock } from "./markdown";

// Полный гид по полюсу черты для страниц /traits/*: у каждого полюса свой текст по одному плану разделов
export type TraitGuideFaq = { readonly question: string; readonly answer: string };
export type TraitGuide = { slug: string; faq: readonly TraitGuideFaq[]; body: string; blocks: TextBlock[] };

export const TRAIT_GUIDE_SECTIONS = [
  "Как узнать эту черту",
  "В повседневной жизни",
  "В работе",
  "В отношениях и общении",
  "Под стрессом",
  "Сильные стороны",
  "Возможные сложности",
  "Частые заблуждения",
] as const;

export const TRAIT_GUIDE_LENGTH = { min: 2800, max: 9000 } as const;
const MIN_FAQ = 3;

function fail(slug: string, message: string): never {
  throw new LibraryError(`trait-guides/${slug}.md: ${message}`);
}

function parseFaq(slug: string, line: string | undefined): TraitGuideFaq[] {
  if (!line) fail(slug, "no faq");
  const items = line.split(" || ").map((item, index) => {
    const [question, answer, extra] = item.split(" => ").map((part) => part.trim());
    if (!question || !answer || extra !== undefined) fail(slug, `faq item ${index + 1} must be "question => answer"`);
    return { question, answer };
  });
  if (items.length < MIN_FAQ) fail(slug, `fewer than ${MIN_FAQ} faq items`);
  return items;
}

export function parseTraitGuide(slug: string, raw: string): TraitGuide {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw.replace(/\r\n/g, "\n").trim());
  if (!match) fail(slug, "no front matter");
  const faqLine = match[1]!
    .split("\n")
    .find((line) => line.startsWith("faq:"))
    ?.slice("faq:".length)
    .trim();
  const body = match[2]!.trim();
  if (body.length < TRAIT_GUIDE_LENGTH.min || body.length > TRAIT_GUIDE_LENGTH.max) fail(slug, `body length ${body.length}`);
  const blocks = parseBlocks(body);
  const headings = blocks.filter((block) => block.kind === "h2").map((block) => block.text);
  if (headings.join("|") !== TRAIT_GUIDE_SECTIONS.join("|")) fail(slug, `sections must be: ${TRAIT_GUIDE_SECTIONS.join(", ")}`);
  return { slug, faq: parseFaq(slug, faqLine), body, blocks };
}

export function parseTraitGuides(raw: Readonly<Record<string, string>>): TraitGuide[] {
  return Object.entries(raw).map(([slug, text]) => parseTraitGuide(slug, text));
}
