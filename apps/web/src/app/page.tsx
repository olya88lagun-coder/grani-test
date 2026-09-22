import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page">
      <div className="stack">
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
        <p className="muted">
          Это не диагноз и не приговор, а способ посмотреть на себя со стороны. Ответы можно менять до конца теста.
        </p>
      </div>
    </main>
  );
}
