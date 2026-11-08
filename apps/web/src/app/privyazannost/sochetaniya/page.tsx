import { ATTACHMENT_COMBINATIONS, getShortTest } from "@grani/content/short-tests";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { faqJsonLd, publicMetadata, webPageJsonLd } from "@/lib/seo";
import styles from "@/components/short-tests/short-test-page.module.css";

const PATH = "/privyazannost/sochetaniya";
const TITLE = "Сочетания типов привязанности в паре";
const DESCRIPTION = "Все 10 сочетаний типов привязанности в паре: как сходятся надёжный, тревожный, избегающий и тревожно-избегающий типы и что помогает каждой паре.";
const H1 = "Сочетания типов привязанности в паре";
const BRIEF =
  "Типов привязанности четыре, поэтому сочетаний в паре — десять. Ни одно из них не обречено: у каждого есть своя типичная ловушка и свои способы её обойти. " +
  "Самое известное и самое трудное сочетание — тревожный и избегающий партнёры, «погоня и побег». Самое спокойное — два надёжных партнёра. Узнать своё сочетание можно, пройдя тест вдвоём.";
const FAQ = [
  {
    question: "Какое сочетание типов привязанности самое удачное?",
    answer:
      "Самое спокойное — когда оба партнёра надёжны или хотя бы один из них надёжный. Но удачной пару делает не сочетание, а то, умеют ли двое говорить о своих реакциях. Пары с любым сочетанием живут долго и хорошо, если видят свою схему и договариваются.",
  },
  {
    question: "Могут ли тревожный и избегающий партнёры быть вместе?",
    answer:
      "Да. Это трудное сочетание, потому что реакции партнёров усиливают друг друга: один догоняет, другой отходит. Но когда оба видят этот круг, договариваются о паузах и перестают винить друг друга, отношения становятся заметно спокойнее.",
  },
  {
    question: "Меняется ли тип привязанности в отношениях?",
    answer:
      "Меняется, хоть и медленно. Долгие отношения с надёжным партнёром, дружба и работа с психологом снижают тревожность и избегание. Поэтому сочетание в паре через несколько лет может стать другим.",
  },
  {
    question: "Как узнать сочетание типов в нашей паре?",
    answer:
      "Пройдите тест на тип привязанности и позовите партнёра по ссылке. Когда он пройдёт тест и согласится объединить результаты, вы оба увидите общую карту: две точки, название сочетания и вашу динамику. Это бесплатно.",
  },
];

export const metadata = publicMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

// Все десять сочетаний на одной странице вместо десяти тонких. Вёрстка — за Codex
export default function AttachmentCombinationsPage() {
  const test = getShortTest("attachment")!;
  // «Надёжный и тревожный: якорь и волна» — в заголовке оба типа, чтобы раздел находился по запросу о паре типов
  const short = (key: string) => test.types.find((type) => type.key === key)?.name.split(" ")[0] ?? key;
  const heading = (key: string, name: string) => {
    const [a, b] = key.split("+") as [string, string];
    return `${short(a)} и ${short(b).toLowerCase()}: ${name.toLowerCase()}`;
  };
  return (
    <main className={styles.landing} data-palette="pair">
      <JsonLd data={webPageJsonLd({ title: TITLE, description: DESCRIPTION, path: PATH })} />
      <JsonLd data={faqJsonLd(FAQ)} />
      <div className={styles.container}>
        <article className={styles.reading}>
          <Breadcrumbs items={[{ name: test.h1, path: test.path }, { name: H1, path: PATH }]} />
          <h1 className={styles.title}>{H1}</h1>
          <section className={styles.brief}>
            <h2>Кратко</h2>
            <p>{BRIEF}</p>
          </section>
          {ATTACHMENT_COMBINATIONS.map((combination) => (
            <section key={combination.key} id={combination.key}>
              <h2>{heading(combination.key, combination.name)}</h2>
              <p>
                <b>{combination.phrase}</b>
              </p>
              <p>{combination.text}</p>
            </section>
          ))}
          <section>
            <h2>Вопросы и ответы</h2>
            {FAQ.map((item) => (
              <details key={item.question} className={styles.faq}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </section>
          <p>
            <Link className="button" href={test.path}>
              Пройти тест на тип привязанности
            </Link>
          </p>
          <p className="muted">{test.disclaimer}</p>
        </article>
      </div>
    </main>
  );
}
