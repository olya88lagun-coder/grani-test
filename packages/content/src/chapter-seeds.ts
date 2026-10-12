import type { ChapterKind, Trait } from "@grani/core";

export type ChapterSeed = { readonly id: string; readonly title: string; readonly focus: string; readonly traits: readonly Trait[] };

// Темы задаёт редакция: так карточки не повторяются и структура одинакова у всех покупателей.
// В пилоте формат карточек только у «Денег»; у остальных глав список пуст
const SEEDS: Readonly<Partial<Record<ChapterKind, readonly ChapterSeed[]>>> = {
  chapter_money: [
    { id: "help", title: "Помощь другим и отказ", focus: "Как человек решает, давать ли деньги в долг, дарить и скидываться, и как ему даётся отказ.", traits: ["agreeableness", "stability"] },
    { id: "surprise", title: "Неожиданные траты", focus: "Что происходит с настроением и решениями, когда появляется непредвиденный расход.", traits: ["stability", "conscientiousness"] },
    { id: "mood", title: "Покупки для настроения", focus: "Покупка как способ сменить состояние: когда это помогает, а когда остаётся только сумма в чеке.", traits: ["stability", "extraversion"] },
    { id: "new", title: "Новые возможности и предложения", focus: "Отношение к незнакомым способам заработать, вложить, попробовать: где осторожность защищает, а где мешает.", traits: ["openness", "conscientiousness"] },
    { id: "periods", title: "Учёт и спонтанные периоды", focus: "Как чередуются аккуратный учёт и спонтанные траты и какая простая система выдержит оба периода.", traits: ["conscientiousness", "extraversion"] },
    { id: "shared", title: "Общие деньги и разговор о них", focus: "Как говорить о деньгах с близкими: договорённости, общие траты, неудобные темы.", traits: ["agreeableness", "extraversion"] },
  ],
};

export function chapterSeeds(kind: ChapterKind): readonly ChapterSeed[] {
  return SEEDS[kind] ?? [];
}

export function hasCardsFormat(kind: ChapterKind): boolean {
  return chapterSeeds(kind).length > 0;
}
