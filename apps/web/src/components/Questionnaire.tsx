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
