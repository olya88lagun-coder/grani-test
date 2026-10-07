import type { SpaceView } from "@/lib/together-view";
import { pluralRu } from "@/lib/plural";
import styles from "./together-stats.module.css";

export function TogetherStats({ stats }: { stats: NonNullable<SpaceView["stats"]> }) {
  const empty = stats.days === 0 && stats.conversations === 0 && stats.dates === 0;
  return <section className={styles.stats} aria-labelledby="together-stats-title">
    <p className="eyebrow">Ваша история</p>
    <h2 id="together-stats-title">Вы уже вместе</h2>
    {empty ? <p>Сегодня первый день: начните с первого вопроса.</p> : <>
      <ul><li>{stats.days === 0 ? <><strong>Первый</strong><span>день в пространстве</span></> : <><strong>{stats.days}</strong><span>{pluralRu(stats.days, ["день", "дня", "дней"])} в пространстве</span></>}</li>
        <li><strong>{stats.conversations}</strong><span>{pluralRu(stats.conversations, ["разговор", "разговора", "разговоров"])}</span></li>
        <li><strong>{stats.dates}</strong><span>{pluralRu(stats.dates, ["свидание", "свидания", "свиданий"])}</span></li></ul>
      <p>{stats.conversations === 0 && stats.dates === 0 ? "Ваша история начинается с первого вопроса. Выберите время для него вдвоём." : "Здесь разговоры и свидания, ответы на которые вы уже открыли вдвоём."}</p>
    </>}
  </section>;
}
