# Money Compass Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Превратить страницу «Финансовый компас» в один линейный путь (Вопросы → Компас → Неделя → Памятка) с живой диаграммой, шагами внутри направлений и переписанными текстами; данные пользователей не меняются.

**Architecture:** Чистая логика (тексты, направления, рекомендуемая привычка) в `apps/web/src/lib/money-practice.ts`; диаграмма — новый чистый компонент `CompassWheel` (SVG-сектора, состояние в `data-state`); `MoneyPractice.tsx` пересобирается под новый порядок разделов. Схема `moneyDataSchema`, API и хук `usePracticeDraft` не трогаются.

**Tech Stack:** TypeScript, React 19 / Next 16, CSS Modules, vitest (`renderToStaticMarkup`), Playwright (e2e, локальная проверка).

**Spec:** `docs/superpowers/specs/2026-10-13-money-compass-rework-design.md`

## Global Constraints

- Данные не меняются: `moneyDataSchema`, `MoneyPracticeData`, API `/api/report/[id]/practice/money`, `usePracticeDraft`, миграции — без правок. Тесты `practice-upgrade.test.ts` и тест схемы в `money-practice.test.ts` остаются зелёными без изменений.
- Оси компаса и их порядок прежние: `plan` (вопросы 0–1), `pause` (2–3), `boundaries` (4), `conditions` (5).
- Не более одной оговорки на текст: слова «может», «могут», «возможно», «вероятно», «можно сравнить» (тест через `hedgeCount` из `@grani/ai`).
- Вводная фраза «Сначала вспомни один недавний случай. Затем проверь, будет ли полезен такой шаг:» в шагах не повторяется; один общий текст `RECALL_NOTE` показывается над компасом, если у какого-то направления нет ответа или он «Пока не знаю».
- Состояния компаса подаются нейтрально; рядом с диаграммой остаётся фраза «Это не оценка финансовой успешности».
- Якоря остаются: `money-questions`, `money-compass`, `money-week`, `money-memo`; убираются `money-observations` и `money-situations`; появляется `money-data`.
- Атрибуты, на которые опираются e2e и тесты: `data-money-ready`, `data-practice-save`, `data-direction`, `aria-pressed` на кнопках направлений, `name="money-question-N"`, `name="money-habit"`, `#money-day-note`, `#money-reflection`, `#money-memo-text`.
- Доступное имя кнопки направления — только её название (`aria-describedby` на скрытое описание состояния): так e2e `getByRole("button", { name: "Пауза перед покупкой", exact: true })` и программы чтения находят кнопку по названию. (Отклонение от спецификации: там предлагалось `aria-label` с состоянием.)
- Цвета — переменные `--practice-*` страницы практики; контраст текста не ниже 4,5 : 1.
- Коммиты: `<type>: <description>`, без строки Co-Authored-By.

## Тексты на утверждение (гейт перед Task 1)

Исполнитель не начинает Task 1, пока владелица не подтвердила этот раздел или не прислала правки. Правки вносятся прямо сюда, затем в код Task 1.

**Тексты о чертах** (`OBSERVATIONS`, три уровня на черту; вопрос под каждой чертой остаётся прежним):

| Черта | Выше | Ниже | Около середины |
|---|---|---|---|
| Открытость опыту | Тебе интересно новое, и ты быстро замечаешь варианты. Риск — решить раньше, чем прочитал условия: перед новым предложением выдели 15 минут на проверку. | По шкале тебе ближе проверенные способы: они защищают от лишнего риска. Одно правило: перед новым предложением сравни его хотя бы с одной альтернативой. | К новому у тебя нет перекоса: где-то хочется пробовать, где-то держаться знакомого. Полезно заметить, в каких денежных ситуациях ты склоняешься в какую сторону. |
| Добросовестность | Тебе близок порядок, и регулярный взгляд на расходы даётся легко. Оставь в плане небольшой свободный остаток, чтобы неожиданное не ломало систему. | Тебе удобнее гибкость, чем подробный учёт. Сложная система не нужна: хватит одного короткого обзора расходов раз в неделю. | Порядок и гибкость у тебя в равновесии. Выбери тот объём учёта, который ты готов вести без напряжения, и держись его. |
| Экстраверсия | Обсуждение помогает тебе прояснить выбор. Следи, чтобы в разговоре решали твои желания, а не темп и ожидания компании. | Тебе удобнее обдумывать решения самому. Для совместных планов заранее подготовь одну фразу о своём бюджете. | Иногда тебе помогает обсуждение, иногда тишина. Замечай, в каком формате денежное решение выходит яснее. |
| Доброжелательность | Ты чутко относишься к людям, и это помогает договариваться. Сложнее назвать свой предел вслух: заранее реши сумму, при которой тебе комфортно. | Ты спокойно называешь свои условия. Объясняй, почему тебе так удобно: тогда другие слышат договорённость, а не отказ. | Тебе доступны и компромисс, и твёрдое «нет». Вспомни разговор о деньгах, где удалось сохранить и отношения, и свой предел. |
| Эмоциональная устойчивость | Ты обычно спокойно встречаешь неожиданные траты. Не откладывай из-за этого проверку условий: спокойствие не заменяет письменный договор. | Неожиданные траты и давление ты переживаешь сильнее. Не решай важное сразу: отложи необязательное решение на сутки, пока напряжение спадёт. | Твоя реакция на напряжение меняется. Замечай, в каком состоянии проще обсуждать расходы и читать условия, и назначай такие дела на это время. |

**Состояния направлений** (подпись → вывод):

| Состояние | Подпись | Вывод |
|---|---|---|
| Нет ответов | Ждёт твоих ответов | Ответь на связанные вопросы, и здесь появится вывод. Можно выбрать «Пока не знаю». |
| Не знаю | Стоит понаблюдать | Пока мало наблюдений. Вспомни один недавний случай и вернись к вопросу. |
| Опора | Знакомый способ, на который можно опереться | Этот способ у тебя уже есть. Заметь, в каких ситуациях он выручает, а где его не хватает. |
| Тема для шага | Можно попробовать небольшой шаг | Здесь можно попробовать небольшой шаг. Это тема для эксперимента, а не оценка твоих финансов. |
| По-разному | Зависит от ситуации | В одних ситуациях ты действуешь уверенно, в других нет. На этой неделе отметь два случая: где получилось спокойно и где нет. |

**Общий текст:** «Если ответа нет или он «Пока не знаю»: сначала вспомни один недавний случай, потом пробуй шаг.»

**Шаги направлений** (первый — если ответ на связанный вопрос «a», второй — иначе; фразы-якоря остаются прежними):

| Направление (бывшая ситуация) | Если уже получается | Если нет |
|---|---|---|
| Ясность расходов (Появилась неожиданная трата) | Продолжай обзор расходов: раздели срочное и то, что подождёт, уточни сроки и полную стоимость. | Запиши, что нужно оплатить сейчас, какие сроки известны и что можно перенести. Не решай всё одним действием. |
| Пауза перед покупкой (Хочется купить прямо сейчас) | Сохрани привычную паузу. После неё определи, для какой задачи нужна вещь и устраивает ли тебя её полная стоимость. | Отложи одну необязательную покупку до завтра. Спроси себя: чего я хочу на самом деле и есть ли другой способ? |
| Свои границы (Нужно договориться о деньгах) | Опирайся на умение называть свой лимит. Заранее обсуди с участниками сумму, сроки и право отказаться. | Перед разговором выбери удобную тебе сумму. Назови её прямо и предложи участие в этих пределах. |
| Проверка условий (Предлагают что-то незнакомое) | Продолжай читать условия. Отдельно уточни все расходы, срок обязательств и порядок отказа. | Не соглашайся до проверки письменных условий. Выпиши непонятные пункты и уточни их у компетентного специалиста. |

---

## Review Focus

- Сохранённые черновики открываются как раньше: схема и хук не менялись, тест схемы и `practice-upgrade` зелёные (Task 1 и итоговый прогон в Task 4).
- Пустые ответы и «Пока не знаю»: все сектора в состоянии «ждёт»/«понаблюдать», привычка не подсвечена, показан `RECALL_NOTE` (Task 1 и Task 3).
- Ошибка или конфликт сохранения: блок «Данные» раскрыт, в шапке есть ссылка на него (Task 3: `isSaveProblem` и SSR-проверка разметки блока).
- Клавиатура и программы чтения: у каждой кнопки направления есть `aria-pressed` и `aria-describedby`, указывающий на существующий элемент (Task 2).
- Ширина 320 px: диаграмма и подписи не создают горизонтальной прокрутки (Task 4, ручная проверка).

---

### Task 1: Логика направлений и тексты

**Files:**
- Modify: `apps/web/src/lib/money-practice.ts` (блок `OBSERVATIONS`, `COMPASS_LABELS`, `recommendations`; добавить функции)
- Test: `apps/web/src/lib/money-practice.test.ts`

**Interfaces:**
- Consumes: существующие `buildCompass`, `MONEY_QUESTIONS`, `MoneyHabit`, `MoneyAnswer` (из `@grani/core`).
- Produces: `STATE_NOTES: Record<CompassState, string>`, `RECALL_NOTE: string`, `type AxisId = "plan" | "pause" | "boundaries" | "conditions"`, `directionDetails(answers): readonly Direction[]` с `Direction = { id: AxisId; title: string; indices: readonly number[]; state: CompassState; label: string; basis: string[]; note: string; situation: string; image: string; action: string; phrase: string; recall: boolean }`, `recommendedHabit(directions: readonly { id: AxisId; state: CompassState }[]): MoneyHabit | null`. `recommendations(answers)` сохраняет прежнюю форму `{ id, title, image, basis, action, phrase }` (её использует `buildMoneyMemo`), но без вводной фразы в `action`.

- [ ] **Step 1: Write the failing tests**

В `apps/web/src/lib/money-practice.test.ts` заменить первую строку импорта на:

```ts
import { hedgeCount } from "@grani/ai";
import { describe, expect, test } from "vitest";
import { buildCompass, COMPASS_LABELS, directionDetails, financialObservations, initialMoneyData, moneyDataSchema, RECALL_NOTE, recommendations, recommendedHabit, STATE_NOTES } from "./money-practice";
```

и добавить в конец файла:

```ts
const ALL_A = Array(6).fill("a") as ("a" | "b" | "c" | "unsure" | null)[];
const ALL_C = Array(6).fill("c") as ("a" | "b" | "c" | "unsure" | null)[];
const ANSWER_SETS = [Array(6).fill(null), ALL_A, ALL_C, Array(6).fill("unsure"), ["a", "c", "a", "a", "b", "c"]] as const;

describe("directions", () => {
  test("every direction carries its own situation, step and phrase, in the axes order", () => {
    const directions = directionDetails(ALL_C);

    expect(directions.map(d => d.id)).toEqual(["plan", "pause", "boundaries", "conditions"]);
    expect(directions.map(d => d.situation)).toEqual(["Появилась неожиданная трата", "Хочется купить прямо сейчас", "Нужно договориться о деньгах", "Предлагают что-то незнакомое"]);
    for (const d of directions) {
      expect(d.action.length).toBeGreaterThan(20);
      expect(d.phrase.length).toBeGreaterThan(10);
      expect(d.note).toBe(STATE_NOTES[d.state]);
    }
  });

  test("steps carry no repeated lead-in, whatever the answers are", () => {
    for (const answers of ANSWER_SETS) {
      for (const s of recommendations(answers)) expect(s.action).not.toContain("Сначала вспомни один недавний случай");
    }
    expect(RECALL_NOTE).toContain("вспомни один недавний случай");
  });

  test("the recall flag is raised only for missing or unknown answers of the direction's situation", () => {
    expect(directionDetails(Array(6).fill(null)).every(d => d.recall)).toBe(true);
    expect(directionDetails(Array(6).fill("unsure")).every(d => d.recall)).toBe(true);
    expect(directionDetails(ALL_A).some(d => d.recall)).toBe(false);
    expect(directionDetails(["a", "a", "a", "a", "a", null]).map(d => d.recall)).toEqual([false, false, false, true]);
  });

  test("a step for a supported answer differs from the step for an experiment", () => {
    const supported = directionDetails(ALL_A).map(d => d.action);
    const experiment = directionDetails(ALL_C).map(d => d.action);
    supported.forEach((action, i) => expect(action).not.toBe(experiment[i]));
  });
});

describe("recommendedHabit", () => {
  test("takes the first direction that is a topic for a step and maps it to a habit", () => {
    expect(recommendedHabit(buildCompass(ALL_C))).toBe("review");
    expect(recommendedHabit(buildCompass(["a", "a", "c", "c", "a", "a"]))).toBe("pause");
    expect(recommendedHabit(buildCompass(["a", "a", "a", "a", "c", "a"]))).toBe("boundary");
    expect(recommendedHabit(buildCompass(["a", "a", "a", "a", "a", "c"]))).toBe("review");
  });

  test("falls back to the first mixed direction, and gives nothing without a topic", () => {
    expect(recommendedHabit(buildCompass(["a", "c", "a", "a", "a", "a"]))).toBe("review");
    expect(recommendedHabit(buildCompass(ALL_A))).toBeNull();
    expect(recommendedHabit(buildCompass(Array(6).fill(null)))).toBeNull();
    expect(recommendedHabit(buildCompass(Array(6).fill("unsure")))).toBeNull();
  });
});

describe("texts", () => {
  test("every text of the page keeps to one hedge at most and has no empty phrases", () => {
    const scoresLow = { openness: 20, conscientiousness: 20, extraversion: 20, agreeableness: 20, stability: 20 };
    const scoresMid = { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, stability: 50 };
    const scoresHigh = { openness: 85, conscientiousness: 85, extraversion: 85, agreeableness: 85, stability: 85 };
    const texts = [
      ...[scoresLow, scoresMid, scoresHigh].flatMap(scores => financialObservations(scores).map(o => o.text)),
      ...Object.values(STATE_NOTES),
      ...ANSWER_SETS.flatMap(answers => recommendations(answers).map(s => s.action)),
      RECALL_NOTE,
    ];

    for (const text of texts) {
      expect(hedgeCount(text), text).toBeLessThanOrEqual(1);
      expect(text).not.toMatch(/Проверь, удобно ли|в твоей конкретной ситуации/);
    }
  });

  test("the labels of the compass are neutral and the supported state names a familiar way", () => {
    expect(COMPASS_LABELS.resource).toBe("Знакомый способ, на который можно опереться");
    expect(COMPASS_LABELS.mixed).toBe("Зависит от ситуации");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run apps/web/src/lib/money-practice.test.ts`
Expected: FAIL (`directionDetails`, `STATE_NOTES`, `RECALL_NOTE`, `recommendedHabit` не экспортируются).

- [ ] **Step 3: Write the implementation**

В `apps/web/src/lib/money-practice.ts`:

1. Заменить массив `OBSERVATIONS` целиком (строки с `const OBSERVATIONS … = [` до закрывающей `];`) на:

```ts
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
```

2. Заменить строку `export const COMPASS_LABELS …` на:

```ts
export const COMPASS_LABELS: Record<CompassState, string> = { pending: "Ждёт твоих ответов", observe: "Стоит понаблюдать", mixed: "Зависит от ситуации", resource: "Знакомый способ, на который можно опереться", practice: "Можно попробовать небольшой шаг" };

export const STATE_NOTES: Record<CompassState, string> = {
  pending: "Ответь на связанные вопросы, и здесь появится вывод. Можно выбрать «Пока не знаю».",
  observe: "Пока мало наблюдений. Вспомни один недавний случай и вернись к вопросу.",
  resource: "Этот способ у тебя уже есть. Заметь, в каких ситуациях он выручает, а где его не хватает.",
  practice: "Здесь можно попробовать небольшой шаг. Это тема для эксперимента, а не оценка твоих финансов.",
  mixed: "В одних ситуациях ты действуешь уверенно, в других нет. На этой неделе отметь два случая: где получилось спокойно и где нет.",
};

export const RECALL_NOTE = "Если ответа нет или он «Пока не знаю»: сначала вспомни один недавний случай, потом пробуй шаг.";
```

3. Заменить функцию `recommendations` целиком (от `export function recommendations` до её закрывающей `}`) на:

```ts
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

// Направление компаса вместе с шагом своей ситуации: ситуации больше не отдельный раздел
export function directionDetails(answers: readonly (MoneyAnswer | null)[]) {
  const steps = recommendations(answers);
  return buildCompass(answers).map(axis => {
    const step = steps.find(s => s.id === AXIS_SITUATION[axis.id])!;
    const answer = answers[step.basis] ?? null;
    return { ...axis, note: STATE_NOTES[axis.state], situation: step.title, image: step.image, action: step.action, phrase: step.phrase, recall: answer === null || answer === "unsure" };
  });
}

const HABIT_FOR_AXIS: Record<AxisId, MoneyHabit> = { plan: "review", pause: "pause", boundaries: "boundary", conditions: "review" };

// Подсказка, а не выбор: привычка `emotion` не имеет своей оси и автоматически не рекомендуется
export function recommendedHabit(directions: readonly { id: AxisId; state: CompassState }[]): MoneyHabit | null {
  const axis = directions.find(d => d.state === "practice") ?? directions.find(d => d.state === "mixed");
  return axis ? HABIT_FOR_AXIS[axis.id] : null;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm exec vitest run apps/web/src/lib/money-practice.test.ts` и `pnpm --filter @grani/web typecheck`
Expected: PASS всех тестов файла (прежние тоже). Typecheck: ошибок нет; `MoneyPractice.tsx` продолжает использовать `recommendations`, `buildCompass`, `answerText` — они остались.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/money-practice.ts apps/web/src/lib/money-practice.test.ts
git commit -m "feat(web): directions with steps, recommended habit and rewritten compass texts"
```

---

### Task 2: Диаграмма компаса

**Files:**
- Create: `apps/web/src/components/practice/CompassWheel.tsx`
- Modify: `apps/web/src/components/practice/MoneyPractice.module.css`
- Test: `apps/web/src/components/practice/CompassWheel.test.tsx`

**Interfaces:**
- Consumes: `CompassState` из `@/lib/money-practice` (Task 1 его не менял).
- Produces: `sectorPath(index: number): string` и `<CompassWheel directions={{ id: string; title: string; state: CompassState; label: string }[]} activeIndex={number} onSelect={(index: number) => void} />`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/practice/CompassWheel.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { CompassState } from "@/lib/money-practice";
import { CompassWheel, sectorPath } from "./CompassWheel";

const make = (states: CompassState[]) => states.map((state, i) => ({ id: `d${i}`, title: `Направление ${i}`, state, label: `Подпись ${state}` }));
const render = (states: CompassState[], active = 0) => renderToStaticMarkup(<CompassWheel directions={make(states)} activeIndex={active} onSelect={() => {}} />);

describe("sectorPath", () => {
  test("gives four different closed shapes, one per side of the wheel", () => {
    const paths = [0, 1, 2, 3].map(sectorPath);

    expect(new Set(paths).size).toBe(4);
    for (const path of paths) expect(path).toMatch(/^M[\d. -]+A[\d. -]+L[\d. -]+A[\d. -]+Z$/);
  });
});

describe("CompassWheel", () => {
  test("draws one sector per direction and marks its state", () => {
    const html = render(["pending", "observe", "mixed", "resource"]);

    expect(html.match(/<path[^>]*data-state="/g)).toHaveLength(4);
    for (const state of ["pending", "observe", "mixed", "resource"]) expect(html).toContain(`data-state="${state}"`);
  });

  test("a topic for a step gets a dot, other states do not", () => {
    expect(render(["practice", "practice", "pending", "pending"]).match(/<circle[^>]*data-marker/g)).toHaveLength(2);
    expect(render(["resource", "mixed", "pending", "observe"]).match(/<circle[^>]*data-marker/g)).toBeNull();
  });

  test("every direction is a button named by its title, pressed when active, and described by its state", () => {
    const html = render(["pending", "observe", "mixed", "resource"], 2);

    for (let i = 0; i < 4; i++) {
      expect(html).toContain(`data-direction="${i}"`);
      expect(html).toContain(`aria-describedby="money-dir-state-${i}"`);
      expect(html).toContain(`id="money-dir-state-${i}"`);
    }
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-pressed="true"[^>]*><span>Направление 2<\/span>/);
    expect(html).not.toContain('aria-label="Направление');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run apps/web/src/components/practice/CompassWheel.test.tsx`
Expected: FAIL (module `./CompassWheel` not found).

- [ ] **Step 3: Write the implementation**

`apps/web/src/components/practice/CompassWheel.tsx`:

```tsx
import type { CompassState } from "@/lib/money-practice";
import styles from "./MoneyPractice.module.css";

type Direction = { id: string; title: string; state: CompassState; label: string };
type Props = { directions: readonly Direction[]; activeIndex: number; onSelect: (index: number) => void };

const CENTER = 160;
const OUTER = 112;
const INNER = 52;
const GAP_DEGREES = 2.5;

// Угол отсчитывается по часовой стрелке от верха: сектор 0 — сверху, 1 — справа, 2 — снизу, 3 — слева
function point(radius: number, degrees: number): [number, number] {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return [CENTER + radius * Math.cos(radians), CENTER + radius * Math.sin(radians)];
}

export function sectorPath(index: number): string {
  const start = index * 90 - 45 + GAP_DEGREES;
  const end = index * 90 + 45 - GAP_DEGREES;
  const [x1, y1] = point(OUTER, start);
  const [x2, y2] = point(OUTER, end);
  const [x3, y3] = point(INNER, end);
  const [x4, y4] = point(INNER, start);
  const f = (value: number) => value.toFixed(1);
  return `M${f(x1)} ${f(y1)}A${OUTER} ${OUTER} 0 0 1 ${f(x2)} ${f(y2)}L${f(x3)} ${f(y3)}A${INNER} ${INNER} 0 0 0 ${f(x4)} ${f(y4)}Z`;
}

// Сектора показывают только состояние ответов: контур, пунктир, штриховка, заливка или точка — без шкалы «лучше/хуже»
export function CompassWheel({ directions, activeIndex, onSelect }: Props) {
  return (
    <div className={styles.compassWheel}>
      <svg viewBox="0 0 320 320" className={styles.wheelSvg} aria-hidden="true">
        <defs>
          <pattern id="money-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="7" className={styles.hatchLine} />
          </pattern>
        </defs>
        {directions.map((d, i) => (
          <path key={d.id} d={sectorPath(i)} className={styles.sector} data-state={d.state} data-active={i === activeIndex ? "" : undefined} onClick={() => onSelect(i)} />
        ))}
        {directions.map((d, i) => {
          if (d.state !== "practice") return null;
          const [x, y] = point((OUTER + INNER) / 2, i * 90);
          return <circle key={d.id} cx={x} cy={y} r={5} className={styles.marker} data-marker="" />;
        })}
      </svg>
      <div className={styles.compassCenter}>Мои<br />ориентиры</div>
      {directions.map((d, i) => (
        <button key={d.id} type="button" className={styles.direction} data-direction={i} data-state={d.state} aria-pressed={i === activeIndex} aria-describedby={`money-dir-state-${i}`} onClick={() => onSelect(i)}>
          <span>{d.title}</span>
        </button>
      ))}
      {directions.map((d, i) => (
        <span key={d.id} id={`money-dir-state-${i}`} className={styles.srOnly}>{d.label}</span>
      ))}
    </div>
  );
}
```

В конец `apps/web/src/components/practice/MoneyPractice.module.css` добавить:

```css
/* Диаграмма компаса: сектора по состоянию ответов */
.wheelSvg { position: absolute; inset: 0; width: 100%; height: 100%; }
.sector { fill: none; stroke: var(--practice-gold); stroke-width: 1.2; opacity: .55; cursor: pointer; transition: opacity 160ms ease-out; }
.sector[data-state="observe"] { stroke-dasharray: 5 4; }
.sector[data-state="mixed"] { fill: url(#money-hatch); }
.sector[data-state="resource"] { fill: var(--practice-gold); fill-opacity: .5; }
.sector[data-state="practice"] { opacity: .95; }
.sector[data-active] { opacity: 1; stroke-width: 2.4; }
.hatchLine { stroke: var(--practice-gold); stroke-width: 2; opacity: .55; }
.marker { fill: var(--practice-gold); pointer-events: none; }
.srOnly { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
```

- [ ] **Step 4: Run test and typecheck**

Run: `pnpm exec vitest run apps/web/src/components/practice/CompassWheel.test.tsx` и `pnpm --filter @grani/web typecheck`
Expected: PASS; типы чистые.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/practice/CompassWheel.tsx apps/web/src/components/practice/CompassWheel.test.tsx apps/web/src/components/practice/MoneyPractice.module.css
git commit -m "feat(web): compass wheel whose sectors show the state of the answers"
```

---

### Task 3: Новая структура страницы

**Files:**
- Modify: `apps/web/src/components/practice/MoneyPractice.tsx` (переписать целиком)
- Modify: `apps/web/src/components/practice/MoneyPractice.module.css` (добавить правила)
- Test: `apps/web/src/components/practice/MoneyPractice.test.tsx`

**Interfaces:**
- Consumes: из Task 1 `directionDetails`, `recommendedHabit`, `RECALL_NOTE`, `financialObservations`, `MONEY_HABITS`, `MONEY_QUESTIONS`, `buildMoneyMemo`, `moneyDataSchema`; из Task 2 `CompassWheel`; существующие `usePracticeDraft`, `ClientPracticeDraft`, `PracticeSaveState`.
- Produces: `MoneyPractice` с прежними props; `isSaveProblem(status: PracticeSaveState): boolean`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/practice/MoneyPractice.test.tsx`:

```tsx
import type { MoneyAnswer, MoneyPracticeData } from "@grani/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { initialMoneyData, RECALL_NOTE } from "@/lib/money-practice";
import { isSaveProblem, MoneyPractice } from "./MoneyPractice";

const SCORES = { openness: 30, conscientiousness: 45, extraversion: 50, agreeableness: 60, stability: 35 };
const render = (data: MoneyPracticeData = initialMoneyData()) =>
  renderToStaticMarkup(<MoneyPractice resultId="r1" displayName="Тест" scores={SCORES} initialDraft={{ revision: 0, schemaVersion: 1, data }} />);
const withAnswers = (answers: (MoneyAnswer | null)[]): MoneyPracticeData => ({ ...initialMoneyData(), answers });
const at = (html: string, needle: string) => {
  const index = html.indexOf(needle);
  expect(index, needle).toBeGreaterThan(-1);
  return index;
};

describe("MoneyPractice layout", () => {
  test("one linear path: questions, compass, week, memo, then the data block", () => {
    const html = render();

    expect(at(html, 'id="money-questions"')).toBeLessThan(at(html, 'id="money-compass"'));
    expect(at(html, 'id="money-compass"')).toBeLessThan(at(html, 'id="money-week"'));
    expect(at(html, 'id="money-week"')).toBeLessThan(at(html, 'id="money-memo"'));
    expect(at(html, 'id="money-memo"')).toBeLessThan(at(html, 'id="money-data"'));
    expect(html).not.toContain('id="money-observations"');
    expect(html).not.toContain('id="money-situations"');
  });

  test("the side navigation has four steps", () => {
    const html = render();
    const nav = html.slice(at(html, "<nav"), at(html, "</nav>"));

    expect(nav.match(/<li>/g)).toHaveLength(4);
    for (const label of ["Вопросы", "Компас", "Неделя", "Памятка"]) expect(nav).toContain(label);
    expect(html).not.toContain("Жизненные ситуации");
  });

  test("the save status is one line in the header, the buttons live in the data block after the memo", () => {
    const html = render();

    expect(at(html, "data-practice-save")).toBeLessThan(at(html, 'id="money-questions"'));
    for (const button of ["Сохранить сейчас", "Скачать черновик"]) {
      expect(html.indexOf(button)).toBeGreaterThan(at(html, 'id="money-data"'));
      expect(html.indexOf(button)).toBeGreaterThan(at(html, 'id="money-memo"'));
    }
  });
});

describe("MoneyPractice compass", () => {
  test("four sectors and four direction buttons, the first direction opened with its step and phrase", () => {
    const html = render(withAnswers(Array(6).fill("c")));

    expect(html.match(/<path[^>]*data-state="/g)).toHaveLength(4);
    expect(html.match(/data-direction="/g)).toHaveLength(4);
    expect(html).toContain("Ясность расходов");
    expect(html).toContain("Появилась неожиданная трата");
    expect(html).toContain("Сначала пойму сроки и обязательные расходы.");
    expect(html).toContain("Это не оценка финансовой успешности");
  });

  test("the five traits are folded into a block inside the compass, not a section of their own", () => {
    const html = render();
    const compass = html.slice(at(html, 'id="money-compass"'), at(html, 'id="money-week"'));

    expect(compass).toContain("Почему так: твои черты");
    expect(compass).toContain("Открытость опыту");
  });

  test("the recall note appears while answers are missing and disappears when all are given", () => {
    expect(render()).toContain(RECALL_NOTE);
    expect(render(withAnswers(Array(6).fill("a")))).not.toContain(RECALL_NOTE);
  });
});

describe("MoneyPractice habits", () => {
  test("the habit that matches the answers is marked once and not chosen for the person", () => {
    const html = render(withAnswers(Array(6).fill("c")));

    expect(html.match(/Подходит по твоим ответам/g)).toHaveLength(1);
    expect(html).not.toMatch(/name="money-habit"[^>]*checked/);
  });

  test("without answers no habit is marked", () => {
    expect(render()).not.toContain("Подходит по твоим ответам");
  });
});

describe("isSaveProblem", () => {
  test("only an error or a conflict is a problem that must be noticed", () => {
    expect(["idle", "dirty", "saving", "saved"].some((s) => isSaveProblem(s as never))).toBe(false);
    expect(isSaveProblem("error")).toBe(true);
    expect(isSaveProblem("conflict")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run apps/web/src/components/practice/MoneyPractice.test.tsx`
Expected: FAIL (`isSaveProblem` не экспортируется; прежняя разметка не совпадает).

- [ ] **Step 3: Rewrite the component**

Заменить файл `apps/web/src/components/practice/MoneyPractice.tsx` целиком:

```tsx
"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { MoneyAnswer, MoneyPracticeData, TraitScores } from "@grani/core";
import { buildMoneyMemo, directionDetails, financialObservations, MONEY_HABITS, MONEY_QUESTIONS, moneyDataSchema, RECALL_NOTE, recommendedHabit } from "@/lib/money-practice";
import { CompassWheel } from "./CompassWheel";
import { usePracticeDraft, type ClientPracticeDraft, type PracticeSaveState } from "./use-practice-draft";
import styles from "./MoneyPractice.module.css";

const validate = (value: unknown): MoneyPracticeData | null => { const parsed = moneyDataSchema.safeParse(value); return parsed.success ? parsed.data : null; };
const SAVE_LABELS: Record<PracticeSaveState, string> = { idle: "Прогресс загружен", dirty: "Есть несохранённые изменения", saving: "Сохраняем…", saved: "Сохранено в аккаунте", error: "Сохранение не подтверждено", conflict: "Есть другая версия в аккаунте" };
const SECTIONS = [{ id: "questions", label: "Вопросы" }, { id: "compass", label: "Компас" }, { id: "week", label: "Неделя" }, { id: "memo", label: "Памятка" }];
const LEVEL_LABELS = { high: "Выражена сильнее", low: "Выражена слабее", borderline: "Близко к середине" } as const;
// Ошибку и конфликт сохранения нельзя спрятать вместе с кнопками: блок «Данные» раскрывается, в шапке появляется ссылка на него
export const isSaveProblem = (status: PracticeSaveState) => status === "error" || status === "conflict";
function localToday() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
function dayDate(start: string, offset: number) { const date = new Date(start + "T12:00:00Z"); date.setUTCDate(date.getUTCDate() + offset); return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" }); }
function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type })); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function MoneyPractice({ resultId, displayName, scores, initialDraft }: { resultId: string; displayName: string; scores: TraitScores; initialDraft: ClientPracticeDraft<MoneyPracticeData> }) {
  const draft = usePracticeDraft({ endpoint: `/api/report/${encodeURIComponent(resultId)}/practice/money`, initial: initialDraft, validate });
  const [questionIndex, setQuestionIndex] = useState(() => Math.max(0, initialDraft.data.answers.findIndex(a => a === null)));
  const [axisIndex, setAxisIndex] = useState(0), [dayIndex, setDayIndex] = useState(0), [notice, setNotice] = useState("");
  const data = draft.data, observations = financialObservations(scores), directions = directionDetails(data.answers);
  const question = MONEY_QUESTIONS[questionIndex]!, answered = data.answers.filter(a => a !== null).length;
  const habit = MONEY_HABITS.find(h => h.id === data.habit), active = directions[axisIndex]!, suggestedHabit = recommendedHabit(directions);
  const saveText = draft.ready ? SAVE_LABELS[draft.status] : "Подключаем сохранение…", saveProblem = isSaveProblem(draft.status);
  const backup = () => download(JSON.stringify({ resultId, practice: "money", schemaVersion: 1, data }, null, 2), "Грани-финансовый-компас-черновик.json", "application/json");
  const generateMemo = () => {
    if (data.memo && !window.confirm("Заменить текст памятки текущими наблюдениями? Сначала можно скачать свою версию.")) return;
    draft.update(before => ({ ...before, memo: buildMoneyMemo(before) }));
  };
  return <div className={styles.root} data-money-ready={draft.ready || undefined}>
    <a className={styles.skip} href="#money-questions">Перейти к вопросам</a>
    <div className={styles.layout}>
      <aside className={styles.navigation} aria-label="Разделы финансового практикума">
        <Link href={`/report/${resultId}`} className={styles.back}>К моему разбору</Link>
        <p className={styles.navTitle}>Деньги</p>
        <nav><ol>{SECTIONS.map((s, i) => <li key={s.id}><a href={`#money-${s.id}`}><span aria-hidden="true">{i + 1}</span>{s.label}</a></li>)}</ol></nav>
        <p className={styles.navNote}>Одна привычка.<br />Семь дней внимания к себе.</p>
      </aside>
      <div className={styles.content}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}><h1>Мой финансовый <em>компас</em></h1><p className={styles.lead}>Понять свои привычки.<br />Найти удобный способ обращаться с деньгами.</p><p className={styles.secondary}>{displayName}, здесь можно проверить знакомые реакции, выбрать одну привычку и наблюдать за ней семь дней.</p><a className={styles.primary} href={answered < 6 ? "#money-questions" : "#money-compass"}>{answered === 0 ? "Начать практикум" : "Продолжить практикум"}</a></div>
          <div className={styles.heroArt} aria-hidden="true"><Image src="/practice/money/gem.png" alt="" fill sizes="(max-width: 700px) 90vw, 440px" priority /></div>
          <div className={styles.heroFoot}><span>Твой приватный практикум · <strong role="status" data-practice-save>{saveText}</strong>{saveProblem && <> · <a href="#money-data">Открыть сохранение</a></>}</span><span>6 вопросов · 1 привычка · 7 дней</span></div>
        </header>
        <fieldset className={styles.controls} disabled={!draft.ready} aria-label="Инструменты финансового практикума">
          <section id="money-questions" className={styles.section} aria-labelledby="money-questions-title">
            <h2 id="money-questions-title">Как это происходит у тебя</h2><p className={styles.intro}>Выбирай то, что ближе к последним неделям. «Пока не знаю» — тоже ответ. Все варианты можно изменить.</p>
            <div className={styles.questionPanel}><div className={styles.questionProgress}><span>Вопрос {questionIndex + 1} из 6</span><span>Ответов: {answered} из 6</span></div>
              <fieldset className={styles.question}><legend>{question.title}</legend><p>{question.context}</p>{[...question.options, "Пока не знаю"].map((text, i) => { const answer = (["a", "b", "c", "unsure"] as MoneyAnswer[])[i]!; return <label key={questionIndex + ":" + i} className={styles.choice}><input type="radio" name={`money-question-${questionIndex}`} value={answer} checked={data.answers[questionIndex] === answer} onChange={() => draft.update(before => ({ ...before, answers: before.answers.map((a, index) => index === questionIndex ? answer : a) }))} /><span>{text}</span></label>; })}</fieldset>
              <div className={styles.questionActions}><button type="button" onClick={() => setQuestionIndex(i => i - 1)} disabled={questionIndex === 0}>Назад</button>{questionIndex < 5 ? <button type="button" className={styles.primary} disabled={data.answers[questionIndex] === null} onClick={() => setQuestionIndex(i => i + 1)}>Следующий вопрос</button> : <a className={styles.primary} href="#money-compass">Посмотреть мой компас</a>}</div>
            </div>
          </section>
          <section id="money-compass" className={styles.section} aria-labelledby="money-compass-title">
            <h2 id="money-compass-title">Четыре направления твоего компаса</h2><p className={styles.intro}>Выбери направление: здесь вывод по твоим ответам, шаг для знакомой ситуации и фраза, которая поможет. Это не оценка финансовой успешности, сектора показывают только твои ответы.</p>
            {directions.some(d => d.recall) && <p className={styles.recall}>{RECALL_NOTE}</p>}
            <div className={styles.compassLayout}>
              <CompassWheel directions={directions} activeIndex={axisIndex} onSelect={setAxisIndex} />
              <div className={styles.compassDetail} aria-live="polite">
                <div className={styles.directionArt}><Image src={`/practice/money/${active.image}.png`} alt="" fill sizes="(max-width: 700px) 90vw, 440px" /></div>
                <h3>{active.title}</h3><p className={styles.compassState}>{active.label}</p><p>{active.note}</p>
                <h4>Что попробовать: {active.situation}</h4><p>{active.action}</p><blockquote>{active.phrase}</blockquote>
                <details data-basis><summary>На какие ответы опирается вывод</summary><ul>{active.basis.map(b => <li key={b}>{b}</li>)}</ul></details>
                <a href="#money-questions">Вернуться к вопросам</a>
              </div>
            </div>
            <details className={styles.traits}><summary>Почему так: твои черты</summary><p className={styles.intro}>Пять ракурсов по твоим шкалам Big Five. Это гипотезы для проверки: характер не определяет доход, долги или финансовое поведение.</p>{observations.map(o => <div key={o.trait} className={styles.trait}><h4>{o.name}<span>{LEVEL_LABELS[o.level]}</span></h4><p>{o.text}</p><p className={styles.prompt}>{o.question}</p></div>)}</details>
          </section>
          <section id="money-week" className={styles.section} aria-labelledby="money-week-title"><div className={styles.weekCover}><Image src="/practice/money/week.png" alt="" fill sizes="(max-width: 700px) 100vw, 900px" /><div><h2 id="money-week-title">Одна привычка.<br />Семь небольших шагов.</h2><p>Не обещай себе изменить всё. Выбери один способ и посмотри, подходит ли он тебе.</p></div></div>
            {!data.startedOn ? <><fieldset className={styles.habitChoices}><legend>Что хочу попробовать</legend>{MONEY_HABITS.map(h => <label key={h.id} className={styles.habit}><input type="radio" name="money-habit" value={h.id} checked={data.habit === h.id} onChange={() => draft.update(before => ({ ...before, habit: h.id }))} /><span><strong>{h.title}{suggestedHabit === h.id && <em className={styles.recommended}>Подходит по твоим ответам</em>}</strong><span>{h.action}</span></span></label>)}</fieldset><button type="button" className={styles.primary} disabled={!data.habit} onClick={() => draft.update(before => ({ ...before, startedOn: localToday() }))}>Начать семь дней</button></> : <div className={styles.experiment}><h3>{habit?.title}</h3><p>{habit?.action}</p><p className={styles.secondary}>Начало: {dayDate(data.startedOn, 0)}. Отмечено дней: {data.done.filter(Boolean).length} из 7. Пропущенный день можно оставить без отметки.</p><div className={styles.dayNav} aria-label="Выбрать день эксперимента">{data.done.map((done, i) => <button type="button" key={i} aria-pressed={i === dayIndex} onClick={() => setDayIndex(i)}><span>День {i + 1}</span><span>{done ? "Отмечен" : "Без отметки"}</span></button>)}</div><div className={styles.dayPanel}><h4>День {dayIndex + 1} · {dayDate(data.startedOn, dayIndex)}</h4><label className={styles.check}><input type="checkbox" checked={data.done[dayIndex]} onChange={e => draft.update(before => ({ ...before, done: before.done.map((d, i) => i === dayIndex ? e.target.checked : d) }))} />Я попробовал(а) выбранный шаг</label><label htmlFor="money-day-note">Что заметил(а) сегодня</label><textarea id="money-day-note" rows={4} maxLength={2000} value={data.notes[dayIndex]} onChange={e => draft.update(before => ({ ...before, notes: before.notes.map((n, i) => i === dayIndex ? e.target.value : n) }))} placeholder="Что помогло? Что оказалось неудобным?" /></div><label htmlFor="money-reflection">Итог недели: что хочу оставить или изменить</label><textarea id="money-reflection" rows={3} maxLength={2000} value={data.reflection} onChange={e => draft.update(before => ({ ...before, reflection: e.target.value }))} /><p className={styles.secondary}>Здесь сохраняется один эксперимент. Памятку можно обновить после своих наблюдений.</p></div>}
          </section>
          <section id="money-memo" className={styles.section} aria-labelledby="money-memo-title"><h2 id="money-memo-title">Мои ориентиры — с собой</h2><p className={styles.intro}>Составь памятку из своих ответов и выбранной привычки. Отредактируй любые слова, чтобы она звучала по-твоему.</p><div className={styles.actions}><button type="button" className={styles.primary} onClick={generateMemo}>{data.memo ? "Обновить по моим ответам" : "Составить мою памятку"}</button><button type="button" disabled={!data.memo} onClick={() => download(data.memo, "Мой-финансовый-компас.txt", "text/plain;charset=utf-8")}>Скачать памятку</button><button type="button" disabled={!data.memo} onClick={() => void navigator.clipboard.writeText(data.memo).then(() => setNotice("Памятка скопирована"), () => setNotice("Копирование недоступно. Можно скачать памятку или выделить текст."))}>Скопировать</button></div><label htmlFor="money-memo-text" className={styles.memoLabel}>Моя редактируемая памятка</label><textarea id="money-memo-text" rows={15} maxLength={8000} value={data.memo} onChange={e => draft.update(before => ({ ...before, memo: e.target.value }))} placeholder="Нажми «Составить мою памятку» или напиши свои ориентиры." />{notice && <p role="status">{notice}</p>}</section>
        </fieldset>
        <details id="money-data" className={styles.dataBlock} open={saveProblem ? true : undefined}>
          <summary>Данные и сохранение</summary>
          <p>Ответы, заметки и памятка сохраняются в аккаунте автоматически. Они доступны только тебе.</p>
          <div className={styles.actions}><button type="button" onClick={() => void draft.saveNow()} disabled={!draft.ready || ["saving", "error", "conflict"].includes(draft.status)}>Сохранить сейчас</button>{draft.status === "error" && <button type="button" onClick={draft.retry}>Повторить сохранение</button>}{draft.status === "conflict" && <button type="button" onClick={() => { if (window.confirm("Загрузить версию из аккаунта и заменить правки этой вкладки? Сначала можно скачать черновик.")) void draft.loadServer(); }}>Загрузить версию из аккаунта</button>}<button type="button" onClick={backup} disabled={!draft.ready}>Скачать черновик</button></div>
          {draft.message && <p className={styles.alert} role="alert">{draft.message}</p>}
        </details>
        <footer className={styles.footer}><p>Материал для самонаблюдения. Big Five не оценивает финансовую грамотность и не прогнозирует доход. Практикум не даёт индивидуальных инвестиционных рекомендаций.</p><Link href={`/report/${resultId}`}>Вернуться к моему разбору</Link></footer>
      </div>
    </div>
  </div>;
}
```

В конец `apps/web/src/components/practice/MoneyPractice.module.css` добавить:

```css
/* Новая структура: вывод направления, свёрнутые черты, блок «Данные» */
.recall { margin: 0 0 18px; color: var(--practice-muted); font-size: 14px; }
.directionArt { position: relative; aspect-ratio: 4 / 1.8; margin-bottom: 18px; border-radius: 10px; overflow: hidden; border: 1px solid var(--practice-line); }
.directionArt img { object-fit: cover; }
.compassDetail h4 { margin: 20px 0 8px; font: 600 12px/1.4 var(--font-body), system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase; color: var(--practice-gold); }
.compassDetail blockquote { margin: 16px 0; color: var(--practice-gold); font-family: var(--font-display); font-size: 24px; line-height: 1.25; }
.traits { margin-top: 36px; border-top: 1px solid var(--practice-line); padding-top: 12px; }
.traits summary { font-size: 18px; }
.trait { padding: 14px 0; border-bottom: 1px solid var(--practice-line); }
.trait h4 { display: flex; justify-content: space-between; gap: 16px; margin: 0 0 6px; font: 400 18px/1.3 var(--font-display), Georgia, serif; text-transform: none; letter-spacing: 0; color: var(--practice-ink); }
.trait h4 span { color: var(--practice-muted); font: 400 13px/1.6 var(--font-body), system-ui, sans-serif; }
.recommended { display: inline-block; margin-left: 10px; padding: 1px 10px; border: 1px solid var(--practice-gold); border-radius: 999px; font: 500 12px/1.6 var(--font-body), system-ui, sans-serif; font-style: normal; color: var(--practice-gold); vertical-align: middle; }
.dataBlock { margin: 36px 0 12px; padding: 16px 0; border-top: 1px solid var(--practice-line); font-size: 14px; color: var(--practice-muted); }
.dataBlock summary { color: var(--practice-ink); font-size: 16px; }
.heroFoot strong { color: var(--practice-gold); font-weight: 600; }
```

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm exec vitest run apps/web/src/components/practice apps/web/src/lib/money-practice.test.ts` и `pnpm --filter @grani/web typecheck`
Expected: PASS всех тестов; типы чистые (`answerText`, `buildCompass`, `recommendations` в компоненте больше не импортируются; они остаются в `money-practice.ts`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/practice/MoneyPractice.tsx apps/web/src/components/practice/MoneyPractice.test.tsx apps/web/src/components/practice/MoneyPractice.module.css
git commit -m "feat(web): finance compass as one linear path with steps inside the directions"
```

---

### Task 4: e2e, проверка в браузере, PR

**Files:**
- Modify: `e2e/money-practice.spec.ts` (строки с `#money-compass summary` и `#money-situations article`)

**Interfaces:**
- Consumes: разметка из Task 3: у раскрывающегося основания `data-basis`, у кнопок направлений `data-direction`.
- Produces: обновлённые селекторы e2e.

- [ ] **Step 1: Update the e2e selectors**

В `e2e/money-practice.spec.ts`:
- заменить `await page.locator("#money-compass summary").click();` на `await page.locator("#money-compass [data-basis] summary").click();`;
- заменить `await expect(page.locator("#money-situations article")).toHaveCount(4);` на `await expect(page.locator("#money-compass [data-direction]")).toHaveCount(4);`.

Остальные селекторы (`#money-compass`, `#money-questions`, `#money-week`, `getByRole("button", { name: "Свои границы", exact: true })`, `[data-practice-save]`, «Повторить сохранение», «Загрузить версию из аккаунта») подходят без изменений: блок «Данные» раскрывается при `error` и `conflict`.

- [ ] **Step 2: Run the whole automated suite**

Run: `pnpm test` и `pnpm typecheck`
Expected: тесты проходят (допустимы известные таймауты `practice-upgrade` и `personality-atlas-upgrade` на полном прогоне при параллельной нагрузке; проверить их отдельно командой `pnpm exec vitest run packages/db/src/practice-upgrade.test.ts packages/db/src/personality-atlas-upgrade.test.ts`); типы всех шести пакетов чистые.

- [ ] **Step 3: Check the page in the browser**

Запустить стенд: `pnpm dev:db`; `PERSONALITY_ATLAS_V2=1 MONEY_PRACTICE_V1=1 pnpm dev:web`; `pnpm dev:worker`. Войти через `/api/dev/login?name=Check`, пройти тест, купить полный разбор и главу «Деньги» на фейковом провайдере (способ — `docs/redesign/CODEX_REPORTS.md`), открыть `/report/<id>/practice/money`. Проверить на 1440, 390 и 320 px:
1. Порядок: шапка → вопросы → компас → неделя → памятка → «Данные и сохранение»; слева 4 пункта.
2. До ответов все четыре сектора «ждёт» (контур), показан текст про «вспомни случай»; привычка не подсвечена.
3. Ответить на все вопросы вариантом «c»: сектора с точкой, первой подсвечена привычка «Пять минут ясности»; ответить смешанно: штриховка в «Зависит от ситуации».
4. У каждого направления виден шаг и фраза; раскрывается «На какие ответы опирается вывод»; блок «Почему так: твои черты» сворачивается.
5. Нет горизонтальной прокрутки на 320 px, подписи кнопок направлений не перекрывают сектора до нечитаемости; при необходимости скорректировать `OUTER` и размеры кнопок в `CompassWheel.tsx` и `MoneyPractice.module.css` (`.direction[data-direction]`) и повторить.
6. Контраст всех текстовых элементов не ниже 4,5 : 1.
7. Сохранение: в шапке одна строка статуса; «Сохранить сейчас» и «Скачать черновик» в блоке «Данные»; при имитации сбоя сети блок раскрывается и в шапке есть ссылка «Открыть сохранение».
8. Старый черновик: открыть аккаунт с уже сохранёнными ответами и неделей — ответы, отметки, заметки и памятка на месте.

- [ ] **Step 4: Run the e2e of the practice (if a QA database is available)**

Run: `pnpm test:e2e -- e2e/money-practice.spec.ts` (нужна отдельная тестовая база по `e2e/money-practice-fixtures.ts`). Если базы нет, e2e не запускается: об этом сообщить в описании PR, а не писать «проверено».

- [ ] **Step 5: Commit and open the pull request**

```bash
git add e2e/money-practice.spec.ts
git commit -m "test(e2e): money compass selectors for the new structure"
git push -u origin HEAD
gh pr create --base master --title "feat: «Финансовый компас» одним путём" --body-file /tmp/pr_compass.md
```

Перед этим записать `/tmp/pr_compass.md`. В описании PR: что изменено, что проверено вживую (пункты шага 3), что не проверено (e2e без QA-базы, текст реальных пользователей), список утверждённых текстов — ссылкой на этот план.
