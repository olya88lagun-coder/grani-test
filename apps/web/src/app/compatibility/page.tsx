import { COMPATIBILITY_LEVELS, formatRub, PRODUCT_PRICES, RESOURCE_TRAITS, SIMILARITY_TRAITS } from "@grani/core";
import { compatibilityTexts, TRAIT_LABELS } from "@grani/content";
import { getLibrary } from "@grani/content/data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { TestCta } from "@/components/TestCta";
import { publicMetadata } from "@/lib/seo";

const DESCRIPTION = "Пройдите тест вдвоём и узнайте процент совместимости по Большой пятёрке. Бесплатно — типы обоих и процент, подробный разбор пары — по желанию.";

export const metadata = publicMetadata({ title: "Тест на совместимость пары", description: DESCRIPTION, path: "/compatibility" });

const labels = (traits: readonly (keyof typeof TRAIT_LABELS)[]) => traits.map((trait) => TRAIT_LABELS[trait].toLowerCase()).join(", ");

export default function CompatibilityPage() {
  const library = getLibrary();
  return (
    <main className="page" data-palette="pair">
      <article className="stack">
        <Breadcrumbs items={[{ name: "Совместимость пары", path: "/compatibility" }]} />
        <p className="eyebrow">Для двоих</p>
        <h1 className="display">Тест на совместимость пары</h1>
        <p className="lead">{DESCRIPTION}</p>

        <h2>Как это работает</h2>
        <ol>
          <li>Вы проходите тест — 50 утверждений, около 10 минут.</li>
          <li>На странице результата создаёте приглашение и отправляете ссылку партнёру.</li>
          <li>Партнёр проходит тест и соглашается показать результат вам — без согласия пара не создаётся.</li>
          <li>
            Вы оба видите типы друг друга и процент совместимости. Разбор пары — {formatRub(PRODUCT_PRICES.pair)}, открывается обоим, платит
            один.
          </li>
        </ol>
        <p>Выйти из пары можно в любой момент — страница пары и разбор скроются у обоих.</p>

        <h2>Из чего складывается процент</h2>
        <p>Процент складывается из двух равных частей:</p>
        <ul>
          <li>
            <strong>Ресурс пары</strong> — {labels(RESOURCE_TRAITS)} обоих. Чем они выше, тем легче договариваться и переживать трудности.
          </li>
          <li>
            <strong>Похожесть</strong> — насколько близки ваши {labels(SIMILARITY_TRAITS)}. В этих чертах похожие люди обычно понимают друг
            друга без объяснений.
          </li>
        </ul>

        <h2>Пять уровней совместимости</h2>
        {COMPATIBILITY_LEVELS.map(({ min, level }) => {
          const texts = compatibilityTexts(library, level);
          return (
            <section key={level} className="card stack">
              <p className="eyebrow">от {min}%</p>
              <h3>{texts.phrase}</h3>
              <p>{texts.text}</p>
            </section>
          );
        })}

        <p className="muted">Процент — повод поговорить о том, как вы устроены, а не приговор отношениям.</p>
        <TestCta title="Начните с себя" />
      </article>
    </main>
  );
}
