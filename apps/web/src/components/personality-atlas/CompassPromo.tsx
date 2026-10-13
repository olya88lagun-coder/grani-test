import Link from "next/link";
import styles from "./PersonalEdition.module.css";

type Props = { href: string; variant?: "top" | "foot" };

const TEXT = {
  top: "Финансовый компас: 6 вопросов, четыре направления и один небольшой шаг на неделю.",
  foot: "Что дальше: компас превращает прочитанное в один небольшой шаг на неделю.",
};

export function CompassPromo({ href, variant = "top" }: Props) {
  return (
    <div className={variant === "top" ? styles.compassPromo : `${styles.compassPromo} ${styles.compassFoot}`}>
      <p>{TEXT[variant]}</p>
      <Link className={styles.moneyLink} href={href}>Открыть мой финансовый компас ↗</Link>
    </div>
  );
}
