import type { ReactNode } from "react";
import styles from "./ReadingContents.module.css";

export type ReadingSection = { id: string; title: ReactNode };

export function ReadingContents({ sections }: { sections: readonly ReadingSection[] }) {
  if (sections.length === 0) return null;
  const links = <ul>{sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ul>;
  return (
    <nav className={styles.contents} aria-label="Содержание">
      <div className={styles.desktop}><p>Содержание</p>{links}</div>
      <details className={styles.mobile}><summary>Содержание</summary>{links}</details>
    </nav>
  );
}
