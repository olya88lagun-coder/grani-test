"use client";

import { scoreShortTest, type Answers, type ShortTestScore } from "@grani/core";
import { getShortTest } from "@grani/content/short-tests";
import { useEffect, useState } from "react";
import { Questionnaire } from "@/components/Questionnaire";
import type { Goal } from "@/lib/analytics";
import { parseStoredShortResult, serializeShortResult, shortProgressStorageKey, shortResultStorageKey, shortResultView } from "@/lib/short-test-result";
import { ShortTestResult } from "./ShortTestResult";
import styles from "./short-tests.module.css";

// Цели воронки по slug теста; новый тест добавляет сюда свою пару
const GOALS: Readonly<Record<string, { start: Goal; finish: Goal }>> = {
  attachment: { start: "attachment_start", finish: "attachment_finish" },
};

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Без хранилища результат просто не переживёт перезагрузку
  }
}

export function ShortTestRunner({ slug }: { slug: string }) {
  const test = getShortTest(slug);
  if (!test) throw new Error(`Unknown short test ${slug}`);
  const [score, setScore] = useState<ShortTestScore | null>(null);
  const [restored, setRestored] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Сохранённый результат читается после гидратации: на сервере localStorage нет
  useEffect(() => {
    setScore(parseStoredShortResult(read(shortResultStorageKey(test.slug)), test));
    setRestored(true);
  }, [test]);

  function complete(answers: Answers) {
    try {
      setScore(scoreShortTest(test!.scoring, answers));
      write(shortResultStorageKey(test!.slug), serializeShortResult(test!.slug, answers, new Date()));
    } catch {
      // Испорченные ответы (подделанное хранилище) — начинаем заново
      write(shortProgressStorageKey(test!.slug), null);
      setAttempt((n) => n + 1);
    }
    window.scrollTo({ top: 0 });
  }

  function restart() {
    write(shortResultStorageKey(test!.slug), null);
    setScore(null);
    setAttempt((n) => n + 1);
  }

  if (!restored) return <p className="muted" role="status">Загружаем тест…</p>;
  if (score) return <ShortTestResult test={test} view={shortResultView(test, score)} onRestart={restart} />;

  const goals = GOALS[test.slug];
  return (
    <div className={styles.runner}>
      <p className={styles.intro}>{test.intro}</p>
      <Questionnaire
        key={attempt}
        items={test.items}
        storageKey={shortProgressStorageKey(test.slug)}
        onComplete={complete}
        submitLabel="Узнать результат"
        screenHeading="h2"
        {...(goals ? { startGoal: goals.start, finishGoal: goals.finish } : {})}
      />
    </div>
  );
}
