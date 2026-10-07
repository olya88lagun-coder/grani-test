"use client";

import { usePathname } from "next/navigation";
import { PublicHeader } from "./PublicHeader";

// Приглашение в пару и анкета для друга ведут по одному сценарию: кнопка «Пройти тест» там привязывает к паре,
// а ссылка меню увела бы на обычный тест — поэтому на них только логотип
const FOCUSED_PREFIXES = ["/p/", "/f/"] as const;

// Шапка всех страниц, кроме главной: у главной своя навигация в первом экране
export function SiteHeader() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  const focused = FOCUSED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  return <PublicHeader pathname={pathname} focused={focused} />;
}
