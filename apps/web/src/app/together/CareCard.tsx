"use client";

import type { CareCard as CareCardData, CareEntry } from "@grani/core";
import { useEffect, useState } from "react";
import { callApi } from "./client";
import { TogetherMark } from "./TogetherMark";
import styles from "./together-extras.module.css";

type State = { kind: "loading" } | { kind: "hidden" } | { kind: "ready"; card: CareCardData };

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
