"use client";

import { useState } from "react";
import { pilotCodeFailure } from "@/lib/together-pilot-view";
import { callApi, LOGIN_AGAIN_URL } from "./client";
import styles from "./together-extras.module.css";

// Ввод общего кода закрытого пилота. После успеха страница перезагружается и показывает обычное пространство
export function PilotCodeForm() {
  const [code, setCode] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidCode, setInvalidCode] = useState(false);

  async function submit() {
    setWorking(true);
    setError(null);
    setInvalidCode(false);
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
    setInvalidCode(result.body.error === "invalid_code");
    setError(pilotCodeFailure(result.status, result.body.error ?? ""));
  }

  return (
    <form
      className={styles.form}
      aria-busy={working}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className={styles.field}>
        <label className={styles.label} htmlFor="pilot-code">Код доступа</label>
        <input id="pilot-code" className={styles.input} type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={64} required value={code} disabled={working} aria-invalid={invalidCode ? true : undefined} aria-describedby={error ? "pilot-code-help pilot-code-error" : "pilot-code-help"} placeholder="Код из приглашения" onChange={(event) => { setCode(event.target.value); setError(null); setInvalidCode(false); }} />
        <p id="pilot-code-help" className={styles.hint}>Введите код целиком, как в приглашении.</p>
      </div>
      <button type="submit" className="button button--block" disabled={working || code.trim() === ""}>
        {working ? "Проверяем…" : "Войти по коду"}
      </button>
      {error && (
        <p id="pilot-code-error" className={styles.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
