"use client";

import { useState } from "react";
import { pilotCodeFailure } from "@/lib/together-pilot-view";
import { callApi, LOGIN_AGAIN_URL } from "./client";

// Ввод общего кода закрытого пилота. После успеха страница перезагружается и показывает обычное пространство
export function PilotCodeForm() {
  const [code, setCode] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setWorking(true);
    setError(null);
    const result = await callApi("/api/together/pilot", { body: { code } });
    if (result.status === 401) {
      window.location.href = LOGIN_AGAIN_URL;
      return;
    }
    if (result.ok) {
      window.location.reload();
      return;
    }
    setWorking(false);
    setError(pilotCodeFailure(result.status, result.body.error ?? ""));
  }

  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="stack buy-form">
        <label className="buy-form__label" htmlFor="pilot-code">Код доступа</label>
        <input id="pilot-code" className="buy-form__input" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={64} required value={code} onChange={(event) => setCode(event.target.value)} />
      </div>
      <button type="submit" className="button button--block" disabled={working || code.trim() === ""}>
        {working ? "Проверяем…" : "Войти по коду"}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
