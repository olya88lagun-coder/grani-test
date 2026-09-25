import { TRAITS, TYPE_TRAITS, traitLevel, typeName, isBorderline, type Gender, type Stability, type Trait, type TraitScores, type TypeCode } from "@grani/core";
import { stabilityText, TRAIT_LABELS, traitBlock, typeCodeToDir, typeTexts, type Library } from "@grani/content";

export { TRAIT_LABELS } from "@grani/content";

const STABILITY_TAGS: Readonly<Record<Stability, string>> = { calm: "Спокойствие", sensitive: "Чувствительность" };

// Одно слово на полюс каждой из четырёх черт типа: теги результата и тезисы карточки для сторис
const POLE_KEYWORDS: Readonly<Record<(typeof TYPE_TRAITS)[number], { "+": string; "-": string }>> = {
  openness: { "+": "Любопытство", "-": "Практичность" },
  conscientiousness: { "+": "Системность", "-": "Спонтанность" },
  extraversion: { "+": "Общительность", "-": "Сосредоточенность" },
  agreeableness: { "+": "Теплота", "-": "Прямота" },
};

export function typeKeywords(code: TypeCode): string[] {
  return TYPE_TRAITS.map((trait, index) => POLE_KEYWORDS[trait][code[index] as "+" | "-"]);
}

export type ScaleView = { trait: Trait; label: string; score: number; borderline: boolean; text: string };

export type ResultView = {
  typeCode: TypeCode;
  dir: string;
  name: string;
  stabilityTag: string;
  stabilityText: string;
  shortText: string;
  keywords: readonly string[];
  scales: readonly ScaleView[];
};

type ResultInput = { typeCode: TypeCode; stability: Stability; scores: TraitScores };

export function buildResultView(library: Library, result: ResultInput, gender: Gender): ResultView {
  return {
    typeCode: result.typeCode,
    dir: typeCodeToDir(result.typeCode),
    name: typeName(result.typeCode, gender),
    stabilityTag: STABILITY_TAGS[result.stability],
    stabilityText: stabilityText(library, result.stability),
    shortText: typeTexts(library, result.typeCode).short,
    keywords: typeKeywords(result.typeCode),
    scales: TRAITS.map((trait) => {
      const score = result.scores[trait];
      return {
        trait,
        label: TRAIT_LABELS[trait],
        score,
        borderline: isBorderline(score),
        text: traitBlock(library, trait, traitLevel(score), "strengths"),
      };
    }),
  };
}
