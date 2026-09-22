"use client";

import { useState } from "react";

export function DeleteForm() {
  const [confirmed, setConfirmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/me/delete", { method: "POST" });
      if (response.ok) {
        window.location.assign("/?deleted=1");
        return;
      }
      setError(response.status === 401 ? "Сессия закончилась — войдите снова и повторите." : "Не получилось удалить данные. Попробуйте ещё раз.");
    } catch {
      setError("Не получилось удалить данные. Проверьте интернет и попробуйте ещё раз.");
    }
    setSending(false);
  }

  return (
    <div className="stack">
      <label className="choice">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        <span>Понимаю, что данные удалятся без возможности восстановления</span>
      </label>
      <button type="button" className="button" disabled={!confirmed || sending} onClick={remove}>
        {sending ? "Удаляем…" : "Удалить навсегда"}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
