import type { ReactNode } from "react";
import styles from "./NightHero.module.css";

type Props = {
  title: string;
  eyebrow?: string;
  // Крошки и вводный текст: крошки стоят над заголовком, текст под ним
  breadcrumbs?: ReactNode;
  children?: ReactNode;
};

// Ночной первый экран внутренних страниц: тот же фон, что у «16 типов», светлый текст на тёмном
export function NightHero({ title, eyebrow, breadcrumbs, children }: Props) {
  return (
    <section className={styles.hero} data-band="night">
      <div className={styles.wrap}>
        {breadcrumbs}
        <header className={styles.intro}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h1>{title}</h1>
          {children && <div className={styles.lead}>{children}</div>}
        </header>
      </div>
    </section>
  );
}

// Ночной финал страницы: призыв к тесту на тёмном фоне
export function NightClosing({ children }: { children: ReactNode }) {
  return (
    <section className={styles.closing} data-band="night">
      <div className={styles.wrap}>{children}</div>
    </section>
  );
}
