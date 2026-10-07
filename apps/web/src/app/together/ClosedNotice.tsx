"use client";

import { useState } from "react";
import { CLOSED_NOTICE_TEXT, type ClosedNoticeReason } from "@/lib/together-view";
import { callApi } from "./client";

// Сообщение оставшемуся участнику о том, что пространство закрыто. Показывается, пока человек не нажмёт «Понятно»
export function ClosedNotice({ reason }: { reason: ClosedNoticeReason }) {
  const [hidden, setHidden] = useState(false);
  const [working, setWorking] = useState(false);
  const text = CLOSED_NOTICE_TEXT[reason];

  async function acknowledge() {
    setWorking(true);
    const result = await callApi("/api/together/closed/ack", { body: {} });
    // Если отметка не дошла, сообщение останется при следующем заходе: лучше показать его ещё раз, чем потерять
    if (result.ok) setHidden(true);
    setWorking(false);
  }

  if (hidden) return null;
  return (
    <section className="card stack" role="status" aria-labelledby="together-closed-title">
      <h2 id="together-closed-title" className="display">{text.title}</h2>
      <p className="lead">{text.lead}</p>
      <div>
        <button type="button" className="button button--ghost" disabled={working} onClick={acknowledge}>
          Понятно
        </button>
      </div>
    </section>
  );
}
