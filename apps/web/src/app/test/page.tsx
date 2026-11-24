import { SELF_ITEMS } from "@grani/content";
import type { Metadata } from "next";
import { BigFiveTestRunner } from "@/components/BigFiveTestRunner";
import styles from "./test.module.css";

// Анкета не для поиска: SEO-лендинг — /big-five-test; robots.txt тоже Disallow: /test
export const metadata: Metadata = { title: "Тест", robots: { index: false, follow: true } };

export default function TestPage() {
  const items = SELF_ITEMS.map(({ id, text }) => ({ id, text }));
  const crystalKeys = SELF_ITEMS.map(({ id, trait, reversed }) => ({ id, trait, reversed }));
  return (
    <main className={styles.page} data-night-entry data-band="night">
      <div className={styles.container}>
        <BigFiveTestRunner items={items} crystalKeys={crystalKeys} />
      </div>
    </main>
  );
}
