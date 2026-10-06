"use client";

import type { CareCard as CareCardData, CareEntry } from "@grani/core";
import { useEffect, useState } from "react";
import { callApi } from "./client";

type State = { kind: "loading" } | { kind: "hidden" } | { kind: "ready"; card: CareCardData };

function Entries({ title, entries }: { title: string; entries: readonly CareEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="stack">
      <p className="eyebrow">{title}</p>
      <ul className="stack">
        {entries.map((entry) => (
          <li key={`${entry.text}|${entry.context ?? ""}`}>
            {entry.text}
            {entry.context && <span className="muted"> · {entry.context}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Итог месяца 1. Показывается только когда месяц пройден; пока сервер не готов отдать карточку, блока на странице нет
export function CareCard() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void callApi<{ ready: boolean; card?: CareCardData }>("/api/together/care").then((result) => {
      if (cancelled) return;
      setState(result.ok && result.body.ready && result.body.card ? { kind: "ready", card: result.body.card } : { kind: "hidden" });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind !== "ready") return null;
  const { card } = state;
  return (
    <section className="card stack" aria-labelledby="care-card-title">
      <p className="eyebrow">Итог месяца 1</p>
      <h2 id="care-card-title" className="display">{card.title}</h2>
      {card.empty ? (
        <p className="muted">Пока в карточку ничего не попало: пункты добавляются, когда автор отмечает «Предлагаю этот пункт для итоговой карточки» в своём ответе.</p>
      ) : (
        <>
          {card.members.map((member) => (
            <div key={member.id} className="stack">
              <h3>{member.name}</h3>
              <Entries title="Как мне показать внимание" entries={member.attention} />
              <Entries title="Что делает мой день легче" entries={member.ease} />
            </div>
          ))}
          {card.rituals.length > 0 && (
            <div className="stack">
              <h3>Идеи для общего ритуала</h3>
              <ul className="stack">
                {card.rituals.map((ritual) => (
                  <li key={`${ritual.ownerId}|${ritual.text}`}>
                    <strong>{ritual.ownerName}:</strong> {ritual.text}
                    {ritual.context && <span className="muted"> · {ritual.context}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!card.complete && <p className="muted">Карточка пополнится, если открыть свои ответы в истории и отметить пункты для итоговой карточки.</p>}
        </>
      )}
    </section>
  );
}
