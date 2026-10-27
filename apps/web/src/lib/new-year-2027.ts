import { TRAITS, traitLevel, type TraitScores } from "@grani/core";

export const YEAR_VERSION = 1;
export const QUESTION_IDS = ["recap", "gratitude", "release", "direction", "goal", "obstacle"] as const;
export type QuestionId = typeof QUESTION_IDS[number];
export type YearAnswers = Partial<Record<QuestionId, string>>;
export const ANSWER_LIMIT = 300;
export const cleanAnswer = (value: unknown): string => typeof value === "string" ? value.trim().slice(0, ANSWER_LIMIT) : "";

export const QUESTIONS: readonly { id: QuestionId; title: string; hint: string; options: readonly string[] }[] = [
  { id: "recap", title: "Каким был твой 2026?", hint: "Не нужно подводить идеальные итоги. Выбери то, что ближе сейчас.", options: ["Год перемен", "Год маленьких побед", "Непростой год", "Год поиска себя"] },
  { id: "gratitude", title: "За что скажешь себе спасибо?", hint: "Даже если это что-то совсем небольшое.", options: ["За то, что продолжал идти", "За заботу о себе", "За смелое решение", "За честность с собой"] },
  { id: "release", title: "Что хочется оставить в 2026?", hint: "Не обещание навсегда. То, чему хочется давать меньше места.", options: ["Спешку", "Сравнение с другими", "Лишние обязательства", "Ожидание идеального момента"] },
  { id: "direction", title: "Чего хочется больше в 2027?", hint: "Одно направление. Его можно будет изменить.", options: ["Больше спокойствия", "Больше нового", "Больше близости", "Больше своего ритма"] },
  { id: "goal", title: "Какую одну цель возьмёшь с собой?", hint: "Что-то твоё, а не из списка чужих ожиданий.", options: ["Вернуться к любимому делу", "Освоить новый навык", "Наладить режим отдыха", "Чаще встречаться с близкими"] },
  { id: "obstacle", title: "Что может помешать начать?", hint: "Подумаем об этом заранее — без упрёков к себе.", options: ["Мало времени", "Усталость", "Страх ошибиться", "Слишком много планов"] },
];

export function validProfile(value: unknown): value is TraitScores {
  if (typeof value !== "object" || value === null) return false;
  return TRAITS.every((key) => {
    const score = (value as Record<string, unknown>)[key];
    return typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100;
  });
}

const DIRECTIONS: Record<string, { title: string; step: string }> = {
  "Больше спокойствия": { title: "Место для спокойствия", step: "Выдели 10 минут без уведомлений и выбери одно небольшое действие для своей цели." },
  "Больше нового": { title: "Место для нового", step: "За 10 минут найди один пробный урок или пример по своей цели и выбери дату первого опыта." },
  "Больше близости": { title: "Место для близости", step: "За 10 минут выбери одного человека и предложи конкретное время для разговора или встречи." },
  "Больше своего ритма": { title: "В своём ритме", step: "Открой календарь и выдели 10 минут на самое маленькое действие для своей цели." },
};
const RESPONSES: Record<string, string> = {
  "Мало времени": "выделю две минуты на самую маленькую часть шага и назначу время продолжения",
  "Усталость": "сначала дам себе паузу, а затем выберу посильную часть шага",
  "Страх ошибиться": "сделаю черновую попытку без требования идеального результата",
  "Слишком много планов": "оставлю на сегодня одно действие, а остальные запишу на потом",
};

export type YearMap = {
  title: string; direction: string; goal: string; firstStep: string; ifThen: string;
  supports: string[]; profileUsed: boolean; reflections: { id: QuestionId; label: string; text: string }[];
};

export function buildYearMap(input: YearAnswers, profile?: unknown): YearMap {
  const answers = Object.fromEntries(QUESTION_IDS.map((key) => [key, cleanAnswer(input[key])])) as Record<QuestionId, string>;
  const direction = Object.hasOwn(DIRECTIONS, answers.direction) ? DIRECTIONS[answers.direction] : undefined;
  const supports: string[] = [];
  const profileUsed = validProfile(profile);
  if (profileUsed) {
    const level = (key: keyof TraitScores) => traitLevel(profile[key]);
    if (level("openness") === "high") supports.push("Открытость к новому: попробуй небольшой эксперимент, прежде чем выбирать большой путь.");
    if (level("openness") === "low") supports.push("Знакомый способ: начни с того, что уже помогало тебе раньше.");
    if (level("conscientiousness") === "high") supports.push("Структура: назначь для первого шага конкретные день и время.");
    if (level("conscientiousness") === "low") supports.push("Гибкость: короткий список из одного действия может быть удобнее большого расписания.");
    if (level("extraversion") === "high") supports.push("Контакт: если подходит, пригласи знакомого поддержать твою первую попытку.");
    if (level("extraversion") === "low") supports.push("Тихое пространство: попробуй начать в одиночку, без необходимости делиться прогрессом.");
    if (level("agreeableness") === "high") supports.push("Забота с границами: оставь в плане место своим потребностям, прежде чем помогать всем остальным.");
    if (level("agreeableness") === "low") supports.push("Самостоятельный выбор: определи свой критерий успеха и спокойно объясни его тем, кого затронет план.");
    if (level("stability") === "low") supports.push("Бережный темп: выбери посильную нагрузку и заранее разреши себе паузу.");
    if (level("stability") === "high") supports.push("Ровный темп: назначь короткую проверку плана через неделю, чтобы заметить, нужна ли корректировка.");
  }
  if (supports.length === 0) supports.push("Одна цель вместо списка требований. Небольшой шаг, который можно пересмотреть через неделю.");
  const goal = answers.goal || "Выбрать одну посильную цель на ближайшую неделю";
  // A specific goal takes priority over a broad direction: do not substitute a social action for an unrelated custom goal.
  const firstStep = answers.goal
    ? `Выдели 10 минут: запиши одно действие для цели «${goal}», которое можно выполнить за эти 10 минут. Назначь день и время.`
    : direction?.step || "Выдели 10 минут: выбери одно важное для себя дело и запиши самый маленький шаг к нему.";
  const obstacle = answers.obstacle;
  return {
    title: direction?.title || "Место для своего", direction: answers.direction || "Свой посильный ритм", goal, firstStep,
    ifThen: obstacle ? `Если возникнет «${obstacle}», то я ${Object.hasOwn(RESPONSES, obstacle) ? RESPONSES[obstacle] : "уменьшу первый шаг до двух минут и выберу, когда вернуться к нему"}.`
      : "Если план окажется слишком большим, то я уменьшу первый шаг до двух минут и попробую снова.",
    profileUsed, supports,
    reflections: QUESTIONS.filter((q) => answers[q.id]).map((q) => ({ id: q.id, label: q.title, text: answers[q.id] })),
  };
}

export type ShareContent = { title: string; subtitle: string; goal: string | null; step: string | null };
export function shareContent(map: YearMap, includePersonal: boolean, firstStep = map.firstStep): ShareContent {
  return {
    title: map.title, subtitle: "В новом году — ближе к себе.",
    goal: includePersonal ? map.goal : null,
    step: includePersonal ? cleanAnswer(firstStep) : null,
  };
}

export type YearEdits = { firstStep: string | null; ifThen: string | null };
export function parseYearDraft(raw: string | null): { answers: YearAnswers; step: number; result: boolean; edits: YearEdits; useProfile: boolean } | null {
  try {
    const data: unknown = JSON.parse(raw || "null");
    if (!data || typeof data !== "object") return null;
    const d = data as Record<string, unknown>;
    if (d.version !== YEAR_VERSION || !d.answers || typeof d.answers !== "object") return null;
    const edits = d.edits && typeof d.edits === "object" ? d.edits as Record<string, unknown> : {};
    return { answers: Object.fromEntries(QUESTION_IDS.map((key) => [key, cleanAnswer((d.answers as Record<string, unknown>)[key])])),
      step: typeof d.step === "number" && Number.isInteger(d.step) ? Math.max(0, Math.min(5, d.step)) : 0, result: d.result === true,
      edits: { firstStep: typeof edits.firstStep === "string" ? edits.firstStep.slice(0, ANSWER_LIMIT) : null, ifThen: typeof edits.ifThen === "string" ? edits.ifThen.slice(0, ANSWER_LIMIT) : null }, useProfile: d.useProfile !== false };
  } catch { return null; }
}
