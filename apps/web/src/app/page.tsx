import type { TypeCode } from "@grani/core";
import { typeCodeToDir } from "@grani/content";
import { getArticles } from "@grani/content/data";
import type { Metadata } from "next";
import Link from "next/link";
import { TypeGem } from "@/components/TypeGem";
import { articleDate, firstSentences, publicMetadata, typePath } from "@/lib/seo";
import { TYPE_VISUALS, type TypeVisual } from "@/lib/type-visuals";

const HOME = publicMetadata({
  title: "Грани — тест личности: 16 типов и как тебя видят другие",
  description:
    "Бесплатный тест личности по Большой пятёрке: 50 утверждений, один из 16 типов, пять шкал и анкета для друзей «Как меня видят другие». 10 минут.",
  path: "/",
});

// absolute — чтобы шаблон «%s — Грани» не повторил название
export const metadata: Metadata = { ...HOME, title: { absolute: "Грани — тест личности: 16 типов и как тебя видят другие" } };

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
  { title: "Красивую карточку", text: "можно поделиться", icon: "share" },
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

const TYPES: readonly { code: TypeCode; title: string; tone: string; text: string }[] = [
  { code: "+-++", title: "Искра", tone: "leaf", text: "Энергия. Вдохновение. Новые идеи." },
  { code: "++--", title: "Архитектор", tone: "glass", text: "Структура. Анализ. Результат." },
  { code: "+--+", title: "Мечтатель", tone: "cloud", text: "Воображение. Глубина. Смысл." },
  { code: "-++-", title: "Командир", tone: "pyramid", text: "Лидерство. Уверенность. Движение." },
  { code: "-+++", title: "Опора", tone: "stone", text: "Надёжность. Стабильность. Забота." },
];

const PAIR_TYPE: TypeCode = "++--";

// Значок типа тот же, что в каталоге и на странице типа
function typeVisual(code: TypeCode): TypeVisual {
  return TYPE_VISUALS[typeCodeToDir(code)]!;
}

const ARTICLE_CARDS = [
  { slug: "ekstravert-introvert", tag: "Личность", tone: "portrait" },
  { slug: "kak-menya-vidyat", tag: "Психология", tone: "interior" },
  { slug: "sovmestimost-par", tag: "Отношения", tone: "arch" },
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

function BotanicalMark() {
  return (
    <span className="home-botanical" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

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
      <svg className="home-crystal__diagram" viewBox="0 0 520 420" aria-hidden="true">
        <path d="M260 34 454 132 454 284 260 386 66 284 66 132Z" />
        <path d="M66 132 260 210 454 132M66 284 260 210 454 284M260 34v352M66 132l194 254M454 132 260 386" />
        <circle cx="66" cy="132" r="4" />
        <circle cx="454" cy="132" r="4" />
        <circle cx="454" cy="284" r="4" />
        <circle cx="66" cy="284" r="4" />
      </svg>
      <svg className="home-crystal__gem" viewBox="0 0 320 320" aria-hidden="true">
        <defs>
          <linearGradient id="homeGemA" x1="52" y1="24" x2="292" y2="294" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fbf8e9" />
            <stop offset="0.35" stopColor="#bbd4a8" />
            <stop offset="0.72" stopColor="#47794e" />
            <stop offset="1" stopColor="#113f1d" />
          </linearGradient>
        </defs>
        <path className="home-crystal__base" d="M160 18 286 92 286 232 160 306 34 232 34 92Z" />
        <path className="home-crystal__facet home-crystal__facet--1" d="M160 18 286 92 160 132 34 92Z" />
        <path className="home-crystal__facet home-crystal__facet--2" d="M34 92 160 132 92 182 34 232Z" />
        <path className="home-crystal__facet home-crystal__facet--3" d="M286 92 160 132 228 182 286 232Z" />
        <path className="home-crystal__facet home-crystal__facet--4" d="M92 182 160 132 228 182 160 306Z" />
        <path className="home-crystal__facet home-crystal__facet--5" d="M34 232 92 182 160 306Z" />
        <path className="home-crystal__facet home-crystal__facet--6" d="M286 232 228 182 160 306Z" />
        <path className="home-crystal__shine" d="M160 18 208 106 160 132 118 104Z" />
        <path className="home-crystal__lines" d="M160 18v288M34 92h252M34 232h252M34 92l126 40 126-40M92 182h136M34 232l126-100 126 100M92 182l68 124 68-124" />
      </svg>
    </div>
  );
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  return (
    <main className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__wash" aria-hidden="true" />
        <div className="home-hero__leaf home-hero__leaf--left" aria-hidden="true" />
        <div className="home-hero__leaf home-hero__leaf--right" aria-hidden="true" />
        <div className="home-hero__arch" aria-hidden="true" />
        <header className="home-nav" aria-label="Основная навигация">
          <Link className="home-brand" href="/" aria-label="Грани">
            <span className="home-brand__mark" aria-hidden="true">
              <TypeGem shape="hexagon" size={30} />
            </span>
            <span>грани</span>
          </Link>
          <nav>
            <Link href="/test">Пройти тест</Link>
            <Link href="/types">16 типов</Link>
            <Link href="/compatibility">Совместимость</Link>
            <Link href="/articles">Статьи</Link>
            <Link href="#about">О проекте</Link>
          </nav>
          <Link className="home-login" href="/me">
            Войти
          </Link>
        </header>

        <div className="home-hero__grid">
          <div className="home-hero__copy">
            {deleted === "1" && (
              <p className="home-status" role="status">
                Данные удалены. Спасибо, что были с нами.
              </p>
            )}
            <p className="home-kicker">Научный тест личности</p>
            <h1 id="home-title">Узнай себя глубже</h1>
            <p className="home-lead">
              <span>50 утверждений → твой тип личности</span>
              <span>5 ключевых черт → взгляд окружающих → карточка для сторис</span>
            </p>
            <div className="home-hero__actions">
              <Link className="button button--lg" href="/test">
                Пройти тест <span aria-hidden="true">→</span>
              </Link>
              <span className="home-time">Бесплатно · ≈ 10 минут</span>
            </div>
          </div>
          <CrystalScene />
        </div>
      </section>

      <section className="home-feature-strip" aria-label="Что даёт тест">
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
            разбор можно открыть отдельно за 299 ₽.
          </p>
          <Link className="button button--lg" href="/test">
            Пройти тест <span aria-hidden="true">→</span>
          </Link>
        </div>

        <article className="home-result-card" aria-label="Пример карточки результата">
          <div className="home-result-card__art">
            <BotanicalMark />
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

      <section className="home-section home-types" aria-labelledby="types-title">
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
                <span className="type-gem" data-family={typeVisual(type.code).family}>
                  <TypeGem shape={typeVisual(type.code).shape} size={58} />
                </span>
                {type.tone === "leaf" && <BotanicalMark />}
              </div>
              <h3>{type.title}</h3>
              <p>{type.text}</p>
              <Link href={typePath(type.code)} aria-label={`Смотреть тип ${type.title}`}>
                →
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
            <h3>Искра</h3>
            <BotanicalMark />
          </article>
          <div className="home-pair-score">
            <span aria-hidden="true">♥</span>
            <strong>78%</strong>
            <p>Совместимость</p>
            <small>Вам легко вместе в развитии, общении и новых идеях.</small>
          </div>
          <article className="home-person-card home-person-card--glass">
            <h3>Архитектор</h3>
            <span className="type-gem" data-family={typeVisual(PAIR_TYPE).family}>
              <TypeGem shape={typeVisual(PAIR_TYPE).shape} size={82} />
            </span>
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
          {homeArticles().map(({ slug, tag, tone, article, heading }) => (
            <article className="home-article-card" key={slug}>
              <div className={`home-article-card__image home-article-card__image--${tone}`}>
                <span>{tag}</span>
              </div>
              <h3>{heading}</h3>
              <p>{firstSentences(article.description, 120)}</p>
              <small>{articleDate(article.date)}</small>
              <Link href={`/articles/${slug}`} aria-label={`Открыть статью ${article.title}`}>
                →
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
