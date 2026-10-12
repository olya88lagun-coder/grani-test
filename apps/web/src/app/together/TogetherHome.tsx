import type { ReactNode } from "react";
import type { TogetherHomeView } from "@/lib/together-home-view";
import { formatAccessUntil } from "@/lib/together-view";
import { TogetherMark } from "./TogetherMark";
import { TogetherStats } from "./TogetherStats";
import styles from "./together-home.module.css";

type Props = {
  view: TogetherHomeView;
  firstName: string;
  pairNames: string;
  accessUntil: string | null;
  activity: ReactNode;
  history: ReactNode;
  care: ReactNode;
  renew: ReactNode;
  extras: ReactNode;
};

const activityLabels: Record<TogetherHomeView["activity"], string> = {
  loading: "Ваш следующий разговор", available: "Один вопрос для вас двоих", waiting: "Пауза до ответа партнёра",
  revealed: "Теперь можно обсудить вдвоём", skipped: "Можно идти дальше", payment_locked: "Продолжение маршрута",
  month_locked: "Следующая тема", error: "Ваш следующий разговор", gone: "Проверяем пространство", none: "Ваш маршрут",
};

// Действия и тексты ответов остаются в существующих панелях. Главная задаёт только их расположение.
export function TogetherHome({ view, firstName, pairNames, accessUntil, activity, history, care, renew, extras }: Props) {
  return (
    <div className={styles.home}>
      <header className={styles.welcome}>
        <div>
          <p className={`eyebrow ${styles.overline}`}>Ваше пространство · Вдвоём</p>
          <h1>{pairNames || firstName ? `${pairNames || firstName}, приятно видеть вас!` : "Приятно видеть вас вдвоём!"}</h1>
          <p className={styles.intro}>Ваше пространство для честных разговоров, новых открытий и тёплых моментов. Здесь только вы вдвоём.</p>
        </div>
      <div className={styles.context}>
        <TogetherMark className={styles.mark} />
        <div>
        <p>{view.theme ? <>{view.theme.month !== null && <span>Тема {view.theme.month} · </span>}{view.theme.title}</> : "В своём темпе"}</p>
        <p className={styles.access}>
          {view.access === "free" && "Три вводные карточки бесплатно"}
          {view.access === "paid" && (accessUntil ? `Доступ действует до ${formatAccessUntil(accessUntil)}` : "Доступ активен для двоих")}
          {view.access === "expired" && (accessUntil ? `Доступ закончился ${formatAccessUntil(accessUntil)}` : "Доступ закончился")}
          {view.access === "unknown" && "Проверяем доступ"}
        </p>
        </div>
      </div>
      </header>

      <div className={styles.mainRow}>
      <div className={styles.activity} aria-label="Текущая карточка" data-activity={view.activity}>
        {view.activity !== "available" && <p className={styles.activityLabel}>{activityLabels[view.activity]}</p>}
        {view.activity === "available" && <picture className={styles.heart} aria-hidden="true">
          <source media="(max-width: 759px)" srcSet="/together/home/emerald-heart-360.webp" />
          <img src="/together/home/emerald-heart-720.webp" width="720" height="480" alt="" decoding="async" />
        </picture>}
        {activity}
      </div>

        {view.sectionsAvailability.history && <section className={styles.history} aria-labelledby="home-history-title">
          <p className="eyebrow">Остаётся с вами</p>
          <h2 id="home-history-title">Наши разговоры</h2>
          <p className={styles.secondaryCopy}>Открытые ответы и пропущенные карточки остаются здесь.</p>
          {history}
          <div className={styles.bookTeaser}>
            <picture className={styles.book} aria-hidden="true">
              <source media="(max-width: 759px)" srcSet="/together/home/emerald-book-240.webp" />
              <img src="/together/home/emerald-book-480.webp" width="480" height="576" alt="" decoding="async" loading="lazy" />
            </picture>
            <p>Книга вашей истории —<br />в будущем.</p>
          </div>
        </section>}
      </div>
        <section className={styles.moments} aria-labelledby="home-moments-title">
          <p className="eyebrow">Сохранённые моменты</p>
          <h2 id="home-moments-title">Пока здесь тихо</h2>
          <p className={styles.secondaryCopy}>Функция сохранения появится позже — для ответов, идей и планов, которые захочется оставить на память.</p>
          <svg className={styles.momentsBook} viewBox="0 0 260 110" aria-hidden="true"><path d="M130 96V44q-45-29-93-9L12 84q68-22 118 12Zm0 0V44q45-29 93-9l25 49q-68-22-118 12ZM17 91q62-12 113 9 51-21 113-9M130 24c-21-27-43 3 0 33 43-30 21-60 0-33Z"/></svg>
        </section>
      {view.sectionsAvailability.care && care}
      <details className={styles.details} data-space-settings>
        <summary><span>Дополнительно</span><span className={styles.settingsHint}>Доступ, рекомендации, выход и документы</span></summary>
        <div className={styles.detailsBody}>
      {view.stats && <details className={styles.subDetails}><summary>Что уже было вместе</summary><TogetherStats stats={view.stats} /></details>}
      {(view.access === "paid" || view.access === "expired") && view.activity !== "payment_locked" && <details className={styles.details}>
        <summary>Управление доступом</summary>
        <div className={styles.detailsBody}>
          <p>История ответов сохраняется. Платные карточки доступны при действующем доступе. Автоматических списаний нет.</p>
          {renew}
        </div>
      </details>}
      {extras}
        </div>
      </details>
    </div>
  );
}
