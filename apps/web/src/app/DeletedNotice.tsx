"use client";

import { useSearchParams } from "next/navigation";

// Плашка после удаления данных читает адрес в браузере — так главная остаётся статической страницей
export function DeletedNotice() {
  const deleted = useSearchParams().get("deleted") === "1";
  if (!deleted) return null;
  return (
    <p className="home-status" role="status">
      Данные удалены. Спасибо, что были с нами.
    </p>
  );
}
