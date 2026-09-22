import { buildPersonalInput, fallbackSections, parseSections, type ChapterSections, type FullSections, type PersonalScores } from "@grani/ai";
import { CHAPTER_TITLES, type Library } from "@grani/content";
import { canBuy, CHAPTER_KINDS, formatRub, MIN_FRIENDS, PRODUCT_PRICES, unlockedKinds, type ChapterKind, type Product } from "@grani/core";
import type { ReportRecord } from "@grani/db";
import { friendsCounter } from "./friends-view";

export const REPORT_DISCLAIMER = "Материалы для самопознания, не психологическая и не медицинская диагностика.";

export type PreviewSection = { title: string; teaser: string };
export type ChapterView =
  | { kind: ChapterKind; title: string; state: "ready"; sections: ChapterSections }
  | { kind: ChapterKind; title: string; state: "preparing" }
  | { kind: ChapterKind; title: string; state: "available"; price: string };
export type FriendsSectionView = { state: "ready"; text: string } | { state: "preparing" } | { state: "waiting"; counter: string };
export type ReportPageView = {
  full: FullSections | null;
  friends: FriendsSectionView;
  chapters: readonly ChapterView[];
  bundle: { price: string } | null;
  preparing: boolean;
};

const TEASER_LENGTH = 120;
// Первое предложение целиком, если оно короткое; иначе — обрезка по слову с многоточием
function teaser(text: string): string {
  const sentence = text.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? text;
  if (sentence.length <= TEASER_LENGTH) return sentence;
  const cut = sentence.slice(0, TEASER_LENGTH);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:—-]+$/, "")}…`;
}

export function buildReportPreview(library: Library, result: PersonalScores): readonly PreviewSection[] {
  const full = fallbackSections(buildPersonalInput(library, "full", result)) as FullSections;
  return [
    { title: "Портрет", teaser: teaser(full.portrait) },
    { title: "Сильные стороны", teaser: teaser(full.strengths[0]!) },
    { title: "Слепые зоны", teaser: teaser(full.blind_spots[0]!.text) },
    { title: "Инструкция по применению меня", teaser: teaser(`Как со мной работать: ${full.manual.work[0]!}`) },
    { title: "Как меня видят другие", teaser: "Появится, когда ответят трое друзей: где их взгляд совпадает с твоим и где расходится." },
  ];
}

export function buildReportPageView(p: { owned: readonly Product[]; reports: readonly ReportRecord[]; friendsCount: number }): ReportPageView {
  const unlocked = unlockedKinds(p.owned);
  const byKind = new Map(p.reports.map((report) => [report.kind, report]));
  const full = byKind.has("full") ? parseSections("full", byKind.get("full")!.sections) : null;

  const friendsText = byKind.has("friends") ? parseSections("friends", byKind.get("friends")!.sections)?.text : undefined;
  const friends: FriendsSectionView = friendsText
    ? { state: "ready", text: friendsText }
    : p.friendsCount >= MIN_FRIENDS
      ? { state: "preparing" }
      : { state: "waiting", counter: friendsCounter(p.friendsCount) };

  const chapters = CHAPTER_KINDS.map((kind): ChapterView => {
    const title = CHAPTER_TITLES[kind];
    const sections = byKind.has(kind) ? parseSections(kind, byKind.get(kind)!.sections) : null;
    if (sections) return { kind, title, state: "ready", sections };
    if (unlocked.has(kind)) return { kind, title, state: "preparing" };
    return { kind, title, state: "available", price: formatRub(PRODUCT_PRICES[kind]) };
  });

  return {
    full,
    friends,
    chapters,
    bundle: canBuy("chapters_all", p.owned) ? { price: formatRub(PRODUCT_PRICES.chapters_all) } : null,
    preparing: full === null || friends.state === "preparing" || chapters.some((chapter) => chapter.state === "preparing"),
  };
}
