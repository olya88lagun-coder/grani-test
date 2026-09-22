"use client";

import { useState } from "react";
import Link from "next/link";
import { TelegramLoginButton } from "./TelegramLoginButton";

export function LoginPanel({ botUsername, authUrl, hasPendingResult }: { botUsername: string; authUrl: string; hasPendingResult: boolean }) {
  const [agreed, setAgreed] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Согласие фиксируется на сервере до входа: виджет Telegram не передаёт дополнительные параметры
  async function confirm() {
    setError(null);
    try {
      const response = await fetch("/api/consent", { method: "POST" });
      if (!response.ok) throw new Error(`consent ${response.status}`);
      setReady(true);
    } catch {
      setError("Не получилось сохранить согласие. Проверьте интернет и попробуйте ещё раз.");
    }
  }

  return (
    <div className="stack">
      <p className="lead">
        {hasPendingResult
          ? "Результат посчитан. Войдите, чтобы увидеть и сохранить его."
          : "Войдите, чтобы открыть свои результаты."}
      </p>

      {!ready && (
        <>
          <label className="choice">
            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
            <span>
              Я соглашаюсь на <Link href="/consent">обработку персональных данных</Link> в соответствии с{" "}
              <Link href="/privacy">политикой</Link>
            </span>
          </label>
          <button type="button" className="button button--block" disabled={!agreed} onClick={confirm}>
            Продолжить
          </button>
        </>
      )}

      {ready && (
        <>
          <TelegramLoginButton botUsername={botUsername} authUrl={authUrl} />
          <a className="button button--ghost button--block" href="/api/auth/vk/start">
            Войти через VK ID
          </a>
        </>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
