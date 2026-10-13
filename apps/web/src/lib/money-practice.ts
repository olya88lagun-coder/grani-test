import { traitLevel, type MoneyAnswer, type MoneyHabit, type MoneyPracticeData, type Trait, type TraitLevel, type TraitScores } from "@grani/core";
import { z } from "zod";
import { seedIconPath } from "./chapter-cover";

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
    high: "Тебе интересно новое, и ты быстро замечаешь варианты. Риск — решить раньше, чем прочитал условия: перед новым предложением выдели 15 минут на проверку.",
    low: "По шкале тебе ближе проверенные способы: они защищают от лишнего риска. Одно правило: перед новым предложением сравни его хотя бы с одной альтернативой.",
    borderline: "К новому у тебя нет перекоса: где-то хочется пробовать, где-то держаться знакомого. Полезно заметить, в каких денежных ситуациях ты склоняешься в какую сторону." }, question: "Что помогает мне проверить новое предложение?" },
  { trait: "conscientiousness", name: "Добросовестность", copy: {
    high: "Тебе близок порядок, и регулярный взгляд на расходы даётся легко. Оставь в плане небольшой свободный остаток, чтобы неожиданное не ломало систему.",
    low: "Тебе удобнее гибкость, чем подробный учёт. Сложная система не нужна: хватит одного короткого обзора расходов раз в неделю.",
    borderline: "Порядок и гибкость у тебя в равновесии. Выбери тот объём учёта, который ты готов вести без напряжения, и держись его." }, question: "Какой минимум учёта мне действительно удобен?" },
  { trait: "extraversion", name: "Экстраверсия", copy: {
    high: "Обсуждение помогает тебе прояснить выбор. Следи, чтобы в разговоре решали твои желания, а не темп и ожидания компании.",
    low: "Тебе удобнее обдумывать решения самому. Для совместных планов заранее подготовь одну фразу о своём бюджете.",
    borderline: "Иногда тебе помогает обсуждение, иногда тишина. Замечай, в каком формате денежное решение выходит яснее." }, question: "Когда мне полезно обсуждение, а когда нужна пауза?" },
  { trait: "agreeableness", name: "Доброжелательность", copy: {
    high: "Ты чутко относишься к людям, и это помогает договариваться. Сложнее назвать свой предел вслух: заранее реши сумму, при которой тебе комфортно.",
    low: "Ты спокойно называешь свои условия. Объясняй, почему тебе так удобно: тогда другие слышат договорённость, а не отказ.",
    borderline: "Тебе доступны и компромисс, и твёрдое «нет». Вспомни разговор о деньгах, где удалось сохранить и отношения, и свой предел." }, question: "Как сказать о своей границе без оправданий?" },
  { trait: "stability", name: "Эмоциональная устойчивость", copy: {
    high: "Ты обычно спокойно встречаешь неожиданные траты. Не откладывай из-за этого проверку условий: спокойствие не заменяет письменный договор.",
    low: "Неожиданные траты и давление ты переживаешь сильнее. Не решай важное сразу: отложи необязательное решение на сутки, пока напряжение спадёт.",
    borderline: "Твоя реакция на напряжение меняется. Замечай, в каком состоянии проще обсуждать расходы и читать условия, и назначай такие дела на это время." }, question: "Что помогает мне принять решение в спокойном состоянии?" },
];
export function financialObservations(scores: TraitScores) {
  return OBSERVATIONS.map(o => { const level = traitLevel(scores[o.trait]); return { trait: o.trait, name: o.name, level, text: o.copy[level], question: o.question }; });
}

export type CompassState = "pending" | "observe" | "mixed" | "resource" | "practice";
export const COMPASS_LABELS: Record<CompassState, string> = { pending: "Ждёт твоих ответов", observe: "Стоит понаблюдать", mixed: "Зависит от ситуации", resource: "Знакомый способ, на который можно опереться", practice: "Можно попробовать небольшой шаг" };

export const STATE_NOTES: Record<CompassState, string> = {
  pending: "Ответь на связанные вопросы, и здесь появится вывод. Можно выбрать «Пока не знаю».",
  observe: "Пока мало наблюдений. Вспомни один недавний случай и вернись к вопросу.",
  resource: "Этот способ у тебя уже есть. Заметь, в каких ситуациях он выручает, а где его не хватает.",
  practice: "Здесь можно попробовать небольшой шаг. Это тема для эксперимента, а не оценка твоих финансов.",
  mixed: "В одних ситуациях ты действуешь уверенно, в других нет. На этой неделе отметь два случая: где получилось спокойно и где нет.",
};

export const RECALL_NOTE = "Если ответа нет или он «Пока не знаю»: сначала вспомни один недавний случай, потом пробуй шаг.";
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

type Situation = { id: "purchase" | "unexpected" | "shared" | "offer"; title: string; image: string; basis: number; supported: string; experiment: string; phrase: string };
const SITUATIONS: readonly Situation[] = [
  { id: "purchase", title: "Хочется купить прямо сейчас", image: "purchases", basis: 3, supported: "Сохрани привычную паузу. После неё определи, для какой задачи нужна вещь и устраивает ли тебя её полная стоимость.", experiment: "Отложи одну необязательную покупку до завтра. Спроси себя: чего я хочу на самом деле и есть ли другой способ?", phrase: "Я вернусь к этому решению завтра." },
  { id: "unexpected", title: "Появилась неожиданная трата", image: "reserve", basis: 1, supported: "Продолжай обзор расходов: раздели срочное и то, что подождёт, уточни сроки и полную стоимость.", experiment: "Запиши, что нужно оплатить сейчас, какие сроки известны и что можно перенести. Не решай всё одним действием.", phrase: "Сначала пойму сроки и обязательные расходы." },
  { id: "shared", title: "Нужно договориться о деньгах", image: "shared", basis: 4, supported: "Опирайся на умение называть свой лимит. Заранее обсуди с участниками сумму, сроки и право отказаться.", experiment: "Перед разговором выбери удобную тебе сумму. Назови её прямо и предложи участие в этих пределах.", phrase: "Мне удобно участвовать в пределах этой суммы." },
  { id: "offer", title: "Предлагают что-то незнакомое", image: "choices", basis: 5, supported: "Продолжай читать условия. Отдельно уточни все расходы, срок обязательств и порядок отказа.", experiment: "Не соглашайся до проверки письменных условий. Выпиши непонятные пункты и уточни их у компетентного специалиста.", phrase: "Я сначала изучу полные условия." },
];

export function recommendations(answers: readonly (MoneyAnswer | null)[]) {
  return SITUATIONS.map(s => ({ id: s.id, title: s.title, image: s.image, basis: s.basis, action: answers[s.basis] === "a" ? s.supported : s.experiment, phrase: s.phrase }));
}

export type AxisId = (typeof AXES)[number]["id"];
const AXIS_SITUATION: Record<AxisId, Situation["id"]> = { plan: "unexpected", pause: "purchase", boundaries: "shared", conditions: "offer" };

// Золотая иконка темы главы «Деньги», ближайшей по смыслу к ситуации направления
const SITUATION_ICON_SEED: Record<Situation["id"], string> = { purchase: "mood", unexpected: "surprise", shared: "shared", offer: "new" };

// Направление компаса вместе с шагом своей ситуации: ситуации больше не отдельный раздел
export function directionDetails(answers: readonly (MoneyAnswer | null)[]) {
  const steps = recommendations(answers);
  return buildCompass(answers).map(axis => {
    const step = steps.find(s => s.id === AXIS_SITUATION[axis.id])!;
    const answer = answers[step.basis] ?? null;
    return { ...axis, note: STATE_NOTES[axis.state], situation: step.title, image: step.image, icon: seedIconPath("chapter_money", SITUATION_ICON_SEED[step.id]), action: step.action, phrase: step.phrase, recall: answer === null || answer === "unsure" };
  });
}

const HABIT_FOR_AXIS: Record<AxisId, MoneyHabit> = { plan: "review", pause: "pause", boundaries: "boundary", conditions: "review" };

// Подсказка, а не выбор: привычка `emotion` не имеет своей оси и автоматически не рекомендуется
export function recommendedHabit(directions: readonly { id: AxisId; state: CompassState }[]): MoneyHabit | null {
  const axis = directions.find(d => d.state === "practice") ?? directions.find(d => d.state === "mixed");
  return axis ? HABIT_FOR_AXIS[axis.id] : null;
}

export function buildMoneyMemo(data: MoneyPracticeData): string {
  const habit = MONEY_HABITS.find(h => h.id === data.habit);
  return ["Мой финансовый компас", "Мои наблюдения по ответам:", ...buildCompass(data.answers).map(a => `${a.title}: ${a.label}.`), "", "Мой небольшой эксперимент:", habit ? `${habit.title}. ${habit.action}` : "Выбрать одну привычку, которую удобно проверить семь дней.", "", "Фразы для знакомых ситуаций:", ...recommendations(data.answers).map(s => s.phrase), "", "Что я хочу оставить после недели:", data.reflection || "Заполню после эксперимента.", "", "Это памятка для самонаблюдения. Она не прогнозирует доход и не предлагает инвестиционных решений."].join("\n");
}
