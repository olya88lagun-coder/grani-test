import type { ChapterKind } from "@grani/core";
import { chapterSeeds, type ChapterSeed } from "./chapter-seeds";
import type { TraitSection } from "./keys";
import { CHAPTER_SECTIONS, CHAPTER_TITLES } from "./labels";

// Карточки пишутся для глав и для вкладки «В жизни»; у второй своя тема, свои блоки библиотеки и нет обзора
export type CardsKind = ChapterKind | "life";

export const LIFE_TITLE = "Жизненные ситуации";
// Пять сценариев ближе всего к работе, разногласиям и стрессу: из этих разделов библиотеки берутся блоки по каждой черте
export const LIFE_SECTIONS: readonly TraitSection[] = ["work", "conflict", "stress"];

// Темы задаёт редакция, названия те же, что в статичном списке вкладки: пользователи видят знакомые ситуации.
// Первые три идут в один запрос к модели, последние две — в другой
const LIFE_SEEDS: readonly ChapterSeed[] = [
  { id: "change", title: "Планы внезапно изменились", focus: "Как человек реагирует, когда привычный план или договорённость меняются в последний момент, и что помогает быстро собрать новый порядок действий.", traits: ["openness", "conscientiousness"] },
  { id: "critique", title: "Твою идею раскритиковали", focus: "Как человек слышит критику своей идеи или работы, что хочется ответить первым и как отделить полезное замечание от общего суждения.", traits: ["stability", "openness"] },
  { id: "deadline", title: "Срок подходит, работа не закончена", focus: "Что происходит, когда срок близко, а работа не закончена: тянется ли желание улучшать, растёт ли напряжение и как выделить то, что нужно к сроку.", traits: ["conscientiousness", "stability"] },
  { id: "talk", title: "Предстоит непростой разговор", focus: "Как человек готовится к непростому разговору и ведёт его: что говорит первым, как слушает и как не уйти от главного.", traits: ["agreeableness", "extraversion"] },
  { id: "method", title: "Коллега предлагает другой способ", focus: "Как человек встречает предложение сделать то же дело другим способом: когда стоит попробовать, когда настоять на своём и как об этом сказать.", traits: ["openness", "agreeableness"] },
];

export const lifeSeeds = (): readonly ChapterSeed[] => LIFE_SEEDS;

export function cardSeeds(kind: CardsKind): readonly ChapterSeed[] {
  return kind === "life" ? LIFE_SEEDS : chapterSeeds(kind);
}

export function cardsTitle(kind: CardsKind): string {
  return kind === "life" ? LIFE_TITLE : CHAPTER_TITLES[kind];
}

export function cardsSections(kind: CardsKind): readonly TraitSection[] {
  return kind === "life" ? LIFE_SECTIONS : [CHAPTER_SECTIONS[kind]];
}
