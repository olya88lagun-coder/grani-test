"use client";

import { useState } from "react";

// Копирование одной строки для «Мой налог»; если буфер недоступен, строку можно выделить и скопировать вручную (она рядом на странице)
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button type="button" className="button button--ghost receipt__copy" onClick={copy} aria-live="polite">
      {state === "done" ? "Скопировано" : state === "failed" ? "Не получилось, выделите вручную" : label}
    </button>
  );
}
