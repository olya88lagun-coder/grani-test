import type { ChapterKind, Trait } from "@grani/core";
import type { TraitSection } from "./keys";

export const TRAIT_LABELS: Readonly<Record<Trait, string>> = {
  openness: "Открытость опыту",
  conscientiousness: "Добросовестность",
  extraversion: "Экстраверсия",
  agreeableness: "Доброжелательность",
  stability: "Эмоциональная устойчивость",
};

export const CHAPTER_TITLES: Readonly<Record<ChapterKind, string>> = {
  chapter_money: "Деньги",
  chapter_conflict: "Конфликты",
  chapter_stress: "Стресс",
  chapter_relationships: "Отношения",
};

// Глава собирается из блоков библиотеки того же раздела по всем пяти чертам
export const CHAPTER_SECTIONS: Readonly<Record<ChapterKind, TraitSection>> = {
  chapter_money: "money",
  chapter_conflict: "conflict",
  chapter_stress: "stress",
  chapter_relationships: "relationships",
};
