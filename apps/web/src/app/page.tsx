import type { Metadata } from "next";
import Link from "next/link";
import { publicMetadata } from "@/lib/seo";

const HOME = publicMetadata({
  title: "Грани — тест личности: 16 типов и как тебя видят другие",
  description: "Бесплатный тест личности по Большой пятёрке: 50 утверждений, один из 16 типов, пять шкал и анкета для друзей «Как меня видят другие». 10 минут.",
  path: "/",
});

// absolute — чтобы шаблон «%s — Грани» не повторил название
export const metadata: Metadata = { ...HOME, title: { absolute: "Грани — тест личности: 16 типов и как тебя видят другие" } };

export default async function HomePage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  return (
    <main className="page">
      <div className="stack">
        {deleted === "1" && (
          <p className="card card--2" role="status">
            Данные удалены. Спасибо, что были с нами.
          </p>
        )}
        <p className="eyebrow">Тест личности · Большая пятёрка</p>
        <h1 className="display">Узнай свой тип и как тебя видят другие</h1>
        <p className="lead">
          50 коротких утверждений на основе научной модели «Большая пятёрка». В ответ — один из 16 типов, пять шкал
          личности и карточка для сторис.
        </p>
        <div className="row">
          <Link className="button button--lg" href="/test">
            Пройти тест <span aria-hidden="true">→</span>
          </Link>
          <span className="muted">10 минут, бесплатно</span>
        </div>
        <div className="row">
          <Link href="/types">16 типов личности</Link>
          <Link href="/compatibility">Тест на совместимость пары</Link>
        </div>
        <p className="muted">
          Это не диагноз и не приговор, а способ посмотреть на себя со стороны. Ответы можно менять до конца теста.
        </p>
      </div>
    </main>
  );
}
