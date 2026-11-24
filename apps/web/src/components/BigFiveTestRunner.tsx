"use client";

import type { Answers, ItemKey } from "@grani/core";
import { useEffect, useState } from "react";
import { Questionnaire } from "@/components/Questionnaire";
import { GuestBigFiveResult } from "@/components/GuestBigFiveResult";
import { InAppBrowserNotice } from "@/components/InAppBrowserNotice";
import { TestAccessNote } from "@/components/TestAccessNote";
import {
  GUEST_BIG_FIVE_RESULT_KEY,
  guestBigFiveView,
  parseGuestBigFiveAnswers,
  parseStoredGuestBigFiveResult,
  serializeGuestBigFiveResult,
  type GuestBigFiveView,
} from "@/lib/guest-big-five-result";
import { STORAGE_KEY } from "@/lib/test-progress";
import styles from "./BigFiveTestRunner.module.css";

type Item = { id: string; text: string };

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
    // Без хранилища гостевой результат не переживёт перезагрузку
  }
}

// После ответа сервера с pending гость остаётся на /test и сразу видит тип и шкалы
export function BigFiveTestRunner({ items, crystalKeys }: { items: readonly Item[]; crystalKeys: readonly ItemKey[] }) {
  const [view, setView] = useState<GuestBigFiveView | null>(null);
  const [restored, setRestored] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setView(parseStoredGuestBigFiveResult(read(GUEST_BIG_FIVE_RESULT_KEY)));
    setRestored(true);
  }, []);

  function showGuestResult(raw: Answers) {
    const answers = parseGuestBigFiveAnswers(raw);
    if (!answers) {
      write(GUEST_BIG_FIVE_RESULT_KEY, null);
      setAttempt((n) => n + 1);
      return;
    }
    write(GUEST_BIG_FIVE_RESULT_KEY, serializeGuestBigFiveResult(answers, new Date()));
    setView(guestBigFiveView(answers));
    setJustCompleted(true);
    window.scrollTo({ top: 0 });
  }

  function restart() {
    write(GUEST_BIG_FIVE_RESULT_KEY, null);
    setView(null);
    setJustCompleted(false);
    setAttempt((n) => n + 1);
  }

  if (!restored) return <p className="muted questionnaire__loading" role="status">Загружаем тест…</p>;
  if (view) return <GuestBigFiveResult view={view} onRestart={restart} focusOnMount={justCompleted} />;

  return (
    <>
      <div className={styles.intro}>
        <p>Выбирай ответ, который ближе к твоему обычному поведению.</p>
        <TestAccessNote />
      </div>
      <InAppBrowserNotice place="test" />
      <Questionnaire
        key={attempt}
        items={items}
        storageKey={STORAGE_KEY}
        submitUrl="/api/results"
        onPendingResult={showGuestResult}
        submitLabel="Узнать результат"
        startGoal="test_start"
        finishGoal="test_finish"
        trackProgress
        crystalKeys={crystalKeys}
      />
    </>
  );
}
