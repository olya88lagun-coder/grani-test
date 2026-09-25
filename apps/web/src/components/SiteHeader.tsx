"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TypeGem } from "./TypeGem";

const LINKS = [
  { href: "/test", label: "Пройти тест" },
  { href: "/types", label: "16 типов" },
  { href: "/compatibility", label: "Совместимость" },
  { href: "/articles", label: "Статьи" },
] as const;

// Приглашение в пару и анкета для друга ведут по одному сценарию: кнопка «Пройти тест» там привязывает к паре,
// а ссылка меню увела бы на обычный тест — поэтому на них только логотип
const FOCUSED_PREFIXES = ["/p/", "/f/"] as const;

// Шапка всех страниц, кроме главной: у главной своя навигация в первом экране
export function SiteHeader() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  const focused = FOCUSED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="site-brand" href="/" aria-label="Грани — на главную">
          <TypeGem shape="hexagon" size={26} />
          <span>грани</span>
        </Link>
        {!focused && <SiteNav pathname={pathname} />}
      </div>
    </header>
  );
}

function SiteNav({ pathname }: { pathname: string }) {
  return (
    <>
      <nav className="site-nav" aria-label="Основная навигация">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} aria-current={pathname.startsWith(link.href) ? "page" : undefined}>
            {link.label}
          </Link>
        ))}
      </nav>
      <Link className="site-login" href="/me">
        Войти
      </Link>
    </>
  );
}
