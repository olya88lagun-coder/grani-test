import type { PortraitSections } from "@grani/ai";
import styles from "./PortraitBlocks.module.css";

// Вкладка «Портрет»: фраза-вывод и пять коротких блоков, написанных под баллы читателя
export function PortraitBlocks({ sections }: { sections: PortraitSections }) {
  return (
    <section className={styles.root} id="edition-reading" data-portrait-blocks aria-labelledby="portrait-headline">
      <p className={styles.label}>Личный портрет</p>
      <h2 id="portrait-headline" className={styles.headline}>
        {sections.headline}
      </h2>
      <div className={styles.grid}>
        {sections.blocks.map((block, index) => (
          <article key={block.seed} className={styles.block}>
            <p className={styles.number}>{String(index + 1).padStart(2, "0")}</p>
            <h3>{block.title}</h3>
            <p>{block.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
