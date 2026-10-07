import { SELF_ITEMS } from "@grani/content";
import type { Metadata } from "next";
import { InAppBrowserNotice } from "@/components/InAppBrowserNotice";
import { Questionnaire } from "@/components/Questionnaire";
import { STORAGE_KEY } from "@/lib/test-progress";
import styles from "./test.module.css";

export const metadata: Metadata = { title: "Тест" };

export default function TestPage() {
  // В клиент уходят только id и текст: ключи и источники вопросов не нужны браузеру
  const items = SELF_ITEMS.map((item) => ({ id: item.id, text: item.text }));
  return (
    <main className={`inner-page inner-page--test ${styles.page}`}>
      <div className={styles.container}>
        <div className={styles.intro}>
          <img src="/home/hero-crystal.webp" alt="" width={908} height={1062} />
          <p>Выбирай ответ, который ближе к твоему обычному поведению.</p>
        </div>
        <InAppBrowserNotice place="test" />
        <Questionnaire items={items} storageKey={STORAGE_KEY} submitUrl="/api/results" submitLabel="Узнать результат" startGoal="test_start" finishGoal="test_finish" trackProgress />
      </div>
    </main>
  );
}
