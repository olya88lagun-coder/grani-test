import { formatRub, PRODUCT_PRICES, type TypeCode } from "@grani/core";
import { typeCodeToDir } from "@grani/content";
import { getArticles } from "@grani/content/data";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, useId } from "react";
import { GemStone } from "@/components/GemStone";
import { gemStone, type GemFamily } from "@/lib/gem-stone";
import type { TypeShape } from "@/lib/gem-paths";
import { GemPortrait } from "@/components/GemPortrait";
import { gemAssetDir } from "@/lib/gem-assets";
import { HomeHeader } from "@/components/PublicHeader";
import { JsonLd } from "@/components/JsonLd";
import { articleDate, firstSentences, publicMetadata, siteJsonLd, typePath } from "@/lib/seo";
import { DeletedNotice } from "./DeletedNotice";
import styles from "./home-refined.module.css";

// Главная — бренд и продукт «Граней». Запрос «тест Big Five / большая пятёрка» отдан /big-five-test:
// две страницы под один запрос сменяли бы друг друга в выдаче
const HOME_TITLE = "Грани — тест личности по модели Big Five";
const HOME_DESCRIPTION =
  "«Грани» — тест личности: твой тип из 16, пять черт характера, взгляд друзей со стороны и карточка для сторис. Бесплатно, 10 минут.";

const HOME = publicMetadata({ title: HOME_TITLE, description: HOME_DESCRIPTION, path: "/" });

// Превью ссылки во ВКонтакте и мессенджерах показывает одну строку — около 40 знаков, поэтому
// для шеринга свой короткий заголовок и живое описание; <title> для поиска остаётся полным
const SHARE_TITLE = "Тест личности «Большая пятёрка» — Грани";
const SHARE_DESCRIPTION = "10 минут и 50 утверждений: твой тип, пять черт и как тебя видят друзья. Бесплатно.";

// absolute — чтобы шаблон «%s — Грани» не повторил название
export const metadata: Metadata = {
  ...HOME,
  title: { absolute: HOME_TITLE },
  openGraph: { ...HOME.openGraph, title: SHARE_TITLE, description: SHARE_DESCRIPTION },
  twitter: { ...HOME.twitter, title: SHARE_TITLE, description: SHARE_DESCRIPTION },
};

const HERO_TRAITS = [
  { label: "Открытость\nк новому", className: "home-crystal__label--openness" },
  { label: "Экстраверсия", className: "home-crystal__label--extra" },
  { label: "Доброжелательность", className: "home-crystal__label--agree" },
  { label: "Добросовестность", className: "home-crystal__label--conscience" },
  { label: "Эмоциональная\nустойчивость", className: "home-crystal__label--stable" },
] as const;

const FEATURES = [
  { title: "На основе", text: "Big Five", icon: "tree" },
  { title: "Показывает твой", text: "уникальный тип", icon: "person" },
  { title: "5 ключевых черт", text: "личности", icon: "bars" },
  { title: "Как тебя видят", text: "другие", icon: "eye" },
  { title: "Карточка для сторис", text: "чтобы поделиться типом", icon: "share" },
] as const;

const RESULT_TRAITS = [
  { label: "Открытость к новому", value: 87 },
  { label: "Экстраверсия", value: 74 },
  { label: "Доброжелательность", value: 81 },
  { label: "Добросовестность", value: 43 },
  { label: "Эмоциональная устойчивость", value: 68 },
] as const;

const RESULT_NOTES = [
  { title: "Как тебя видят другие", text: "Друзья ценят твою энергию, искренность и умение вдохновлять.", icon: "eye" },
  { title: "Сильные стороны", text: "Любознательность, вдохновение других и быстрая адаптация.", icon: "bolt" },
  { title: "Зоны роста", text: "Иногда берёшь на себя слишком много и доходишь не до конца.", icon: "target" },
] as const;

const TYPES: readonly { code: HomeTypeCode; title: string; tone: string; text: string }[] = [
  { code: "+-++", title: "Искра", tone: "leaf", text: "Энергия. Вдохновение. Новые идеи." },
  { code: "++--", title: "Архитектор", tone: "glass", text: "Структура. Анализ. Результат." },
  { code: "+--+", title: "Мечтатель", tone: "cloud", text: "Воображение. Глубина. Смысл." },
  { code: "-++-", title: "Командир", tone: "pyramid", text: "Лидерство. Уверенность. Движение." },
  { code: "-+++", title: "Опора", tone: "stone", text: "Надёжность. Стабильность. Забота." },
];

type HomeTypeCode = Extract<TypeCode, "+-++" | "++--" | "+--+" | "-++-" | "-+++">;

// Optical layers belong to the homepage; the shared GemStone geometry stays unchanged.
function HomeGem({ shape, family, size }: { shape: TypeShape; family: GemFamily; size: number }) {
  const id = useId();
  const { outline, facets } = gemStone(shape, family);
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <defs>
        {facets.map((facet, index) => {
          const points = facet.points.split(" ").map((point) => point.split(",").map(Number));
          const x = points.reduce((sum, point) => sum + point[0]!, 0) / points.length;
          const y = points.reduce((sum, point) => sum + point[1]!, 0) / points.length;
          const light = (1 + Math.cos(Math.atan2(y - 100, x - 100) + 2.3)) / 2;
          return (
            <linearGradient key={index} id={id + "-facet-" + index} x1="0" y1={index % 2 ? "1" : "0"} x2="1" y2={index % 2 ? "0" : "1"}>
              <stop offset="0" stopColor="#fff" stopOpacity={0.12 + light * 0.3} />
              <stop offset=".42" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" stopColor="#00140c" stopOpacity={0.18 + (1 - light) * 0.34} />
            </linearGradient>
          );
        })}
        <radialGradient id={id + "-reflection"} cx=".32" cy=".18" r=".85">
          <stop offset="0" stopColor="#fff" stopOpacity=".24" />
          <stop offset=".35" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#00140c" stopOpacity=".35" />
        </radialGradient>
      </defs>
      <GemStone shape={shape} family={family} size={200} />
      <g>
        {facets.map((facet, index) => (
          <polygon key={index} points={facet.points} fill={"url(#" + id + "-facet-" + index + ")"} />
        ))}
      </g>
      <polygon points={outline} fill={"url(#" + id + "-reflection)"} />
      <polygon points={outline} fill="none" stroke="var(--gold)" strokeOpacity=".6" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function HomeTypeGem({ code, size = 180 }: { code: HomeTypeCode; size?: number }) {
  return <GemPortrait dir={gemAssetDir(typeCodeToDir(code))} size={size} />;
}

const ARTICLE_CARDS = [
  { slug: "ekstravert-introvert", tag: "Личность", tone: "portrait", image: "/home/article-extrovert.webp" },
  { slug: "kak-menya-vidyat", tag: "Психология", tone: "interior", image: "/home/article-friends.webp" },
  { slug: "sovmestimost-par", tag: "Отношения", tone: "arch", image: "/home/article-relationship.webp" },
] as const;

// Карточки — настоящие статьи; пропавший slug роняет сборку, а не прячет карточку
function homeArticles() {
  const articles = getArticles();
  return ARTICLE_CARDS.map((card) => {
    const article = articles.find((item) => item.slug === card.slug);
    if (!article) throw new Error(`Home page article not found: ${card.slug}`);
    return { ...card, article, heading: article.title.split(":")[0]! };
  });
}

type IconName = (typeof FEATURES)[number]["icon"] | (typeof RESULT_NOTES)[number]["icon"];

function HomeIcon({ name }: { name: IconName }) {
  if (name === "tree") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 27V6m0 0 8 8m-8-8-8 8m8 4 6-6m-6 6-6-6" />
      </svg>
    );
  }
  if (name === "person") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="11" r="4" />
        <path d="M8 26c1.4-5.2 4.1-8 8-8s6.6 2.8 8 8" />
      </svg>
    );
  }
  if (name === "bars") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M8 25V14m8 11V7m8 18V11" />
      </svg>
    );
  }
  if (name === "eye") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M4 16s4.5-7 12-7 12 7 12 7-4.5 7-12 7S4 16 4 16Z" />
        <circle cx="16" cy="16" r="3" />
      </svg>
    );
  }
  if (name === "share") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="9" cy="16" r="3" />
        <circle cx="23" cy="8" r="3" />
        <circle cx="23" cy="24" r="3" />
        <path d="m12 14 8-4m-8 8 8 4" />
      </svg>
    );
  }
  if (name === "bolt") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M18 3 8 18h8l-2 11 10-16h-8l2-10Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="8" />
      <path d="M16 4v5m0 14v5m12-12h-5M9 16H4m18.5-8.5L19 11m-6 10-3.5 3.5" />
    </svg>
  );
}

const HERO_GEM_OUTLINE = gemStone("hexagon", 2).outline;

function CrystalScene() {
  return (
    <div className="home-crystal" aria-label="Гранёная схема личности">
      {HERO_TRAITS.map((trait) => (
        <span key={trait.className} className={`home-crystal__label ${trait.className}`}>
          {trait.label.split("\n").map((line) => (
            <span key={line}>{line}</span>
          ))}
        </span>
      ))}
      <svg className="home-crystal__diagram" viewBox="0 0 520 520" aria-hidden="true" focusable="false">
        <circle cx="260" cy="260" r="229" />
        <circle cx="260" cy="260" r="202" />
      </svg>
      <div className={styles.heroGem}>
        <HomeGem shape="hexagon" family={2} size={440} />
        <svg className={styles.sheenLayer} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
          <defs>
            <clipPath id="home-gem-cut"><polygon points={HERO_GEM_OUTLINE} /></clipPath>
            <linearGradient id="home-gem-light" x1="0" x2="1">
              <stop offset="0" stopColor="var(--ink)" stopOpacity="0" />
              <stop offset=".5" stopColor="var(--ink)" stopOpacity=".35" />
              <stop offset="1" stopColor="var(--ink)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g clipPath="url(#home-gem-cut)">
            <rect className={styles.sheen} x="-90" y="-40" width="70" height="280" fill="url(#home-gem-light)" />
          </g>
        </svg>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className={`home-page ${styles.page}`}>
      <section className="home-hero" data-band="night" aria-labelledby="home-title">
        <HomeHeader />

        <div className="home-hero__grid">
          <div className="home-hero__copy">
            <Suspense>
              <DeletedNotice />
            </Suspense>
            {/* Подпись над крупной фразой — часть заголовка; поисковый запрос про Big Five ведёт на /big-five-test */}
            <h1 id="home-title">
              <span className="home-kicker">Тест личности «Грани»</span>
              <span className="home-title__main">Узнай себя <em>глубже</em></span>
            </h1>
            <p className="home-lead">
              <span>50 утверждений — твой тип личности.</span>
              <span>Пять ключевых черт, взгляд друзей и карточка для сторис.</span>
            </p>
            <div className="home-hero__actions">
              <Link className="button button--lg" href="/test">
                Пройти тест <span aria-hidden="true">→</span>
              </Link>
              <Link className={styles.secondaryAction} href="/big-five-test">о тесте Big Five</Link>
            </div>
            <div className="home-time">
              Бесплатно · ≈ 10 минут
            </div>
          </div>
          <CrystalScene />
        </div>
      </section>

      <section className="home-feature-strip" data-band="night" aria-label="Что даёт тест">
        {FEATURES.map((feature) => (
          <div className="home-feature" key={`${feature.title}-${feature.text}`}>
            <span className="home-feature__icon">
              <HomeIcon name={feature.icon} />
            </span>
            <span>
              <b>{feature.title}</b>
              <small>{feature.text}</small>
            </span>
          </div>
        ))}
      </section>

      <section id="about" className="home-section home-result" aria-labelledby="result-title">
        <div className="home-section__copy">
          <p className="home-kicker">Твой результат</p>
          <h2 id="result-title">Больше, чем просто тип</h2>
          <p>
            Бесплатно ты получишь свой тип, 5 ключевых черт и карточку для сторис. Если захочется глубже — подробный
            разбор можно открыть отдельно за {formatRub(PRODUCT_PRICES.full)}.
          </p>
          <Link className="button button--lg" href="/test">
            Пройти тест <span aria-hidden="true">→</span>
          </Link>
        </div>

        <article className="home-result-card" aria-label="Пример карточки результата">
          <div className="home-result-card__art">
            <span className="home-example">Пример</span>
            <HomeTypeGem code="+-++" />
          </div>
          <p>Твой тип</p>
          <h3>Искра</h3>
          <span>Энергия · Вдохновение · Новые идеи</span>
          <div className="home-result-card__scales">
            {RESULT_TRAITS.map((trait) => (
              <div className="home-scale" key={trait.label}>
                <div>
                  <span>{trait.label}</span>
                  <b>{trait.value}%</b>
                </div>
                <i>
                  <span style={{ width: `${trait.value}%` }} />
                </i>
              </div>
            ))}
          </div>
        </article>

        <div className="home-note-cards">
          {RESULT_NOTES.map((note) => (
            <article className="home-note-card" key={note.title}>
              <span className="home-note-card__icon">
                <HomeIcon name={note.icon} />
              </span>
              <h3>{note.title}</h3>
              <p>{note.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-types" data-band="night" aria-labelledby="types-title">
        <div className="home-section__copy">
          <p className="home-kicker">16 типов личности</p>
          <h2 id="types-title">Разные грани — одинаково ценные</h2>
          <p>Каждый тип уникален. Нет «лучших» или «худших» — есть просто разные способы быть собой.</p>
          <Link className="button" href="/types">
            Все типы <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="home-type-carousel" aria-label="Примеры типов личности">
          {TYPES.map((type) => (
            <article className={`home-type-card home-type-card--${type.tone}`} key={type.code}>
              <div className="home-type-card__art">
                <HomeTypeGem code={type.code} size={240} />
              </div>
              <h3>{type.title}</h3>
              <p>{type.text}</p>
              <Link href={typePath(type.code)} aria-label={`Смотреть тип ${type.title}`}>
                <span>О типе</span><span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-pair" aria-labelledby="pair-title">
        <div className="home-section__copy">
          <p className="home-kicker">Совместимость</p>
          <h2 id="pair-title">Как ваши грани сочетаются</h2>
          <p>
            Пройдите тест отдельно, получите свой тип и сравните, насколько вы сходны и в чём дополняете друг друга.
          </p>
          <Link className="button button--lg" href="/compatibility">
            Проверить совместимость <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="home-pair__cards" aria-label="Пример совместимости">
          <article className="home-person-card home-person-card--leaf">
            <div className={styles.personGem}><HomeTypeGem code="+-++" /></div>
            <h3>Искра</h3>
          </article>
          <div className="home-pair-score">
            <span className="home-example">Пример</span>
            <span aria-hidden="true">♥</span>
            <strong>78%</strong>
            <p>Совместимость</p>
            <small>Вам легко вместе в развитии, общении и новых идеях.</small>
          </div>
          <article className="home-person-card home-person-card--glass">
            <div className={styles.personGem}><HomeTypeGem code="++--" /></div>
            <h3>Архитектор</h3>
          </article>
          <div className="home-pair-list">
            <b>Вам легко вместе в:</b>
            <span>общении</span>
            <span>интересе к новому</span>
            <span>поддержке идей</span>
            <b>Стоит договориться о:</b>
            <em>планировании</em>
            <em>темпе жизни</em>
            <em>распределении обязанностей</em>
          </div>
        </div>
      </section>

      <section className="home-section home-articles" aria-labelledby="articles-title">
        <div className="home-section__copy">
          <p className="home-kicker">Статьи</p>
          <h2 id="articles-title">Понимать себя и других — проще</h2>
          <p>Полезные материалы о личности, отношениях и психологии — простыми словами и с научной основой.</p>
          <Link className="button" href="/articles">
            Все статьи <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="home-article-grid">
          {homeArticles().map(({ slug, tag, tone, image, article, heading }) => (
            <article className="home-article-card" key={slug}>
              <div className={`home-article-card__image home-article-card__image--${tone}`}>
                <img src={image} alt="" width={630} height={698} loading="lazy" decoding="async" />
                <span>{tag}</span>
              </div>
              <h3>{heading}</h3>
              <p>{firstSentences(article.description, 120)}</p>
              <small>{articleDate(article.date)}</small>
              <Link href={`/articles/${slug}`} aria-label={`Открыть статью ${article.title}`}>
                <span>Читать статью</span><span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
      </section>
      <JsonLd data={siteJsonLd(HOME_DESCRIPTION)} />
    </main>
  );
}
