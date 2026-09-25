"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  COOKIE_SETTINGS_EVENT,
  LOGIN_MARK,
  METRIKA_ID,
  reachGoal,
  readChoice,
  sanitizePath,
  sanitizeReferrer,
  saveChoice,
  type CookieChoice,
} from "@/lib/analytics";
import { SITE_URL } from "@/lib/site";

type YmWindow = Window & { ym?: ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number } };

// Счётчик работает только на боевом домене: локальная разработка и сквозные тесты статистику не портят
const isProductionHost = () => window.location.origin === SITE_URL;

function loadMetrika(): void {
  const w = window as YmWindow;
  if (w.ym) return;
  // Стандартная очередь Метрики: вызовы до загрузки tag.js сохраняются и выполняются после
  const ym = ((...args: unknown[]) => {
    (ym.a ??= []).push(args);
  }) as NonNullable<YmWindow["ym"]>;
  ym.l = Date.now();
  w.ym = ym;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://mc.yandex.ru/metrika/tag.js";
  document.head.appendChild(script);
  // defer: просмотры отправляем сами, с очищенным адресом
  ym(METRIKA_ID, "init", { defer: true, clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false });
}

function sendHit(pathname: string): void {
  const ym = (window as YmWindow).ym;
  if (!ym) return;
  const origin = window.location.origin;
  ym(METRIKA_ID, "hit", `${origin}${sanitizePath(pathname)}`, { referer: sanitizeReferrer(document.referrer, origin) });
}

function takeLoginMark(): void {
  const url = new URL(window.location.href);
  if (url.searchParams.get(LOGIN_MARK.param) !== LOGIN_MARK.value) return;
  reachGoal("login");
  url.searchParams.delete(LOGIN_MARK.param);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

export function Analytics() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<CookieChoice | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    const saved = readChoice(window.localStorage);
    setChoice(saved);
    setOpen(saved === null);
    const reopen = () => setOpen(true);
    window.addEventListener(COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  useEffect(() => {
    if (choice !== "all" || !isProductionHost()) return;
    loadMetrika();
    loaded.current = true;
  }, [choice]);

  useEffect(() => {
    if (choice === undefined) return;
    if (loaded.current) sendHit(pathname);
    takeLoginMark();
  }, [pathname, choice]);

  // Пока баннер открыт, он не должен закрывать кнопки внизу страницы
  useEffect(() => {
    document.body.classList.toggle("has-cookie-banner", open);
  }, [open]);

  function decide(next: CookieChoice) {
    saveChoice(window.localStorage, next);
    setOpen(false);
    // Загруженную Метрику не выгрузить — после отказа страница перезагружается без неё
    if (next === "necessary" && loaded.current) {
      window.location.reload();
      return;
    }
    setChoice(next);
  }

  if (!open) return null;
  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie">
      <p>
        Мы используем cookie, чтобы сайт работал. С вашего разрешения — ещё и Яндекс.Метрику для статистики посещений. Подробнее — в{" "}
        <Link href="/privacy">политике</Link>.
      </p>
      <div className="row">
        <button type="button" className="button" onClick={() => decide("all")}>
          Принять
        </button>
        <button type="button" className="button button--ghost" onClick={() => decide("necessary")}>
          Только необходимые
        </button>
      </div>
    </div>
  );
}
