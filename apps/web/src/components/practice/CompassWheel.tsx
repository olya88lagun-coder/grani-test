import type { CompassState } from "@/lib/money-practice";
import styles from "./MoneyPractice.module.css";

type Direction = { id: string; title: string; state: CompassState; label: string };
type Props = { directions: readonly Direction[]; activeIndex: number; onSelect: (index: number) => void };

const CENTER = 160;
const OUTER = 112;
const INNER = 52;
const GAP_DEGREES = 2.5;

// Угол отсчитывается по часовой стрелке от верха: сектор 0 — сверху, 1 — справа, 2 — снизу, 3 — слева
function point(radius: number, degrees: number): [number, number] {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return [CENTER + radius * Math.cos(radians), CENTER + radius * Math.sin(radians)];
}

export function sectorPath(index: number): string {
  const start = index * 90 - 45 + GAP_DEGREES;
  const end = index * 90 + 45 - GAP_DEGREES;
  const [x1, y1] = point(OUTER, start);
  const [x2, y2] = point(OUTER, end);
  const [x3, y3] = point(INNER, end);
  const [x4, y4] = point(INNER, start);
  const f = (value: number) => value.toFixed(1);
  return `M${f(x1)} ${f(y1)}A${OUTER} ${OUTER} 0 0 1 ${f(x2)} ${f(y2)}L${f(x3)} ${f(y3)}A${INNER} ${INNER} 0 0 0 ${f(x4)} ${f(y4)}Z`;
}

// Сектора показывают только состояние ответов: контур, пунктир, штриховка, заливка или точка — без шкалы «лучше/хуже»
export function CompassWheel({ directions, activeIndex, onSelect }: Props) {
  return (
    <div className={styles.compassWheel}>
      <svg viewBox="0 0 320 320" className={styles.wheelSvg} aria-hidden="true">
        <defs>
          <pattern id="money-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="7" className={styles.hatchLine} />
          </pattern>
        </defs>
        {directions.map((d, i) => (
          <path key={d.id} d={sectorPath(i)} className={styles.sector} data-state={d.state} data-active={i === activeIndex ? "" : undefined} onClick={() => onSelect(i)} />
        ))}
        {directions.map((d, i) => {
          if (d.state !== "practice") return null;
          const [x, y] = point((OUTER + INNER) / 2, i * 90);
          return <circle key={d.id} cx={x} cy={y} r={5} className={styles.marker} data-marker="" />;
        })}
      </svg>
      <div className={styles.compassCenter}>Мои<br />ориентиры</div>
      {directions.map((d, i) => (
        <button key={d.id} type="button" className={styles.direction} data-direction={i} data-state={d.state} aria-pressed={i === activeIndex} aria-describedby={`money-dir-state-${i}`} onClick={() => onSelect(i)}>
          <span>{d.title}</span>
        </button>
      ))}
      {directions.map((d, i) => (
        <span key={d.id} id={`money-dir-state-${i}`} className={styles.srOnly}>{d.label}</span>
      ))}
    </div>
  );
}
