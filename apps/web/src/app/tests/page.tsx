import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { publicMetadata, webPageJsonLd } from "@/lib/seo";
import styles from "./tests.module.css";

const PATH = "/tests";
const TITLE = "Тесты личности онлайн — Big Five, темперамент и привязанность";
const DESCRIPTION =
  "Все бесплатные тесты «Граней»: Big Five за 10 минут, темперамент и тип привязанности без регистрации. Результат сразу; VK ID нужен только чтобы сохранить.";

export const metadata = publicMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const TESTS = [
  {
    href: "/test",
    aboutHref: "/big-five-test",
    aboutLabel: "О тесте Big Five",
    eyebrow: "Главный тест",
    title: "Big Five — Большая пятёрка",
    benefit: "Тип личности и пять черт характера: как ты устроен в целом.",
    meta: "50 утверждений · ≈ 10 минут · бесплатно",
    access: "Результат видно сразу. VK ID — чтобы сохранить, поделиться карточкой или купить разбор.",
    cta: "Пройти Big Five",
    featured: true,
  },
  {
    href: "/temperament",
    aboutHref: null,
    aboutLabel: null,
    eyebrow: "Без регистрации",
    title: "Тест на темперамент",
    benefit: "Холерик, сангвиник, флегматик или меланхолик — как быстро ты загораешься и сколько общения тебе нужно.",
    meta: "24 утверждения · ≈ 4 минуты · бесплатно",
    access: "Результат сразу в браузере, вход не нужен.",
    cta: "Пройти тест",
    featured: false,
  },
  {
    href: "/privyazannost",
    aboutHref: null,
    aboutLabel: null,
    eyebrow: "Без регистрации",
    title: "Тест на тип привязанности",
    benefit: "Как ты реагируешь на близость и дистанцию: надёжный, тревожный, избегающий или тревожно-избегающий тип.",
    meta: "30 утверждений · ≈ 5 минут · бесплатно",
    access: "Результат сразу в браузере, вход не нужен. Можно пройти вдвоём с партнёром.",
    cta: "Пройти тест",
    featured: false,
  },
] as const;

export default function TestsHubPage() {
  return (
    <main className={`inner-page ${styles.page}`} data-night-entry data-band="night">
      <JsonLd data={webPageJsonLd({ title: TITLE, description: DESCRIPTION, path: PATH })} />
      <section className={styles.hero}>
        <div className={styles.wrap}>
          <Breadcrumbs items={[{ name: "Тесты", path: PATH }]} />
          <header className={styles.intro}>
            <p className={styles.eyebrow}>Грани</p>
            <h1>Тесты личности</h1>
            <p className={styles.lead}>
              Выбери тест под задачу. Короткие — без регистрации, результат сразу. Big Five — главный портрет личности: тип и шкалы тоже видны сразу, а сохранить их можно через VK ID.
            </p>
          </header>
        </div>
      </section>

      <div className={styles.body}>
        <ul className={styles.list}>
          {TESTS.map((test) => (
            <li key={test.href} className={test.featured ? styles.cardFeatured : styles.card} data-band="night">
              <div className={styles.cardCopy}>
                <p className={styles.cardEyebrow}>{test.eyebrow}</p>
                <h2>{test.title}</h2>
                <p className={styles.benefit}>{test.benefit}</p>
                <p className={styles.meta}>{test.meta}</p>
                <p className={styles.access}>{test.access}</p>
              </div>
              <div className={styles.cardActions}>
                <Link className="button" href={test.href}>
                  {test.cta} <span aria-hidden="true">→</span>
                </Link>
                {test.aboutHref && test.aboutLabel ? (
                  <Link className={styles.secondary} href={test.aboutHref}>
                    {test.aboutLabel}
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
