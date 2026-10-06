"use client";

import { useRef, useState } from "react";
import { startErrorMessage } from "@/lib/together-view";
import { callApi, LOGIN_AGAIN_URL } from "./client";

// Ссылка для друзей: сворачиваемый блок у активной пары. Ссылка ничего не раскрывает о паре и не даёт скидок: она только приводит на публичную страницу
export function ShareFriends() {
  const [url, setUrl] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function getLink() {
    setWorking(true);
    setError(null);
    const result = await callApi<{ url: string }>("/api/together/share", { body: {} });
    setWorking(false);
    if (result.status === 401) return void (window.location.href = LOGIN_AGAIN_URL);
    if (!result.ok) return setError(startErrorMessage(result.body.error ?? "").text);
    setUrl(result.body.url);
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Ссылка скопирована.");
    } catch {
      inputRef.current?.select();
      setMessage("Ссылка выделена. Скопируйте её вручную.");
    }
  }

  return (
    <details className="tc-details card">
      <summary>Поделиться с парой друзей</summary>
      <div className="stack">
        <p className="muted">Ссылка ведёт на страницу «Вдвоём». Она не раскрывает ничего о вас, а пространство друзья создадут сами.</p>
        {url ? (
          <>
            <div className="stack buy-form">
              <label className="buy-form__label" htmlFor="together-share-link">Ссылка для друзей</label>
              <input id="together-share-link" ref={inputRef} className="buy-form__input" readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
            </div>
            <button type="button" className="button button--block" onClick={copy}>Скопировать ссылку</button>
            {message && <p role="status">{message}</p>}
          </>
        ) : (
          <button type="button" className="button button--ghost button--block" disabled={working} onClick={getLink}>
            {working ? "Готовим ссылку…" : "Получить ссылку"}
          </button>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
