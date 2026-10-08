"use client";

import type { Answer, Answers } from "@grani/core";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GemStone } from "@/components/GemStone";
import { type Goal, progressGoalsCrossed, reachGoal } from "@/lib/analytics";
import type { TypeShape } from "@/lib/gem-paths";
import { gemStone, type GemFamily } from "@/lib/gem-stone";
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
  STORAGE_UNAVAILABLE_NOTICE,
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
  startGoal?: Goal;
  finishGoal?: Goal;
  // Цели 25/50/75% — только для своего теста, не для анкеты друзей
  trackProgress?: boolean;
  // Камень рядом со счётчиком: грани закрашиваются по мере ответов. Без него остаётся только полоса
  progressGem?: { shape: TypeShape; family: GemFamily };
};

const ANSWER_VALUES = [1, 2, 3, 4, 5] as const satisfies readonly Answer[];

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

// false — браузер не дал сохранить: вопросы проходятся, но прогресс не переживёт перезагрузку, и человеку об этом нужно сказать
function writeStorage(key: string, value: string | null): boolean {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function Questionnaire({ items, storageKey, submitUrl, submitLabel, pageSize = PAGE_SIZE, startGoal, finishGoal, trackProgress = false, progressGem }: QuestionnaireProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>({});
  const [page, setPage] = useState(0);
  const [restored, setRestored] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageFailed, setStorageFailed] = useState(false);
  // Состояние обновляется после отрисовки, поэтому второй быстрый щелчок успевает пройти: отправку закрывает ref
  const sendingRef = useRef(false);
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
  const facetCount = progressGem ? gemStone(progressGem.shape, progressGem.family).facets.length : 0;

  function choose(id: string, value: Answer) {
    // Начало — первый ответ в пустом тесте; восстановленный прогресс не считается новым началом
    const before = answeredCount(items, answers);
    if (startGoal && before === 0) reachGoal(startGoal);
    const next = withAnswer(answers, id, value);
    if (trackProgress) for (const goal of progressGoalsCrossed(before, answeredCount(items, next), items.length)) reachGoal(goal);
    setAnswers(next);
    setStorageFailed(!writeStorage(storageKey, JSON.stringify(next)));
  }

  function goTo(nextPage: number) {
    setPage(nextPage);
    setError(null);
    window.scrollTo({ top: 0 });
    headingRef.current?.focus();
  }

  async function submit() {
    if (sendingRef.current) return;
    sendingRef.current = true;
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
        if (finishGoal) reachGoal(finishGoal);
        router.push(body.redirect);
        return;
      }
      setError(submitErrorMessage(body.error));
    } catch {
      setError(submitErrorMessage(undefined));
    }
    sendingRef.current = false;
    setSending(false);
  }

  if (!restored) return <p className="muted questionnaire__loading" role="status">Загружаем вопросы…</p>;

  return (
    <div className="stack questionnaire" aria-busy={sending}>
      <div className="progress">
        <div className="progress__head">
          {progressGem && <GemStone shape={progressGem.shape} family={progressGem.family} size={52} lit={Math.round((done / items.length) * facetCount)} />}
          <span className="muted">
            Ответов: {done} из {items.length}
          </span>
        </div>
        <div className="progress__bar" role="progressbar" aria-label="Прогресс ответов" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={done}>
          <span style={{ transform: `scaleX(${done / items.length})` }} />
        </div>
      </div>

      <h1 className="eyebrow questionnaire__screen" ref={headingRef} tabIndex={-1}>
        Экран {page + 1} из {pages}
      </h1>

      {pageItems(items, page, pageSize).map((item) => (
        <fieldset key={item.id} className="card question-card">
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

      {storageFailed && (
        <p className="muted questionnaire__notice" role="status">
          {STORAGE_UNAVAILABLE_NOTICE}
        </p>
      )}

      {error && (
        <p className="error questionnaire__error" role="alert">
          {error}
        </p>
      )}

      <div className="row questionnaire__navigation">
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
