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

      <h1 className="eyebrow" ref={headingRef} tabIndex={-1}>
        Экран {page + 1} из {pages}
      </h1>

      {pageItems(items, page).map((item) => (
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
