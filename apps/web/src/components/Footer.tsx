import Link from "next/link";
import { CookieSettingsButton } from "./CookieSettingsButton";

const LINKS = [
  { href: "/big-five-test", label: "Тест Big Five" },
  { href: "/types", label: "Типы личности" },
  { href: "/together", label: "Вдвоём" },
  { href: "/articles", label: "Статьи" },
  { href: "/about", label: "О проекте и методике" },
  { href: "/pricing", label: "Разборы и цены" },
  { href: "/contacts", label: "Контакты и услуги" },
  { href: "/offer", label: "Оферта" },
  { href: "/privacy", label: "Политика обработки данных" },
  { href: "/consent", label: "Согласие" },
  { href: "/me", label: "Мой результат" },
] as const;

export function Footer() {
  return (
    <footer className="page footer">
      <nav aria-label="Документы и разделы">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
        <CookieSettingsButton />
      </nav>
    </footer>
  );
}
