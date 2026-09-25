import Link from "next/link";

export function TestCta({ title = "Узнай свой тип" }: { title?: string }) {
  return (
    <section className="card stack test-cta">
      <h2>{title}</h2>
      <p>50 коротких утверждений по модели «Большая пятёрка»: тип, пять шкал и карточка для сторис.</p>
      <div className="row">
        <Link className="button" href="/test">
          Пройти тест <span aria-hidden="true">→</span>
        </Link>
        <span className="muted">10 минут, бесплатно</span>
      </div>
    </section>
  );
}
