import { parseSections, type PairSections } from "@grani/ai";
import { compatibilityLevel, compatibilityScore, formatRub, PRODUCT_PRICES, TRAITS, typeName, unlockedKinds, type Gender, type Product, type Trait } from "@grani/core";
import { compatibilityTexts, typeCodeToDir, type Library } from "@grani/content";
import type { PairMember, PairRecord, ReportRecord } from "@grani/db";
import { firstName } from "@/server/friends-service";
import { TRAIT_LABELS } from "./result-view";

export type PairPerson = { firstName: string; typeName: string; dir: string };
export type PairRow = { trait: Trait; label: string; you: number; partner: number };
export type PairView = { pairId: string; score: number; phrase: string; text: string; you: PairPerson; partner: PairPerson; rows: readonly PairRow[] };

function person(member: PairMember): PairPerson {
  return {
    firstName: firstName(member.user.displayName),
    typeName: typeName(member.result.typeCode, member.user.gender),
    dir: typeCodeToDir(member.result.typeCode),
  };
}

export function buildPairView(library: Library, pair: PairRecord, viewerId: string): PairView {
  const [a, b] = pair.members;
  const [you, partner] = a.user.id === viewerId ? [a, b] : [b, a];
  const score = compatibilityScore(a.result.scores, b.result.scores);
  const texts = compatibilityTexts(library, compatibilityLevel(score));
  return {
    pairId: pair.id,
    score,
    phrase: texts.phrase,
    text: texts.text,
    you: person(you),
    partner: person(partner),
    rows: TRAITS.map((trait) => ({ trait, label: TRAIT_LABELS[trait], you: you.result.scores[trait], partner: partner.result.scores[trait] })),
  };
}

const OBJECT_PRONOUNS: Readonly<Record<Exclude<Gender, null>, string>> = { female: "её", male: "его" };

export function pairConsentLabel(inviterFirstName: string, gender: Gender): string {
  // Без пола местоимение не угадываем: формулировка про обоих не требует ни «её», ни «его», ни склонения имени
  if (gender === null) return `${inviterFirstName} и я увидим типы и шкалы друг друга`;
  return `${inviterFirstName} увидит мой тип и шкалы, а я — ${OBJECT_PRONOUNS[gender]}`;
}

export const PAIR_SECTION_TITLES: Readonly<Record<keyof PairSections, string>> = {
  similar: "В чём вы похожи",
  differences: "Где вы разные и как это использовать",
  conflicts: "Откуда будут конфликты и как договариваться",
  home_money: "Быт и деньги",
  support: "Как поддерживать друг друга",
};

export type PairReportView =
  | { state: "available"; price: string }
  | { state: "preparing" }
  | { state: "ready"; sections: readonly { key: keyof PairSections; title: string; text: string }[] };

export function buildPairReportView(p: { owned: readonly Product[]; report: ReportRecord | null }): PairReportView {
  const sections = p.report ? parseSections("pair", p.report.sections) : null;
  if (sections) {
    const keys = Object.keys(PAIR_SECTION_TITLES) as (keyof PairSections)[];
    return { state: "ready", sections: keys.map((key) => ({ key, title: PAIR_SECTION_TITLES[key], text: sections[key] })) };
  }
  if (unlockedKinds(p.owned).has("pair")) return { state: "preparing" };
  return { state: "available", price: formatRub(PRODUCT_PRICES.pair) };
}
