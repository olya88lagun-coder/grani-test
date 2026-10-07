"use client";

import { useEffect } from "react";
import { waitingPollDelayMs, type SpaceView } from "@/lib/together-view";
import { LOGIN_AGAIN_URL, readSpace } from "./client";

// Фоновое обновление экрана ожидания партнёра. Ошибки сети молча пропускаются: следующая попытка придёт по расписанию,
// сообщение об ошибке человек видит только у своих действий. На скрытой вкладке опрос стоит, при возврате обновляет сразу.
export function useWaitingPoll(active: boolean, onSpace: (space: SpaceView | null) => void): void {
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const check = async () => {
      if (cancelled || document.hidden) return;
      const result = await readSpace();
      if (cancelled) return;
      if (result.ok) onSpace(result.space);
      else if (result.status === 401) window.location.href = LOGIN_AGAIN_URL;
    };
    const schedule = () => {
      timer = setTimeout(async () => {
        await check();
        if (!cancelled) schedule();
      }, waitingPollDelayMs(Date.now() - startedAt));
    };
    const onVisible = () => {
      if (!document.hidden) void check();
    };

    document.addEventListener("visibilitychange", onVisible);
    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, onSpace]);
}
