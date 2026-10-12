import type { ChapterKind, Trait, TraitScores } from "@grani/core";

export type ChapterAxis = { trait: Trait; low: string; high: string; value: number };

const AXES: Partial<Record<ChapterKind, readonly { trait: Trait; low: string; high: string }[]>> = {
  chapter_money: [
    { trait: "openness", low: "Держусь проверенного", high: "Охотно пробую новое" },
    { trait: "agreeableness", low: "Легко отказываю", high: "Трудно отказать" },
    { trait: "stability", low: "Острая реакция на неожиданное", high: "Спокойно встречаю неожиданное" },
  ],
};

const clamp = (value: number) => Math.round(Math.min(100, Math.max(0, value)));

export function chapterAxes(kind: ChapterKind, scores: TraitScores): readonly ChapterAxis[] {
  return (AXES[kind] ?? []).map((axis) => ({ ...axis, value: clamp(scores[axis.trait]) }));
}
