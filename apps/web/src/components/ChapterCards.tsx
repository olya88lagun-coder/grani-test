import type { ChapterCardsSections } from "@grani/ai";
import type { ChapterKind, TraitScores } from "@grani/core";
import Image from "next/image";
import { chapterAxes } from "@/lib/chapter-axes";
import { seedIconPath } from "@/lib/chapter-cover";
import { EDITION_TRAITS } from "@/lib/personal-edition-copy";
import styles from "./ChapterCards.module.css";

type Props = { kind: ChapterKind; sections: ChapterCardsSections; scores: TraitScores; practiceHref?: string };

export function ChapterCards({ kind, sections, scores, practiceHref }: Props) {
  const axes = chapterAxes(kind, scores);
  return (
    <div className={styles.root}>
      <header className={styles.head}>
        <p className={styles.label}>Главный вывод</p>
        <h3>{sections.headline}</h3>
        <p>{sections.summary}</p>
      </header>

      {axes.length > 0 && (
        <div className={styles.axes}>
          {axes.map((axis) => (
            <div key={axis.trait} className={styles.axis} role="img" aria-label={`${axis.low} — ${axis.high}: ${axis.value} из 100`}>
              <div className={styles.poles}>
                <span>{axis.low}</span>
                <span>{axis.high}</span>
              </div>
              <div className={styles.track}>
                <i style={{ left: `${axis.value}%` }} />
              </div>
              <p className={styles.score}>{axis.value} из 100</p>
            </div>
          ))}
        </div>
      )}

      <ol className={styles.cards}>
        {sections.situations.map((card, index) => (
          <li key={card.seed}>
            <article className={styles.card}>
              <div className={styles.cardHead}>
                <p className={styles.number}>{String(index + 1).padStart(2, "0")}</p>
                {seedIconPath(kind, card.seed) && <Image className={styles.icon} src={seedIconPath(kind, card.seed)!} alt="" width={80} height={80} />}
              </div>
              <h4>{card.title}</h4>
              <h5>Узнаёшь себя?</h5>
              <p>{card.scene}</p>
              <h5>Почему так</h5>
              <p>{card.why}</p>
              <p className={styles.chips}>
                {card.traits.map((trait) => (
                  <span key={trait}>{EDITION_TRAITS[trait].label}</span>
                ))}
              </p>
              <h5>Что сказать</h5>
              <ul className={styles.say}>
                {card.say.map((phrase) => (
                  <li key={phrase}>«{phrase}»</li>
                ))}
              </ul>
              <h5>Что сделать</h5>
              <p>{card.do}</p>
            </article>
          </li>
        ))}
      </ol>

      <section className={styles.block}>
        <h4>Как это видят близкие</h4>
        <p>{sections.others_see}</p>
      </section>

      <section className={styles.block}>
        <h4>Три ловушки</h4>
        <ul className={styles.traps}>
          {sections.traps.map((item) => (
            <li key={item.trap} data-trap>
              <p>{item.trap}</p>
              <p className={styles.instead}>Вместо этого: {item.instead}</p>
            </li>
          ))}
        </ul>
      </section>

      {practiceHref && (
        <a className={styles.practice} href={practiceHref}>
          Продолжить в финансовом компасе ↗
        </a>
      )}
    </div>
  );
}
