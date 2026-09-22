"use client";

import { useState } from "react";
import { reachGoal, type Goal } from "@/lib/analytics";

type InviteLinkProps = {
  endpoint: string;
  body: Record<string, string>;
  initialUrl: string | null;
  getLabel: string;
  shareTitle: string;
  shareGoal?: Goal;
};

export function InviteLink({ endpoint, body, initialUrl, getLabel, shareTitle, shareGoal }: InviteLinkProps) {
  const [url, setUrl] = useState(initialUrl);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = (await response.json()) as { ok: boolean; url?: string };
      if (data.ok && data.url) setUrl(data.url);
      else setStatus("Не получилось создать ссылку. Обновите страницу и попробуйте ещё раз.");
    } catch {
      setStatus("Не получилось создать ссылку. Проверьте интернет.");
    }
    setLoading(false);
  }

  async function share() {
    if (!url) return;
    setStatus(null);
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, url });
        if (shareGoal) reachGoal(shareGoal);
        return;
      }
      await navigator.clipboard.writeText(url);
      if (shareGoal) reachGoal(shareGoal);
      setStatus("Ссылка скопирована.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("Не получилось поделиться — скопируйте ссылку из поля.");
    }
  }

  if (!url) {
    return (
      <div className="stack">
        <button type="button" className="button" disabled={loading} onClick={create}>
          {loading ? "Создаём…" : getLabel}
        </button>
        {status && <p className="error" role="alert">{status}</p>}
      </div>
    );
  }

  return (
    <div className="stack">
      <input className="invite-link" readOnly value={url} aria-label="Ссылка-приглашение" onFocus={(event) => event.currentTarget.select()} />
      <button type="button" className="button" onClick={share}>
        Отправить ссылку <span aria-hidden="true">→</span>
      </button>
      {status && <p className="muted" role="status">{status}</p>}
    </div>
  );
}
