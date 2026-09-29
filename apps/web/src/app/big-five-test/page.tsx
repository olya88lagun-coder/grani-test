import { METHOD_SOURCES, TRAIT_LABELS } from "@grani/content";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { SourceList } from "@/components/SourceList";
import { TestCta } from "@/components/TestCta";
import { faqJsonLd, publicMetadata, traitPath, webPageJsonLd } from "@/lib/seo";

const TITLE = "Тест Big Five онлайн бесплатно — Большая пятёрка личности";
const DESCRIPTION =
  "Бесплатный тест Big Five на русском: 50 утверждений, около 10 минут, результат сразу. Узнай свой уровень открытости, добросовестности, экстраверсии, доброжелательности и эмоциональной устойчивости.";
const PATH = "/big-five-test";

export const metadata = publicMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FACTS = ["50 утверждений", "≈ 10 минут", "бесплатно", "на русском языке"] as const;

const TRAIT_LINKS = [
  ["openness", "Открытость к новому"],
  ["conscientiousness", "Добросовестность"],
  ["extraversion", "Экстраверсия"],
  ["agreeableness", "Доброжелательность"],
  ["stability", "Эмоциональная устойчивость"],
] as const;

// У каждой черты свой смысл — не один абзац с подменой названия
const TRAIT_TEXTS: Readonly<Record<(typeof TRAIT_LINKS)[number][0], string>> = {
  openness:
    "Воображение, любознательность и интерес к новому. Высокая открытость тянет к идеям, искусству и непривычным способам смотреть на вещи; низкая — к практичности и проверенному, что тоже сила там, где нужна надёжность.",
  conscientiousness:
    "Самодисциплина, организованность и доведение дел до конца. Высокая добросовестность — это планы, списки и сдержанное слово; низкая — гибкость и спонтанность, но дедлайны и рутина даются труднее.",
  extraversion:
    "Откуда берётся энергия. Экстраверты заряжаются от людей, движения и новых впечатлений; интроверты восстанавливаются в тишине и глубоких разговорах один на один — это не то же самое, что застенчивость.",
  agreeableness:
    "Эмпатия, доверие и стиль в конфликтах. Высокая доброжелательность ищет согласие и легко уступает; низкая — прямота и готовность отстаивать свою позицию, даже если это кому-то неудобно.",
  stability:
    "Как ты реагируешь на стресс и как быстро восстанавливаешься. Высокая устойчивость — спокойствие под давлением; низкая — более острые переживания и тревога, но вместе с ними тонкая чувствительность к себе и другим.",
};

function TestButton({ label = "Пройти тест бесплатно" }: { label?: string }) {
  return (
    <p>
      <Link className="button" href="/test">
        {label} <span aria-hidden="true">→</span>
      </Link>
    </p>
  );
}

const FAQ = [
  {
    question: "Что такое тест Big Five?",
    answer: "Это опросник по модели «Большая пятёрка», который описывает личность через пять широких черт, а не через диагнозы или оценку человека.",
  },
  {
    question: "Сколько времени занимает тест?",
    answer: "Обычно около 10 минут: нужно ответить на 50 коротких утверждений о привычном поведении и восприятии себя.",
  },
  {
    question: "Можно ли пройти тест бесплатно?",
    answer: "Да. В «Гранях» бесплатный результат показывает тип, пять шкал и карточку, которой можно поделиться.",
  },
  {
    question: "Чем Big Five отличается от MBTI?",
    answer: "Big Five измеряет выраженность черт по шкалам. MBTI делит людей на типы, поэтому эти системы нельзя напрямую приравнивать друг к другу.",
  },
  {
    question: "Нужно ли регистрироваться?",
    answer: "Пройти тест можно без регистрации. Чтобы увидеть и сохранить результат, нужно войти через VK ID — так к нему можно вернуться позже.",
  },
  {
    question: "Можно ли пройти повторно?",
    answer: "Да, но лучше отвечать по обычному поведению за последние месяцы, а не под настроение одного дня.",
  },
] as const;

export default function BigFiveTestPage() {
  return (
    <main className="inner-page">
      <div className="page page--wide stack">
        <Breadcrumbs items={[{ name: "Тест Big Five", path: PATH }]} />
        <section className="home-section home-result" aria-labelledby="big-five-title">
          <div className="home-section__copy">
            <p className="home-kicker">Big Five · OCEAN · IPIP-50</p>
            <h1 id="big-five-title" className="display">
              Тест Big Five — Большая пятёрка личности
            </h1>
            <p className="lead">Бесплатно, 50 утверждений, около 10 минут — и сразу результат: профиль по пяти чертам и один из 16 типов «Граней».</p>
            <div className="home-hero__actions">
              <Link className="button button--lg" href="/test">
                Пройти тест бесплатно <span aria-hidden="true">→</span>
              </Link>
              <span className="home-time">Результат сразу после ответов</span>
            </div>
          </div>
          <article className="home-result-card" aria-label="Что внутри теста">
            <div className="home-result-card__art">
              <img src="/home/hero-crystal.webp" alt="" width={908} height={1062} loading="eager" decoding="async" />
            </div>
            <p>Что покажет тест</p>
            <h2>5 черт + тип</h2>
            <span>Профиль личности простым языком</span>
            <div className="home-result-card__scales">
              {TRAIT_LINKS.map(([trait, label], index) => (
                <div className="home-scale" key={trait}>
                  <div>
                    <span>{label}</span>
                    <b>{70 - index * 7}%</b>
                  </div>
                  <i>
                    <span style={{ width: `${70 - index * 7}%` }} />
                  </i>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="home-feature-strip" aria-label="Кратко о тесте">
          {FACTS.map((fact) => (
            <div className="home-feature" key={fact}>
              <span>
                <b>{fact}</b>
                <small>Big Five</small>
              </span>
            </div>
          ))}
        </section>

        <section className="stack" aria-labelledby="what-shows">
          <h2 id="what-shows">Что измеряет тест: пять черт Big Five</h2>
          <p>
            «Большая пятёрка» описывает личность не типом-ярлыком, а пятью шкалами. У каждой два полюса, и сильные стороны есть на любом из них — важно не «сколько баллов хорошо», а как черта проявляется именно у тебя.
          </p>
          <div className="article-grid">
            {TRAIT_LINKS.map(([trait, label]) => (
              <article className="card stack" key={trait}>
                <h3>{label}</h3>
                <p>{TRAIT_TEXTS[trait]}</p>
                <p className="row">
                  <Link href={traitPath(trait, "high")}>{TRAIT_LABELS[trait]}: высокая</Link>
                  <Link href={traitPath(trait, "low")}>низкая</Link>
                </p>
              </article>
            ))}
          </div>
        </section>

        <TestButton label="Узнать свои пять черт" />

        <section className="stack" aria-labelledby="how-it-works">
          <h2 id="how-it-works">Как считается результат</h2>
          <p>
            Основа теста — IPIP-50: 50 утверждений из открытого банка International Personality Item Pool. По каждой из пяти черт есть прямые и обратные утверждения, поэтому итог меньше зависит от привычки соглашаться со всем подряд.
          </p>
          <p>
            После прохождения четыре черты складываются в один из <Link href="/types">16 типов «Граней»</Link>, а эмоциональная устойчивость уточняет, спокойный или чувствительный оттенок у результата. Это не медицинская оценка и не психологическое заключение.
          </p>
        </section>

        <section className="stack" aria-labelledby="what-you-get">
          <h2 id="what-you-get">Что ты получишь</h2>
          <ul>
            <li>пять шкал личности с понятной расшифровкой;</li>
            <li>тип «Граней» и короткое описание сильных сторон;</li>
            <li>зоны роста без обесценивания и диагнозов;</li>
            <li>карточку результата, которой можно поделиться;</li>
            <li>возможность сравнить самооценку с тем, как тебя видят друзья.</li>
          </ul>
          <TestButton />
        </section>

        <section className="stack" aria-labelledby="accuracy">
          <h2 id="accuracy">Насколько точен тест</h2>
          <p>
            «Большая пятёрка» — самая изученная модель личности в психологии: её черты воспроизводятся в разных странах и довольно устойчивы у взрослых на протяжении лет. IPIP-50 — короткая открытая версия опросника, поэтому она хорошо показывает общий профиль, но не заменяет длинные методики и тем более консультацию специалиста.
          </p>
          <p>
            Точнее всего результат, когда отвечаешь про обычное поведение за последние месяцы, а не про один удачный или трудный день. Подробнее — на странице <Link href="/about">о методике «Граней»</Link>.
          </p>
        </section>

        <section className="stack" aria-labelledby="who">
          <h2 id="who">Кому подходит</h2>
          <p>
            Тем, кто хочет лучше понять себя и свои реакции, выбирает работу или ритм жизни, хочет спокойнее договариваться с близкими или просто любопытно, как описывает личность современная психология. Тест рассчитан на взрослых и не предназначен для диагностики.
          </p>
        </section>

        <section className="stack" aria-labelledby="faq">
          <h2 id="faq">Вопросы о тесте Big Five</h2>
          {FAQ.map((item) => (
            <article className="card stack" key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </section>

        <SourceList sources={METHOD_SOURCES} />
        <TestCta title="Пройти тест Big Five бесплатно" />
        <JsonLd data={webPageJsonLd({ title: TITLE, description: DESCRIPTION, path: PATH })} />
        <JsonLd data={faqJsonLd(FAQ)} />
      </div>
    </main>
  );
}
