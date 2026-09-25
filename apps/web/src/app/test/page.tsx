import { SELF_ITEMS } from "@grani/content";
import type { Metadata } from "next";
import { Questionnaire } from "@/components/Questionnaire";
import { STORAGE_KEY } from "@/lib/test-progress";

export const metadata: Metadata = { title: "Тест" };

export default function TestPage() {
  // В клиент уходят только id и текст: ключи и источники вопросов не нужны браузеру
  const items = SELF_ITEMS.map((item) => ({ id: item.id, text: item.text }));
  return (
    <main className="inner-page inner-page--test">
      <div className="page page--test">
        <div className="inner-mark" aria-hidden="true">
          <img src="/home/hero-crystal.webp" alt="" width={908} height={1062} />
        </div>
        <Questionnaire items={items} storageKey={STORAGE_KEY} submitUrl="/api/results" submitLabel="Узнать результат" startGoal="test_start" finishGoal="test_finish" />
      </div>
    </main>
  );
}
