"use client";

import type { CareCard as CareCardData, CareEntry } from "@grani/core";
import { useEffect, useState } from "react";
import { callApi, LOGIN_AGAIN_URL } from "./client";
import { TogetherMark } from "./TogetherMark";
import styles from "./together-extras.module.css";

type State = ({ kind: "loading" } | { kind: "hidden" } | { kind: "error" } | { kind: "ready"; card: CareCardData }) & { key: number };

function Entries({ title, entries }: { title: string; entries: readonly CareEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className={styles.careGroup}>
      <p className={styles.careGroupTitle}>{title}</p>
      <ul className={styles.careList}>
        {entries.map((entry, index) => (
          <li className={styles.careEntry} key={`${entry.text}|${entry.context ?? ""}|${index}`}>
            {entry.text}
            {entry.context && <span className={styles.careContext}>{entry.context}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Локальная правка сразу очищает итог; безопасное фоновое чтение сохраняет его до нового ответа сервера.
export function CareCard({ refreshKey = 0, backgroundRefreshKey = 0 }: { refreshKey?: number; backgroundRefreshKey?: number }) {
  const [retryRound, setRetryRound] = useState(0);
  const [state, setState] = useState<State>({ kind: "loading", key: refreshKey });

  useEffect(() => {
    let cancelled = false;
    setState((current) => current.key === refreshKey && (current.kind === "ready" || current.kind === "hidden") ? current : { kind: "loading", key: refreshKey });
    void callApi<{ ready: boolean; card?: CareCardData }>("/api/together/care").then((result) => {
      if (cancelled) return;
      if (result.status === 401) {
        setState({ kind: "hidden", key: refreshKey });
        window.location.href = LOGIN_AGAIN_URL;
      } else if (result.status === 404 || (result.ok && !result.body.ready)) setState({ kind: "hidden", key: refreshKey });
      else if (result.ok && result.body.ready && result.body.card) setState({ kind: "ready", card: result.body.card, key: refreshKey });
      else setState({ kind: "error", key: refreshKey });
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, backgroundRefreshKey, retryRound]);

  if (state.key !== refreshKey || state.kind === "loading") return <p className={styles.hint} role="status">Обновляем карточку заботы…</p>;
  if (state.kind === "hidden") return null;
  if (state.kind === "error") return <section className={`${styles.care} stack`}>
    <p role="alert">Не получилось загрузить карточку заботы.</p>
    <button type="button" className="button button--ghost" onClick={() => setRetryRound((round) => round + 1)}>Повторить загрузку карточки заботы</button>
  </section>;
  const { card } = state;
  return (
    <section className={styles.care} aria-labelledby="care-card-title">
      <div className={styles.careHeader}>
        <div>
          <p className="eyebrow">Итог месяца 1</p>
          <h2 id="care-card-title">{card.title}</h2>
        </div>
        <TogetherMark className={styles.mark} />
      </div>
      <p className={styles.careIntro}>{card.empty ? "Здесь собираются пункты, которые вы разрешили включить в итог месяца." : "Способы внимания, которые вы выбрали сами. Пробуйте их в обычные дни, когда вам удобно."}</p>
      {card.empty ? (
        <div className={styles.empty}>
          <h3>Пока без выбранных пунктов</h3>
          <p>В итог входят только пункты, которые каждый разрешил включить при раскрытии своих ответов: «Предлагаю этот пункт для итоговой карточки».</p>
        </div>
      ) : (
        <>
          <div className={styles.carePeople}>
          {card.members.map((member) => (
            <div key={member.id} className={styles.carePerson}>
              <h3>{member.name}</h3>
              <Entries title="Как мне показать внимание" entries={member.attention} />
              <Entries title="Что делает мой день легче" entries={member.ease} />
              {member.attention.length === 0 && member.ease.length === 0 && <p className={styles.hint}>Выбранных пунктов пока нет.</p>}
            </div>
          ))}
          </div>
          {card.rituals.length > 0 && (
            <div className={styles.rituals}>
              <h3>Идеи для общего ритуала</h3>
              <p className={styles.hint}>Личные предложения, которые можно обсудить вдвоём.</p>
              <ul className={styles.careList}>
                {card.rituals.map((ritual, index) => (
                  <li className={styles.careEntry} key={`${ritual.ownerId}|${ritual.text}|${index}`}>
                    <span className={styles.ritualAuthor}>{ritual.ownerName}</span>
                    {ritual.text}
                    {ritual.context && <span className={styles.careContext}>{ritual.context}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!card.complete && <p className={`${styles.hint} ${styles.careFooter}`}>В итог вошли только выбранные вами пункты. Необязательно заполнять все разделы.</p>}
        </>
      )}
    </section>
  );
}
