import { TRAITS, traitLevel, typeName, isBorderline, type Gender, type Stability, type Trait, type TraitScores, type TypeCode } from "@grani/core";
import { stabilityText, traitBlock, typeCodeToDir, typeTexts, type Library } from "@grani/content";

export const TRAIT_LABELS: Readonly<Record<Trait, string>> = {
  openness: "Открытость опыту",
  conscientiousness: "Добросовестность",
  extraversion: "Экстраверсия",
  agreeableness: "Доброжелательность",
  stability: "Эмоциональная устойчивость",
};

const STABILITY_TAGS: Readonly<Record<Stability, string>> = { calm: "Спокойствие", sensitive: "Чувствительность" };

export type ScaleView = { trait: Trait; label: string; score: number; borderline: boolean; text: string };

export type ResultView = {
  typeCode: TypeCode;
  dir: string;
  name: string;
  stabilityTag: string;
  stabilityText: string;
  shortText: string;
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
