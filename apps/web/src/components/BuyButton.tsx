"use client";

import type { Product } from "@grani/core";
import { useEffect, useId, useState, type FormEvent } from "react";
import { reachGoal } from "@/lib/analytics";

const ERRORS: Record<string, string> = {
  unauthorized: "Войдите, чтобы купить разбор.",
  invalid_email: "Проверьте почту — на неё придёт чек.",
  not_available: "Это уже куплено — обновите страницу.",
  not_found: "Не нашли результат. Обновите страницу.",
  payments_unavailable: "Оплата временно недоступна. Попробуйте позже.",
  rate_limited: "Слишком много попыток. Подождите минуту.",
};
const FALLBACK = "Не получилось перейти к оплате. Проверьте интернет и попробуйте ещё раз.";

// Почту помнит только этот браузер — чтобы при следующей покупке не вводить её снова
const EMAIL_KEY = "grani-receipt-email";

function rememberedEmail(): string {
  try {
    return localStorage.getItem(EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

function rememberEmail(email: string): void {
  try {
    localStorage.setItem(EMAIL_KEY, email);
  } catch {
    // Хранилище недоступно (приватный режим) — почту просто спросим в следующий раз
  }
}

export function BuyButton({ product, targetId, label, ghost = false }: { product: Product; targetId: string; label: string; ghost?: boolean }) {
  const [email, setEmail] = useState("");
  const [remembered, setRemembered] = useState(false);
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  useEffect(() => {
    const saved = rememberedEmail();
    if (saved) {
      setEmail(saved);
      setRemembered(true);
    }
  }, []);

  async function pay() {
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/purchases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ product, targetId, email }),
      });
      const body = (await response.json()) as { ok: boolean; url?: string; error?: string };
      if (body.ok && body.url) {
        // Цель — один раз, когда человек действительно уходит к оплате, а не на каждый запрос почты
        reachGoal("checkout_start", { product });
        if (email.trim()) rememberEmail(email.trim());
        window.location.assign(body.url);
        return;
      }
      // Почта нужна только для оплаты через ЮKassa: сервер сам говорит, когда её спросить
      if (body.error === "email_required") {
        setRemembered(false);
        setAsking(true);
        setSending(false);
        return;
      }
      if (body.error === "invalid_email") {
        setRemembered(false);
        setAsking(true);
      }
      setError(ERRORS[body.error ?? ""] ?? FALLBACK);
    } catch {
      setError(FALLBACK);
    }
    setSending(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void pay();
  }

  const buttonClass = ghost ? "button button--ghost" : "button";
  const errorLine = error && (
    <p className="error" role="alert">
      {error}
    </p>
  );

  if (asking) {
    return (
      <form className="stack buy-form" onSubmit={submit}>
        <label className="buy-form__label" htmlFor={inputId}>
          Почта для чека
        </label>
        <input
          id={inputId}
          className="buy-form__input"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <p className="buy-form__hint">Сюда пришлём чек самозанятого из «Мой налог». Больше ни для чего не используем.</p>
        <button type="submit" className={buttonClass} disabled={sending}>
          {sending ? "Переходим к оплате…" : "Перейти к оплате"}
        </button>
        {errorLine}
      </form>
    );
  }

  return (
    <div className="stack">
      <button type="button" className={buttonClass} disabled={sending} onClick={() => void pay()}>
        {sending ? "Переходим к оплате…" : label}
      </button>
      {remembered && (
        <p className="buy-form__hint">
          Чек — на {email}.{" "}
          <button type="button" className="link-button" onClick={() => setAsking(true)}>
            Изменить
          </button>
        </p>
      )}
      {errorLine}
    </div>
  );
}
