import type { Situation } from "@grani/ai";
import Image from "next/image";
import { EDITION_TRAITS } from "@/lib/personal-edition-copy";
import styles from "./ChapterCards.module.css";

// Одна карточка ситуации: общая для глав и для вкладки «В жизни»
export function SituationCard({ card, index, iconSrc }: { card: Situation; index: number; iconSrc: string | null }) {
  return (
    <article className={styles.card}>
      <div className={styles.cardHead}>
        <p className={styles.number}>{String(index + 1).padStart(2, "0")}</p>
        {iconSrc && <Image className={styles.icon} src={iconSrc} alt="" width={80} height={80} />}
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
  );
}
