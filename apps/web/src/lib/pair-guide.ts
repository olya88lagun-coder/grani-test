import { PAIR_MAP_QUESTIONS, type Trait } from "@grani/core";
import type { PairRow, PairView } from "./pair-view";

export type Perspective = "you" | "partner";
type Poles = readonly [string, string, string];
type SituationTemplate = {
  id: string; title: string; subtitle: string; trait: Trait; needs: Poles;
  action: string; phrase: string; question: string; caution?: string;
};

// These are conversation prompts derived from self-reported traits, not predictions.
// Mid-range scores deliberately get a third, less polarized interpretation.
const SITUATIONS: readonly SituationTemplate[] = [
  { id: "conflict", title: "Когда вы спорите", subtitle: "Пауза или разговор сразу", trait: "stability",
    needs: ["бережный темп и пауза, чтобы собраться с мыслями", "возможность выбрать между паузой и разговором", "спокойный разбор конкретной проблемы"],
    action: "Спросите, есть ли сейчас силы говорить. Если нужна пауза, назовите время возвращения к разговору.",
    phrase: "Я хочу разобраться вместе. Поговорим сейчас или вернёмся к этому через полчаса?",
    question: "Как каждый из нас понимает, что пора сделать паузу?" },
  { id: "home", title: "Быт и порядок", subtitle: "Что значит «достаточно чисто»", trait: "conscientiousness",
    needs: ["гибкие правила без подробного расписания", "понятный минимум порядка с местом для гибкости", "ясные обязанности и предсказуемый порядок"],
    action: "Выберите две задачи, которые важны обоим. Для каждой запишите ответственного и критерий «готово».",
    phrase: "Что нам обоим важно делать регулярно, а где можно оставить свободу?",
    question: "Как выглядит приемлемый для каждого из нас порядок дома?" },
  { id: "money", title: "Деньги и покупки", subtitle: "План или решение по ситуации", trait: "conscientiousness",
    needs: ["простые ориентиры и свобода в небольших покупках", "сочетание общего плана и личной свободы", "заранее понятные рамки и план расходов"],
    action: "Обсудите сумму, выше которой покупку стоит согласовать, и отдельный бюджет для личных решений.",
    phrase: "Давай выберем, какие траты обсуждаем вместе, а какие каждый решает самостоятельно.",
    question: "Какую покупку мы хотели бы обсуждать заранее?",
    caution: "Big Five не показывает доход, долги или финансовые привычки. Здесь гипотеза о планировании, а не оценка обращения с деньгами." },
  { id: "social", title: "Общение и отдых", subtitle: "В компании или вдвоём", trait: "extraversion",
    needs: ["время в тишине и небольшая компания", "баланс общения и уединения", "совместное общение и внешние впечатления"],
    action: "Перед выходными обсудите запас сил. Оставьте место и для общего времени, и для раздельного отдыха.",
    phrase: "Сколько общения тебе хочется в эти выходные? Мне важно найти вариант для нас обоих.",
    question: "После какого отдыха у каждого из нас больше сил?" },
  { id: "closeness", title: "Близость и пространство", subtitle: "Как быть рядом без давления", trait: "extraversion",
    needs: ["личное пространство и спокойное время рядом", "возможность чередовать совместное и личное время", "больше активного совместного времени"],
    action: "Спросите, какие формы близости приятны каждому. Обсудите, как просить о личном времени без обиды.",
    phrase: "Мне хочется быть ближе. Какое время вместе сейчас было бы приятно тебе?",
    question: "Как мы можем показывать тепло и уважать личное пространство?",
    caution: "Тест не определяет сексуальные предпочтения, привязанность или верность. О близости лучше спрашивать друг друга напрямую." },
  { id: "support", title: "Поддержка в трудный день", subtitle: "Выслушать, помочь или побыть рядом", trait: "stability",
    needs: ["бережный темп, внимание к переживаниям и время на восстановление", "возможность выбрать эмоциональную или практическую поддержку", "спокойный разбор и конкретная помощь"],
    action: "Не угадывайте вид поддержки. Предложите выбор: послушать, помочь делом или оставить время наедине.",
    phrase: "Тебе сейчас нужно, чтобы я выслушал(а), помог(ла) с решением или просто побыл(а) рядом?",
    question: "Что помогает нам чувствовать поддержку, а что воспринимается как давление?" },
  { id: "plans", title: "Планы и новое", subtitle: "Привычный маршрут или эксперимент", trait: "openness",
    needs: ["знакомый формат и понятные ожидания", "баланс знакомого и небольших экспериментов", "новые впечатления и возможность пробовать"],
    action: "Предложите один небольшой эксперимент. Заранее договоритесь, что любой может отказаться без объяснений.",
    phrase: "Хочешь попробовать что-то новое или сейчас приятнее знакомый вариант?",
    question: "Какие перемены нам интересны, а какие лучше обсуждать заранее?" },
  { id: "decisions", title: "Решения вдвоём", subtitle: "Говорить прямо и слышать ответ", trait: "agreeableness",
    needs: ["прямое обсуждение позиции и право не согласиться", "баланс прямоты и бережного диалога", "доброжелательный тон и поиск общего решения"],
    action: "Сначала каждый называет свою потребность. Потом ищите вариант, учитывающий обе, без поиска победителя.",
    phrase: "Я вижу это иначе. Давай сначала поймём, что важно каждому из нас.",
    question: "Как сказать «нет» так, чтобы у нас оставалось место для обсуждения?" },
];

function pole(value: number): 0 | 1 | 2 {
  return value < 40 ? 0 : value > 60 ? 2 : 1;
}

export function buildPairGuide(view: PairView, perspective: Perspective) {
  const subject = perspective === "you" ? view.you : view.partner;
  const other = perspective === "you" ? view.partner : view.you;
  const ordered = [...view.rows].sort((a, b) => Math.abs(a.you - a.partner) - Math.abs(b.you - b.partner));
  const common = ordered[0]!;
  const difference = ordered[ordered.length - 1]!;
  const situations = SITUATIONS.map(template => {
    const row = view.rows.find(row => row.trait === template.trait)!;
    const score = perspective === "you" ? row.you : row.partner;
    const otherScore = perspective === "you" ? row.partner : row.you;
    const need = template.needs[pole(score)];
    return { ...template, question: PAIR_MAP_QUESTIONS.find(q => q.id === template.id)!.question, score, otherScore, label: row.label, need,
      partnerNeed: template.needs[pole(otherScore)],
      hypothesis: `Возможно, ${subject.firstName}: вам ближе ${need}. Это предположение по шкале «${row.label}», которое стоит проверить в разговоре.` };
  });
  return { subject, other, common, difference, situations };
}

export const PAIR_GUIDE_CONTENTS = [
  { id: "overview", title: "Обзор пары" },
  { id: "profiles", title: "Профили Big Five" },
  { id: "situations", title: "8 жизненных ситуаций" },
  { id: "translator", title: "Переводчик друг друга" },
  { id: "conversation", title: "Сложный разговор" },
  { id: "agreements", title: "3 договорённости" },
  { id: "summary", title: "Итог" },
] as const;

export function pairGap(row: PairRow): number { return Math.abs(row.you - row.partner); }
