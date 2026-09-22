import { ALL_TYPE_CODES, TYPE_NAMES, TYPE_TRAITS, type Trait, type TypeCode } from "@grani/core";
import { TRAIT_LABELS, type PagePole } from "@grani/content";

type TypeTrait = (typeof TYPE_TRAITS)[number];

// Страница типа открыта всем, поэтому показывает обе формы названия
export function typeDisplayName(code: TypeCode): string {
  const { name, feminine } = TYPE_NAMES[code];
  return feminine ? `${name} / ${feminine}` : name;
}

export function typePoles(code: TypeCode): readonly { trait: TypeTrait; pole: PagePole }[] {
  return TYPE_TRAITS.map((trait, index) => ({ trait, pole: code[index] === "+" ? "high" : "low" }));
}

export function typesWithPole(trait: Trait, pole: PagePole): readonly TypeCode[] {
  const index = (TYPE_TRAITS as readonly Trait[]).indexOf(trait);
  if (index < 0) return [];
  const sign = pole === "high" ? "+" : "-";
  return ALL_TYPE_CODES.filter((code) => code[index] === sign);
}

const POLE_ADJECTIVES: Readonly<Record<PagePole, string>> = { high: "Высокая", low: "Низкая" };
export const POLE_WORDS: Readonly<Record<PagePole, string>> = { high: "высокая", low: "низкая" };

// Все пять названий черт — существительные женского рода, поэтому прилагательное одно
export function traitPageTitle(trait: Trait, pole: PagePole): string {
  const label = TRAIT_LABELS[trait];
  return `${POLE_ADJECTIVES[pole]} ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

export function oppositePole(pole: PagePole): PagePole {
  return pole === "high" ? "low" : "high";
}
