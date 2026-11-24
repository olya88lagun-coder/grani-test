"use client";

import { useEffect, useRef, useState } from "react";
import { reachGoal } from "@/lib/analytics";
import { SITE_URL } from "@/lib/site";
import styles from "./short-tests.module.css";

const COPIED_MS = 2000;

type ShortResultShareProps = {
  path: string;
  typeName: string;
  shareTitle: string;
};

// MVP для коротких тестов: ссылка на публичную страницу типа (без ответов и логина).
// Карточек PNG как у Big Five пока нет — шарим URL через Web Share / копирование.
export function ShortResultShare({ path, typeName, shareTitle }: ShortResultShareProps) {
  const url = `${SITE_URL}${path}`;
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    setStatus(null);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      reachGoal("short_result_share", { action: "copy" });
    } catch {
      field.current?.select();
      setStatus("Не получилось скопировать — выделите ссылку в поле и скопируйте вручную.");
    }
  }

  async function share() {
    setStatus(null);
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, url, text: shareTitle });
        reachGoal("short_result_share", { action: "share" });
        return;
      }
      await navigator.clipboard.writeText(url);
      reachGoal("short_result_share", { action: "copy_fallback" });
      setStatus("Ссылка скопирована.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("Не получилось поделиться — скопируйте ссылку из поля.");
    }
  }

  return (
    <section className={styles.share} aria-labelledby="short-share-title" data-testid="short-result-share">
      <p className={styles.shareEyebrow}>Поделиться</p>
      <h3 id="short-share-title" className={styles.shareTitle}>
        Расскажи о типе «{typeName}»
      </h3>
      <p className={styles.shareLead}>
        Ссылка ведёт на страницу типа — без ответов и личных данных. Вход не нужен.
      </p>
      <textarea
        ref={field}
        className="invite-link"
        readOnly
        rows={1}
        value={url}
        aria-label="Ссылка на страницу типа"
        onFocus={(event) => event.currentTarget.select()}
      />
      <div className="invite-link__actions">
        <button type="button" className="button" onClick={() => void share()}>
          Поделиться <span aria-hidden="true">→</span>
        </button>
        <button type="button" className="button button--ghost invite-link__copy" onClick={() => void copy()} aria-live="polite">
          {copied ? "Скопировано ✓" : "Скопировать ссылку"}
        </button>
      </div>
      {status && (
        <p className="muted" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
