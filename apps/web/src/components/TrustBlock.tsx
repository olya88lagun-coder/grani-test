import Link from "next/link";
import { OPERATOR } from "@/lib/legal";
import { VK_COMMUNITY_LINK } from "@/lib/site-links";
import styles from "./TrustBlock.module.css";

type Props = {
  /** Узкая вёрстка для страницы цен — без полной ночной полосы */
  compact?: boolean;
  className?: string;
};

export function TrustBlock({ compact = false, className }: Props) {
  const root = [styles.block, compact ? styles.compact : "", className].filter(Boolean).join(" ");
  return (
    <section id="trust" className={root} data-band="night" aria-labelledby="trust-title">
      <div className={styles.inner}>
        <p className={styles.kicker}>Честно о «Гранях»</p>
        <h2 id="trust-title" className={styles.title}>
          Как устроен тест и разборы
        </h2>
        <div className={styles.grid}>
          <div className={styles.part}>
            <h3 className={styles.partTitle}>Как устроен тест</h3>
            <p>
              Опросник IPIP-50 по модели «Большая пятёрка». Баллы — твоё самоописание по шкале 0–100, а не процентили населения:
              русский перевод не нормирован.
            </p>
            <p>
              Тест — материал для самопознания, а не диагноз и не медицинская оценка.{" "}
              <Link href="/about">Подробнее о методике</Link>.
            </p>
          </div>
          <div className={styles.part}>
            <h3 className={styles.partTitle}>Бесплатно и платно</h3>
            <p>
              Бесплатно: тип, пять шкал, карточка для сторис и взгляд друзей. Платно — подробные текстовые разборы по результату.
            </p>
            <p>
              Текст подробного разбора готовит сервис ИИ (YandexGPT или GigaChat). Ему передаются только баллы, уровни черт и готовые
              тексты «Граней» — без имени и контактов.
            </p>
          </div>
          <div className={styles.part}>
            <h3 className={styles.partTitle}>Куда написать</h3>
            <p>
              Вопросы — в{" "}
              <a href={VK_COMMUNITY_LINK.href} target="_blank" rel="noopener noreferrer">
                {VK_COMMUNITY_LINK.label.toLowerCase()}
              </a>{" "}
              или на почту{" "}
              <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.
            </p>
            <p>Отвечаем в течение двух рабочих дней.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
