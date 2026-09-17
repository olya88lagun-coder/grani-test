# Task 2: Общий опросник для теста и анкеты друга

**Files:**
- Modify: `apps/web/src/lib/test-progress.ts`, `apps/web/src/lib/test-progress.test.ts`, `apps/web/src/app/test/page.tsx`
- Create: `apps/web/src/components/Questionnaire.tsx`
- Delete: `apps/web/src/app/test/TestRunner.tsx`

**Interfaces:**
- Consumes: `ANSWER_LABELS`, функции прогресса (план 3, Task 7).
- Produces:
  ```ts
  // test-progress.ts — размер экрана стал параметром, по умолчанию PAGE_SIZE = 5
  function pageCount(total: number, pageSize?: number): number;
  function pageItems<T>(items: readonly T[], page: number, pageSize?: number): readonly T[];
  function isPageComplete(items: readonly { id: string }[], answers: Answers, page: number, pageSize?: number): boolean;
  function firstIncompletePage(items: readonly { id: string }[], answers: Answers, pageSize?: number): number;
  const SUBMIT_ERRORS: Readonly<Record<string, string>>;
  function submitErrorMessage(code: string | undefined): string;

  // components/Questionnaire.tsx (client)
  type QuestionnaireProps = {
    items: readonly { id: string; text: string }[];
    storageKey: string;
    submitUrl: string;
    submitLabel: string;
    pageSize?: number;
  };
  function Questionnaire(props: QuestionnaireProps): ReactElement;
  ```

Анкета друга устроена так же, как тест: те же пять вариантов ответа, прогресс в `localStorage`, отправка JSON `{ answers }` и переход по `redirect` из ответа. Отличаются вопросы, ключ хранения (у каждой ссылки свой — `grani:friend:<token>`), адрес отправки, подпись кнопки и размер экрана (4 вопроса вместо 5). Поэтому `TestRunner` превращается в общий `Questionnaire`, а тексты ошибок отправки выносятся в `test-progress.ts` и дополняются кодами анкеты друга (Task 3).

- [ ] **Step 1: Тесты (падают)**

В `apps/web/src/lib/test-progress.test.ts` добавить в импорт `submitErrorMessage` и тесты:
```ts
describe("custom page size", () => {
  test("splits and resumes by the given page size", () => {
    expect(pageCount(12, 4)).toBe(3);
    expect(pageItems(items, 1, 4).map((item) => item.id)).toEqual(["q-5", "q-6", "q-7", "q-8"]);
    expect(isPageComplete(items, answerFirst(4), 0, 4)).toBe(true);
    expect(firstIncompletePage(items, answerFirst(9), 4)).toBe(2);
  });
});

describe("submitErrorMessage", () => {
  test("explains known errors and falls back for the rest", () => {
    expect(submitErrorMessage("already_answered")).toMatch(/уже ответ/i);
    expect(submitErrorMessage("own_invite")).toMatch(/свою/i);
    expect(submitErrorMessage("rate_limited")).toMatch(/минуту/i);
    expect(submitErrorMessage(undefined)).toMatch(/интернет/i);
    expect(submitErrorMessage("something_new")).toMatch(/интернет/i);
  });
});
```

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run apps/web/src/lib/test-progress.test.ts
```
Expected: FAIL — `submitErrorMessage` не экспортируется, `pageItems(items, 1, 4)` возвращает пять вопросов.

- [ ] **Step 2: Реализация прогресса**

В `apps/web/src/lib/test-progress.ts` заменить четыре функции страниц и добавить тексты ошибок:
```ts
export function pageCount(total: number, pageSize = PAGE_SIZE): number {
  return Math.ceil(total / pageSize);
}

export function pageItems<T>(items: readonly T[], page: number, pageSize = PAGE_SIZE): readonly T[] {
  return items.slice(page * pageSize, (page + 1) * pageSize);
}

export function isPageComplete(items: readonly WithId[], answers: Answers, page: number, pageSize = PAGE_SIZE): boolean {
  return pageItems(items, page, pageSize).every((item) => answers[item.id] !== undefined);
}

export function firstIncompletePage(items: readonly WithId[], answers: Answers, pageSize = PAGE_SIZE): number {
  const pages = pageCount(items.length, pageSize);
  for (let page = 0; page < pages; page += 1) {
    if (!isPageComplete(items, answers, page, pageSize)) return page;
  }
  return pages - 1;
}

export const SUBMIT_ERRORS: Readonly<Record<string, string>> = {
  rate_limited: "Слишком много попыток. Подождите минуту и нажмите ещё раз.",
  invalid_answers: "Не все ответы сохранились. Проверьте экраны с вопросами.",
  already_answered: "С этого браузера на вопросы по этой ссылке уже ответили.",
  own_invite: "Это ваша ссылка: отвечать по ней должны друзья, а не вы.",
  not_found: "Ссылка не работает. Попросите прислать её ещё раз.",
};

const SUBMIT_FALLBACK = "Не получилось отправить ответы. Проверьте интернет и попробуйте ещё раз.";

export function submitErrorMessage(code: string | undefined): string {
  return (code && SUBMIT_ERRORS[code]) || SUBMIT_FALLBACK;
}
```

```bash
pnpm vitest run apps/web/src/lib/test-progress.test.ts
```
Expected: PASS.

- [ ] **Step 3: Компонент `Questionnaire`**

`apps/web/src/components/Questionnaire.tsx` — перенос `app/test/TestRunner.tsx` с параметрами. Отличия от `TestRunner`: `STORAGE_KEY` → `props.storageKey`, `"/api/results"` → `props.submitUrl`, «Узнать результат» → `props.submitLabel`, размер экрана `props.pageSize` передаётся во все функции страниц, локальные `SUBMIT_ERRORS`/`FALLBACK_ERROR` заменены на `submitErrorMessage`.
```tsx
"use client";

import type { Answer, Answers } from "@grani/core";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ANSWER_LABELS,
  PAGE_SIZE,
  answeredCount,
  firstIncompletePage,
  isComplete,
  isPageComplete,
  pageCount,
  pageItems,
  parseStoredProgress,
  submitErrorMessage,
  withAnswer,
} from "@/lib/test-progress";

type Item = { id: string; text: string };

export type QuestionnaireProps = {
  items: readonly Item[];
  storageKey: string;
  submitUrl: string;
  submitLabel: string;
  pageSize?: number;
};

const ANSWER_VALUES = [1, 2, 3, 4, 5] as const satisfies readonly Answer[];

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Без localStorage вопросы проходятся, просто прогресс не переживёт перезагрузку
  }
}

export function Questionnaire({ items, storageKey, submitUrl, submitLabel, pageSize = PAGE_SIZE }: QuestionnaireProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>({});
  const [page, setPage] = useState(0);
  const [restored, setRestored] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // localStorage есть только в браузере, поэтому прогресс восстанавливается после гидратации
  useEffect(() => {
    const saved = parseStoredProgress(readStorage(storageKey), items);
    setAnswers(saved);
    setPage(firstIncompletePage(items, saved, pageSize));
    setRestored(true);
  }, [items, storageKey, pageSize]);

  const pages = pageCount(items.length, pageSize);
  const isLastPage = page === pages - 1;
  const done = answeredCount(items, answers);

  function choose(id: string, value: Answer) {
    const next = withAnswer(answers, id, value);
    setAnswers(next);
    writeStorage(storageKey, JSON.stringify(next));
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
      const response = await fetch(submitUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const body = (await response.json()) as { ok: boolean; redirect?: string; error?: string };
      if (body.ok && body.redirect) {
        writeStorage(storageKey, null);
        router.push(body.redirect);
        return;
      }
      setError(submitErrorMessage(body.error));
    } catch {
      setError(submitErrorMessage(undefined));
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

      <h1 className="eyebrow" ref={headingRef} tabIndex={-1}>
        Экран {page + 1} из {pages}
      </h1>

      {pageItems(items, page, pageSize).map((item) => (
        <fieldset key={item.id} className="card">
          <legend className="question">{item.text}</legend>
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
          <button type="button" className="button" disabled={!isComplete(items, answers) || sending} onClick={submit}>
            {sending ? "Отправляем…" : submitLabel}
          </button>
        ) : (
          <button type="button" className="button" disabled={!isPageComplete(items, answers, page, pageSize)} onClick={() => goTo(page + 1)}>
            Дальше
          </button>
        )}
      </div>
    </div>
  );
}
```

`apps/web/src/app/test/page.tsx`:
```tsx
import { SELF_ITEMS } from "@grani/content";
import type { Metadata } from "next";
import { Questionnaire } from "@/components/Questionnaire";
import { STORAGE_KEY } from "@/lib/test-progress";

export const metadata: Metadata = { title: "Тест" };

export default function TestPage() {
  // В клиент уходят только id и текст: ключи и источники вопросов не нужны браузеру
  const items = SELF_ITEMS.map((item) => ({ id: item.id, text: item.text }));
  return (
    <main className="page">
      <Questionnaire items={items} storageKey={STORAGE_KEY} submitUrl="/api/results" submitLabel="Узнать результат" />
    </main>
  );
}
```

```bash
git rm apps/web/src/app/test/TestRunner.tsx
```

Подпись кнопки во время отправки меняется с «Считаем…» на «Отправляем…» — одна на оба сценария.

- [ ] **Step 4: Проверка — тест о себе не изменился**

```bash
pnpm test && pnpm typecheck
```
Expected: всё зелёное.

С запущенными `pnpm dev:db` и `pnpm dev:web`:
```bash
pnpm test:e2e
```
Expected: `3 passed` — сквозные сценарии плана 3 проходят без правок.

- [ ] **Step 5: Коммит**

```bash
git add apps/web/src/lib/test-progress.ts apps/web/src/lib/test-progress.test.ts apps/web/src/components/Questionnaire.tsx apps/web/src/app/test
git commit -m "refactor(web): shared questionnaire for the self test and the friend form"
```
