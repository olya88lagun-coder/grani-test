"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { AccountLink } from "./AccountLink";
import { TypeGem } from "./TypeGem";
import styles from "./PublicHeader.module.css";

const LINKS = [
  { href: "/test", label: "Пройти тест" },
  { href: "/types", label: "16 типов" },
  { href: "/compatibility", label: "Совместимость" },
  { href: "/together", label: "Вдвоём" },
  { href: "/articles", label: "Статьи" },
  { href: "/about", label: "О проекте" },
] as const;

type HeaderProps = { pathname: string; home?: boolean; focused?: boolean };

// Нативное раскрытие работает и до гидратации. Escape, клик снаружи и переход закрывают меню.
export function PublicHeader({ pathname, home = false, focused = false }: HeaderProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      const menu = menuRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
    }
    function closeOnEscape(event: KeyboardEvent) {
      const menu = menuRef.current;
      if (event.key !== "Escape" || !menu?.open) return;
      event.preventDefault();
      menu.open = false;
      menu.querySelector("summary")?.focus();
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function navigation(mobile = false) {
    return (
      <nav className={mobile ? styles.mobileLinks : styles.desktopLinks} aria-label="Основная навигация">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={pathname.startsWith(link.href) ? "page" : undefined}
            onClick={mobile ? () => {
              const menu = menuRef.current;
              if (!menu) return;
              menu.open = false;
              if (pathname === link.href) menu.querySelector("summary")?.focus();
            } : undefined}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <header className={`public-header ${home ? "" : "site-header "}${styles.header}${home ? ` ${styles.home}` : ""}`}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/" aria-label="Грани — на главную">
          <TypeGem shape="hexagon" size={28} />
          <span>грани</span>
        </Link>
        {!focused && (
          <>
            {navigation()}
            <AccountLink className={styles.account!} />
            <details className={styles.menu} ref={menuRef} key={pathname}>
              <summary aria-controls="compact-site-navigation">
                <span>Меню</span>
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 7h12M4 13h12" /></svg>
              </summary>
              <div className={styles.panel} id="compact-site-navigation">
                {navigation(true)}
              </div>
            </details>
          </>
        )}
      </div>
    </header>
  );
}

export function HomeHeader() {
  return <PublicHeader pathname="/" home />;
}
