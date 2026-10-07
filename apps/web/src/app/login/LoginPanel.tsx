"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./login.module.css";

export function LoginPanel({ lead }: { lead: string }) {
  const [agreed, setAgreed] = useState(false);
  const [ready, setReady] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Согласие фиксируется на сервере до входа: VK ID не передаёт дополнительные параметры
  async function confirm() {
    setConfirming(true);
    setError(null);
    try {
      const response = await fetch("/api/consent", { method: "POST" });
      if (!response.ok) throw new Error(`consent ${response.status}`);
      setReady(true);
    } catch {
      setError("Не получилось сохранить согласие. Проверьте интернет и попробуйте ещё раз.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className={styles.panelBody} aria-busy={confirming}>
      <p className={styles.lead}>{lead}</p>

      {!ready && (
        <>
          <label className={`choice ${styles.consent}`}>
            <input type="checkbox" checked={agreed} disabled={confirming} onChange={(event) => setAgreed(event.target.checked)} />
            <span>
              Мне есть 14 лет. Я соглашаюсь на <Link href="/consent">обработку персональных данных</Link> в соответствии с{" "}
              <Link href="/privacy">политикой</Link>
            </span>
          </label>
          <button type="button" className={`button button--block ${styles.action}`} disabled={!agreed || confirming} onClick={confirm}>
            {confirming ? "Сохраняем…" : "Продолжить"}
          </button>
        </>
      )}

      {ready && (
        <a className={`button button--block ${styles.action}`} href="/api/auth/vk/start">
          Войти через VK ID
        </a>
      )}

      {error && (
        <p className={`error ${styles.error}`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
