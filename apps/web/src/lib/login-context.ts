// Откуда человек пришёл на страницу входа. Вступление показывается только для подтверждённого контекста;
// порядок приоритета тот же, что у возврата после входа (completeLogin): приглашение пары, «Вдвоём», результат теста
export type LoginContext = "pair" | "together" | "result" | "default";
export type LoginContextFacts = { pairInvite: boolean; together: boolean; pendingResult: boolean };

export function pickLoginContext(facts: LoginContextFacts): LoginContext {
  if (facts.pairInvite) return "pair";
  if (facts.together) return "together";
  if (facts.pendingResult) return "result";
  return "default";
}

// Тексты утверждены владелицей; «результат готов» и «ответы сохранены» не обещаются
export const LOGIN_INTRO: Readonly<Record<LoginContext, { title: string; lead: string }>> = {
  default: { title: "Войди в «Грани»", lead: "Здесь можно вернуться к своему результату и продолжить знакомство с собой" },
  result: { title: "Осталось увидеть результат", lead: "Войди, чтобы увидеть свой тип личности и пять ключевых черт" },
  pair: { title: "Продолжим сравнение", lead: "Войди, чтобы продолжить сравнение ваших результатов" },
  together: { title: "Продолжим во «Вдвоём»", lead: "Войди, чтобы продолжить в пространстве «Грани. Вдвоём»" },
};
