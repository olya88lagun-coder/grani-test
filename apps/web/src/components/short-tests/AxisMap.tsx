import styles from "./short-tests.module.css";

// Карта двух осей: x — вправо, y — вверх; подписи квадрантов — [левый низ, правый низ, левый верх, правый верх]
export function AxisMap({ xLabel, yLabel, x, y, quadrantLabels }: { xLabel: string; yLabel: string; x: number; y: number; quadrantLabels: readonly [string, string, string, string] }) {
  const size = 260;
  const pad = 11;
  const span = size - pad * 2;
  const cx = pad + (Math.min(100, Math.max(0, x)) / 100) * span;
  const cy = pad + (1 - Math.min(100, Math.max(0, y)) / 100) * span;
  const mid = pad + span / 2;
  const [lowLow, highLow, lowHigh, highHigh] = quadrantLabels;
  return (
    <figure className={styles.map}>
      <p className={styles.mapAxis}>{yLabel} <span aria-hidden="true">↑</span></p>
      <div className={styles.mapLabels}>
        <span>{lowHigh}</span>
        <span>{highHigh}</span>
      </div>
      <svg className={styles.plot} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${xLabel}: ${x}%, ${yLabel}: ${y}%`}>
        <rect x={pad} y={pad} width={span} height={span} rx="7" className={styles.plotField} />
        <line x1={mid} y1={pad} x2={mid} y2={size - pad} className={styles.plotLine} />
        <line x1={pad} y1={mid} x2={size - pad} y2={mid} className={styles.plotLine} />
        <circle cx={cx} cy={cy} r="9" className={styles.plotHalo} />
        <circle cx={cx} cy={cy} r="4.5" className={styles.plotDot} />
      </svg>
      <div className={styles.mapLabels}>
        <span>{lowLow}</span>
        <span>{highLow}</span>
      </div>
      <p className={`${styles.mapAxis} ${styles.mapAxisX}`}>{xLabel} <span aria-hidden="true">→</span></p>
    </figure>
  );
}
