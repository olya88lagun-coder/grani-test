"use client";

import { useState } from "react";
import { mergeHistory, type CardFailure, cardFailure, type HistoryItem } from "@/lib/together-cards-view";
import { readHistory } from "./client";
import { ConfirmDialog } from "./ConfirmDialog";

type Props = { partnerName: string; onFailure: (failure: CardFailure) => void };

// Сколько карточек в истории и что в ней, решает сервер; просмотр истории ничего не отмечает просмотренным
export function CardHistory({ partnerName, onFailure }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [reading, setReading] = useState<HistoryItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(before?: number) {
    setLoading(true);
    setError(null);
    const result = await readHistory(before);
    setLoading(false);
    if (!result.ok) {
      const failure = cardFailure(result.status, result.body.error ?? "");
      if (failure.kind === "none") setError(failure.text);
      else onFailure(failure);
      return;
    }
    setItems((current) => mergeHistory(before === undefined ? [] : (current ?? []), result.body.items));
    setNext(result.body.next);
  }

  const toggle = () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && items === null) void load();
  };

  return (
    <section className="stack">
      <button type="button" className="button button--ghost" aria-expanded={open} onClick={toggle}>
        {open ? "Скрыть историю" : "История карточек"}
      </button>
      {open && (
        <div className="stack">
          {items?.length === 0 && (
            <p className="muted">История ещё впереди. Здесь появятся раскрытые и пропущенные карточки.</p>
          )}
          {items?.map((item) => (
            <button key={item.id} type="button" className="tc-history-item" onClick={() => setReading(item)}>
              <span className="eyebrow">
                Карточка {item.position} · {item.outcome === "revealed" ? "ответы открыты" : "пропущена"}
              </span>
              <span className="tc-history-item__title">{item.title}</span>
              <span className="muted">{item.prompt}</span>
            </button>
          ))}
          {loading && <p className="muted" role="status">Загружаем историю…</p>}
          {error && <p className="error" role="alert">{error}</p>}
          {next !== null && !loading && (
            <button type="button" className="button button--ghost" onClick={() => void load(next)}>Показать ещё</button>
          )}
        </div>
      )}
      {reading && (
        <ConfirmDialog title={reading.title} confirmLabel="Закрыть" onClose={() => setReading(null)}>
          <p className="lead">{reading.prompt}</p>
          {reading.outcome === "skipped" && <p>Карточка пропущена. Ответы друг другу не открылись.</p>}
          {reading.mine?.fields.answer !== undefined && (
            <div>
              <p className="eyebrow">{reading.outcome === "revealed" ? "Ваш ответ" : "Только вам"}</p>
              <p className="tc-text">{String(reading.mine.fields.answer)}</p>
            </div>
          )}
          {reading.outcome === "revealed" && reading.partner.fields?.answer !== undefined && (
            <div>
              <p className="eyebrow">
                {partnerName}
                {reading.partner.edited ? " · изменено" : ""}
              </p>
              <p className="tc-text">{String(reading.partner.fields.answer)}</p>
            </div>
          )}
        </ConfirmDialog>
      )}
    </section>
  );
}
