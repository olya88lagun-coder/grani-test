import { SELF_ITEMS } from "@grani/content";
import type { Metadata } from "next";
import { Questionnaire } from "@/components/Questionnaire";
import { STORAGE_KEY } from "@/lib/test-progress";

export const metadata: Metadata = { title: "Тест" };

export default function TestPage() {
  // В клиент уходят только id и текст: ключи и источники вопросов не нужны браузеру
  const items = SELF_ITEMS.map((item) => ({ id: item.id, text: item.text }));
  return (
    <main className="page">
      <Questionnaire items={items} storageKey={STORAGE_KEY} submitUrl="/api/results" submitLabel="Узнать результат" />
    </main>
  );
}
