"use client";

import { useEffect, useRef, useState } from "react";
import { IN_APP_NAMES, inAppBrowser, type InAppBrowser } from "@/lib/in-app-browser";

// login-fallback — тихая ссылка под формой входа для обычных браузеров, остальные места — плашка для встроенных
type Props = { place: "test" | "login" | "login-fallback"; hasPendingResult?: boolean };

const COPIED_MS = 2000;

async function requestHandoff(): Promise<string | null> {
  try {
    const response = await fetch("/api/handoff", { method: "POST" });
    const body = (await response.json()) as { ok: boolean; url?: string };
    return body.ok && body.url ? body.url : null;
  } catch {
    return null;
  }
}

function detect(): InAppBrowser | null {
  const bridge = "TelegramWebviewProxy" in window;
  return inAppBrowser(navigator.userAgent, { telegramBridge: bridge });
}

// Встроенный браузер приложения (ВК, Telegram…) теряет вход через VK ID: подтверждение уходит в приложение ВК,
// а страница его не замечает. Предлагаем открыть сайт в Safari или Chrome и переносим туда посчитанный результат
export function InAppBrowserNotice({ place, hasPendingResult = false }: Props) {
  const [app, setApp] = useState<InAppBrowser | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    const found = detect();
    setApp(found);
    // Одна ссылка переноса на страницу, даже если эффект запустится повторно
    if (!found || place !== "login" || !hasPendingResult || requested.current) return;
    requested.current = true;
    // Адрес страницы подменяется ссылкой переноса: «Открыть в Safari» из меню приложения унесёт результат с собой
    void requestHandoff().then((url) => {
      if (!url) return;
      setLink(url);
      window.history.replaceState(null, "", new URL(url).pathname);
    });
  }, [place, hasPendingResult]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    setStatus(null);
    const url = link ?? (hasPendingResult ? await requestHandoff() : window.location.href);
    if (!url) {
      setStatus("Не получилось создать ссылку. Обновите страницу и попробуйте ещё раз.");
      return;
    }
    setLink(url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setStatus(`Скопируйте ссылку вручную: ${url}`);
    }
  }

  if (place === "login-fallback") {
    if (app || !hasPendingResult) return null;
    // Обычный браузер: тихая запасная ссылка на случай, если вход здесь не выходит
    return (
      <div className="handoff-fallback">
        <button type="button" className="link-button" onClick={copy}>
          {copied ? "Ссылка скопирована — вставьте её в другой браузер" : "Не получается войти? Перенести результат в другой браузер"}
        </button>
        {status && <p className="muted">{status}</p>}
      </div>
    );
  }

  if (!app) return null;
  const where = IN_APP_NAMES[app];
  return (
    <section className="in-app-notice" role="note" aria-labelledby="in-app-title">
      <h2 id="in-app-title">Откройте сайт в Safari или Chrome</h2>
      <p>
        Вы открыли «Грани» внутри приложения {where}. Здесь вход через VK ID может зациклиться и не вернуть вас на сайт.
      </p>
      <p>
        Нажмите значок компаса внизу экрана или меню <b>⋯</b> → «Открыть в браузере».
        {place === "login" && hasPendingResult ? " Результат теста откроется там же — проходить заново не придётся." : ""}
      </p>
      <button type="button" className="button button--ghost" onClick={copy}>
        {copied ? "Скопировано ✓" : "Скопировать ссылку"}
      </button>
      {status && <p className="muted">{status}</p>}
    </section>
  );
}
