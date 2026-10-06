# «Вдвоём», этап 2: карточки, ответы, раскрытие — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Пара в активном пространстве проходит 29 карточек по очереди: каждый отвечает отдельно, ответы раскрываются только после ответа обоих, прогресс сохраняется.

**Architecture:** Чистые правила проверки ответов в `packages/core`; каталог (JSON + zod) и маршрут в `packages/content`; две таблицы ответов/карточек и таблица личных отметок в `packages/db` с составными внешними ключами; состояние выводится из строк, все операции пары идут под блокировкой строки пространства; тонкий сервис и HTTP-маршруты в `apps/web`. Ответ партнёра читается из базы только после проверки, что у карточки два ответа `submitted`.

**Tech Stack:** TypeScript, Drizzle ORM (PostgreSQL / PGlite в тестах), zod 4, Next.js 16 (route handlers, `params: Promise`), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-06-together-cards-design.md` (и предыдущая `2026-10-05-together-backend-design.md`). Читать обе.

## Global Constraints

- Максимум текста ответа: **1200** символов (считаются кодовые точки, не UTF-16); у каждого `short_text` в каталоге задан свой `maxLength` (не больше 1200).
- Маршрут v1: `intro-01, intro-02, intro-03, m01-d01 … m01-d26` — ровно **29** карточек; `m01-d27` и `m01-d28` в маршрут не входят и не разбираются схемой.
- Любая карточка каталога: `revealPolicy` равен `after_both_submit`; типы полей только `short_text` и `boolean`; есть обязательное поле `answer`.
- Карточка вида `intro` доступна без оплаты; `main` требует действующего доступа только при **первой** отправке ответа.
- В пространстве одновременно **не более одной** открытой (`closed_at is null`) карточки — обеспечивает уникальный индекс.
- Операции карточек берут только блокировку строки пространства (подмножество порядка пользователь → пространство → …), пользователя не блокируют.
- Ответ партнёра (`fields`) читается только внутри `buildCardView` после проверки «у обоих `submitted`».
- Ответы GET-маршрутов: заголовок `cache-control: no-store`. Изменяющие маршруты: проверка origin и `togetherLimiter` через `authorizeTogether`.
- Комментарии в коде — по-русски, короткие, объясняют «почему»; имена — английские; файлы до 800 строк; без мутации входных данных.
- Новые маршруты Next.js копируют форму существующих (`app/api/together/purchases/[id]/route.ts`): `params: Promise<...>`, `authorizeTogether`, `failure`. Перед правкой `apps/web` прочитать `apps/web/AGENTS.md`.
- Коммиты — conventional (`feat(db): …`, `test: …`, `docs: …`), по одному на задачу. Не пушить и не открывать PR без просьбы пользователя.
- Команды запускаются из корня `C:\dev\grani-test`; тесты — `pnpm vitest run <путь>`.

## Review Focus

1. **Утечка чужого ответа до раскрытия** во всех состояниях (`answer`, `waiting`, `skipped`, история, ответ на `PUT`): строка-метка в чужом ответе не должна появляться в JSON. Тесты — Task 5, 6, 7.
2. **Повторная или одновременная отправка после раскрытия** не создаёт вторую следующую карточку и не раскрывает дважды. Тест — Task 6.
3. **Кириллица, эмодзи, пробелы:** ответ из одних пробелов — пустой; ровно 1200 символов проходит, 1201 нет; эмодзи считается одним символом. Тест — Task 2.
4. **Пропуск:** после моего ответа он стирает мой текст и сразу ставит мою отметку; если партнёр уже ответил, а я пропустил, его ответ мне нигде не показывается. Тест — Task 6.
5. **Выход и удаление аккаунта между действиями:** после закрытия пространства все операции дают `not_found`, данные не удаляются; удаление аккаунта стирает только ответы этого человека. Тесты — Task 6, 7.
6. **Конец маршрута:** после последней карточки новой не создаётся, `card: null`, прогресс `done = total`. Тест — Task 5.

---

## Структура файлов

| Файл | Ответственность |
|---|---|
| `packages/core/src/together-cards.ts` (+test) | Типы карточки и ответа, `checkAnswerFields` (чистая проверка полей) |
| `packages/content/src/together/{intro.json,month-01.json}` | Текст карточек (источник правды для сервера) |
| `packages/content/src/together/catalog.ts` (+test) | zod-схема, `toSnapshot`, `buildTrack`, `TOGETHER_TRACK` |
| `packages/db/src/schema.ts`, `drizzle/0006_together_cards.sql` | Таблицы `together_cards`, `together_answers`, `together_card_marks` |
| `packages/db/src/together-cards-schema.test.ts` | Проверка ограничений БД |
| `packages/db/src/together-card-context.ts` | Пространство под блокировкой, выдача карточки, вид карточки, итог «ждёт просмотра» |
| `packages/db/src/together-cards.ts` (+test) | `loadCurrentCard`, `listHistory`, `countClosedCards`, `deleteUserAnswers` |
| `packages/db/src/together-card-actions.ts` (+test) | `submitAnswer`, `deleteDraft`, `skipCard`, `continueCard` |
| `packages/db/src/together-cards.fixtures.ts` | Короткий маршрут для тестов БД |
| `packages/db/src/testing.ts` | `seedTogetherAccess` |
| `apps/web/src/server/together-cards-service.ts` (+test) | Тонкий сервис: каталог, доступ, форма ответа API |
| `apps/web/src/server/together-route.ts` | `cardErrorStatus` |
| `apps/web/src/app/api/together/{cards/current,cards/[id]/answer,cards/[id]/skip,cards/[id]/continue,history}/route.ts` | HTTP-маршруты |
| `e2e/together-cards.spec.ts` | Сценарий двух аккаунтов через API |
| `docs/together/CLAUDE_HANDOFF.md` | Запись этапа 2 и контракт |

---

### Task 1: Привести спецификацию в соответствие с решениями плана

**Files:**
- Modify: `docs/superpowers/specs/2026-10-06-together-cards-design.md`

**Interfaces:**
- Consumes: —
- Produces: спецификация без противоречий с планом (отметка просмотра обязательна, `not_current` убран, аналитика не затрагивается).

- [ ] **Step 1: Правки в спецификации**

Три правки:
1. В описании `together_card_marks`: заменить «`seen_at null`» на «`seen_at not null` (строка существует ⇔ человек посмотрел итог)».
2. В списке ошибок API и в разделе тестов убрать `not_current`: открытая карточка пары всегда одна, поэтому ответ на закрытую карточку — `already_closed` / `already_revealed`.
3. В разделе «Чтение и защита раскрытия» убрать фразу про `PRIVATE_SEGMENTS`: карточки не имеют страниц, идентификаторы живут только в путях `/api/...`, которые аналитика страниц не видит.

В разделе «Поведение» добавить абзац после «Пропуск»:

```
**Булевы поля до раскрытия.** Клиент не должен присылать поля с `availableAt: after_reveal` (даже `false`) до раскрытия: любое их присутствие в теле — 400 `field_not_available`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-10-06-together-cards-design.md
git commit -m "docs(together): align stage 2 spec with plan decisions"
```

---

### Task 2: Чистые правила ответа в core

**Files:**
- Create: `packages/core/src/together-cards.ts`
- Create: `packages/core/src/together-cards.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `TOGETHER_ANSWER_MAX_LENGTH = 1200`
  - `type CardKind = "intro" | "main"`
  - `type CardField = { id: string; type: "short_text" | "boolean"; label: string; required: boolean; maxLength?: number; availableAt?: "after_reveal" }`
  - `type CardSnapshot = { id: string; version: number; kind: CardKind; title: string; estimatedMinutes: number; prompt: string; hint: string; jointAction: string; skipAllowed: boolean; fields: CardField[] }`
  - `type AnswerFields = Record<string, string | boolean>`
  - `type AnswerCheck = { ok: true; fields: AnswerFields } | { ok: false; reason: "invalid_field" | "field_not_available"; field: string }`
  - `checkAnswerFields(card: CardSnapshot, input: unknown, revealed: boolean): AnswerCheck`

- [ ] **Step 1: Write the failing test**

`packages/core/src/together-cards.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { checkAnswerFields, type CardSnapshot } from "./together-cards";

const card: CardSnapshot = {
  id: "c1",
  version: 1,
  kind: "intro",
  title: "Карточка",
  estimatedMinutes: 5,
  prompt: "Вопрос?",
  hint: "Подсказка",
  jointAction: "Сделайте вместе",
  skipAllowed: true,
  fields: [
    { id: "answer", type: "short_text", label: "Ответ", required: true, maxLength: 1200 },
    { id: "note", type: "short_text", label: "Заметка", required: false, maxLength: 20 },
    { id: "share_in_book", type: "boolean", label: "В книгу", required: false, availableAt: "after_reveal" },
    { id: "like", type: "boolean", label: "Нравится", required: false },
  ],
};

describe("checkAnswerFields", () => {
  test("trims text, keeps booleans and drops empty optional text", () => {
    expect(checkAnswerFields(card, { answer: "  Чай и тишина  ", note: "   ", like: false }, false)).toEqual({
      ok: true,
      fields: { answer: "Чай и тишина", like: false },
    });
  });

  test("rejects a missing, empty or whitespace-only required answer", () => {
    for (const input of [{}, { answer: "" }, { answer: "   \n " }]) {
      expect(checkAnswerFields(card, input, false)).toEqual({ ok: false, reason: "invalid_field", field: "answer" });
    }
  });

  test("counts code points: 1200 pass, 1201 fail, an emoji is one character", () => {
    expect(checkAnswerFields(card, { answer: "я".repeat(1200) }, false).ok).toBe(true);
    expect(checkAnswerFields(card, { answer: "я".repeat(1201) }, false)).toEqual({ ok: false, reason: "invalid_field", field: "answer" });
    expect(checkAnswerFields(card, { answer: "😀".repeat(1200) }, false).ok).toBe(true);
    expect(checkAnswerFields(card, { answer: "x", note: "😀".repeat(21) }, false)).toEqual({ ok: false, reason: "invalid_field", field: "note" });
  });

  test("rejects unknown keys, wrong types and non-object input", () => {
    expect(checkAnswerFields(card, { answer: "a", extra: "b" }, false)).toEqual({ ok: false, reason: "invalid_field", field: "extra" });
    expect(checkAnswerFields(card, JSON.parse('{"answer":"a","__proto__":"b"}'), false)).toEqual({ ok: false, reason: "invalid_field", field: "__proto__" });
    expect(checkAnswerFields(card, { answer: 5 }, false)).toEqual({ ok: false, reason: "invalid_field", field: "answer" });
    expect(checkAnswerFields(card, { answer: "a", like: "yes" }, false)).toEqual({ ok: false, reason: "invalid_field", field: "like" });
    for (const input of [null, undefined, "text", ["answer"], 7]) {
      expect(checkAnswerFields(card, input, false)).toEqual({ ok: false, reason: "invalid_field", field: "" });
    }
  });

  test("allows an after-reveal field only once the answers are revealed, even when it is false", () => {
    expect(checkAnswerFields(card, { answer: "a", share_in_book: false }, false)).toEqual({ ok: false, reason: "field_not_available", field: "share_in_book" });
    expect(checkAnswerFields(card, { answer: "a", share_in_book: true }, true)).toEqual({ ok: true, fields: { answer: "a", share_in_book: true } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/core/src/together-cards.test.ts`
Expected: FAIL — cannot resolve `./together-cards`.

- [ ] **Step 3: Write minimal implementation**

`packages/core/src/together-cards.ts`:

```ts
export const TOGETHER_ANSWER_MAX_LENGTH = 1200;

export type CardKind = "intro" | "main";
export type CardFieldType = "short_text" | "boolean";
export type CardField = {
  id: string;
  type: CardFieldType;
  label: string;
  required: boolean;
  maxLength?: number;
  availableAt?: "after_reveal";
};
// Карточка, как она выдана паре: копия из каталога на момент выдачи
export type CardSnapshot = {
  id: string;
  version: number;
  kind: CardKind;
  title: string;
  estimatedMinutes: number;
  prompt: string;
  hint: string;
  jointAction: string;
  skipAllowed: boolean;
  fields: CardField[];
};
export type AnswerFields = Record<string, string | boolean>;
export type AnswerCheck = { ok: true; fields: AnswerFields } | { ok: false; reason: "invalid_field" | "field_not_available"; field: string };

const invalid = (field: string): AnswerCheck => ({ ok: false, reason: "invalid_field", field });

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

// Проверка и очистка присланных полей по снимку карточки. Поля «после раскрытия» принимаются только когда ответы уже раскрыты
export function checkAnswerFields(card: CardSnapshot, input: unknown, revealed: boolean): AnswerCheck {
  if (!isPlainObject(input)) return invalid("");
  const known = new Set(card.fields.map((field) => field.id));
  for (const key of Object.keys(input)) if (!known.has(key)) return invalid(key);

  const fields: AnswerFields = {};
  for (const field of card.fields) {
    const value = input[field.id];
    if (value === undefined) {
      if (field.required) return invalid(field.id);
      continue;
    }
    if (field.availableAt === "after_reveal" && !revealed) return { ok: false, reason: "field_not_available", field: field.id };
    if (field.type === "boolean") {
      if (typeof value !== "boolean") return invalid(field.id);
      fields[field.id] = value;
      continue;
    }
    if (typeof value !== "string") return invalid(field.id);
    const text = value.trim();
    if (text === "") {
      if (field.required) return invalid(field.id);
      continue;
    }
    if ([...text].length > (field.maxLength ?? TOGETHER_ANSWER_MAX_LENGTH)) return invalid(field.id);
    fields[field.id] = text;
  }
  return { ok: true, fields };
}
```

В `packages/core/src/index.ts` добавить последней строкой: `export * from "./together-cards";`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/core/src/together-cards.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/together-cards.ts packages/core/src/together-cards.test.ts packages/core/src/index.ts
git commit -m "feat(core): together card snapshot types and answer field checks"
```

---

### Task 3: Каталог карточек и маршрут

**Files:**
- Create: `packages/content/src/together/intro.json`
- Create: `packages/content/src/together/month-01.json` (копия `docs/together/content/month-01.json`)
- Create: `packages/content/src/together/catalog.ts`
- Create: `packages/content/src/together/catalog.test.ts`
- Modify: `packages/content/package.json` (экспорт `./together`)

**Interfaces:**
- Consumes: `CardSnapshot`, `CardField`, `CardKind` из `@grani/core` (Task 2).
- Produces:
  - `toSnapshot(raw: unknown, kind: CardKind): CardSnapshot` — бросает ошибку на неверной схеме
  - `buildTrack(introCards: readonly unknown[], monthCards: readonly unknown[]): CardSnapshot[]`
  - `TOGETHER_TRACK: readonly CardSnapshot[]` (29 карточек)
  - импорт в других пакетах: `@grani/content/together`

- [ ] **Step 1: Copy the month file and write the intro file**

```bash
cp docs/together/content/month-01.json packages/content/src/together/month-01.json
```
(если папки нет — сначала `mkdir -p packages/content/src/together`)

`packages/content/src/together/intro.json`:

```json
{
  "cards": [
    {
      "id": "intro-01",
      "semanticKey": "intro.notice_good.1",
      "version": 1,
      "title": "Замечать хорошее",
      "estimatedMinutes": 5,
      "prompt": "Какой небольшой поступок партнёра недавно сделал ваш день приятнее?",
      "hint": "Вспомните конкретный момент. Одного-двух предложений достаточно.",
      "fields": [
        { "id": "answer", "type": "short_text", "label": "Какой небольшой поступок партнёра недавно сделал ваш день приятнее?", "required": true, "maxLength": 1200 },
        { "id": "share_in_book", "type": "boolean", "label": "Хочу выбрать свой ответ для будущей книги", "required": false, "availableAt": "after_reveal" }
      ],
      "revealPolicy": "after_both_submit",
      "jointAction": "Прочитайте ответы и поблагодарите друг друга за эти моменты.",
      "skipAllowed": true
    },
    {
      "id": "intro-02",
      "semanticKey": "intro.care_language.2",
      "version": 1,
      "title": "Забота на вашем языке",
      "estimatedMinutes": 7,
      "prompt": "Какое маленькое действие поможет вам почувствовать заботу на этой неделе?",
      "hint": "Выберите что-то простое и посильное: прогулку, сообщение, помощь или время вместе.",
      "fields": [
        { "id": "answer", "type": "short_text", "label": "Какое маленькое действие поможет вам почувствовать заботу на этой неделе?", "required": true, "maxLength": 1200 },
        { "id": "share_in_book", "type": "boolean", "label": "Хочу выбрать свой ответ для будущей книги", "required": false, "availableAt": "after_reveal" }
      ],
      "revealPolicy": "after_both_submit",
      "jointAction": "Выберите по одному действию из ответов и договоритесь, когда попробуете их.",
      "skipAllowed": true
    },
    {
      "id": "intro-03",
      "semanticKey": "intro.our_story.3",
      "version": 1,
      "title": "Момент из нашей истории",
      "estimatedMinutes": 10,
      "prompt": "Какой момент из начала ваших отношений хочется сохранить?",
      "hint": "Можно вспомнить встречу, разговор или небольшой смешной эпизод. Любой вопрос можно пропустить.",
      "fields": [
        { "id": "answer", "type": "short_text", "label": "Какой момент из начала ваших отношений хочется сохранить?", "required": true, "maxLength": 1200 },
        { "id": "share_in_book", "type": "boolean", "label": "Хочу выбрать свой ответ для будущей книги", "required": false, "availableAt": "after_reveal" }
      ],
      "revealPolicy": "after_both_submit",
      "jointAction": "Поделитесь воспоминаниями. Каждый может выбрать свой ответ для черновика книги.",
      "skipAllowed": true
    }
  ]
}
```

- [ ] **Step 2: Write the failing test**

`packages/content/src/together/catalog.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { buildTrack, toSnapshot, TOGETHER_TRACK } from "./catalog";
import intro from "./intro.json";

const validCard = {
  id: "x-01",
  version: 1,
  title: "T",
  estimatedMinutes: 5,
  prompt: "P",
  hint: "H",
  fields: [{ id: "answer", type: "short_text", label: "L", required: true, maxLength: 100 }],
  revealPolicy: "after_both_submit",
  jointAction: "J",
  skipAllowed: true,
};

describe("together track", () => {
  test("has 29 unique cards: three intro cards then m01-d01 … m01-d26", () => {
    const ids = TOGETHER_TRACK.map((card) => card.id);
    expect(ids).toHaveLength(29);
    expect(new Set(ids).size).toBe(29);
    expect(ids.slice(0, 3)).toEqual(["intro-01", "intro-02", "intro-03"]);
    expect(ids[3]).toBe("m01-d01");
    expect(ids.at(-1)).toBe("m01-d26");
    expect(ids).not.toContain("m01-d27");
    expect(TOGETHER_TRACK.slice(0, 3).every((card) => card.kind === "intro")).toBe(true);
    expect(TOGETHER_TRACK.slice(3).every((card) => card.kind === "main")).toBe(true);
  });

  test("every card has a required answer field and only supported field types", () => {
    for (const card of TOGETHER_TRACK) {
      expect(card.fields.find((field) => field.id === "answer")).toMatchObject({ type: "short_text", required: true });
      expect(card.fields.every((field) => field.type === "short_text" || field.type === "boolean")).toBe(true);
      expect(card.fields.filter((field) => field.type === "short_text").every((field) => (field.maxLength ?? 0) > 0 && (field.maxLength ?? 0) <= 1200)).toBe(true);
      expect(card.skipAllowed).toBe(true);
    }
  });

  test("boolean fields that need a reveal are marked after_reveal", () => {
    const first = TOGETHER_TRACK[3]!;
    expect(first.fields.find((field) => field.id === "share_in_book")).toMatchObject({ type: "boolean", availableAt: "after_reveal" });
  });
});

describe("toSnapshot", () => {
  test("keeps only the fields the server needs", () => {
    expect(toSnapshot({ ...validCard, rewardBinding: { type: "attention" } }, "main")).toEqual({
      id: "x-01",
      version: 1,
      kind: "main",
      title: "T",
      estimatedMinutes: 5,
      prompt: "P",
      hint: "H",
      jointAction: "J",
      skipAllowed: true,
      fields: [{ id: "answer", type: "short_text", label: "L", required: true, maxLength: 100 }],
    });
  });

  test("rejects an unsupported field type, a different reveal policy and a missing answer field", () => {
    const reference = { id: "pick", type: "candidate_reference", label: "L", required: false };
    expect(() => toSnapshot({ ...validCard, fields: [...validCard.fields, reference] }, "main")).toThrow();
    expect(() => toSnapshot({ ...validCard, revealPolicy: "immediately" }, "main")).toThrow();
    expect(() => toSnapshot({ ...validCard, fields: [{ ...validCard.fields[0], id: "other" }] }, "main")).toThrow();
    expect(() => toSnapshot({ ...validCard, fields: [{ ...validCard.fields[0], required: false }] }, "main")).toThrow();
  });
});

describe("buildTrack", () => {
  test("fails loudly when a card of the track is missing", () => {
    expect(() => buildTrack(intro.cards.slice(0, 2), [])).toThrow(/intro-03/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run packages/content/src/together/catalog.test.ts`
Expected: FAIL — cannot resolve `./catalog`.

- [ ] **Step 4: Write minimal implementation**

`packages/content/src/together/catalog.ts`:

```ts
import { z } from "zod";
import type { CardField, CardKind, CardSnapshot } from "@grani/core";
import intro from "./intro.json";
import month01 from "./month-01.json";

const fieldSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string().min(1), type: z.literal("short_text"), label: z.string().min(1), required: z.boolean(), maxLength: z.number().int().positive().max(1200) }),
  z.object({ id: z.string().min(1), type: z.literal("boolean"), label: z.string().min(1), required: z.boolean(), availableAt: z.literal("after_reveal").optional() }),
]);

const cardSchema = z
  .object({
    id: z.string().min(1),
    version: z.number().int().positive(),
    title: z.string().min(1),
    estimatedMinutes: z.number().int().positive(),
    prompt: z.string().min(1),
    hint: z.string().min(1),
    fields: z.array(fieldSchema).min(1),
    revealPolicy: z.literal("after_both_submit"),
    jointAction: z.string().min(1),
    skipAllowed: z.boolean(),
  })
  .refine((card) => card.fields.some((field) => field.id === "answer" && field.type === "short_text" && field.required), "card needs a required text answer field");

type ParsedField = z.infer<typeof fieldSchema>;

const toField = (field: ParsedField): CardField =>
  field.type === "short_text"
    ? { id: field.id, type: field.type, label: field.label, required: field.required, maxLength: field.maxLength }
    : { id: field.id, type: field.type, label: field.label, required: field.required, ...(field.availableAt ? { availableAt: field.availableAt } : {}) };

// Из редакционной карточки берётся только то, что нужно серверу; награды и книга подключаются на своих этапах
export function toSnapshot(raw: unknown, kind: CardKind): CardSnapshot {
  const card = cardSchema.parse(raw);
  return {
    id: card.id,
    version: card.version,
    kind,
    title: card.title,
    estimatedMinutes: card.estimatedMinutes,
    prompt: card.prompt,
    hint: card.hint,
    jointAction: card.jointAction,
    skipAllowed: card.skipAllowed,
    fields: card.fields.map(toField),
  };
}

const INTRO_IDS = ["intro-01", "intro-02", "intro-03"];
// m01-d27 и m01-d28 выбирают кандидатов для карточки заботы (этап 4): в маршрут этапа 2 не входят и схемой не разбираются
const MAIN_IDS = Array.from({ length: 26 }, (_, index) => `m01-d${String(index + 1).padStart(2, "0")}`);

const find = (cards: readonly unknown[], id: string): unknown => {
  const raw = cards.find((card) => typeof card === "object" && card !== null && (card as { id?: unknown }).id === id);
  if (raw === undefined) throw new Error(`together card ${id} is missing from the catalog`);
  return raw;
};

export function buildTrack(introCards: readonly unknown[], monthCards: readonly unknown[]): CardSnapshot[] {
  return [...INTRO_IDS.map((id) => toSnapshot(find(introCards, id), "intro")), ...MAIN_IDS.map((id) => toSnapshot(find(monthCards, id), "main"))];
}

export const TOGETHER_TRACK: readonly CardSnapshot[] = buildTrack(intro.cards, month01.cards);
```

В `packages/content/package.json` в `exports` добавить: `"./together": "./src/together/catalog.ts"`.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run packages/content/src/together/catalog.test.ts && pnpm --filter @grani/content typecheck`
Expected: PASS, typecheck без ошибок. Если TypeScript жалуется на размер вывода типа JSON, привести `month01.cards` и `intro.cards` к `readonly unknown[]` в вызове `buildTrack`.

- [ ] **Step 6: Commit**

```bash
git add packages/content/src/together packages/content/package.json
git commit -m "feat(content): together card catalog and 29-card track"
```

---

### Task 4: Таблицы карточек, ответов и отметок

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create (генерируется): `packages/db/drizzle/0006_together_cards.sql`, снимок и журнал в `packages/db/drizzle/meta/`
- Create: `packages/db/src/together-cards-schema.test.ts`

**Interfaces:**
- Consumes: `CardSnapshot`, `AnswerFields` из `@grani/core` (Task 2); существующие `togetherSpaces`, `togetherMembers`.
- Produces: таблицы `togetherCards`, `togetherAnswers`, `togetherCardMarks`; enum `togetherAnswerStatusEnum`; тип `TogetherAnswerStatus`.

- [ ] **Step 1: Write the failing test**

`packages/db/src/together-cards-schema.test.ts`:

```ts
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import type { CardSnapshot } from "@grani/core";
import { togetherAnswers, togetherCardMarks, togetherCards } from "./schema";
import { createTestDb, seedTogetherSpace, seedUser } from "./testing";
import type { Database } from "./types";

const NOW = new Date("2026-10-05T10:00:00Z");
const SNAPSHOT: CardSnapshot = {
  id: "c1",
  version: 1,
  kind: "intro",
  title: "T",
  estimatedMinutes: 5,
  prompt: "P",
  hint: "H",
  jointAction: "J",
  skipAllowed: true,
  fields: [{ id: "answer", type: "short_text", label: "L", required: true, maxLength: 100 }],
};

let db: Database;
let spaceId: string;
let anna: string;
let boris: string;

const card = (space: string, position: number, closedAt: Date | null = null, cardId = `c${position}`) =>
  db.insert(togetherCards).values({ spaceId: space, cardId, position, snapshot: { ...SNAPSHOT, id: cardId }, closedAt }).returning({ id: togetherCards.id });

beforeEach(async () => {
  db = await createTestDb();
  ({ spaceId, initiatorId: anna, partnerId: boris } = await seedTogetherSpace(db, { now: NOW }));
});

describe("together cards", () => {
  test("a space has at most one open card, and a closed one makes room for the next", async () => {
    const [first] = await card(spaceId, 1);
    await expect(card(spaceId, 2)).rejects.toThrow();

    await db.update(togetherCards).set({ closedAt: NOW }).where(eq(togetherCards.id, first!.id));
    await expect(card(spaceId, 2)).resolves.toBeDefined();
  });

  test("positions and catalog ids are unique inside a space but not across spaces", async () => {
    const other = await seedTogetherSpace(db, { now: NOW });
    await card(spaceId, 1, NOW);

    await expect(card(spaceId, 1, NOW, "other-id")).rejects.toThrow();
    await expect(card(spaceId, 2, NOW, "c1")).rejects.toThrow();
    await expect(card(other.spaceId, 1)).resolves.toBeDefined();
    await expect(card(spaceId, 0, NOW, "zero")).rejects.toThrow();
  });
});

describe("together answers", () => {
  const answer = (cardRowId: string, space: string, userId: string, values: Partial<typeof togetherAnswers.$inferInsert> = {}) =>
    db.insert(togetherAnswers).values({ cardId: cardRowId, spaceId: space, userId, status: "submitted", fields: { answer: "text" }, ...values });

  test("one answer per person and card", async () => {
    const [row] = await card(spaceId, 1);
    await answer(row!.id, spaceId, anna);

    await expect(answer(row!.id, spaceId, anna)).rejects.toThrow();
    await expect(answer(row!.id, spaceId, boris)).resolves.toBeDefined();
  });

  test("an answer needs an author who belongs to the same space", async () => {
    const [row] = await card(spaceId, 1);
    const vera = await seedUser(db, { externalId: "vera" });
    const other = await seedTogetherSpace(db, { now: NOW });

    await expect(answer(row!.id, spaceId, vera)).rejects.toThrow();
    await expect(answer(row!.id, spaceId, other.initiatorId)).rejects.toThrow();
  });

  test("an answer cannot point at a card of another space", async () => {
    const other = await seedTogetherSpace(db, { now: NOW });
    const [row] = await card(spaceId, 1);

    await expect(answer(row!.id, other.spaceId, other.initiatorId)).rejects.toThrow();
  });

  test("a skipped answer is empty and the revision starts at one", async () => {
    const [row] = await card(spaceId, 1);

    await expect(answer(row!.id, spaceId, anna, { status: "skipped", fields: { answer: "leftover" } })).rejects.toThrow();
    await expect(answer(row!.id, spaceId, anna, { revision: 0 })).rejects.toThrow();
    await expect(answer(row!.id, spaceId, anna, { status: "skipped", fields: {} })).resolves.toBeDefined();
  });
});

describe("together card marks", () => {
  test("one mark per person and card, and only for members of the space", async () => {
    const [row] = await card(spaceId, 1, NOW);
    const vera = await seedUser(db, { externalId: "vera" });
    const mark = (userId: string) => db.insert(togetherCardMarks).values({ cardId: row!.id, spaceId, userId, seenAt: NOW });

    await mark(anna);
    await expect(mark(anna)).rejects.toThrow();
    await expect(mark(vera)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/db/src/together-cards-schema.test.ts`
Expected: FAIL — `togetherCards` is not exported from `./schema`.

- [ ] **Step 3: Add the tables**

В `packages/db/src/schema.ts`:

1. В импорт из `drizzle-orm/pg-core` добавить `foreignKey`; рядом с импортом `REPORT_KINDS` добавить: `import type { AnswerFields, CardSnapshot } from "@grani/core";` (объединить с существующим импортом `@grani/core`).
2. После таблицы `togetherAccessPeriods` добавить:

```ts
export const togetherAnswerStatusEnum = pgEnum("together_answer_status", ["submitted", "skipped"]);
export type TogetherAnswerStatus = (typeof togetherAnswerStatusEnum.enumValues)[number];

// Карточка пары: снимок хранится в строке, поэтому правка каталога не меняет уже выданное
export const togetherCards = pgTable(
  "together_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => togetherSpaces.id, { onDelete: "cascade" }),
    cardId: text("card_id").notNull(),
    position: integer("position").notNull(),
    snapshot: jsonb("snapshot").$type<CardSnapshot>().notNull(),
    createdAt: createdAt(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("together_cards_space_position_uq").on(t.spaceId, t.position),
    uniqueIndex("together_cards_space_card_uq").on(t.spaceId, t.cardId),
    // Опора составных ключей: ответ и отметка не могут указать на карточку чужого пространства
    uniqueIndex("together_cards_id_space_uq").on(t.id, t.spaceId),
    // У пары не больше одной открытой карточки
    uniqueIndex("together_cards_open_uq")
      .on(t.spaceId)
      .where(sql`${t.closedAt} is null`),
    check("together_cards_position_positive", sql`${t.position} >= 1`),
  ],
);

export const togetherAnswers = pgTable(
  "together_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id").notNull(),
    spaceId: uuid("space_id").notNull(),
    userId: uuid("user_id").notNull(),
    status: togetherAnswerStatusEnum("status").notNull(),
    fields: jsonb("fields").$type<AnswerFields>().notNull().default({}),
    revision: integer("revision").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ columns: [t.cardId, t.spaceId], foreignColumns: [togetherCards.id, togetherCards.spaceId] }).onDelete("cascade"),
    // Автор — участник именно этого пространства
    foreignKey({ columns: [t.spaceId, t.userId], foreignColumns: [togetherMembers.spaceId, togetherMembers.userId] }),
    uniqueIndex("together_answers_card_user_uq").on(t.cardId, t.userId),
    check("together_answers_revision_positive", sql`${t.revision} >= 1`),
    check("together_answers_skipped_empty", sql`${t.status} <> 'skipped' or ${t.fields} = '{}'::jsonb`),
  ],
);

// Личные отметки: «я посмотрел итог» (строка есть ⇔ посмотрел) и «мы это сделали вместе».
// Нужны отдельно от ответов: у того, кто не отвечал, строки ответа нет, а итог пропуска партнёра показать нужно
export const togetherCardMarks = pgTable(
  "together_card_marks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id").notNull(),
    spaceId: uuid("space_id").notNull(),
    userId: uuid("user_id").notNull(),
    seenAt: timestamp("seen_at", { withTimezone: true }).notNull(),
    doneAt: timestamp("done_at", { withTimezone: true }),
  },
  (t) => [
    foreignKey({ columns: [t.cardId, t.spaceId], foreignColumns: [togetherCards.id, togetherCards.spaceId] }).onDelete("cascade"),
    foreignKey({ columns: [t.spaceId, t.userId], foreignColumns: [togetherMembers.spaceId, togetherMembers.userId] }),
    uniqueIndex("together_card_marks_card_user_uq").on(t.cardId, t.userId),
  ],
);
```

- [ ] **Step 4: Generate the migration and inspect it**

Run: `pnpm --filter @grani/db exec drizzle-kit generate --name together_cards`
Expected: создан `packages/db/drizzle/0006_together_cards.sql`, обновлён `meta/_journal.json`.
Проверить глазами: `grep -n "FOREIGN KEY\|CREATE UNIQUE INDEX\|CREATE TYPE" packages/db/drizzle/0006_together_cards.sql` — должны быть три таблицы, два составных внешних ключа у ответов и отметок, частичный уникальный индекс `together_cards_open_uq … WHERE "closed_at" is null`, проверка `together_answers_skipped_empty`. Если внешний ключ на `together_members(space_id, user_id)` или на `together_cards(id, space_id)` отсутствует — исправить схему, не править SQL руками.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run packages/db/src/together-cards-schema.test.ts && pnpm --filter @grani/db typecheck`
Expected: PASS (7 tests), typecheck без ошибок.

- [ ] **Step 6: Run the whole db suite for regressions**

Run: `pnpm vitest run packages/db`
Expected: все тесты db зелёные (миграции применяются на каждой PGlite-базе).

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle packages/db/src/together-cards-schema.test.ts
git commit -m "feat(db): together cards, answers and card marks tables"
```

---

### Task 5: Контекст карточек и чтение текущей карточки

**Files:**
- Modify: `packages/db/src/together.ts` (экспорт `lockSpace`, `findActiveMembership`)
- Create: `packages/db/src/together-card-context.ts`
- Create: `packages/db/src/together-cards.ts`
- Create: `packages/db/src/together-cards.fixtures.ts`
- Create: `packages/db/src/together-cards.test.ts`
- Modify: `packages/db/src/index.ts`

**Interfaces:**
- Consumes: таблицы Task 4; `CardSnapshot`, `AnswerFields`, `accessState` из `@grani/core`; `getAccessSnapshot` из `./together-billing`.
- Produces (`together-card-context.ts`):
  - `type CardRow = typeof togetherCards.$inferSelect`
  - `type CardState = "answer" | "waiting" | "revealed" | "skipped"`
  - `type CardView = { id: string; position: number; total: number; snapshot: CardSnapshot; state: CardState; mine: { fields: AnswerFields; revision: number; done: boolean } | null; partner: { status: "none" | "answered" | "skipped"; fields?: AnswerFields; edited?: boolean; done?: boolean } }`
  - `type SpaceContext = { spaceId: string; partnerId: string }`
  - `resolveSpace(tx: Database, userId: string, options?: { lock: boolean }): Promise<SpaceContext | null>`
  - `loadCard(tx: Database, spaceId: string, cardId: string): Promise<CardRow | null>`
  - `answerStatuses(tx: Database, cardId: string): Promise<Map<string, TogetherAnswerStatus>>`
  - `isRevealed(statuses: Map<string, TogetherAnswerStatus>, a: string, b: string): boolean`
  - `readAnswer(tx: Database, cardId: string, userId: string): Promise<{ fields: AnswerFields; revision: number } | null>`
  - `buildCardView(tx: Database, p: { card: CardRow; userId: string; partnerId: string; total: number }): Promise<CardView>`
  - `openCardOf(tx: Database, spaceId: string): Promise<CardRow | null>`
  - `pendingCardFor(tx: Database, spaceId: string, userId: string): Promise<CardRow | null>`
  - `ensureOpenCard(tx: Database, spaceId: string, track: readonly CardSnapshot[], now: Date): Promise<CardRow | null>`
  - `closeCard(tx: Database, p: { card: CardRow; track: readonly CardSnapshot[]; now: Date }): Promise<void>`
  - `countClosedCards(tx: Database, spaceId: string): Promise<number>`
- Produces (`together-cards.ts`): `loadCurrentCard(db: Database, p: { userId: string; track: readonly CardSnapshot[]; now: Date }): Promise<CurrentCard>` где `CurrentCard = { ok: true; card: CardView | null; progress: { done: number; total: number }; accessActive: boolean } | { ok: false; reason: "not_found" }`.
- Produces (`together-cards.fixtures.ts`): `fixtureCard(id: string, kind?: CardKind, skipAllowed?: boolean): CardSnapshot`, `FIXTURE_TRACK: readonly CardSnapshot[]` (`intro-01`, `intro-02`, `main-01`).

- [ ] **Step 1: Write the fixtures and the failing test**

`packages/db/src/together-cards.fixtures.ts`:

```ts
import type { CardKind, CardSnapshot } from "@grani/core";

// Короткий маршрут для тестов БД: реальный каталог лежит в @grani/content, db от него не зависит
export function fixtureCard(id: string, kind: CardKind = "intro", skipAllowed = true): CardSnapshot {
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
    fields: [
      { id: "answer", type: "short_text", label: "Ответ", required: true, maxLength: 50 },
      { id: "share_in_book", type: "boolean", label: "В книгу", required: false, availableAt: "after_reveal" },
    ],
  };
}

export const FIXTURE_TRACK: readonly CardSnapshot[] = [fixtureCard("intro-01"), fixtureCard("intro-02"), fixtureCard("main-01", "main")];
```

`packages/db/src/together-cards.test.ts`:

```ts
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { togetherAnswers, togetherCardMarks, togetherCards } from "./schema";
import { createTestDb, seedTogetherSpace, seedUser } from "./testing";
import { closeSpaceForUser, createSpace } from "./together";
import { loadCurrentCard } from "./together-cards";
import { FIXTURE_TRACK } from "./together-cards.fixtures";
import type { Database } from "./types";

const NOW = new Date("2026-10-05T10:00:00Z");
const SECRET = "СЕКРЕТ-ПАРТНЁРА";

let db: Database;
let spaceId: string;
let anna: string;
let boris: string;

const current = (userId: string, track = FIXTURE_TRACK) => loadCurrentCard(db, { userId, track, now: NOW });

async function firstCardId(): Promise<string> {
  const result = await current(anna);
  if (!result.ok || !result.card) throw new Error("no current card");
  return result.card.id;
}

const answer = (cardId: string, userId: string, status: "submitted" | "skipped", fields: Record<string, string | boolean> = {}, revision = 1) =>
  db.insert(togetherAnswers).values({ cardId, spaceId, userId, status, fields, revision });
const close = (cardId: string) => db.update(togetherCards).set({ closedAt: NOW }).where(eq(togetherCards.id, cardId));
const mark = (cardId: string, userId: string) => db.insert(togetherCardMarks).values({ cardId, spaceId, userId, seenAt: NOW });

beforeEach(async () => {
  db = await createTestDb();
  ({ spaceId, initiatorId: anna, partnerId: boris } = await seedTogetherSpace(db, { now: NOW }));
});

describe("loadCurrentCard", () => {
  test("issues the first card once and shows the same card to both", async () => {
    const first = await current(anna);
    await current(boris);
    await current(anna);

    expect(await db.select().from(togetherCards).where(eq(togetherCards.spaceId, spaceId))).toHaveLength(1);
    expect(first).toMatchObject({
      ok: true,
      progress: { done: 0, total: 3 },
      accessActive: false,
      card: { position: 1, state: "answer", mine: null, partner: { status: "none" }, snapshot: { id: "intro-01" } },
    });
  });

  test("shows nothing outside an active space", async () => {
    const vera = await seedUser(db, { externalId: "vera" });
    expect(await current(vera)).toEqual({ ok: false, reason: "not_found" });

    const pending = await seedUser(db, { externalId: "pending" });
    await createSpace(db, { userId: pending, now: NOW });
    expect(await current(pending)).toEqual({ ok: false, reason: "not_found" });

    await closeSpaceForUser(db, { userId: anna, now: NOW, reason: "left" });
    expect(await current(anna)).toEqual({ ok: false, reason: "not_found" });
    expect(await current(boris)).toEqual({ ok: false, reason: "not_found" });
  });

  test("never exposes a partner answer before the reveal", async () => {
    const cardId = await firstCardId();
    await answer(cardId, boris, "submitted", { answer: SECRET });

    const waitingForMe = await current(anna);
    expect(waitingForMe).toMatchObject({ card: { state: "answer", partner: { status: "answered" } } });
    expect(JSON.stringify(waitingForMe)).not.toContain(SECRET);

    // Анна пропустила, карточка закрыта: ответ Бориса ей всё равно не раскрывается
    await answer(cardId, anna, "skipped");
    await close(cardId);
    const afterSkip = await current(anna);
    expect(afterSkip).toMatchObject({ card: { position: 1, state: "skipped", mine: null, partner: { status: "answered" } } });
    expect(JSON.stringify(afterSkip)).not.toContain(SECRET);
    expect(await current(boris)).toMatchObject({ card: { state: "skipped", mine: { fields: { answer: SECRET } }, partner: { status: "skipped" } } });
  });

  test("reveals both answers when both are submitted and flags an edited partner answer", async () => {
    const cardId = await firstCardId();
    await answer(cardId, anna, "submitted", { answer: "Мой ответ" });
    await answer(cardId, boris, "submitted", { answer: SECRET }, 2);
    await close(cardId);
    await db.insert(togetherCardMarks).values({ cardId, spaceId, userId: boris, seenAt: NOW, doneAt: NOW });

    expect(await current(anna)).toMatchObject({
      card: { state: "revealed", mine: { fields: { answer: "Мой ответ" }, revision: 1, done: false }, partner: { status: "answered", fields: { answer: SECRET }, edited: true, done: true } },
    });
  });

  test("puts an unseen result before the open card until the person has seen it", async () => {
    const cardId = await firstCardId();
    await answer(cardId, anna, "submitted", { answer: "a" });
    await answer(cardId, boris, "submitted", { answer: "b" });
    await close(cardId);

    expect(await current(anna)).toMatchObject({ card: { position: 1, state: "revealed" }, progress: { done: 1, total: 3 } });
    await mark(cardId, anna);
    expect(await current(anna)).toMatchObject({ card: { position: 2, state: "answer", snapshot: { id: "intro-02" } } });
    expect(await current(boris)).toMatchObject({ card: { position: 1, state: "revealed" } });
    expect(await db.select().from(togetherCards).where(eq(togetherCards.spaceId, spaceId))).toHaveLength(2);
  });

  test("returns no card once the track is finished and every result is seen", async () => {
    const shortTrack = FIXTURE_TRACK.slice(0, 1);
    const cardId = (await current(anna, shortTrack).then((result) => (result.ok ? result.card?.id : undefined)))!;
    await answer(cardId, anna, "submitted", { answer: "a" });
    await answer(cardId, boris, "submitted", { answer: "b" });
    await close(cardId);

    expect(await current(anna, shortTrack)).toMatchObject({ card: { state: "revealed" } });
    await mark(cardId, anna);
    await mark(cardId, boris);

    expect(await current(anna, shortTrack)).toEqual({ ok: true, card: null, progress: { done: 1, total: 1 }, accessActive: false });
    expect(await db.select().from(togetherCards).where(eq(togetherCards.spaceId, spaceId))).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/db/src/together-cards.test.ts`
Expected: FAIL — cannot resolve `./together-cards`.

- [ ] **Step 3: Export the lock helpers**

В `packages/db/src/together.ts` заменить `async function lockSpace(` на `export async function lockSpace(` и `async function findActiveMembership(` на `export async function findActiveMembership(` (тела не менять). Над `lockSpace` комментарий про порядок блокировок остаётся как есть.

- [ ] **Step 4: Write the context module**

`packages/db/src/together-card-context.ts`:

```ts
import { and, asc, count, desc, eq, isNotNull, isNull, ne, notExists, sql } from "drizzle-orm";
import type { AnswerFields, CardSnapshot } from "@grani/core";
import { togetherAnswers, togetherCardMarks, togetherCards, togetherMembers, togetherSpaces, type TogetherAnswerStatus } from "./schema";
import { findActiveMembership, lockSpace } from "./together";
import type { Database } from "./types";
import { isUuid } from "./uuid";

export type CardRow = typeof togetherCards.$inferSelect;
export type CardState = "answer" | "waiting" | "revealed" | "skipped";
export type CardView = {
  id: string;
  position: number;
  total: number;
  snapshot: CardSnapshot;
  state: CardState;
  mine: { fields: AnswerFields; revision: number; done: boolean } | null;
  partner: { status: "none" | "answered" | "skipped"; fields?: AnswerFields; edited?: boolean; done?: boolean };
};
export type SpaceContext = { spaceId: string; partnerId: string };

// Пространство человека: карточками можно пользоваться только в активном пространстве двоих.
// Изменяющие операции берут блокировку пространства: она выстраивает в очередь всё, что делает пара,
// и входит в общий порядок блокировок (пользователь → пространство → …) без блокировки пользователя
export async function resolveSpace(tx: Database, userId: string, options: { lock: boolean } = { lock: true }): Promise<SpaceContext | null> {
  const membership = await findActiveMembership(tx, userId);
  if (!membership) return null;
  const space = options.lock
    ? await lockSpace(tx, membership.spaceId)
    : ((await tx.select().from(togetherSpaces).where(eq(togetherSpaces.id, membership.spaceId)).limit(1))[0] ?? null);
  // Статус перечитан после блокировки: пока ждали, человек мог выйти
  if (!space || space.status !== "active") return null;
  const [partner] = await tx
    .select({ userId: togetherMembers.userId })
    .from(togetherMembers)
    .where(and(eq(togetherMembers.spaceId, space.id), isNull(togetherMembers.leftAt), ne(togetherMembers.userId, userId)))
    .limit(1);
  return partner ? { spaceId: space.id, partnerId: partner.userId } : null;
}

export async function loadCard(tx: Database, spaceId: string, cardId: string): Promise<CardRow | null> {
  if (!isUuid(cardId)) return null;
  const [card] = await tx
    .select()
    .from(togetherCards)
    .where(and(eq(togetherCards.id, cardId), eq(togetherCards.spaceId, spaceId)))
    .limit(1);
  return card ?? null;
}

// Только статусы, без текста: по ним решается, раскрыта ли карточка
export async function answerStatuses(tx: Database, cardId: string): Promise<Map<string, TogetherAnswerStatus>> {
  const rows = await tx.select({ userId: togetherAnswers.userId, status: togetherAnswers.status }).from(togetherAnswers).where(eq(togetherAnswers.cardId, cardId));
  return new Map(rows.map((row) => [row.userId, row.status]));
}

export const isRevealed = (statuses: Map<string, TogetherAnswerStatus>, a: string, b: string): boolean =>
  statuses.get(a) === "submitted" && statuses.get(b) === "submitted";

export async function readAnswer(tx: Database, cardId: string, userId: string): Promise<{ fields: AnswerFields; revision: number } | null> {
  const [row] = await tx
    .select({ fields: togetherAnswers.fields, revision: togetherAnswers.revision })
    .from(togetherAnswers)
    .where(and(eq(togetherAnswers.cardId, cardId), eq(togetherAnswers.userId, userId), eq(togetherAnswers.status, "submitted")))
    .limit(1);
  return row ?? null;
}

// Единственное место, где читается текст ответа партнёра, и только после проверки «у обоих submitted»
export async function buildCardView(tx: Database, p: { card: CardRow; userId: string; partnerId: string; total: number }): Promise<CardView> {
  const statuses = await answerStatuses(tx, p.card.id);
  const mineStatus = statuses.get(p.userId);
  const partnerStatus = statuses.get(p.partnerId);
  const revealed = isRevealed(statuses, p.userId, p.partnerId);
  const marks = await tx.select({ userId: togetherCardMarks.userId, doneAt: togetherCardMarks.doneAt }).from(togetherCardMarks).where(eq(togetherCardMarks.cardId, p.card.id));
  const doneOf = (userId: string) => marks.some((mark) => mark.userId === userId && mark.doneAt !== null);

  const mine = mineStatus === "submitted" ? await readAnswer(tx, p.card.id, p.userId) : null;
  const state: CardState = p.card.closedAt === null ? (mineStatus === "submitted" ? "waiting" : "answer") : revealed ? "revealed" : "skipped";
  const partner: CardView["partner"] = { status: partnerStatus === undefined ? "none" : partnerStatus === "submitted" ? "answered" : "skipped" };
  if (revealed) {
    const theirs = await readAnswer(tx, p.card.id, p.partnerId);
    if (theirs) {
      partner.fields = theirs.fields;
      partner.edited = theirs.revision > 1;
      partner.done = doneOf(p.partnerId);
    }
  }
  return {
    id: p.card.id,
    position: p.card.position,
    total: p.total,
    snapshot: p.card.snapshot,
    state,
    mine: mine ? { fields: mine.fields, revision: mine.revision, done: doneOf(p.userId) } : null,
    partner,
  };
}

export async function openCardOf(tx: Database, spaceId: string): Promise<CardRow | null> {
  const [card] = await tx
    .select()
    .from(togetherCards)
    .where(and(eq(togetherCards.spaceId, spaceId), isNull(togetherCards.closedAt)))
    .limit(1);
  return card ?? null;
}

// Закрытая карточка, итог которой человек ещё не посмотрел (нет его отметки); самая ранняя
export async function pendingCardFor(tx: Database, spaceId: string, userId: string): Promise<CardRow | null> {
  const [card] = await tx
    .select()
    .from(togetherCards)
    .where(
      and(
        eq(togetherCards.spaceId, spaceId),
        isNotNull(togetherCards.closedAt),
        notExists(
          tx
            .select({ one: sql`1` })
            .from(togetherCardMarks)
            .where(and(eq(togetherCardMarks.cardId, togetherCards.id), eq(togetherCardMarks.userId, userId))),
        ),
      ),
    )
    .orderBy(asc(togetherCards.position))
    .limit(1);
  return card ?? null;
}

async function openNextCard(tx: Database, spaceId: string, track: readonly CardSnapshot[], now: Date): Promise<CardRow | null> {
  const [last] = await tx.select({ position: togetherCards.position }).from(togetherCards).where(eq(togetherCards.spaceId, spaceId)).orderBy(desc(togetherCards.position)).limit(1);
  const position = (last?.position ?? 0) + 1;
  const next = track[position - 1];
  if (!next) return null;
  const [card] = await tx.insert(togetherCards).values({ spaceId, cardId: next.id, position, snapshot: next, createdAt: now }).returning();
  return card ?? null;
}

// Первая карточка выдаётся при первом обращении пары; повтор ничего не создаёт, пока есть открытая
export async function ensureOpenCard(tx: Database, spaceId: string, track: readonly CardSnapshot[], now: Date): Promise<CardRow | null> {
  return (await openCardOf(tx, spaceId)) ?? (await openNextCard(tx, spaceId, track, now));
}

// Закрытие и выдача следующей карточки — в одной транзакции
export async function closeCard(tx: Database, p: { card: CardRow; track: readonly CardSnapshot[]; now: Date }): Promise<void> {
  await tx.update(togetherCards).set({ closedAt: p.now }).where(eq(togetherCards.id, p.card.id));
  await openNextCard(tx, p.card.spaceId, p.track, p.now);
}

export async function countClosedCards(tx: Database, spaceId: string): Promise<number> {
  const [row] = await tx.select({ value: count() }).from(togetherCards).where(and(eq(togetherCards.spaceId, spaceId), isNotNull(togetherCards.closedAt)));
  return row?.value ?? 0;
}
```

- [ ] **Step 5: Write `loadCurrentCard`**

`packages/db/src/together-cards.ts`:

```ts
import { accessState, type CardSnapshot } from "@grani/core";
import { buildCardView, countClosedCards, ensureOpenCard, openCardOf, pendingCardFor, resolveSpace, type CardView } from "./together-card-context";
import { getAccessSnapshot } from "./together-billing";
import type { Database } from "./types";

export type CurrentCard =
  | { ok: true; card: CardView | null; progress: { done: number; total: number }; accessActive: boolean }
  | { ok: false; reason: "not_found" };

// Что видит человек сейчас: сначала итог, который он ещё не посмотрел, иначе открытая карточка пары.
// Выдача первой карточки — единственная запись при чтении; она идемпотентна под блокировкой пространства
export async function loadCurrentCard(db: Database, p: { userId: string; track: readonly CardSnapshot[]; now: Date }): Promise<CurrentCard> {
  return db.transaction(async (tx): Promise<CurrentCard> => {
    const context = await resolveSpace(tx, p.userId);
    if (!context) return { ok: false, reason: "not_found" };
    await ensureOpenCard(tx, context.spaceId, p.track, p.now);
    const row = (await pendingCardFor(tx, context.spaceId, p.userId)) ?? (await openCardOf(tx, context.spaceId));
    const { periods, closedAt } = await getAccessSnapshot(tx, context.spaceId);
    return {
      ok: true,
      card: row ? await buildCardView(tx, { card: row, userId: p.userId, partnerId: context.partnerId, total: p.track.length }) : null,
      progress: { done: await countClosedCards(tx, context.spaceId), total: p.track.length },
      accessActive: accessState(periods, p.now, closedAt).active,
    };
  });
}
```

В `packages/db/src/index.ts` добавить строки:

```ts
export * from "./together-card-context";
export * from "./together-cards";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run packages/db/src/together-cards.test.ts && pnpm --filter @grani/db typecheck`
Expected: PASS (5 tests), typecheck без ошибок. Если `export *` даёт конфликт имён, переименовать локальный `isRevealed`/`readAnswer` с префиксом `card`.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src
git commit -m "feat(db): together card context and current card read"
```

---

### Task 6: Действия: ответ, черновик, пропуск, «Продолжить»

**Files:**
- Modify: `packages/db/src/testing.ts` (`seedTogetherAccess`)
- Create: `packages/db/src/together-card-actions.ts`
- Create: `packages/db/src/together-card-actions.test.ts`
- Modify: `packages/db/src/index.ts`

**Interfaces:**
- Consumes: всё из Task 5; `checkAnswerFields` из `@grani/core` (Task 2); `getAccessSnapshot`, `grantAccessPeriod` из `./together-billing`.
- Produces:
  - `submitAnswer(db, p: { userId: string; cardId: string; fields: unknown; track: readonly CardSnapshot[]; now: Date }): Promise<SubmitOutcome>`, где `SubmitOutcome = { ok: true; state: "waiting" | "revealed" | "edited"; revealed: CardView | null } | { ok: false; reason: "not_found" | "already_closed" | "reveal_pending" | "access_required" | "invalid_field" | "field_not_available"; field?: string }`
  - `deleteDraft(db, p: { userId: string; cardId: string }): Promise<{ ok: true } | { ok: false; reason: "not_found" | "already_closed" | "already_revealed" }>`
  - `skipCard(db, p: { userId: string; cardId: string; track: readonly CardSnapshot[]; now: Date }): Promise<{ ok: true } | { ok: false; reason: "not_found" | "already_closed" | "reveal_pending" | "skip_not_allowed" }>`
  - `continueCard(db, p: { userId: string; cardId: string; done: boolean; now: Date }): Promise<{ ok: true } | { ok: false; reason: "not_found" | "not_closed" }>`
  - `seedTogetherAccess(db, p: { spaceId: string; userId: string; paidAt?: Date }): Promise<void>` (из `@grani/db/testing`)

- [ ] **Step 1: Add the access seed helper**

В `packages/db/src/testing.ts` добавить импорт `import { grantAccessPeriod } from "./together-billing";` и функцию после `seedTogetherSpace`:

```ts
// Оплаченный период для активного пространства — для тестов карточек категории main
export async function seedTogetherAccess(db: Database, p: { spaceId: string; userId: string; paidAt?: Date }): Promise<void> {
  const paidAt = p.paidAt ?? new Date("2026-10-05T10:00:00Z");
  const [purchase] = await db
    .insert(schema.purchases)
    .values({ userId: p.userId, product: "together_30d", spaceId: p.spaceId, amountKopecks: 59_900, status: "succeeded", paidAt })
    .returning({ id: schema.purchases.id });
  const granted = await grantAccessPeriod(db, { spaceId: p.spaceId, purchaseId: purchase!.id, paidAt });
  if (!granted.ok) throw new Error(`seed access failed: ${granted.reason}`);
}
```

- [ ] **Step 2: Write the failing test**

`packages/db/src/together-card-actions.test.ts`:

```ts
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import type { CardSnapshot } from "@grani/core";
import { togetherAnswers, togetherCardMarks, togetherCards } from "./schema";
import { createTestDb, seedTogetherAccess, seedTogetherSpace, seedUser } from "./testing";
import { closeSpaceForUser } from "./together";
import { continueCard, deleteDraft, skipCard, submitAnswer } from "./together-card-actions";
import { loadCurrentCard } from "./together-cards";
import { fixtureCard, FIXTURE_TRACK } from "./together-cards.fixtures";
import type { Database } from "./types";

const NOW = new Date("2026-10-05T10:00:00Z");
const SECRET = "СЕКРЕТ-ПАРТНЁРА";

let db: Database;
let spaceId: string;
let anna: string;
let boris: string;

const put = (userId: string, cardId: string, fields: unknown, track: readonly CardSnapshot[] = FIXTURE_TRACK) => submitAnswer(db, { userId, cardId, fields, track, now: NOW });
const skip = (userId: string, cardId: string, track: readonly CardSnapshot[] = FIXTURE_TRACK) => skipCard(db, { userId, cardId, track, now: NOW });
const proceed = (userId: string, cardId: string, done = false) => continueCard(db, { userId, cardId, done, now: NOW });

async function viewOf(userId: string, track: readonly CardSnapshot[] = FIXTURE_TRACK) {
  const result = await loadCurrentCard(db, { userId, track, now: NOW });
  if (!result.ok) throw new Error("no space");
  return result;
}

async function currentId(userId = anna): Promise<string> {
  const { card } = await viewOf(userId);
  if (!card) throw new Error("no current card");
  return card.id;
}

async function reveal(cardId: string) {
  await put(anna, cardId, { answer: "ответ Ани" });
  await put(boris, cardId, { answer: "ответ Бориса" });
}

const cardRows = () => db.select().from(togetherCards).where(eq(togetherCards.spaceId, spaceId));
const answerRow = (cardId: string, userId: string) => db.select().from(togetherAnswers).where(and(eq(togetherAnswers.cardId, cardId), eq(togetherAnswers.userId, userId)));

beforeEach(async () => {
  db = await createTestDb();
  ({ spaceId, initiatorId: anna, partnerId: boris } = await seedTogetherSpace(db, { now: NOW }));
});

describe("submitAnswer", () => {
  test("an answer waits for the partner and both are revealed only after the second one", async () => {
    const id = await currentId();

    expect(await put(anna, id, { answer: "Мой тихий вечер" })).toEqual({ ok: true, state: "waiting", revealed: null });
    const before = await viewOf(boris);
    expect(before.card?.partner).toEqual({ status: "answered" });
    expect(JSON.stringify(before)).not.toContain("Мой тихий вечер");

    const second = await put(boris, id, { answer: "Чай и тишина" });
    if (!second.ok || !second.revealed) throw new Error("expected a reveal");
    expect(second.state).toBe("revealed");
    expect(second.revealed.mine?.fields).toEqual({ answer: "Чай и тишина" });
    expect(second.revealed.partner.fields).toEqual({ answer: "Мой тихий вечер" });
    expect(await cardRows()).toHaveLength(2);
    expect((await viewOf(anna)).card).toMatchObject({ position: 1, state: "revealed" });
  });

  test("a repeated answer before the reveal replaces the text and keeps revision one", async () => {
    const id = await currentId();
    await put(anna, id, { answer: "первый" });

    expect(await put(anna, id, { answer: "второй" })).toMatchObject({ ok: true, state: "waiting" });

    expect(await answerRow(id, anna)).toMatchObject([{ fields: { answer: "второй" }, revision: 1 }]);
  });

  test("rejects invalid input and after-reveal fields before the reveal", async () => {
    const id = await currentId();

    expect(await put(anna, id, { answer: "" })).toEqual({ ok: false, reason: "invalid_field", field: "answer" });
    expect(await put(anna, id, { answer: "я".repeat(51) })).toEqual({ ok: false, reason: "invalid_field", field: "answer" });
    expect(await put(anna, id, { answer: "ок", unknown: 1 })).toEqual({ ok: false, reason: "invalid_field", field: "unknown" });
    expect(await put(anna, id, { answer: "ок", share_in_book: false })).toEqual({ ok: false, reason: "field_not_available", field: "share_in_book" });
    expect(await answerRow(id, anna)).toEqual([]);
  });

  test("the next card waits for the result to be seen, then opens", async () => {
    const first = await currentId();
    await reveal(first);

    expect(await put(anna, (await cardRows()).find((card) => card.position === 2)!.id, { answer: "рано" })).toEqual({ ok: false, reason: "reveal_pending" });
    await proceed(anna, first);

    const second = await currentId(anna);
    expect(await put(anna, second, { answer: "теперь можно" })).toMatchObject({ ok: true, state: "waiting" });
  });

  test("an author edits the revealed answer: revision grows only on a real change and the partner sees the flag", async () => {
    const id = await currentId();
    await reveal(id);

    expect(await put(anna, id, { answer: "ответ Ани" })).toEqual({ ok: true, state: "edited", revealed: null });
    expect(await answerRow(id, anna)).toMatchObject([{ revision: 1 }]);
    expect(await put(anna, id, { answer: "исправленный", share_in_book: true })).toEqual({ ok: true, state: "edited", revealed: null });
    expect(await answerRow(id, anna)).toMatchObject([{ revision: 2, fields: { answer: "исправленный", share_in_book: true } }]);

    expect((await viewOf(boris)).card?.partner).toMatchObject({ edited: true, fields: { answer: "исправленный" } });
  });

  test("a repeated submit after the reveal never creates a second next card", async () => {
    const id = await currentId();
    await reveal(id);

    await put(boris, id, { answer: "ответ Бориса" });
    await put(boris, id, { answer: "ответ Бориса" });

    expect(await cardRows()).toHaveLength(2);
  });

  test("cannot edit a card that was closed by a skip", async () => {
    const id = await currentId();
    await put(anna, id, { answer: "мой" });
    await skip(boris, id);

    expect(await put(anna, id, { answer: "поздно" })).toEqual({ ok: false, reason: "already_closed" });
  });

  test("a main card needs access for the first answer only, an intro card never does", async () => {
    for (let i = 0; i < 2; i++) {
      const introId = await currentId();
      await reveal(introId);
      await proceed(anna, introId);
      await proceed(boris, introId);
    }
    const mainId = await currentId();

    expect(await put(anna, mainId, { answer: "платная" })).toEqual({ ok: false, reason: "access_required" });
    expect((await viewOf(anna)).accessActive).toBe(false);

    await seedTogetherAccess(db, { spaceId, userId: anna, paidAt: NOW });
    expect(await put(anna, mainId, { answer: "платная" })).toMatchObject({ ok: true, state: "waiting" });
    expect(await put(boris, mainId, { answer: "платная Бориса" })).toMatchObject({ ok: true, state: "revealed" });
  });

  test("answers of someone outside the space or to a malformed id are not found", async () => {
    const id = await currentId();
    const vera = await seedUser(db, { externalId: "vera" });
    const other = await seedTogetherSpace(db, { now: NOW });

    expect(await put(vera, id, { answer: "a" })).toEqual({ ok: false, reason: "not_found" });
    expect(await put(other.initiatorId, id, { answer: "a" })).toEqual({ ok: false, reason: "not_found" });
    expect(await put(anna, "not-a-uuid", { answer: "a" })).toEqual({ ok: false, reason: "not_found" });
  });

  test("a closed space refuses everything and keeps the data", async () => {
    const id = await currentId();
    await put(anna, id, { answer: "осталось" });
    await closeSpaceForUser(db, { userId: boris, now: NOW, reason: "left" });

    expect(await put(anna, id, { answer: "ещё" })).toEqual({ ok: false, reason: "not_found" });
    expect(await skip(anna, id)).toEqual({ ok: false, reason: "not_found" });
    expect(await deleteDraft(db, { userId: anna, cardId: id })).toEqual({ ok: false, reason: "not_found" });
    expect(await proceed(anna, id)).toEqual({ ok: false, reason: "not_found" });
    expect(await answerRow(id, anna)).toMatchObject([{ fields: { answer: "осталось" } }]);
  });
});

describe("deleteDraft", () => {
  test("removes an unrevealed answer, is idempotent and keeps the card open", async () => {
    const id = await currentId();
    await put(anna, id, { answer: "черновик" });

    expect(await deleteDraft(db, { userId: anna, cardId: id })).toEqual({ ok: true });
    expect(await deleteDraft(db, { userId: anna, cardId: id })).toEqual({ ok: true });
    expect(await answerRow(id, anna)).toEqual([]);
    expect(await put(boris, id, { answer: "Борис" })).toMatchObject({ ok: true, state: "waiting" });
  });

  test("a revealed answer cannot be deleted, a skipped card is closed", async () => {
    const id = await currentId();
    await reveal(id);
    expect(await deleteDraft(db, { userId: anna, cardId: id })).toEqual({ ok: false, reason: "already_revealed" });

    await proceed(anna, id);
    const next = await currentId();
    await skip(anna, next);
    expect(await deleteDraft(db, { userId: anna, cardId: next })).toEqual({ ok: false, reason: "already_closed" });
  });
});

describe("skipCard", () => {
  test("closes the card for both, opens the next one and lets the partner see the skip", async () => {
    const id = await currentId();

    expect(await skip(anna, id)).toEqual({ ok: true });

    expect(await cardRows()).toHaveLength(2);
    expect(await answerRow(id, anna)).toMatchObject([{ status: "skipped", fields: {} }]);
    expect((await viewOf(boris)).card).toMatchObject({ position: 1, state: "skipped", partner: { status: "skipped" } });
    expect((await viewOf(anna)).card).toMatchObject({ position: 2, state: "answer" });
  });

  test("skipping after my own answer wipes the text and marks the result as seen for me", async () => {
    const id = await currentId();
    await put(anna, id, { answer: "мой черновик" });

    await skip(anna, id);

    expect(await answerRow(id, anna)).toMatchObject([{ status: "skipped", fields: {} }]);
    const [mark] = await db.select().from(togetherCardMarks).where(and(eq(togetherCardMarks.cardId, id), eq(togetherCardMarks.userId, anna)));
    expect(mark?.seenAt).toEqual(NOW);
  });

  test("a skip while the partner has already answered never shows the partner's answer to the skipper", async () => {
    const id = await currentId();
    await put(boris, id, { answer: SECRET });

    await skip(anna, id);

    expect(await answerRow(id, boris)).toMatchObject([{ status: "submitted", fields: { answer: SECRET } }]);
    expect(JSON.stringify(await viewOf(anna))).not.toContain(SECRET);
    expect((await viewOf(boris)).card).toMatchObject({ position: 1, state: "skipped", mine: { fields: { answer: SECRET } }, partner: { status: "skipped" } });
  });

  test("a card that forbids skipping refuses it, a closed card cannot be skipped again", async () => {
    const strictTrack = [fixtureCard("strict-01", "intro", false), ...FIXTURE_TRACK];
    const strictId = (await viewOf(anna, strictTrack)).card!.id;
    expect(await skip(anna, strictId, strictTrack)).toEqual({ ok: false, reason: "skip_not_allowed" });
  });
});

describe("skipCard on a closed card", () => {
  test("is refused", async () => {
    const id = await currentId();
    await skip(anna, id);

    expect(await skip(boris, id)).toEqual({ ok: false, reason: "already_closed" });
  });
});

describe("continueCard", () => {
  test("marks the result as seen and 'done' only once the pair did the action; a skipped result cannot be done", async () => {
    const id = await currentId();
    await reveal(id);

    expect(await proceed(anna, id)).toEqual({ ok: true });
    expect(await proceed(anna, id, true)).toEqual({ ok: true });
    expect(await proceed(anna, id)).toEqual({ ok: true });
    const [mark] = await db.select().from(togetherCardMarks).where(and(eq(togetherCardMarks.cardId, id), eq(togetherCardMarks.userId, anna)));
    expect(mark).toMatchObject({ seenAt: NOW, doneAt: NOW });
    expect((await viewOf(boris)).card?.partner).toMatchObject({ done: true });

    const next = await currentId(anna);
    await skip(anna, next);
    expect(await proceed(boris, next, true)).toEqual({ ok: true });
    const [skippedMark] = await db.select().from(togetherCardMarks).where(and(eq(togetherCardMarks.cardId, next), eq(togetherCardMarks.userId, boris)));
    expect(skippedMark?.doneAt).toBeNull();
  });

  test("refuses an open card", async () => {
    const id = await currentId();

    expect(await proceed(anna, id)).toEqual({ ok: false, reason: "not_closed" });
  });
});

describe("the end of the track", () => {
  test("does not issue another card after the last one", async () => {
    const shortTrack = FIXTURE_TRACK.slice(0, 1);
    const id = (await viewOf(anna, shortTrack)).card!.id;
    await put(anna, id, { answer: "a" }, shortTrack);
    await put(boris, id, { answer: "b" }, shortTrack);

    expect(await cardRows()).toHaveLength(1);
    await proceed(anna, id);
    await proceed(boris, id);
    expect((await viewOf(anna, shortTrack)).card).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run packages/db/src/together-card-actions.test.ts`
Expected: FAIL — cannot resolve `./together-card-actions`.

- [ ] **Step 4: Implement the actions**

`packages/db/src/together-card-actions.ts`:

```ts
import { isDeepStrictEqual } from "node:util";
import { accessState, checkAnswerFields, type CardSnapshot } from "@grani/core";
import { and, eq, sql } from "drizzle-orm";
import { togetherAnswers, togetherCardMarks } from "./schema";
import {
  answerStatuses,
  buildCardView,
  closeCard,
  isRevealed,
  loadCard,
  pendingCardFor,
  readAnswer,
  resolveSpace,
  type CardRow,
  type CardView,
  type SpaceContext,
} from "./together-card-context";
import { getAccessSnapshot } from "./together-billing";
import type { Database } from "./types";

export type SubmitOutcome =
  | { ok: true; state: "waiting" | "revealed" | "edited"; revealed: CardView | null }
  | { ok: false; reason: "not_found" | "already_closed" | "reveal_pending" | "access_required" | "invalid_field" | "field_not_available"; field?: string };
type Failure<R extends string> = { ok: false; reason: R };

// Общая обвязка: пространство под блокировкой, затем карточка этого пространства; чужой или битый id — not_found
async function inCard<T extends { ok: boolean }>(
  db: Database,
  p: { userId: string; cardId: string },
  run: (tx: Database, context: SpaceContext, card: CardRow) => Promise<T>,
): Promise<T | Failure<"not_found">> {
  return db.transaction(async (tx): Promise<T | Failure<"not_found">> => {
    const context = await resolveSpace(tx, p.userId);
    if (!context) return { ok: false, reason: "not_found" };
    const card = await loadCard(tx, context.spaceId, p.cardId);
    return card ? run(tx, context, card) : { ok: false, reason: "not_found" };
  });
}

async function hasAccess(tx: Database, spaceId: string, now: Date): Promise<boolean> {
  const { periods, closedAt } = await getAccessSnapshot(tx, spaceId);
  return accessState(periods, now, closedAt).active;
}

export async function submitAnswer(
  db: Database,
  p: { userId: string; cardId: string; fields: unknown; track: readonly CardSnapshot[]; now: Date },
): Promise<SubmitOutcome> {
  return inCard<SubmitOutcome>(db, p, async (tx, context, card) => {
    const statuses = await answerStatuses(tx, card.id);
    const mine = statuses.get(p.userId);
    const revealed = isRevealed(statuses, p.userId, context.partnerId);

    if (card.closedAt !== null) {
      // Закрытая карточка: править можно только свой раскрытый ответ
      if (!revealed) return { ok: false, reason: "already_closed" };
      const check = checkAnswerFields(card.snapshot, p.fields, true);
      if (!check.ok) return { ok: false, reason: check.reason, field: check.field };
      const existing = await readAnswer(tx, card.id, p.userId);
      // Ревизия растёт только при настоящем изменении: иначе у партнёра появится ложная отметка «изменено»
      if (existing && !isDeepStrictEqual(existing.fields, check.fields)) {
        await tx
          .update(togetherAnswers)
          .set({ fields: check.fields, revision: sql`${togetherAnswers.revision} + 1`, updatedAt: p.now })
          .where(and(eq(togetherAnswers.cardId, card.id), eq(togetherAnswers.userId, p.userId)));
      }
      return { ok: true, state: "edited", revealed: null };
    }

    if (await pendingCardFor(tx, context.spaceId, p.userId)) return { ok: false, reason: "reveal_pending" };
    const check = checkAnswerFields(card.snapshot, p.fields, false);
    if (!check.ok) return { ok: false, reason: check.reason, field: check.field };
    // Платная карточка требует доступа только при первой отправке: правка уже отправленного не блокируется
    if (mine === undefined && card.snapshot.kind === "main" && !(await hasAccess(tx, context.spaceId, p.now))) return { ok: false, reason: "access_required" };

    if (mine === undefined) {
      await tx.insert(togetherAnswers).values({ cardId: card.id, spaceId: context.spaceId, userId: p.userId, status: "submitted", fields: check.fields, updatedAt: p.now });
    } else {
      await tx
        .update(togetherAnswers)
        .set({ fields: check.fields, updatedAt: p.now })
        .where(and(eq(togetherAnswers.cardId, card.id), eq(togetherAnswers.userId, p.userId)));
    }
    if (statuses.get(context.partnerId) !== "submitted") return { ok: true, state: "waiting", revealed: null };

    // Второй ответ раскрывает карточку: она закрывается, следующая выдаётся в той же транзакции
    await closeCard(tx, { card, track: p.track, now: p.now });
    const view = await buildCardView(tx, { card: { ...card, closedAt: p.now }, userId: p.userId, partnerId: context.partnerId, total: p.track.length });
    return { ok: true, state: "revealed", revealed: view };
  });
}

export async function deleteDraft(
  db: Database,
  p: { userId: string; cardId: string },
): Promise<{ ok: true } | Failure<"not_found" | "already_closed" | "already_revealed">> {
  return inCard<{ ok: true } | Failure<"already_closed" | "already_revealed">>(db, p, async (tx, context, card) => {
    if (card.closedAt !== null) {
      return { ok: false, reason: isRevealed(await answerStatuses(tx, card.id), p.userId, context.partnerId) ? "already_revealed" : "already_closed" };
    }
    await tx.delete(togetherAnswers).where(and(eq(togetherAnswers.cardId, card.id), eq(togetherAnswers.userId, p.userId), eq(togetherAnswers.status, "submitted")));
    return { ok: true };
  });
}

export async function skipCard(
  db: Database,
  p: { userId: string; cardId: string; track: readonly CardSnapshot[]; now: Date },
): Promise<{ ok: true } | Failure<"not_found" | "already_closed" | "reveal_pending" | "skip_not_allowed">> {
  return inCard<{ ok: true } | Failure<"already_closed" | "reveal_pending" | "skip_not_allowed">>(db, p, async (tx, context, card) => {
    if (card.closedAt !== null) return { ok: false, reason: "already_closed" };
    if (await pendingCardFor(tx, context.spaceId, p.userId)) return { ok: false, reason: "reveal_pending" };
    if (!card.snapshot.skipAllowed) return { ok: false, reason: "skip_not_allowed" };
    // Свой прежний ответ затирается: пропуск не оставляет текста; ответ партнёра не трогаем и не раскрываем
    await tx
      .insert(togetherAnswers)
      .values({ cardId: card.id, spaceId: context.spaceId, userId: p.userId, status: "skipped", fields: {}, updatedAt: p.now })
      .onConflictDoUpdate({ target: [togetherAnswers.cardId, togetherAnswers.userId], set: { status: "skipped", fields: {}, updatedAt: p.now } });
    await tx.insert(togetherCardMarks).values({ cardId: card.id, spaceId: context.spaceId, userId: p.userId, seenAt: p.now }).onConflictDoNothing();
    await closeCard(tx, { card, track: p.track, now: p.now });
    return { ok: true };
  });
}

// «Продолжить»: отметка просмотра итога; done добавляется, когда пара сделала действие, и только у раскрытой карточки
export async function continueCard(
  db: Database,
  p: { userId: string; cardId: string; done: boolean; now: Date },
): Promise<{ ok: true } | Failure<"not_found" | "not_closed">> {
  return inCard<{ ok: true } | Failure<"not_closed">>(db, p, async (tx, context, card) => {
    if (card.closedAt === null) return { ok: false, reason: "not_closed" };
    const revealed = isRevealed(await answerStatuses(tx, card.id), p.userId, context.partnerId);
    await tx
      .insert(togetherCardMarks)
      .values({ cardId: card.id, spaceId: context.spaceId, userId: p.userId, seenAt: p.now, doneAt: p.done && revealed ? p.now : null })
      .onConflictDoUpdate({
        target: [togetherCardMarks.cardId, togetherCardMarks.userId],
        set: { doneAt: sql`coalesce(${togetherCardMarks.doneAt}, excluded.done_at)` },
      });
    return { ok: true };
  });
}
```

В `packages/db/src/index.ts` добавить: `export * from "./together-card-actions";`

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run packages/db/src/together-card-actions.test.ts && pnpm --filter @grani/db typecheck`
Expected: PASS, typecheck чистый. Если `onConflictDoUpdate` ругается на `target` — проверить, что в схеме у `together_answers` и `together_card_marks` есть уникальные индексы по `(card_id, user_id)` (Task 4).

- [ ] **Step 6: Run the db suite**

Run: `pnpm vitest run packages/db`
Expected: все зелёные.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src
git commit -m "feat(db): together card answers, skip, draft delete and continue"
```

---

### Task 7: История, прогресс и удаление ответов при удалении аккаунта

**Files:**
- Modify: `packages/db/src/together-cards.ts` (`listHistory`, `deleteUserAnswers`)
- Modify: `packages/db/src/together-cards.test.ts` (тесты истории)
- Modify: `packages/db/src/delete-user.ts`
- Modify: `packages/db/src/delete-user.test.ts`

**Interfaces:**
- Consumes: всё из Task 5–6.
- Produces:
  - `type HistoryItem = { id: string; position: number; title: string; prompt: string; outcome: "revealed" | "skipped"; mine: { fields: AnswerFields; revision: number } | null; partner: { status: "none" | "answered" | "skipped"; fields?: AnswerFields; edited?: boolean } }`
  - `listHistory(db: Database, p: { userId: string; before?: number; limit?: number }): Promise<{ ok: true; items: HistoryItem[]; next: number | null } | { ok: false; reason: "not_found" }>` (по умолчанию 20, по убыванию позиции)
  - `deleteUserAnswers(tx: Database, userId: string): Promise<void>`

- [ ] **Step 1: Write the failing tests**

В `packages/db/src/together-cards.test.ts` изменить импорт на `import { listHistory, loadCurrentCard } from "./together-cards";` и добавить в конец:

```ts
describe("listHistory", () => {
  async function playTwoCards() {
    const first = await firstCardId();
    await answer(first, anna, "submitted", { answer: "Аня-1" });
    await answer(first, boris, "submitted", { answer: "Борис-1" });
    await close(first);
    await mark(first, anna);
    await current(anna);
    const second = (await db.select().from(togetherCards).where(eq(togetherCards.position, 2)))[0]!;
    await answer(second.id, anna, "skipped");
    await answer(second.id, boris, "submitted", { answer: SECRET });
    await close(second.id);
    return { first, second: second.id };
  }

  test("lists closed cards newest first with both answers only for revealed ones", async () => {
    const { first, second } = await playTwoCards();

    const result = await listHistory(db, { userId: anna });
    if (!result.ok) throw new Error("no space");
    expect(result.items.map((item) => [item.id, item.outcome])).toEqual([
      [second, "skipped"],
      [first, "revealed"],
    ]);
    expect(result.items[1]).toMatchObject({ mine: { fields: { answer: "Аня-1" } }, partner: { status: "answered", fields: { answer: "Борис-1" } } });
    expect(result.items[0]).toMatchObject({ mine: null, partner: { status: "answered" } });
    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect(result.next).toBeNull();
  });

  test("pages by position and refuses outsiders and closed spaces", async () => {
    await playTwoCards();

    const page = await listHistory(db, { userId: boris, limit: 1 });
    if (!page.ok) throw new Error("no space");
    expect(page.items.map((item) => item.position)).toEqual([2]);
    expect(page.next).toBe(2);
    const rest = await listHistory(db, { userId: boris, before: 2, limit: 1 });
    if (!rest.ok) throw new Error("no space");
    expect(rest.items.map((item) => item.position)).toEqual([1]);
    expect(rest.next).toBeNull();

    const vera = await seedUser(db, { externalId: "vera" });
    expect(await listHistory(db, { userId: vera })).toEqual({ ok: false, reason: "not_found" });
    await closeSpaceForUser(db, { userId: anna, now: NOW, reason: "left" });
    expect(await listHistory(db, { userId: boris })).toEqual({ ok: false, reason: "not_found" });
  });
});
```

В `packages/db/src/delete-user.test.ts` добавить в импорты `togetherAnswers, togetherCards` из `./schema` и тест внутри `describe("deleteUserData", …)`:

```ts
  it("erases the deleted user's together answers but keeps the partner's", async () => {
    const { spaceId, initiatorId, partnerId } = await seedTogetherSpace(db);
    const [card] = await db
      .insert(togetherCards)
      .values({ spaceId, cardId: "intro-01", position: 1, snapshot: { id: "intro-01", version: 1, kind: "intro", title: "T", estimatedMinutes: 5, prompt: "P", hint: "H", jointAction: "J", skipAllowed: true, fields: [] } })
      .returning({ id: togetherCards.id });
    await db.insert(togetherAnswers).values([
      { cardId: card!.id, spaceId, userId: initiatorId, status: "submitted", fields: { answer: "ушедшего" } },
      { cardId: card!.id, spaceId, userId: partnerId, status: "submitted", fields: { answer: "оставшегося" } },
    ]);

    await deleteUserData(db, initiatorId);

    const rows = await db.select().from(togetherAnswers);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: partnerId, fields: { answer: "оставшегося" } });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run packages/db/src/together-cards.test.ts packages/db/src/delete-user.test.ts`
Expected: FAIL — `listHistory` не экспортируется; ответ удалённого пользователя остаётся.

- [ ] **Step 3: Implement**

В `packages/db/src/together-cards.ts` добавить импорты и код:

```ts
import { and, desc, eq, isNotNull, lt } from "drizzle-orm";
import type { AnswerFields } from "@grani/core";
import { togetherAnswers, togetherCardMarks, togetherCards } from "./schema";
```
(объединить с существующими импортами; `buildCardView` и `resolveSpace` уже импортированы)

```ts
export type HistoryItem = {
  id: string;
  position: number;
  title: string;
  prompt: string;
  outcome: "revealed" | "skipped";
  mine: { fields: AnswerFields; revision: number } | null;
  partner: { status: "none" | "answered" | "skipped"; fields?: AnswerFields; edited?: boolean };
};

const HISTORY_PAGE = 20;

// Закрытые карточки пространства, новые первыми. Вид строится тем же buildCardView, поэтому ответ партнёра
// попадает сюда только у раскрытых карточек
export async function listHistory(
  db: Database,
  p: { userId: string; before?: number; limit?: number },
): Promise<{ ok: true; items: HistoryItem[]; next: number | null } | { ok: false; reason: "not_found" }> {
  const context = await resolveSpace(db, p.userId, { lock: false });
  if (!context) return { ok: false, reason: "not_found" };
  const limit = p.limit ?? HISTORY_PAGE;
  const rows = await db
    .select()
    .from(togetherCards)
    .where(and(eq(togetherCards.spaceId, context.spaceId), isNotNull(togetherCards.closedAt), p.before === undefined ? undefined : lt(togetherCards.position, p.before)))
    .orderBy(desc(togetherCards.position))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const items: HistoryItem[] = [];
  for (const row of page) {
    const view = await buildCardView(db, { card: row, userId: p.userId, partnerId: context.partnerId, total: 0 });
    items.push({
      id: view.id,
      position: view.position,
      title: view.snapshot.title,
      prompt: view.snapshot.prompt,
      outcome: view.state === "revealed" ? "revealed" : "skipped",
      mine: view.mine ? { fields: view.mine.fields, revision: view.mine.revision } : null,
      partner: view.partner,
    });
  }
  return { ok: true, items, next: rows.length > limit ? (page.at(-1)?.position ?? null) : null };
}

// Удаление аккаунта: стираются только ответы и отметки этого человека, ответы партнёра остаются у него
export async function deleteUserAnswers(tx: Database, userId: string): Promise<void> {
  await tx.delete(togetherCardMarks).where(eq(togetherCardMarks.userId, userId));
  await tx.delete(togetherAnswers).where(eq(togetherAnswers.userId, userId));
}
```

В `packages/db/src/delete-user.ts` добавить `import { deleteUserAnswers } from "./together-cards";` и после вызова `closeSpaceForUser(...)` строку:

```ts
    // Пользователь помечается удалённым, а не удаляется, поэтому каскад ответов не сработает сам
    await deleteUserAnswers(tx, userId);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run packages/db && pnpm --filter @grani/db typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src
git commit -m "feat(db): together card history and answer erasure on account deletion"
```

---

### Task 8: Сервис в web и прогресс в виде пространства

**Files:**
- Create: `apps/web/src/server/together-cards-service.ts`
- Create: `apps/web/src/server/together-cards-service.test.ts`
- Modify: `apps/web/src/server/together-service.ts` (`progress` в `TogetherSpaceView`)
- Modify: `apps/web/src/server/together-service.test.ts`

**Interfaces:**
- Consumes: `TOGETHER_TRACK` из `@grani/content/together`; `loadCurrentCard`, `submitAnswer`, `deleteDraft`, `skipCard`, `continueCard`, `listHistory`, `countClosedCards`, `CardView`, `HistoryItem` из `@grani/db`; `TogetherDeps` из `./together-service`.
- Produces:
  - `type CardResponse = { id: string; position: number; kind: "intro" | "main"; title: string; prompt: string; hint: string; estimatedMinutes: number; jointAction: string; fields: CardField[]; state: CardState; locked: boolean; mine: CardView["mine"]; partner: CardView["partner"] }`
  - `getCurrentTogetherCard(deps, userId): Promise<{ ok: true; card: CardResponse | null; progress: { done: number; total: number } } | { ok: false; error: "not_found" }>`
  - `answerTogetherCard(deps, p: { userId; cardId; fields: unknown }): Promise<{ ok: true; state: "waiting" | "revealed" | "edited"; revealed: { card: CardResponse } | null } | { ok: false; error: "not_found" | "already_closed" | "reveal_pending" | "access_required" | "invalid_field" | "field_not_available" }>`
  - `deleteTogetherDraft(deps, p: { userId; cardId }): Promise<{ ok: true } | { ok: false; error: "not_found" | "already_closed" | "already_revealed" }>`
  - `skipTogetherCard(deps, p: { userId; cardId }): Promise<{ ok: true } | { ok: false; error: "not_found" | "already_closed" | "reveal_pending" | "skip_not_allowed" }>`
  - `continueTogetherCard(deps, p: { userId; cardId; done: unknown }): Promise<{ ok: true } | { ok: false; error: "invalid" | "not_found" | "not_closed" }>`
  - `getTogetherHistory(deps, p: { userId; before: unknown }): Promise<{ ok: true; items: HistoryItem[]; next: number | null } | { ok: false; error: "invalid" | "not_found" }>`
  - `TogetherSpaceView.progress: { done: number; total: number }`

- [ ] **Step 1: Write the failing test**

`apps/web/src/server/together-cards-service.test.ts`:

```ts
import { createTestDb, seedTogetherAccess, seedTogetherSpace, type Database } from "@grani/db/testing";
import { beforeEach, describe, expect, test } from "vitest";
import {
  answerTogetherCard,
  continueTogetherCard,
  deleteTogetherDraft,
  getCurrentTogetherCard,
  getTogetherHistory,
  skipTogetherCard,
} from "./together-cards-service";
import { getTogetherSpaceView, type TogetherDeps } from "./together-service";

const START = new Date("2026-10-05T10:00:00Z");

let db: Database;
let deps: TogetherDeps;
let spaceId: string;
let anna: string;
let boris: string;

async function current(userId: string) {
  const result = await getCurrentTogetherCard(deps, userId);
  if (!result.ok) throw new Error(result.error);
  return result;
}

async function cardId(userId = anna): Promise<string> {
  const { card } = await current(userId);
  if (!card) throw new Error("no card");
  return card.id;
}

// Проходит одну карточку: оба отвечают, оба нажимают «Продолжить»
async function playCard() {
  const id = await cardId();
  await answerTogetherCard(deps, { userId: anna, cardId: id, fields: { answer: "Аня" } });
  await answerTogetherCard(deps, { userId: boris, cardId: id, fields: { answer: "Борис" } });
  await continueTogetherCard(deps, { userId: anna, cardId: id, done: false });
  await continueTogetherCard(deps, { userId: boris, cardId: id, done: false });
}

beforeEach(async () => {
  db = await createTestDb();
  deps = { db, now: () => START, appUrl: "http://localhost:3000" };
  ({ spaceId, initiatorId: anna, partnerId: boris } = await seedTogetherSpace(db, { now: START }));
});

describe("getCurrentTogetherCard", () => {
  test("starts with the first free intro card and a 29-card track", async () => {
    const result = await current(anna);

    expect(result.progress).toEqual({ done: 0, total: 29 });
    expect(result.card).toMatchObject({ position: 1, kind: "intro", state: "answer", locked: false, mine: null, partner: { status: "none" } });
    expect(result.card?.title).toBe("Замечать хорошее");
    expect(result.card?.fields.map((field) => field.id)).toEqual(["answer", "share_in_book"]);
  });

  test("locks the first paid card until access is paid, then lets the pair answer", async () => {
    for (let i = 0; i < 3; i++) await playCard();

    const locked = await current(anna);
    expect(locked.card).toMatchObject({ position: 4, kind: "main", state: "answer", locked: true });
    expect(await answerTogetherCard(deps, { userId: anna, cardId: locked.card!.id, fields: { answer: "платная" } })).toEqual({ ok: false, error: "access_required" });

    await seedTogetherAccess(db, { spaceId, userId: anna, paidAt: START });
    expect((await current(anna)).card?.locked).toBe(false);
    expect(await answerTogetherCard(deps, { userId: anna, cardId: locked.card!.id, fields: { answer: "платная" } })).toMatchObject({ ok: true, state: "waiting" });
  });

  test("a person outside a space gets not_found", async () => {
    const result = await getCurrentTogetherCard(deps, "00000000-0000-4000-8000-000000000000");

    expect(result).toEqual({ ok: false, error: "not_found" });
  });
});

describe("answers, drafts and skips", () => {
  test("maps the reveal to an API card for the one who completes it", async () => {
    const id = await cardId();
    await answerTogetherCard(deps, { userId: anna, cardId: id, fields: { answer: "Аня" } });

    const outcome = await answerTogetherCard(deps, { userId: boris, cardId: id, fields: { answer: "Борис" } });

    expect(outcome).toMatchObject({ ok: true, state: "revealed", revealed: { card: { state: "revealed", mine: { fields: { answer: "Борис" } }, partner: { fields: { answer: "Аня" } }, locked: false } } });
  });

  test("passes errors through as stable codes", async () => {
    const id = await cardId();

    expect(await answerTogetherCard(deps, { userId: anna, cardId: id, fields: { answer: "" } })).toEqual({ ok: false, error: "invalid_field" });
    expect(await answerTogetherCard(deps, { userId: anna, cardId: id, fields: { answer: "ок", share_in_book: true } })).toEqual({ ok: false, error: "field_not_available" });
    await answerTogetherCard(deps, { userId: anna, cardId: id, fields: { answer: "черновик" } });
    expect(await deleteTogetherDraft(deps, { userId: anna, cardId: id })).toEqual({ ok: true });
    expect(await skipTogetherCard(deps, { userId: anna, cardId: id })).toEqual({ ok: true });
    expect(await skipTogetherCard(deps, { userId: boris, cardId: id })).toEqual({ ok: false, error: "already_closed" });
  });

  test("validates the 'done' flag of continue", async () => {
    const id = await cardId();
    await skipTogetherCard(deps, { userId: anna, cardId: id });

    expect(await continueTogetherCard(deps, { userId: boris, cardId: id, done: "yes" })).toEqual({ ok: false, error: "invalid" });
    expect(await continueTogetherCard(deps, { userId: boris, cardId: id, done: undefined })).toEqual({ ok: true });
  });
});

describe("getTogetherHistory", () => {
  test("lists played cards and validates the cursor", async () => {
    await playCard();

    const history = await getTogetherHistory(deps, { userId: anna, before: undefined });
    expect(history).toMatchObject({ ok: true, items: [{ position: 1, outcome: "revealed", title: "Замечать хорошее" }], next: null });
    expect(await getTogetherHistory(deps, { userId: anna, before: "abc" })).toEqual({ ok: false, error: "invalid" });
    expect(await getTogetherHistory(deps, { userId: anna, before: "0" })).toEqual({ ok: false, error: "invalid" });
    expect(await getTogetherHistory(deps, { userId: anna, before: "2" })).toMatchObject({ ok: true });
  });
});

describe("space view progress", () => {
  test("reports how many cards the pair has completed", async () => {
    expect((await getTogetherSpaceView(deps, anna))?.progress).toEqual({ done: 0, total: 29 });

    await playCard();

    expect((await getTogetherSpaceView(deps, boris))?.progress).toEqual({ done: 1, total: 29 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run apps/web/src/server/together-cards-service.test.ts`
Expected: FAIL — cannot resolve `./together-cards-service`.

- [ ] **Step 3: Implement the service**

`apps/web/src/server/together-cards-service.ts`:

```ts
import { TOGETHER_TRACK } from "@grani/content/together";
import type { CardField } from "@grani/core";
import {
  continueCard,
  deleteDraft,
  listHistory,
  loadCurrentCard,
  skipCard,
  submitAnswer,
  type CardState,
  type CardView,
  type HistoryItem,
} from "@grani/db";
import type { TogetherDeps } from "./together-service";

export type CardResponse = {
  id: string;
  position: number;
  kind: "intro" | "main";
  title: string;
  prompt: string;
  hint: string;
  estimatedMinutes: number;
  jointAction: string;
  fields: CardField[];
  state: CardState;
  locked: boolean;
  mine: CardView["mine"];
  partner: CardView["partner"];
};

// Платная карточка закрыта, пока человек ещё не ответил, а доступа нет; уже отвеченное остаётся доступным
function toCardResponse(view: CardView, accessActive: boolean): CardResponse {
  return {
    id: view.id,
    position: view.position,
    kind: view.snapshot.kind,
    title: view.snapshot.title,
    prompt: view.snapshot.prompt,
    hint: view.snapshot.hint,
    estimatedMinutes: view.snapshot.estimatedMinutes,
    jointAction: view.snapshot.jointAction,
    fields: view.snapshot.fields,
    state: view.state,
    locked: view.snapshot.kind === "main" && view.state === "answer" && !accessActive,
    mine: view.mine,
    partner: view.partner,
  };
}

export async function getCurrentTogetherCard(
  deps: TogetherDeps,
  userId: string,
): Promise<{ ok: true; card: CardResponse | null; progress: { done: number; total: number } } | { ok: false; error: "not_found" }> {
  const result = await loadCurrentCard(deps.db, { userId, track: TOGETHER_TRACK, now: deps.now() });
  if (!result.ok) return { ok: false, error: "not_found" };
  return { ok: true, card: result.card ? toCardResponse(result.card, result.accessActive) : null, progress: result.progress };
}

export async function answerTogetherCard(
  deps: TogetherDeps,
  p: { userId: string; cardId: string; fields: unknown },
): Promise<
  | { ok: true; state: "waiting" | "revealed" | "edited"; revealed: { card: CardResponse } | null }
  | { ok: false; error: "not_found" | "already_closed" | "reveal_pending" | "access_required" | "invalid_field" | "field_not_available" }
> {
  const outcome = await submitAnswer(deps.db, { userId: p.userId, cardId: p.cardId, fields: p.fields, track: TOGETHER_TRACK, now: deps.now() });
  if (!outcome.ok) return { ok: false, error: outcome.reason };
  return { ok: true, state: outcome.state, revealed: outcome.revealed ? { card: toCardResponse(outcome.revealed, true) } : null };
}

export async function deleteTogetherDraft(
  deps: TogetherDeps,
  p: { userId: string; cardId: string },
): Promise<{ ok: true } | { ok: false; error: "not_found" | "already_closed" | "already_revealed" }> {
  const outcome = await deleteDraft(deps.db, p);
  return outcome.ok ? outcome : { ok: false, error: outcome.reason };
}

export async function skipTogetherCard(
  deps: TogetherDeps,
  p: { userId: string; cardId: string },
): Promise<{ ok: true } | { ok: false; error: "not_found" | "already_closed" | "reveal_pending" | "skip_not_allowed" }> {
  const outcome = await skipCard(deps.db, { userId: p.userId, cardId: p.cardId, track: TOGETHER_TRACK, now: deps.now() });
  return outcome.ok ? outcome : { ok: false, error: outcome.reason };
}

export async function continueTogetherCard(
  deps: TogetherDeps,
  p: { userId: string; cardId: string; done: unknown },
): Promise<{ ok: true } | { ok: false; error: "invalid" | "not_found" | "not_closed" }> {
  if (p.done !== undefined && typeof p.done !== "boolean") return { ok: false, error: "invalid" };
  const outcome = await continueCard(deps.db, { userId: p.userId, cardId: p.cardId, done: p.done === true, now: deps.now() });
  return outcome.ok ? outcome : { ok: false, error: outcome.reason };
}

export async function getTogetherHistory(
  deps: TogetherDeps,
  p: { userId: string; before: unknown },
): Promise<{ ok: true; items: HistoryItem[]; next: number | null } | { ok: false; error: "invalid" | "not_found" }> {
  let before: number | undefined;
  if (p.before !== undefined && p.before !== null) {
    const parsed = typeof p.before === "string" && /^\d{1,6}$/.test(p.before) ? Number(p.before) : NaN;
    if (!Number.isInteger(parsed) || parsed < 1) return { ok: false, error: "invalid" };
    before = parsed;
  }
  const outcome = await listHistory(deps.db, { userId: p.userId, before });
  return outcome.ok ? outcome : { ok: false, error: outcome.reason };
}
```

- [ ] **Step 4: Add `progress` to the space view**

В `apps/web/src/server/together-service.ts`: добавить `countClosedCards` в импорт из `@grani/db`, `import { TOGETHER_TRACK } from "@grani/content/together";`, в тип `TogetherSpaceView` поле `progress: { done: number; total: number };` и в возвращаемый объект `getTogetherSpaceView`:

```ts
    progress: { done: await countClosedCards(deps.db, snapshot.space.id), total: TOGETHER_TRACK.length },
```

В `apps/web/src/server/together-service.test.ts` в `describe("getTogetherSpaceView")` добавить:

```ts
  test("reports zero progress for a pair that has not started", async () => {
    await makeActive();

    expect((await getTogetherSpaceView(deps, anna))?.progress).toEqual({ done: 0, total: 29 });
  });
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm vitest run apps/web/src/server && pnpm --filter @grani/web typecheck`
Expected: PASS, typecheck чистый. Если web не видит `@grani/content/together`, проверить зависимость `@grani/content` в `apps/web/package.json` (она уже используется) и экспорт из Task 3.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/server
git commit -m "feat(web): together cards service and progress in the space view"
```

---

### Task 9: HTTP-маршруты карточек

**Files:**
- Modify: `apps/web/src/server/together-route.ts` (`cardErrorStatus`)
- Modify: `apps/web/src/server/together-route.test.ts`
- Create: `apps/web/src/app/api/together/cards/current/route.ts`
- Create: `apps/web/src/app/api/together/cards/[id]/answer/route.ts`
- Create: `apps/web/src/app/api/together/cards/[id]/skip/route.ts`
- Create: `apps/web/src/app/api/together/cards/[id]/continue/route.ts`
- Create: `apps/web/src/app/api/together/history/route.ts`

**Interfaces:**
- Consumes: сервис Task 8; `authorizeTogether`, `failure`, `readJsonObject` из `@/server/together-route`; `togetherLimiter` из `@/server/rate-limit`.
- Produces: `cardErrorStatus(error: string): number` — 404 для `not_found`; 400 для `invalid`, `invalid_field`, `field_not_available`; 409 для остальных кодов.

Перед правкой прочитать `apps/web/AGENTS.md` и открыть образцы: `apps/web/src/app/api/together/purchases/[id]/route.ts` (динамический параметр) и `apps/web/src/app/api/together/leave/route.ts` (изменяющий маршрут).

- [ ] **Step 1: Write the failing test**

В `apps/web/src/server/together-route.test.ts` добавить `cardErrorStatus` в импорт из `./together-route` и в конец файла:

```ts
describe("cardErrorStatus", () => {
  test("maps card errors to stable HTTP statuses", () => {
    expect(cardErrorStatus("not_found")).toBe(404);
    for (const error of ["invalid", "invalid_field", "field_not_available"]) expect(cardErrorStatus(error)).toBe(400);
    for (const error of ["already_closed", "already_revealed", "reveal_pending", "access_required", "skip_not_allowed", "not_closed"]) {
      expect(cardErrorStatus(error)).toBe(409);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run apps/web/src/server/together-route.test.ts`
Expected: FAIL — `cardErrorStatus` не экспортируется.

- [ ] **Step 3: Implement `cardErrorStatus`**

В `apps/web/src/server/together-route.ts` добавить после `failure`:

```ts
// Один набор кодов ошибок карточек для всех маршрутов: нет доступа к карточке — 404, неверный ввод — 400, конфликт состояния — 409
export const cardErrorStatus = (error: string): number => (error === "not_found" ? 404 : error === "invalid" || error === "invalid_field" || error === "field_not_available" ? 400 : 409);
```

- [ ] **Step 4: Write the routes**

`apps/web/src/app/api/together/cards/current/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { authorizeTogether, cardErrorStatus, failure } from "@/server/together-route";
import { getCurrentTogetherCard } from "@/server/together-cards-service";

export async function GET(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: false });
  if (context instanceof NextResponse) return context;
  const outcome = await getCurrentTogetherCard(context.deps, context.user.id);
  if (!outcome.ok) return failure(outcome.error, cardErrorStatus(outcome.error));
  return NextResponse.json({ ok: true, card: outcome.card, progress: outcome.progress }, { headers: { "cache-control": "no-store" } });
}
```

`apps/web/src/app/api/together/cards/[id]/answer/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { togetherLimiter } from "@/server/rate-limit";
import { authorizeTogether, cardErrorStatus, failure, readJsonObject } from "@/server/together-route";
import { answerTogetherCard, deleteTogetherDraft } from "@/server/together-cards-service";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await authorizeTogether(request, { mutating: true, limiter: togetherLimiter });
  if (context instanceof NextResponse) return context;
  const { id } = await params;
  const { fields } = await readJsonObject(request);
  const outcome = await answerTogetherCard(context.deps, { userId: context.user.id, cardId: id, fields });
  if (!outcome.ok) return failure(outcome.error, cardErrorStatus(outcome.error));
  return NextResponse.json(outcome);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await authorizeTogether(request, { mutating: true, limiter: togetherLimiter });
  if (context instanceof NextResponse) return context;
  const { id } = await params;
  const outcome = await deleteTogetherDraft(context.deps, { userId: context.user.id, cardId: id });
  return outcome.ok ? NextResponse.json(outcome) : failure(outcome.error, cardErrorStatus(outcome.error));
}
```

`apps/web/src/app/api/together/cards/[id]/skip/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { togetherLimiter } from "@/server/rate-limit";
import { authorizeTogether, cardErrorStatus, failure } from "@/server/together-route";
import { skipTogetherCard } from "@/server/together-cards-service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await authorizeTogether(request, { mutating: true, limiter: togetherLimiter });
  if (context instanceof NextResponse) return context;
  const { id } = await params;
  const outcome = await skipTogetherCard(context.deps, { userId: context.user.id, cardId: id });
  return outcome.ok ? NextResponse.json(outcome) : failure(outcome.error, cardErrorStatus(outcome.error));
}
```

`apps/web/src/app/api/together/cards/[id]/continue/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { togetherLimiter } from "@/server/rate-limit";
import { authorizeTogether, cardErrorStatus, failure, readJsonObject } from "@/server/together-route";
import { continueTogetherCard } from "@/server/together-cards-service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await authorizeTogether(request, { mutating: true, limiter: togetherLimiter });
  if (context instanceof NextResponse) return context;
  const { id } = await params;
  const { done } = await readJsonObject(request);
  const outcome = await continueTogetherCard(context.deps, { userId: context.user.id, cardId: id, done });
  return outcome.ok ? NextResponse.json(outcome) : failure(outcome.error, cardErrorStatus(outcome.error));
}
```

`apps/web/src/app/api/together/history/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { authorizeTogether, cardErrorStatus, failure } from "@/server/together-route";
import { getTogetherHistory } from "@/server/together-cards-service";

export async function GET(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: false });
  if (context instanceof NextResponse) return context;
  const outcome = await getTogetherHistory(context.deps, { userId: context.user.id, before: request.nextUrl.searchParams.get("before") ?? undefined });
  if (!outcome.ok) return failure(outcome.error, cardErrorStatus(outcome.error));
  return NextResponse.json({ ok: true, items: outcome.items, next: outcome.next }, { headers: { "cache-control": "no-store" } });
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm vitest run apps/web/src/server/together-route.test.ts && pnpm --filter @grani/web typecheck`
Expected: PASS, typecheck чистый (динамические маршруты проверяются типами Next).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): together cards, history and progress API routes"
```

---

### Task 10: Сквозной сценарий двух аккаунтов

**Files:**
- Create: `e2e/together-cards.spec.ts`

**Interfaces:**
- Consumes: маршруты Task 9, `/api/dev/login`, существующие маршруты этапа 0 (создание пространства, запрос, подтверждение); `BASE_URL`, `uniqueName` из `e2e/helpers`.
- Produces: e2e-сценарий.

- [ ] **Step 1: Write the scenario**

`e2e/together-cards.spec.ts`:

```ts
import { expect, test, type APIResponse, type Browser, type Page } from "@playwright/test";
import { BASE_URL, uniqueName } from "./helpers";

const origin = { origin: BASE_URL };

async function signedIn(browser: Browser, name: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`/api/dev/login?name=${encodeURIComponent(name)}`);
  return page;
}

const post = (page: Page, url: string, data?: unknown) => page.request.post(url, { data, headers: origin });
const put = (page: Page, url: string, data: unknown) => page.request.put(url, { data, headers: origin });

type CardJson = { id: string; position: number; state: string; mine: { fields: Record<string, unknown> } | null; partner: { status: string; fields?: Record<string, unknown> } };
type Current = { ok: boolean; card: CardJson | null; progress: { done: number; total: number } };

async function json<T>(response: APIResponse): Promise<T> {
  return (await response.json()) as T;
}

test("two accounts play the first free cards: hidden until both answer, reveal, skip, continue", async ({ browser }) => {
  test.setTimeout(120_000);
  const anna = await signedIn(browser, uniqueName("Аня"));
  const boris = await signedIn(browser, uniqueName("Борис"));
  const vera = await signedIn(browser, uniqueName("Вера"));

  // Пространство из двух человек
  const created = await json<{ inviteUrl: string }>(await post(anna, "/api/together/spaces"));
  const token = created.inviteUrl.split("/").at(-1)!;
  expect((await post(boris, "/api/together/invite/request", { token })).status()).toBe(200);
  expect((await post(anna, "/api/together/invite/confirm", { accept: true })).status()).toBe(200);

  // Без входа и вне пространства карточек нет
  expect((await anna.request.get("/api/together/cards/current")).status()).toBe(200);
  expect((await vera.request.get("/api/together/cards/current")).status()).toBe(404);

  const first = await json<Current>(await anna.request.get("/api/together/cards/current"));
  expect(first.progress).toEqual({ done: 0, total: 29 });
  expect(first.card).toMatchObject({ position: 1, state: "answer" });
  const id = first.card!.id;

  // Ответ Ани не виден Борису до его собственного ответа
  const secret = `тайна-${Date.now()}`;
  expect((await put(anna, `/api/together/cards/${id}/answer`, { fields: { answer: secret } })).status()).toBe(200);
  const borisBefore = await boris.request.get("/api/together/cards/current");
  expect(await borisBefore.text()).not.toContain(secret);
  expect((await json<Current>(borisBefore)).card?.partner).toEqual({ status: "answered" });

  // Чужой человек и проверки входа
  expect((await put(vera, `/api/together/cards/${id}/answer`, { fields: { answer: "я чужая" } })).status()).toBe(404);
  expect((await anna.request.put(`/api/together/cards/${id}/answer`, { data: { fields: { answer: "без origin" } } })).status()).toBe(403);
  expect((await put(boris, `/api/together/cards/${id}/answer`, { fields: { answer: "" } })).status()).toBe(400);
  expect((await put(boris, `/api/together/cards/${id}/answer`, { fields: { answer: "ок", share_in_book: false } })).status()).toBe(400);

  // Второй ответ раскрывает карточку
  const revealed = await json<{ ok: boolean; state: string; revealed: { card: CardJson } }>(await put(boris, `/api/together/cards/${id}/answer`, { fields: { answer: "Борис ответил" } }));
  expect(revealed.state).toBe("revealed");
  expect(revealed.revealed.card.partner.fields).toEqual({ answer: secret });

  // Аня, ждавшая, видит раскрытие, а не следующую карточку; пока не нажмёт «Продолжить», отвечать дальше нельзя
  const annaReveal = await json<Current>(await anna.request.get("/api/together/cards/current"));
  expect(annaReveal.card).toMatchObject({ position: 1, state: "revealed", partner: { fields: { answer: "Борис ответил" } } });
  expect(annaReveal.progress.done).toBe(1);
  const nextId = (await json<Current>(await boris.request.get("/api/together/cards/current"))).card!.id;
  expect((await post(boris, `/api/together/cards/${id}/continue`, { done: "yes" })).status()).toBe(400);
  expect((await post(boris, `/api/together/cards/${id}/continue`, { done: true })).status()).toBe(200);
  expect((await post(anna, `/api/together/cards/${id}/continue`, {})).status()).toBe(200);

  // Борис пропускает вторую карточку: Аня видит «пропущено», текст не раскрывается
  const second = await json<Current>(await anna.request.get("/api/together/cards/current"));
  expect(second.card).toMatchObject({ position: 2, state: "answer" });
  expect(second.card!.id).toBe(nextId);
  expect((await put(anna, `/api/together/cards/${nextId}/answer`, { fields: { answer: "Мой второй" } })).status()).toBe(200);
  expect((await post(boris, `/api/together/cards/${nextId}/skip`)).status()).toBe(200);
  const skipped = await anna.request.get("/api/together/cards/current");
  expect((await json<Current>(skipped)).card).toMatchObject({ position: 2, state: "skipped", partner: { status: "skipped" } });
  expect((await post(anna, `/api/together/cards/${nextId}/skip`)).status()).toBe(409);
  expect((await post(anna, `/api/together/cards/${nextId}/continue`, {})).status()).toBe(200);

  // История и прогресс
  const history = await json<{ items: { position: number; outcome: string }[] }>(await anna.request.get("/api/together/history"));
  expect(history.items.map((item) => [item.position, item.outcome])).toEqual([
    [2, "skipped"],
    [1, "revealed"],
  ]);
  expect((await anna.request.get("/api/together/history?before=abc")).status()).toBe(400);
  const space = await json<{ space: { progress: { done: number; total: number } } }>(await anna.request.get("/api/together/space"));
  expect(space.space.progress).toEqual({ done: 2, total: 29 });

  // После выхода карточки закрыты для обоих
  expect((await post(boris, "/api/together/leave", { acknowledged: true })).status()).toBe(200);
  expect((await anna.request.get("/api/together/cards/current")).status()).toBe(404);
  expect((await boris.request.get("/api/together/history")).status()).toBe(404);
});
```

- [ ] **Step 2: Run the scenario**

Запустить локальные сервисы (в отдельных терминалах/фоном): `pnpm dev:db`, затем `pnpm dev:web` и `pnpm dev:worker` (веб-сервер без `OWNER_IDENTITY` достаточен). Затем:

Run: `pnpm test:e2e e2e/together-cards.spec.ts`
Expected: PASS (1 test). Любой сбой — разобраться по ответу маршрута; не ослаблять проверки. После прогона остановить сервисы.

- [ ] **Step 3: Commit**

```bash
git add e2e/together-cards.spec.ts
git commit -m "test(e2e): two accounts play together cards through the API"
```

---

### Task 11: Документы и итоговая проверка

**Files:**
- Modify: `docs/together/CLAUDE_HANDOFF.md`

**Interfaces:**
- Consumes: готовый код этапа 2.
- Produces: запись этапа 2 в `CLAUDE_HANDOFF.md`.

- [ ] **Step 1: Full verification**

Run: `pnpm typecheck && pnpm test`
Expected: типы чистые, все тесты зелёные (было 702 + новые). Записать фактическое число тестов для документа.

Run: `pnpm test:coverage` (если занимает разумное время) — зафиксировать итоговое покрытие.

- [ ] **Step 2: Append the stage 2 record**

В конец `docs/together/CLAUDE_HANDOFF.md` добавить раздел (подставить фактические значения проверок и хеш коммита):

```markdown

## Этап 2: карточки, ответы, раскрытие — Claude · 2026-10-06
Ветка `feat/together-stage2` (от `feat/together-stage1`). Спецификация: [../superpowers/specs/2026-10-06-together-cards-design.md](../superpowers/specs/2026-10-06-together-cards-design.md), план: [../superpowers/plans/2026-10-06-together-cards.md](../superpowers/plans/2026-10-06-together-cards.md).

**Что сделано (код подготовлен).** Маршрут из 29 карточек (3 вводные бесплатные + `m01-d01…d26`), ответы с раскрытием только после ответа обоих, пропуск, правка раскрытого ответа, отметки «Продолжить» и «сделали вместе», история, прогресс. Каталог для сервера — `packages/content/src/together/` (копия `docs/together/content/month-01.json` плюс `intro.json`); файлы в `docs/together/content/` остаются редакционным снимком, актуальным считается пакет.

**Контракт для экранов.**
`GET /api/together/cards/current` → `{ ok, card | null, progress: { done, total } }`; `card`: `id, position, kind, title, prompt, hint, estimatedMinutes, jointAction, fields[], state ("answer" | "waiting" | "revealed" | "skipped"), locked, mine { fields, revision, done } | null, partner { status ("none" | "answered" | "skipped"), fields?, edited?, done? }`.
`revealed` и `skipped` — итог закрытой карточки, он показывается, пока человек не нажмёт «Продолжить» (`POST …/continue`); отвечать на следующую до этого нельзя (409 `reveal_pending`).
`PUT /api/together/cards/[id]/answer` `{ fields }` → `{ ok, state ("waiting" | "revealed" | "edited"), revealed: { card } | null }`; `DELETE` того же пути — черновик до раскрытия; `POST …/skip`; `POST …/continue` `{ done?: boolean }`; `GET /api/together/history?before=<position>` → `{ ok, items[], next }`; `GET /api/together/space` дополнен `progress`.
Поля с `availableAt: "after_reveal"` (например `share_in_book`) до раскрытия присылать нельзя, даже `false`: 400 `field_not_available`. Коды ошибок: 400 `invalid_field`, `field_not_available`, `invalid`; 404 нейтральный; 409 `already_closed`, `already_revealed`, `reveal_pending`, `access_required`, `skip_not_allowed`, `not_closed`; 429.
Платные карточки (`kind: "main"`): `locked: true`, пока человек не ответил, а доступа нет. Вводные доступны без оплаты.

**Проверено 2026-10-06:** (подставить: `pnpm typecheck`; `pnpm test` — число тестов; e2e `together-cards.spec.ts`). PR, слияние и деплой не выполнялись.

**Ограничения.** Нет экранов карточек (Codex), запасных карточек, свиданий, месяцев 2–3, игровых форматов, карточек `m01-d27`/`m01-d28` (этап 4 вместе с карточкой заботы), книги, наград и уведомлений. После выхода данные сохраняются, но никому не показываются; экран «мои ответы» и выгрузка — этап 4. Гонки проверены порядком блокировок и ограничениями БД, а не параллельными соединениями (PGlite однопоточный). Тексты карточек и трёх вводных — редакционный черновик, нужно утверждение владельца до выхода в master.
Следующая задача: экраны карточек (Codex рисует, Claude подключает), затем этап 3 (игровые форматы).
```

- [ ] **Step 3: Commit**

```bash
git add docs/together/CLAUDE_HANDOFF.md
git commit -m "docs(together): stage 2 record and cards API contract"
```
