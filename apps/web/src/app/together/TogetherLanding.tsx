import Image from "next/image";
import type { ReactNode } from "react";
import { PAIR_PRODUCTS } from "@/lib/pair-products";
import { TOGETHER_MONTHS, TOGETHER_TRACK } from "@grani/content/together";
import { TOGETHER_SEASON } from "@grani/content/together-season";
import { formatRub, TOGETHER_PERIOD_DAYS, TOGETHER_PRICE_KOPECKS } from "@grani/core";
import { DATA_STORAGE, TOGETHER_REFUND_DAYS } from "@/lib/legal";
import styles from "./together-landing.module.css";

const question = TOGETHER_TRACK.find((card) => card.id === "m01-d01")!;
// В макете это идея для свидания из месяца 4, но в каталоге она является вопросом.
const dateIdea = TOGETHER_MONTHS[4]!.find((card) => card.id === "m04-d02")!;
const date = TOGETHER_TRACK.find((card) => card.id === "m01-d07")!;
const firstMonth = TOGETHER_SEASON[0]!;
const price = formatRub(TOGETHER_PRICE_KOPECKS);
const benefits = [
  ["conversation", "Разговоры", "Вопросы, на которые редко находится время."],
  ["heart", "Свидания", "Небольшие идеи для совместного времени."],
  ["pair", "Ваша история", "Каждый отвечает сам. Ответы открываются, когда ответили оба."],
  ["spark", "Новое каждый месяц", "Темы и карточки открываются постепенно."],
] as const;

function Icon({ kind }: { kind: string }) {
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "conversation" ? <path d="M26 15c0 6-5 10-11 10l-7 3 1-6c-3-2-5-4-5-7C4 9 9 5 15 5s11 4 11 10Z" />
      : kind === "heart" ? <path d="M16 27S4 20 4 12c0-7 9-9 12-2 3-7 12-5 12 2 0 8-12 15-12 15Z" />
      : kind === "pair" ? <><circle cx="12" cy="10" r="4" /><path d="M4 26v-3c0-7 16-7 16 0v3M22 6c7 0 7 9 0 9m2 4c4 1 4 4 4 7" /></>
      : <path d="m16 3 4 9 10 1-8 7 2 10-8-5-8 5 2-10-8-7 10-1Z" />}
  </svg>;
}

function Example({ kind, title, text, className = "" }: { kind: string; title: string; text: string; className?: string }) {
  return <article className={`${styles.example} ${className}`}>
    <span className={styles.badge}>Пример</span>
    <p className={styles.cardKind}>{kind}</p>
    <h3>{title}</h3>
    <p className={styles.hint}>{text}</p>
  </article>;
}

type Props = {
  // Для не вошедшего человека кнопка ведёт во вход с возвратом к созданию пространства
  enterQuery: string;
  // Для вошедшего человека без пространства кнопка ведёт сразу к созданию
  ctaHref?: string;
  // Для пары, у которой пространство уже есть: все кнопки ведут обратно в пространство
  member?: boolean;
  // Сообщение над витриной (например, что пространство закрыто); без него витрина как раньше
  notice?: ReactNode;
};

export function TogetherLanding({ enterQuery, ctaHref, member = false, notice }: Props) {
  const enterHref = member ? "/together" : (ctaHref ?? `/api/together/enter?next=space${enterQuery}`);
  const cta = (label = "Создать пространство для двоих") => <a className={styles.cta} href={enterHref}>{member ? "Открыть моё пространство" : label}<span aria-hidden="true">↗</span></a>;
  return <main className={styles.landing} data-palette="pair">
    {notice}
    <section className={styles.hero} aria-labelledby="together-title">
      <div className={styles.heroInner}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Грани · Вдвоём</p>
          <h1 id="together-title">Быть ближе —<br />в обычные дни</h1>
          <p className={styles.lead}>Короткие разговоры, вопросы и небольшие совместные идеи, которые помогают чаще замечать друг друга.</p>
          {cta()}
          <p className={styles.priceLine}>3 карточки бесплатно, дальше {price} за {TOGETHER_PERIOD_DAYS} дней на двоих</p>
          <ul className={styles.trust} aria-label="Условия участия"><li>Без обязательного теста</li><li>Два личных аккаунта</li><li>Без автопродления</li></ul>
        </div>
        <div className={styles.scene}>
          <div className={styles.art} aria-hidden="true">
            {/* Art direction: picture выбирает один файл, включая предзагрузку. UI всегда остаётся HTML. */}
            <picture>
              <source media="(max-width: 600px)" srcSet="/together/hero-still-life-mobile-v3.webp" />
              <Image src="/together/hero-still-life-v3.webp" alt="" width={1600} height={800} sizes="100vw" loading="eager" fetchPriority="high" unoptimized />
            </picture>
          </div>
          <h2 className={styles.visuallyHidden}>Примеры карточек</h2>
          <div className={styles.heroCards}>
            <Example kind="Разговор · месяц 1" title={question.prompt} text={question.hint} className={styles.questionCard} />
            <Example kind="Идея для свидания · вопрос месяца 4" title={dateIdea.prompt} text={dateIdea.hint} className={styles.dateCard} />
            <Example kind={`Месяц ${firstMonth.month}`} title={firstMonth.title} text={firstMonth.promise} className={styles.monthCard} />
          </div>
        </div>
      </div>
      <ul className={styles.benefits}>
        {benefits.map(([icon, title, text]) => <li key={title}><span className={styles.icon}><Icon kind={icon} /></span><div><h2>{title}</h2><p>{text}</p></div></li>)}
      </ul>
    </section>

    <section className={styles.section} aria-labelledby="how-title">
      <p className={styles.eyebrow}>В своём темпе</p>
      <h2 id="how-title">Начнём с вас двоих</h2>
      <ol className={styles.steps}>
        <li><span>01</span><h3>Войдите через VK ID</h3><p>У каждого свой аккаунт. Тест личности проходить не нужно.</p></li>
        <li><span>02</span><h3>Пригласите партнёра</h3><p>Отправьте личную ссылку. Партнёр отправит запрос, а вы подтвердите его имя.</p></li>
        <li><span>03</span><h3>Откройте первый разговор</h3><p>Каждый отвечает самостоятельно. Ответы открываются, когда ответили оба. Темп выбираете вы.</p></li>
      </ol>
    </section>

    <section className={styles.inside} aria-labelledby="inside-title">
      <div className={styles.section}>
        <p className={styles.eyebrow}>Что внутри</p><h2 id="inside-title">Один вопрос. Время для вас.</h2>
        <p className={styles.sectionLead}>Можно начать с воспоминания. Или выйти на небольшое свидание — без большого плана.</p>
        <div className={styles.samples}>
          <Example kind="Разговор · месяц 1" title={question.prompt} text={question.hint} />
          <article className={styles.example}><span className={styles.badge}>Пример</span><p className={styles.cardKind}>Свидание · месяц 1</p><h3>{date.title}</h3><p>{date.prompt}</p><p className={styles.dateSteps}>{date.hint}</p></article>
        </div>
      </div>
    </section>

    <section className={styles.section} aria-labelledby="route-title">
      <p className={styles.eyebrow}>Шесть тем для двоих</p><h2 id="route-title">Маршрут на полгода</h2>
      <p className={styles.sectionLead}>Новые месяцы открываются по очереди: каждый следующий — после {TOGETHER_PERIOD_DAYS} дней накопленного оплаченного доступа.</p>
      <ol className={styles.roadmap}>{TOGETHER_SEASON.map((month) => <li key={month.month}>
        <p className={styles.eyebrow}>Месяц {month.month}</p><h3>{month.title}</h3>
        {/* Promise месяцев 2–3 упоминает ещё не готовые награды: это тоже помечаем как план. */}
        <p>{!month.resultReady && <span className={styles.planLabel}>План месяца: </span>}{month.promise}</p>
        <ul className={styles.teasers}>{month.teasers.map((teaser) => <li key={teaser}>«{teaser}»</li>)}</ul>
        <p className={styles.result}><strong>{month.resultReady ? "Уже доступно" : "Мы готовим"}</strong><br />{month.result}</p>
      </li>)}</ol>
    </section>

    <section className={styles.offer} aria-labelledby="price-title">
      <div><p className={styles.eyebrow}>Один доступ на двоих</p><h2 id="price-title">Сначала попробуйте</h2><p>Три вводные карточки доступны бесплатно. Оплата предлагается, когда оба участника подтверждены и вы доходите до основного маршрута.</p></div>
      <div className={styles.pricePanel}><p className={styles.amount}>{price}</p><p>за {TOGETHER_PERIOD_DAYS} дней на двоих</p>{cta("Попробовать бесплатно")}<p className={styles.small}>Без автопродления. Отказ в течение {TOGETHER_REFUND_DAYS} дней без объяснения причин — по условиям оферты.</p><p className={styles.legal}><a href="/offer">Оферта</a><a href="/privacy">Политика</a><a href="/consent">Согласие</a></p></div>
    </section>

    <section className={`${styles.section} ${styles.faq}`} aria-labelledby="faq-title">
      <p className={styles.eyebrow}>Перед первым вопросом</p><h2 id="faq-title">Частые вопросы</h2>
      <details><summary>Нужно ли проходить тест личности?</summary><p>Нет. «Вдвоём» работает независимо от теста Big Five. Для участия нужны два личных аккаунта.</p></details>
      <details><summary>Чем «Вдвоём» отличается от разбора совместимости?</summary><p>{PAIR_PRODUCTS.compatibility.title}: {PAIR_PRODUCTS.compatibility.summary} {PAIR_PRODUCTS.compatibility.needsTest} «Вдвоём»: {PAIR_PRODUCTS.together.summary} {PAIR_PRODUCTS.together.needsTest} Продукты не заменяют друг друга и покупаются отдельно. <a href="/compatibility">О разборе совместимости</a>.</p></details>
      <details><summary>Партнёр сразу увидит мои ответы?</summary><p>Нет. Каждый отвечает самостоятельно. Ответы карточки открываются, когда ответили оба.</p></details>
      <details><summary>Что будет, если один из нас выйдет?</summary><p>Совместная программа и доступ прекратятся для обоих. Остаток срока автоматически не переносится. Плательщик может запросить возврат за неиспользованные сутки по <a href="/offer">условиям оферты</a>.</p></details>
      <details><summary>Где хранятся ответы и как удалить данные?</summary><p>Данные хранятся {DATA_STORAGE}. Условия хранения и удаления описаны в <a href="/privacy">политике</a>. Удаление аккаунта доступно в <a href="/me/delete">личном кабинете</a>.</p></details>
    </section>

    <section className={styles.final} aria-labelledby="final-title"><p className={styles.eyebrow}>Грани · Вдвоём</p><h2 id="final-title">Что вы ещё<br />не знаете друг о друге?</h2><p>Начать можно с одного вопроса.</p>{cta("Начать с одного вопроса")}<p className={styles.small}>3 карточки бесплатно · без автопродления</p></section>
  </main>;
}
