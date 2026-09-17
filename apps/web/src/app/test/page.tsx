import { SELF_ITEMS } from "@grani/content";
import type { Metadata } from "next";
import { TestRunner } from "./TestRunner";

export const metadata: Metadata = { title: "Тест" };

export default function TestPage() {
  // В клиент уходят только id и текст: ключи и источники вопросов не нужны браузеру
  const items = SELF_ITEMS.map((item) => ({ id: item.id, text: item.text }));
  return (
    <main className="page">
      <TestRunner items={items} />
    </main>
  );
}
