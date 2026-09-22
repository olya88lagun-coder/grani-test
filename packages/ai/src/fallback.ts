import { TRAITS, type Trait } from "@grani/core";
import { PAIR_SECTIONS } from "@grani/content";
import { byPronounced, type PersonalFacts, type ReportInput } from "./input";
import type { ChapterSections, FriendsSections, FullSections, PairSections, ReportSections } from "./sections";
import type { ReportKind } from "@grani/core";

const ADVICE_MARKER = "Что помогает:";
const TIP_MARKER = "Что с этим делать:";
const DEFAULT_TIP = "Замечать это вовремя и договариваться заранее — уже половина дела.";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const paragraphs = (block: string) => block.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
const bullets = (block: string) => block.split("\n").filter((line) => line.startsWith("- ")).map((line) => line.slice(2).trim());
const firstBullet = (block: string) => bullets(block)[0] ?? paragraphs(block)[0] ?? block.trim();
const firstParagraph = (block: string) => paragraphs(block)[0] ?? block.trim();
const firstSentence = (text: string) => text.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? text;

function advice(block: string): string {
  const found = paragraphs(block).find((part) => part.startsWith(ADVICE_MARKER));
  return capitalize((found ?? paragraphs(block).at(-1) ?? block).replace(ADVICE_MARKER, "").trim());
}

function splitBlindSpot(bullet: string): { text: string; tip: string } {
  const [text, tip] = bullet.split(TIP_MARKER);
  return { text: text!.trim(), tip: tip ? capitalize(tip.trim()) : DEFAULT_TIP };
}

const ordered = (facts: PersonalFacts): Trait[] => byPronounced(facts.traits).map((fact) => fact.trait);

function full(input: Extract<ReportInput, { kind: "full" }>): FullSections {
  const traits = input.blocks.traits;
  const top = ordered(input.facts);
  return {
    portrait: `${input.blocks.typeShort}\n\n${input.blocks.stability}`,
    strengths: top.map((trait) => firstBullet(traits[trait].strengths)),
    blind_spots: top.slice(0, 4).map((trait) => splitBlindSpot(firstBullet(traits[trait].blind_spots))),
    manual: {
      work: top.slice(0, 3).map((trait) => advice(traits[trait].work)),
      fight: top.slice(0, 3).map((trait) => advice(traits[trait].conflict)),
      annoys: top.slice(0, 3).map((trait) => firstSentence(firstParagraph(traits[trait].stress))),
    },
  };
}

function chapter(input: Extract<ReportInput, { kind: `chapter_${string}` }>): ChapterSections {
  const top = ordered(input.facts);
  return {
    text: top.map((trait) => firstParagraph(input.blocks.traits[trait])).join("\n\n"),
    tips: [...new Set(top.map((trait) => advice(input.blocks.traits[trait])))],
  };
}

function friends(input: Extract<ReportInput, { kind: "friends" }>): FriendsSections {
  const lines = input.friends.traits.map((fact) =>
    fact.notable
      ? `«${fact.label}»: друзья ставят тебе ${fact.friends}, ты себе — ${fact.self}. ${fact.diff > 0 ? "Со стороны эта черта заметнее, чем тебе кажется." : "Со стороны эта черта видна слабее, чем тебе кажется."}`
      : `«${fact.label}»: оценки почти совпадают — ${fact.self} у тебя и ${fact.friends} у друзей.`,
  );
  const summary = input.friends.traits.some((fact) => fact.notable)
    ? "Разница — не ошибка теста: люди видят поступки, а ты знаешь ещё и мотивы. Там, где оценки расходятся, полезно спросить друзей, что именно они замечают."
    : "В целом друзья видят тебя примерно так же, как ты себя: то, что ты о себе знаешь, заметно и со стороны.";
  return { text: [`Это среднее по ответам друзей (${input.friends.count}) на те же 20 вопросов, на которые ты отвечаешь о себе в тесте.`, ...lines, summary].join("\n\n") };
}

function pair(input: Extract<ReportInput, { kind: "pair" }>): PairSections {
  return Object.fromEntries(
    PAIR_SECTIONS.map((section) => [section, TRAITS.map((trait) => input.blocks[section][trait]).join("\n\n")]),
  ) as PairSections;
}

export function fallbackSections(input: ReportInput): ReportSections[ReportKind] {
  if (input.kind === "full") return full(input);
  if (input.kind === "friends") return friends(input);
  if (input.kind === "pair") return pair(input);
  return chapter(input);
}
