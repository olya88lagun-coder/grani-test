import { TRAITS, TYPE_TRAITS, temperamentFromBigFive, traitLevel, typeName, isBorderline, type Gender, type Stability, type Trait, type TraitScores, type TypeCode } from "@grani/core";
import { stabilityText, TRAIT_LABELS, traitBlock, typeCodeToDir, typeTexts, type Library } from "@grani/content";
import { getShortTest } from "@grani/content/short-tests";

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
  // Бонус из двух шкал Big Five; ведёт на страницу темперамента и на сам тест
  temperament: { name: string; path: string };
};

function temperamentLink(scores: TraitScores): { name: string; path: string } {
  const test = getShortTest("temperament");
  const key = temperamentFromBigFive(scores);
  const type = test?.types.find((t) => t.key === key);
  if (!test || !type) throw new Error(`No temperament page for ${key}`);
  return { name: type.name, path: `${test.path}/${type.slug}` };
}

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
    temperament: temperamentLink(result.scores),
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
