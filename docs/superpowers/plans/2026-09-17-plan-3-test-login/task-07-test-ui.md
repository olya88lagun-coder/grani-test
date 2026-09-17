# Task 7: Первый экран и страница теста

**Files:**
- Create: `apps/web/src/lib/test-progress.ts`, `apps/web/src/app/page.tsx`, `apps/web/src/app/test/page.tsx`, `apps/web/src/app/test/TestRunner.tsx`
- Test: `apps/web/src/lib/test-progress.test.ts`

**Interfaces:**
- Consumes: `SELF_ITEMS`, `SelfItem` (`@grani/content`); `Answer`, `Answers` (`@grani/core`); `POST /api/results` (Task 5) — ответ `{ ok: true, redirect }` или `{ ok: false, error }`; CSS-классы Task 3.
- Produces:
  ```ts
  const PAGE_SIZE = 5;
  const STORAGE_KEY = "grani:answers:v1";
  const ANSWER_LABELS: Readonly<Record<Answer, string>>;
  function pageCount(total: number): number;
  function pageItems<T>(items: readonly T[], page: number): readonly T[];
  function answeredCount(items: readonly { id: string }[], answers: Answers): number;
  function isPageComplete(items: readonly { id: string }[], answers: Answers, page: number): boolean;
  function firstIncompletePage(items: readonly { id: string }[], answers: Answers): number; // все отвечены — последняя страница
  function isComplete(items: readonly { id: string }[], answers: Answers): boolean;
  function withAnswer(answers: Answers, id: string, value: Answer): Answers; // новый объект
  function parseStoredProgress(raw: string | null, items: readonly { id: string }[]): Answers; // мусор → {}
  ```

Вопросы показываются по 5 на экран — 10 экранов. Ответы сохраняются в `localStorage` после каждого выбора, поэтому перезагрузка или возврат через день продолжает с первого незаконченного экрана. Сохранённое читается терпимо: неизвестные id, значения вне 1–5 и испорченный JSON отбрасываются. Если `localStorage` недоступен (приватный режим, запрет cookie), тест всё равно проходится — просто без сохранения. После успешной отправки ответы из `localStorage` удаляются.

- [ ] **Step 1: Тесты (падают)**

`apps/web/src/lib/test-progress.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import {
  ANSWER_LABELS,
  answeredCount,
  firstIncompletePage,
  isComplete,
  isPageComplete,
  pageCount,
  pageItems,
  parseStoredProgress,
  withAnswer,
} from "./test-progress";

const items = Array.from({ length: 12 }, (_, i) => ({ id: `q-${i + 1}` }));
const answerFirst = (n: number) => Object.fromEntries(items.slice(0, n).map((item) => [item.id, 3 as const]));

describe("paging", () => {
  test("splits items into pages of five", () => {
    expect(pageCount(12)).toBe(3);
    expect(pageCount(50)).toBe(10);
    expect(pageItems(items, 0).map((item) => item.id)).toEqual(["q-1", "q-2", "q-3", "q-4", "q-5"]);
    expect(pageItems(items, 2).map((item) => item.id)).toEqual(["q-11", "q-12"]);
  });

  test("a page is complete only when every item on it is answered", () => {
    expect(isPageComplete(items, answerFirst(4), 0)).toBe(false);
    expect(isPageComplete(items, answerFirst(5), 0)).toBe(true);
  });

  test("resumes from the first page with a missing answer", () => {
    expect(firstIncompletePage(items, {})).toBe(0);
    expect(firstIncompletePage(items, answerFirst(7))).toBe(1);
    expect(firstIncompletePage(items, answerFirst(12))).toBe(2);
  });
});

describe("answers", () => {
  test("counts only answers to known items", () => {
    expect(answeredCount(items, { ...answerFirst(3), unknown: 5 })).toBe(3);
    expect(isComplete(items, answerFirst(11))).toBe(false);
    expect(isComplete(items, answerFirst(12))).toBe(true);
  });

  test("adding an answer returns a new object and keeps the original", () => {
    const before = answerFirst(1);
    const after = withAnswer(before, "q-2", 5);
    expect(after).toEqual({ "q-1": 3, "q-2": 5 });
    expect(before).toEqual({ "q-1": 3 });
  });

  test("has a label for each of the five answers", () => {
    expect(Object.keys(ANSWER_LABELS)).toEqual(["1", "2", "3", "4", "5"]);
    expect(ANSWER_LABELS[1]).toBe("Совсем не про меня");
    expect(ANSWER_LABELS[5]).toBe("Точно про меня");
  });
});

describe("stored progress", () => {
  test("restores valid answers", () => {
    expect(parseStoredProgress(JSON.stringify({ "q-1": 2, "q-2": 5 }), items)).toEqual({ "q-1": 2, "q-2": 5 });
  });

  test("drops unknown ids and values outside 1–5", () => {
    const raw = JSON.stringify({ "q-1": 4, "q-2": 0, "q-3": 6, "q-4": 2.5, "q-5": "3", other: 3 });
    expect(parseStoredProgress(raw, items)).toEqual({ "q-1": 4 });
  });

  test.each([null, "", "not json", "[1,2]", "null", "42"])("returns no answers for %j", (raw) => {
    expect(parseStoredProgress(raw, items)).toEqual({});
  });
});
```

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run apps/web/src/lib/test-progress.test.ts
```
Expected: FAIL — модуля `./test-progress` нет.

- [ ] **Step 2: Реализация**

`apps/web/src/lib/test-progress.ts`:
```ts
import type { Answer, Answers } from "@grani/core";

export const PAGE_SIZE = 5;
export const STORAGE_KEY = "grani:answers:v1";

export const ANSWER_LABELS: Readonly<Record<Answer, string>> = {
  1: "Совсем не про меня",
  2: "Скорее не про меня",
  3: "Отчасти",
  4: "Скорее про меня",
  5: "Точно про меня",
};

type WithId = { readonly id: string };

export function pageCount(total: number): number {
  return Math.ceil(total / PAGE_SIZE);
}

export function pageItems<T>(items: readonly T[], page: number): readonly T[] {
  return items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
}

export function answeredCount(items: readonly WithId[], answers: Answers): number {
  return items.filter((item) => answers[item.id] !== undefined).length;
}

export function isPageComplete(items: readonly WithId[], answers: Answers, page: number): boolean {
  return pageItems(items, page).every((item) => answers[item.id] !== undefined);
}

export function firstIncompletePage(items: readonly WithId[], answers: Answers): number {
  const pages = pageCount(items.length);
  for (let page = 0; page < pages; page += 1) {
    if (!isPageComplete(items, answers, page)) return page;
  }
  return pages - 1;
}

export function isComplete(items: readonly WithId[], answers: Answers): boolean {
  return answeredCount(items, answers) === items.length;
}

export function withAnswer(answers: Answers, id: string, value: Answer): Answers {
  return { ...answers, [id]: value };
}

function isAnswer(value: unknown): value is Answer {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function parseStoredProgress(raw: string | null, items: readonly WithId[]): Answers {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
  const stored = parsed as Record<string, unknown>;
  const restored: Record<string, Answer> = {};
  for (const item of items) {
    const value = stored[item.id];
    if (isAnswer(value)) restored[item.id] = value;
  }
  return restored;
}
```

```bash
pnpm vitest run apps/web/src/lib/test-progress.test.ts
```
Expected: PASS.

- [ ] **Step 3: Страница теста**

`apps/web/src/app/test/page.tsx`:
```tsx
import { SELF_ITEMS } from "@grani/content";
import type { Metadata } from "next";
import { TestRunner } from "./TestRunner";

export const metadata: Metadata = { title: "Тест — Грани" };

export default function TestPage() {
  // В клиент уходят только id и текст: ключи и источники вопросов не нужны браузеру
  const items = SELF_ITEMS.map((item) => ({ id: item.id, text: item.text }));
  return (
    <main className="page">
      <TestRunner items={items} />
    </main>
  );
}
```

`apps/web/src/app/test/TestRunner.tsx`:
```tsx
"use client";

import type { Answer, Answers } from "@grani/core";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ANSWER_LABELS,
  STORAGE_KEY,
  answeredCount,
  firstIncompletePage,
  isComplete,
  isPageComplete,
  pageCount,
  pageItems,
  parseStoredProgress,
  withAnswer,
} from "@/lib/test-progress";

type Item = { id: string; text: string };

const ANSWER_VALUES = [1, 2, 3, 4, 5] as const satisfies readonly Answer[];

const SUBMIT_ERRORS: Record<string, string> = {
  rate_limited: "Слишком много попыток. Подождите минуту и нажмите ещё раз.",
  invalid_answers: "Не все ответы сохранились. Проверьте экраны теста.",
};
const FALLBACK_ERROR = "Не получилось отправить ответы. Проверьте интернет и попробуйте ещё раз.";

function readStorage(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Без localStorage тест проходится, просто прогресс не переживёт перезагрузку
  }
}

export function TestRunner({ items }: { items: readonly Item[] }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>({});
  const [page, setPage] = useState(0);
  const [restored, setRestored] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // localStorage есть только в браузере, поэтому прогресс восстанавливается после гидратации
  useEffect(() => {
    const saved = parseStoredProgress(readStorage(), items);
    setAnswers(saved);
    setPage(firstIncompletePage(items, saved));
    setRestored(true);
  }, [items]);

  const pages = pageCount(items.length);
  const isLastPage = page === pages - 1;
  const done = answeredCount(items, answers);

  function choose(id: string, value: Answer) {
    const next = withAnswer(answers, id, value);
    setAnswers(next);
    writeStorage(JSON.stringify(next));
  }

  function goTo(nextPage: number) {
    setPage(nextPage);
    setError(null);
    window.scrollTo({ top: 0 });
    headingRef.current?.focus();
  }

  async function submit() {
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/results", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const body = (await response.json()) as { ok: boolean; redirect?: string; error?: string };
      if (body.ok && body.redirect) {
        writeStorage(null);
        router.push(body.redirect);
        return;
      }
      setError(SUBMIT_ERRORS[body.error ?? ""] ?? FALLBACK_ERROR);
    } catch {
      setError(FALLBACK_ERROR);
    }
    setSending(false);
  }

  if (!restored) return <p className="muted">Загружаем вопросы…</p>;

  return (
    <div className="stack">
      <div className="progress">
        <span className="muted">
          Ответов: {done} из {items.length}
        </span>
        <div className="progress__bar" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={done}>
          <span style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
      </div>

      <h1 className="display" ref={headingRef} tabIndex={-1}>
        Экран {page + 1} из {pages}
      </h1>

      {pageItems(items, page).map((item) => (
        <fieldset key={item.id} className="card">
          <legend className="lead">{item.text}</legend>
          <div className="choices">
            {ANSWER_VALUES.map((value) => (
              <label key={value} className="choice">
                <input
                  type="radio"
                  name={item.id}
                  value={value}
                  checked={answers[item.id] === value}
                  onChange={() => choose(item.id, value)}
                />
                {ANSWER_LABELS[value]}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="row">
        {page > 0 && (
          <button type="button" className="button button--ghost" onClick={() => goTo(page - 1)}>
            Назад
          </button>
        )}
        {isLastPage ? (
          <button
            type="button"
            className="button"
            disabled={!isComplete(items, answers) || sending}
            onClick={submit}
          >
            {sending ? "Считаем…" : "Узнать результат"}
          </button>
        ) : (
          <button
            type="button"
            className="button"
            disabled={!isPageComplete(items, answers, page)}
            onClick={() => goTo(page + 1)}
          >
            Дальше
          </button>
        )}
      </div>
    </div>
  );
}
```

`POST /api/results` принимает тело `{ answers }` (Task 5).

- [ ] **Step 4: Первый экран**

`apps/web/src/app/page.tsx`:
```tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page">
      <div className="stack">
        <h1 className="display">Узнай свой тип и как тебя видят другие</h1>
        <p className="lead">
          50 коротких утверждений на основе научной модели «Большая пятёрка». В ответ — один из 16 типов, пять шкал
          личности и карточка для сторис.
        </p>
        <div className="row">
          <Link className="button" href="/test">
            Пройти тест
          </Link>
          <span className="muted">10 минут, бесплатно</span>
        </div>
        <p className="muted">
          Это не диагноз и не приговор, а способ посмотреть на себя со стороны. Ответы можно менять до конца теста.
        </p>
      </div>
      <footer className="footer">
        <Link href="/consent">Согласие на обработку данных</Link>
        <Link href="/me">Мой результат</Link>
      </footer>
    </main>
  );
}
```

- [ ] **Step 5: Проверка в браузере**

```bash
pnpm dev:db
pnpm dev:web
```
(в двух терминалах; в сессии Claude — через `preview_start`, конфигурация в `.claude/launch.json` с `pnpm dev:web`, порт 3000).

Проверить: `/` показывает заголовок и кнопку; `/test` — 5 вопросов, «Дальше» неактивна до ответа на все пять; после перезагрузки на третьем экране тест открывается на третьем экране с отмеченными ответами; «Назад» показывает прежние ответы; на ширине 375px нет горизонтальной прокрутки; последний экран «Узнать результат» без входа ведёт на `/login`. Консоль браузера без ошибок.

- [ ] **Step 6: Тесты и коммит**

```bash
pnpm test && pnpm typecheck
git add apps/web/src/lib/test-progress.ts apps/web/src/lib/test-progress.test.ts apps/web/src/app/page.tsx apps/web/src/app/test
git commit -m "feat(web): landing page and paged test with progress saved in localStorage"
```
