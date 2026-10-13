import type { ChapterCardsSections } from "@grani/ai";
import type { ChapterKind, TraitScores } from "@grani/core";
import { chapterAxes } from "@/lib/chapter-axes";
import { seedIconPath } from "@/lib/chapter-cover";
import { SituationCard } from "./SituationCard";
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
            <SituationCard card={card} index={index} iconSrc={seedIconPath(kind, card.seed)} />
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
