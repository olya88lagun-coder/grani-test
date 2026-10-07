import Link from "next/link";
import { CookieSettingsButton } from "./CookieSettingsButton";
import styles from "./Footer.module.css";

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

const GROUPS = [
  { title: "Исследовать", links: [LINKS[0], LINKS[1], LINKS[3], LINKS[4]] },
  { title: "Ваши результаты", links: [LINKS[10], LINKS[5], LINKS[2]] },
  { title: "Помощь и документы", links: [LINKS[6], LINKS[7], LINKS[8], LINKS[9]] },
] as const;

export function Footer() {
  return (
    <footer className={styles.footer}>
      <nav className={styles.content} aria-label="Документы и разделы">
        {GROUPS.map((group, index) => (
          <section key={group.title}>
            <h2>{group.title}</h2>
            <ul>{group.links.map((link) => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}</ul>
            {index === GROUPS.length - 1 && <CookieSettingsButton />}
          </section>
        ))}
      </nav>
    </footer>
  );
}
