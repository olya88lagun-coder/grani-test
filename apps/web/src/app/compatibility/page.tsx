import { COMPATIBILITY_LEVELS, formatRub, PRODUCT_PRICES, RESOURCE_TRAITS, SIMILARITY_TRAITS } from "@grani/core";
import { compatibilityTexts, TRAIT_LABELS } from "@grani/content";
import { getLibrary } from "@grani/content/data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { TestCta } from "@/components/TestCta";
import { publicMetadata } from "@/lib/seo";

const DESCRIPTION = "Пройдите тест вдвоём и узнайте процент совместимости по Большой пятёрке. Бесплатно — типы обоих и процент, подробный разбор пары — по желанию.";

export const metadata = publicMetadata({ title: "Тест на совместимость пары", description: DESCRIPTION, path: "/compatibility" });

const labels = (traits: readonly (keyof typeof TRAIT_LABELS)[]) => traits.map((trait) => TRAIT_LABELS[trait].toLowerCase()).join(", ");

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.7 3.8 4.5 7.1 4.5c2 0 3.6 1.1 4.9 2.9 1.3-1.8 2.9-2.9 4.9-2.9 3.3 0 5.5 3.2 4.3 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" />
    </svg>
  );
}

// Палитра главной вместо «Глины»: розовый остаётся только акцентом — надзаголовок, сердце, проценты уровней
export default function CompatibilityPage() {
  const library = getLibrary();
  return (
    <main className="inner-page inner-page--pair">
      <article className="page page--wide stack">
        <Breadcrumbs items={[{ name: "Совместимость пары", path: "/compatibility" }]} />
        <header className="inner-intro">
          <div className="inner-intro__copy">
            <p className="eyebrow">Для двоих</p>
            <h1 className="display">Тест на совместимость пары</h1>
            <p className="lead">{DESCRIPTION}</p>
          </div>
          <div className="pair-hero" aria-hidden="true">
            <div className="pair-hero__card">
              <img src="/home/hero-crystal.webp" alt="" width={908} height={1062} />
              <span>Ты</span>
            </div>
            <span className="pair-hero__heart">
              <HeartIcon />
            </span>
            <div className="pair-hero__card pair-hero__card--blush">
              <img src="/home/hero-crystal.webp" alt="" width={908} height={1062} />
              <span>Партнёр</span>
            </div>
          </div>
        </header>

        <section className="inner-block stack">
          <h2>Как это работает</h2>
          <ol className="steps">
            <li>Вы проходите тест — 50 утверждений, около 10 минут.</li>
            <li>На странице результата создаёте приглашение и отправляете ссылку партнёру.</li>
            <li>Партнёр проходит тест и соглашается показать результат вам — без согласия пара не создаётся.</li>
            <li>
              Вы оба видите типы друг друга и процент совместимости. Разбор пары — {formatRub(PRODUCT_PRICES.pair)}, открывается обоим,
              платит один.
            </li>
          </ol>
          <p>Выйти из пары можно в любой момент — страница пары и разбор скроются у обоих.</p>
        </section>

        <section className="inner-block stack">
          <h2>Из чего складывается процент</h2>
          <p>Процент складывается из двух равных частей:</p>
          <ul className="formula">
            <li>
              <img className="formula__icon" src="/home/hero-crystal.webp" alt="" width={908} height={1062} />
              <strong>Ресурс пары</strong> — {labels(RESOURCE_TRAITS)} обоих. Чем они выше, тем легче договариваться и переживать трудности.
            </li>
            <li>
              <svg className="formula__icon formula__icon--venn" viewBox="0 0 64 40" aria-hidden="true">
                <circle cx="24" cy="20" r="16" />
                <circle cx="40" cy="20" r="16" />
              </svg>
              <strong>Похожесть</strong> — насколько близки ваши {labels(SIMILARITY_TRAITS)}. В этих чертах похожие люди обычно понимают
              друг друга без объяснений.
            </li>
          </ul>
        </section>

        <section className="inner-block stack">
          <h2>Пять уровней совместимости</h2>
          <div className="level-grid">
            {COMPATIBILITY_LEVELS.map(({ min, level }) => {
              const texts = compatibilityTexts(library, level);
              return (
                <section key={level} className={`card stack level-card level-card--${level}`}>
                  <p className="level-card__percent">от {min}%</p>
                  <h3>{texts.phrase}</h3>
                  <p>{texts.text}</p>
                </section>
              );
            })}
          </div>
        </section>

        <p className="muted">Процент — повод поговорить о том, как вы устроены, а не приговор отношениям.</p>
        <TestCta title="Начните с себя" />
      </article>
    </main>
  );
}
