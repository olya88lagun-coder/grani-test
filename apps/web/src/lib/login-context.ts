// Откуда человек пришёл на страницу входа. Вступление показывается только для подтверждённого контекста;
// порядок приоритета тот же, что у возврата после входа (completeLogin): приглашение пары, «Вдвоём», результат теста
export type LoginContext = "pair" | "together" | "short" | "short_pair" | "short_invite" | "result" | "default";
// shortKind: партнёр пришёл по приглашению (invite) или человек зовёт партнёра (pair)
export type LoginContextFacts = { pairInvite: boolean; together: boolean; pendingResult: boolean; shortResult?: boolean; shortKind?: "invite" | "pair" };

export function pickLoginContext(facts: LoginContextFacts): LoginContext {
  if (facts.pairInvite) return "pair";
  if (facts.together) return "together";
  if (facts.shortResult) return facts.shortKind === "invite" ? "short_pair" : facts.shortKind === "pair" ? "short_invite" : "short";
  if (facts.pendingResult) return "result";
  return "default";
}

// Тексты утверждены владелицей; «результат готов» и «ответы сохранены» не обещаются
export const LOGIN_INTRO: Readonly<Record<LoginContext, { title: string; lead: string }>> = {
  default: { title: "Войди в «Грани»", lead: "Здесь можно вернуться к своему результату и продолжить знакомство с собой" },
  result: { title: "Осталось увидеть результат", lead: "Войди, чтобы увидеть свой тип личности и пять ключевых черт" },
  pair: { title: "Продолжим сравнение", lead: "Войди, чтобы продолжить сравнение ваших результатов" },
  together: { title: "Продолжим во «Вдвоём»", lead: "Войди, чтобы продолжить в пространстве «Грани. Вдвоём»" },
  short: { title: "Откроем личный разбор", lead: "Войдите, чтобы открыть разбор: результат теста сохранится в ваш кабинет" },
  short_pair: { title: "Откроем карту пары", lead: "Войдите, чтобы увидеть общую карту: ваш результат сохранится в кабинет" },
  short_invite: { title: "Позовём партнёра", lead: "Войдите, чтобы получить ссылку для партнёра: ваш результат сохранится в кабинет" },
};
