import type { LifeSections } from "@grani/ai";
import { lifeIconPath } from "@/lib/chapter-cover";
import { SituationCard } from "./SituationCard";
import styles from "./ChapterCards.module.css";

// Вкладка «В жизни»: пять карточек, написанных под баллы читателя; вёрстка карточек общая с главами
export function LifeCards({ sections }: { sections: LifeSections }) {
  return (
    <section className={styles.root} data-life-cards aria-labelledby="life-cards-title">
      <header className={styles.head}>
        <p className={styles.label}>Мои жизненные сценарии</p>
        <h3 id="life-cards-title">Когда жизнь меняет условия</h3>
        <p>Пять ситуаций, чтобы заметить привычную реакцию и попробовать другой ход. Это вопросы к наблюдению, а не прогноз по баллам.</p>
      </header>
      <ol className={styles.cards}>
        {sections.situations.map((card, index) => (
          <li key={card.seed}>
            <SituationCard card={card} index={index} iconSrc={lifeIconPath(card.seed)} />
          </li>
        ))}
      </ol>
    </section>
  );
}
