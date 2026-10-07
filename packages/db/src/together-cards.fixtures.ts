import type { CardKind, CardSnapshot } from "@grani/core";

// Короткий маршрут для тестов БД: реальный каталог лежит в @grani/content, db от него не зависит
export function fixtureCard(id: string, kind: CardKind = "intro", skipAllowed = true, unlockStage = 0): CardSnapshot {
  return {
    id,
    version: 1,
    kind,
    title: `Карточка ${id}`,
    estimatedMinutes: 5,
    prompt: "Вопрос?",
    hint: "Подсказка",
    jointAction: "Сделайте вместе",
    skipAllowed,
    ...(unlockStage > 0 ? { unlockStage } : {}),
    fields: [
      { id: "answer", type: "short_text", label: "Ответ", required: true, maxLength: 50 },
      { id: "share_in_book", type: "boolean", label: "В книгу", required: false, availableAt: "after_reveal" },
    ],
  };
}

export const FIXTURE_TRACK: readonly CardSnapshot[] = [fixtureCard("intro-01"), fixtureCard("intro-02"), fixtureCard("main-01", "main")];

// Маршрут для проверки открытия месяцев: вводная, карточка месяца 1 и карточка месяца 2 (открывается со второго этапа)
export const UNLOCK_TRACK: readonly CardSnapshot[] = [fixtureCard("intro-01"), fixtureCard("main-01", "main"), fixtureCard("month2-01", "main", true, 1)];
