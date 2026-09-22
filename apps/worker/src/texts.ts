import { MIN_FRIENDS, type ReportKind } from "@grani/core";

export function friendAnsweredText(friendsCount: number, url: string): string {
  if (friendsCount < MIN_FRIENDS) {
    return `Ещё один друг ответил на вопросы о тебе — ${friendsCount} из ${MIN_FRIENDS}. Когда ответят трое, откроется сравнение «Как тебя видят другие»: ${url}`;
  }
  if (friendsCount === MIN_FRIENDS) return `Ответили трое друзей — сравнение «Как тебя видят другие» готово: ${url}`;
  return `Ответил ещё один друг, сравнение обновилось. Всего ответов: ${friendsCount}. ${url}`;
}

export function pairCreatedText(partnerFirstName: string, score: number, url: string): string {
  return `Пара готова: вы и ${partnerFirstName}, совместимость ${score}%. Посмотреть типы и шкалы рядом: ${url}`;
}

const READY_TITLES: Readonly<Record<ReportKind, string>> = {
  full: "полный разбор",
  friends: "раздел «Как тебя видят другие»",
  chapter_money: "глава «Деньги»",
  chapter_conflict: "глава «Конфликты»",
  chapter_stress: "глава «Стресс»",
  chapter_relationships: "глава «Отношения»",
  pair: "разбор вашей пары",
};

export function reportReadyText(kind: ReportKind, url: string): string {
  return `Готово: ${READY_TITLES[kind]}. Открыть: ${url}`;
}
