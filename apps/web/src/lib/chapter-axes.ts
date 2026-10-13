import type { ChapterKind, Trait, TraitScores } from "@grani/core";

export type ChapterAxis = { trait: Trait; low: string; high: string; value: number };

const AXES: Partial<Record<ChapterKind, readonly { trait: Trait; low: string; high: string }[]>> = {
  chapter_money: [
    { trait: "openness", low: "Держусь проверенного", high: "Охотно пробую новое" },
    { trait: "agreeableness", low: "Легко отказываю", high: "Трудно отказать" },
    { trait: "stability", low: "Острая реакция на неожиданное", high: "Спокойно встречаю неожиданное" },
  ],
  chapter_conflict: [
    { trait: "agreeableness", low: "Отстаиваю своё", high: "Уступаю ради мира" },
    { trait: "stability", low: "Остро реагирую на напряжение", high: "Остаюсь спокойным" },
    { trait: "extraversion", low: "Обдумываю молча", high: "Говорю сразу" },
  ],
  chapter_stress: [
    { trait: "stability", low: "Сильно напрягаюсь", high: "Спокойно переношу нагрузку" },
    { trait: "extraversion", low: "Восстанавливаюсь один", high: "Восстанавливаюсь с людьми" },
    { trait: "conscientiousness", low: "Действую по ситуации", high: "Держу план и режим" },
  ],
  chapter_relationships: [
    { trait: "extraversion", low: "Нужно личное пространство", high: "Тянусь к общению" },
    { trait: "agreeableness", low: "Отстаиваю границы", high: "Подстраиваюсь" },
    { trait: "stability", low: "Тревожусь в близости", high: "Спокойно в близости" },
  ],
};

const clamp = (value: number) => Math.round(Math.min(100, Math.max(0, value)));

export function chapterAxes(kind: ChapterKind, scores: TraitScores): readonly ChapterAxis[] {
  return (AXES[kind] ?? []).map((axis) => ({ ...axis, value: clamp(scores[axis.trait]) }));
}
