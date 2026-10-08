import Link from "next/link";
import { BrandMark } from "./BrandMark";
import { CookieSettingsButton } from "./CookieSettingsButton";

const GROUPS = [
  {
    title: "Разделы",
    links: [
      { href: "/big-five-test", label: "Тест Big Five" },
      { href: "/types", label: "Типы личности" },
      { href: "/together", label: "Вдвоём" },
      { href: "/articles", label: "Статьи" },
    ],
  },
  {
    title: "О сайте",
    links: [
      { href: "/about", label: "О проекте и методике" },
      { href: "/pricing", label: "Разборы и цены" },
      { href: "/contacts", label: "Контакты и услуги" },
      { href: "/me", label: "Мой результат" },
    ],
  },
  {
    title: "Документы",
    links: [
      { href: "/offer", label: "Оферта" },
      { href: "/privacy", label: "Политика обработки данных" },
      { href: "/consent", label: "Согласие" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="footer" data-band="night">
      <div className="footer__inner">
        <div className="footer__brand">
          <BrandMark height={40} />
          <div>
            <span className="footer__word">грани</span>
            <p className="footer__tagline">Тест личности по модели Big Five</p>
          </div>
        </div>
        <nav aria-label="Документы и разделы">
          {GROUPS.map((group) => (
            <div key={group.title} className="footer__group">
              <p className="footer__title">{group.title}</p>
              {group.links.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
              {group.title === "Документы" && <CookieSettingsButton />}
            </div>
          ))}
        </nav>
      </div>
    </footer>
  );
}
