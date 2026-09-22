import Link from "next/link";
import { breadcrumbs } from "@/lib/seo";
import { JsonLd } from "./JsonLd";

export type Crumb = { name: string; path: string };

// Последняя крошка — текущая страница: она подписана, но не ссылка
export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  const trail = [{ name: "Главная", path: "/" }, ...items];
  return (
    <>
      <nav aria-label="Навигация" className="crumbs">
        {trail.map((item, index) =>
          index === trail.length - 1 ? (
            <span key={item.path} aria-current="page">
              {item.name}
            </span>
          ) : (
            <Link key={item.path} href={item.path}>
              {item.name}
            </Link>
          ),
        )}
      </nav>
      <JsonLd data={breadcrumbs(trail)} />
    </>
  );
}
