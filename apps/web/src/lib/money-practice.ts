import { traitLevel, type MoneyAnswer, type MoneyHabit, type MoneyPracticeData, type Trait, type TraitLevel, type TraitScores } from "@grani/core";
import { z } from "zod";

export const MAX_PRACTICE_REVISION = 2_147_483_646;
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const date = new Date(s + "T12:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === s;
});
export const moneyDataSchema = z.strictObject({
  answers: z.array(z.enum(["a", "b", "c", "unsure"]).nullable()).length(6),
  habit: z.enum(["pause", "review", "emotion", "boundary"]).nullable(),
  startedOn: dateOnly.nullable(), done: z.array(z.boolean()).length(7),
  notes: z.array(z.string().max(2000)).length(7), reflection: z.string().max(2000), memo: z.string().max(8000),
}).refine(d => d.startedOn === null ? !d.done.some(Boolean) && d.notes.every(n => !n) && !d.reflection : d.habit !== null, { message: "Experiment must be started before adding progress" });

export function initialMoneyData(): MoneyPracticeData {
  return { answers: Array(6).fill(null), habit: null, startedOn: null, done: Array(7).fill(false), notes: Array(7).fill(""), reflection: "", memo: "" };
}

export const MONEY_QUESTIONS = [
  { title: "Как ты обычно решаешь, на что потратить деньги?", context: "Вспомни последние несколько недель.", options: ["Сверяюсь с планом и обязательными расходами", "Держу общую картину в голове", "Решаю по ходу, а общую сумму вижу позже"] },
  { title: "Что происходит с непредвиденной тратой?", context: "Речь о привычном способе действовать, а не о размере дохода.", options: ["Сначала пересматриваю другие расходы", "Прикидываю, чем смогу её покрыть", "Откладываю разбор последствий"] },
  { title: "Как часто покупка становится способом сменить настроение?", context: "Плохих ответов здесь нет.", options: ["Обычно замечаю это желание и делаю паузу", "Иногда замечаю уже после покупки", "Часто покупаю, чтобы стало легче"] },
  { title: "Как ты принимаешь решение о необязательной покупке?", context: "Например, о вещи, без которой можно обойтись сегодня.", options: ["Возвращаюсь к решению после паузы", "Сравниваю варианты, но иногда тороплюсь", "Часто решаю сразу, пока хочется"] },
  { title: "Что происходит, когда другие предлагают потратить больше, чем тебе удобно?", context: "Общий подарок, встреча или поездка.", options: ["Называю удобную мне сумму или отказываюсь", "Ищу компромисс, но сказать о лимите непросто", "Часто соглашаюсь, а потом жалею"] },
  { title: "Что ты делаешь с незнакомым финансовым предложением?", context: "Не оцениваем готовность к инвестициям: речь о проверке информации.", options: ["Разбираюсь в условиях, расходах и праве отказаться", "Проверяю часть условий и советуюсь", "Могу согласиться, пока предложение кажется привлекательным"] },
] as const;

const OBSERVATIONS: readonly { trait: Trait; name: string; copy: Record<TraitLevel, string>; question: string }[] = [
  { trait: "openness", name: "Открытость опыту", copy: {
    high: "Интерес к новому может помогать замечать варианты. Проверь, оставляешь ли ты время на изучение условий незнакомого предложения.",
    low: "Знакомые способы могут давать ощущение опоры. Проверь, удобно ли иногда сравнивать их с альтернативами без обязательства что-то менять.",
    borderline: "Отношение к новому может зависеть от ситуации. Отметь, когда хочется пробовать, а когда лучше опереться на знакомое." }, question: "Что помогает мне проверить новое предложение?" },
  { trait: "conscientiousness", name: "Добросовестность", copy: {
    high: "Склонность к порядку может помочь регулярно возвращаться к расходам. Проверь, остаётся ли в плане место для изменений.",
    low: "Гибкий подход может быть удобнее подробного учёта. Попробуй один короткий обзор вместо сложной системы правил.",
    borderline: "План и гибкость могут сочетаться по-разному. Посмотри, какой объём учёта ты готов поддерживать без лишнего напряжения." }, question: "Какой минимум учёта мне действительно удобен?" },
  { trait: "extraversion", name: "Экстраверсия", copy: {
    high: "Обсуждение может помогать прояснить выбор. Проверь, отделяешь ли ты свои желания от темпа и ожиданий компании.",
    low: "Самостоятельное обдумывание может быть удобным. Попробуй заранее готовить фразу о своём бюджете для совместных планов.",
    borderline: "Иногда полезно обсудить, иногда — подумать одному. Заметь, какой формат делает денежное решение яснее." }, question: "Когда мне полезно обсуждение, а когда нужна пауза?" },
  { trait: "agreeableness", name: "Доброжелательность", copy: {
    high: "Внимание к другим может помогать договариваться. Проверь, получается ли сохранять собственные границы в общих расходах.",
    low: "Независимая оценка может помочь назвать свои условия. Проверь, достаточно ли ясно и спокойно ты объясняешь их другим.",
    borderline: "Компромисс и собственные условия могут быть одинаково важны. Вспомни разговор, в котором удалось сохранить оба." }, question: "Как сказать о своей границе без оправданий?" },
  { trait: "stability", name: "Эмоциональная устойчивость", copy: {
    high: "Спокойствие может дать пространство для обдумывания. Проверь, не откладываешь ли проверку условий из-за ощущения, что всё под контролем.",
    low: "Чувствительность к напряжению может усиливать желание быстрее закрыть вопрос. Попробуй отложить необязательное решение до спокойного момента.",
    borderline: "Реакция на напряжение может меняться. Заметь, в каком состоянии проще обсуждать расходы и проверять условия." }, question: "Что помогает мне принять решение в спокойном состоянии?" },
];
export function financialObservations(scores: TraitScores) {
  return OBSERVATIONS.map(o => { const level = traitLevel(scores[o.trait]); return { trait: o.trait, name: o.name, level, text: o.copy[level], question: o.question }; });
}

export type CompassState = "pending" | "observe" | "mixed" | "resource" | "practice";
export const COMPASS_LABELS: Record<CompassState, string> = { pending: "Ждёт твоих ответов", observe: "Стоит понаблюдать", mixed: "Зависит от ситуации", resource: "Есть привычка, на которую можно опереться", practice: "Можно попробовать небольшой шаг" };
const AXES = [{ id: "plan", title: "Ясность расходов", indices: [0, 1] }, { id: "pause", title: "Пауза перед покупкой", indices: [2, 3] }, { id: "boundaries", title: "Свои границы", indices: [4] }, { id: "conditions", title: "Проверка условий", indices: [5] }] as const;
export function buildCompass(answers: readonly (MoneyAnswer | null)[]) {
  return AXES.map(axis => {
    const values = axis.indices.map(i => answers[i] ?? null);
    const state: CompassState = values.includes(null) ? "pending" : values.includes("unsure") ? "observe" : values.every(v => v === "a") ? "resource" : values.every(v => v === "c") ? "practice" : "mixed";
    const basis = axis.indices.map(i => `${MONEY_QUESTIONS[i]!.title} — ${answerText(i, answers[i] ?? null)}`);
    return { ...axis, state, label: COMPASS_LABELS[state], basis };
  });
}
export function answerText(index: number, answer: MoneyAnswer | null): string {
  return answer === null ? "Пока без ответа" : answer === "unsure" ? "Пока не знаю" : MONEY_QUESTIONS[index]!.options[{ a: 0, b: 1, c: 2 }[answer]]!;
}

export const MONEY_HABITS: readonly { id: MoneyHabit; title: string; action: string }[] = [
  { id: "pause", title: "Пауза перед покупкой", action: "Перед одной необязательной покупкой отложи решение до завтра. Запиши, осталось ли желание. На необходимые расходы пауза не распространяется." },
  { id: "review", title: "Пять минут ясности", action: "Раз в день спокойно просмотри сегодняшние траты. Запиши одну заметку о том, что оказалось полезным или неожиданным. Менять расходы необязательно." },
  { id: "emotion", title: "Сначала замечать настроение", action: "Когда хочется купить что-то ради облегчения, назови своё чувство. Попробуй короткую бесплатную паузу и реши, нужна ли ещё покупка." },
  { id: "boundary", title: "Одна спокойная граница", action: "Перед совместной тратой сформулируй удобный тебе лимит. Если такой ситуации сегодня нет, потренируй фразу для будущего разговора." },
];

export function recommendations(answers: readonly (MoneyAnswer | null)[]) {
  const choice = (index: number, supported: string, experiment: string) => answers[index] === "a" ? supported : answers[index] === null || answers[index] === "unsure" ? "Сначала вспомни один недавний случай. Затем проверь, будет ли полезен такой шаг: " + experiment : experiment;
  return [
    { id: "purchase", title: "Хочется купить прямо сейчас", image: "purchases", basis: 3, action: choice(3, "Сохрани привычную паузу. После неё проверь, для какой задачи нужна вещь и устраивает ли тебя её полная стоимость.", "Отложи одну необязательную покупку до завтра. Спроси себя: что именно я хочу получить и есть ли другой способ?"), phrase: "Я вернусь к этому решению завтра." },
    { id: "unexpected", title: "Появилась неожиданная трата", image: "reserve", basis: 1, action: choice(1, "Используй привычный обзор расходов. Раздели срочное и то, что может подождать; уточни сроки и полную стоимость.", "Запиши, что нужно оплатить сейчас, какие сроки известны и что можно перенести. Не решай всё одним действием."), phrase: "Сначала пойму сроки и обязательные расходы." },
    { id: "shared", title: "Нужно договориться о деньгах", image: "shared", basis: 4, action: choice(4, "Опирайся на умение назвать свой лимит. Заранее обсуди с участниками сумму, сроки и возможность отказаться.", "Перед разговором выбери удобную тебе сумму. Назови её прямо и предложи вариант участия в этих пределах."), phrase: "Мне удобно участвовать в пределах этой суммы." },
    { id: "offer", title: "Предлагают что-то незнакомое", image: "choices", basis: 5, action: choice(5, "Сохрани привычку читать условия. Отдельно уточни все расходы, срок обязательств и порядок отказа.", "Не соглашайся до проверки письменных условий. Выпиши непонятные пункты и уточни их у компетентного специалиста."), phrase: "Я сначала изучу полные условия." },
  ];
}

export function buildMoneyMemo(data: MoneyPracticeData): string {
  const habit = MONEY_HABITS.find(h => h.id === data.habit);
  return ["Мой финансовый компас", "Мои наблюдения по ответам:", ...buildCompass(data.answers).map(a => `${a.title}: ${a.label}.`), "", "Мой небольшой эксперимент:", habit ? `${habit.title}. ${habit.action}` : "Выбрать одну привычку, которую удобно проверить семь дней.", "", "Фразы для знакомых ситуаций:", ...recommendations(data.answers).map(s => s.phrase), "", "Что я хочу оставить после недели:", data.reflection || "Заполню после эксперимента.", "", "Это памятка для самонаблюдения. Она не прогнозирует доход и не предлагает инвестиционных решений."].join("\n");
}
