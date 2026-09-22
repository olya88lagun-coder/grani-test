"use client";

import type { Product } from "@grani/core";
import { useState } from "react";

const ERRORS: Record<string, string> = {
  unauthorized: "Войдите, чтобы купить разбор.",
  not_available: "Это уже куплено — обновите страницу.",
  not_found: "Не нашли результат. Обновите страницу.",
  payments_unavailable: "Оплата временно недоступна. Попробуйте позже.",
  rate_limited: "Слишком много попыток. Подождите минуту.",
};
const FALLBACK = "Не получилось перейти к оплате. Проверьте интернет и попробуйте ещё раз.";

export function BuyButton({ product, targetId, label, ghost = false }: { product: Product; targetId: string; label: string; ghost?: boolean }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/purchases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ product, targetId }) });
      const body = (await response.json()) as { ok: boolean; url?: string; error?: string };
      if (body.ok && body.url) {
        window.location.assign(body.url);
        return;
      }
      setError(ERRORS[body.error ?? ""] ?? FALLBACK);
    } catch {
      setError(FALLBACK);
    }
    setSending(false);
  }

  return (
    <div className="stack">
      <button type="button" className={ghost ? "button button--ghost" : "button"} disabled={sending} onClick={buy}>
        {sending ? "Переходим к оплате…" : label}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
