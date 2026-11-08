import styles from "./short-tests.module.css";

// Карта двух осей: x — вправо, y — вверх; подписи квадрантов — [левый низ, правый низ, левый верх, правый верх]
// points — несколько подписанных точек (карта пары); без них рисуется одна точка x, y
export type AxisMapPoint = { x: number; y: number; label: string };

export function AxisMap({
  xLabel,
  yLabel,
  x = 0,
  y = 0,
  points,
  quadrantLabels,
}: {
  xLabel: string;
  yLabel: string;
  x?: number;
  y?: number;
  points?: readonly AxisMapPoint[];
  quadrantLabels: readonly [string, string, string, string];
}) {
  const size = 260;
  const pad = 11;
  const span = size - pad * 2;
  const px = (value: number) => pad + (Math.min(100, Math.max(0, value)) / 100) * span;
  const py = (value: number) => pad + (1 - Math.min(100, Math.max(0, value)) / 100) * span;
  const cx = px(x);
  const cy = py(y);
  const label = points
    ? points.map((point) => `${point.label} — ${xLabel}: ${point.x}%, ${yLabel}: ${point.y}%`).join("; ")
    : `${xLabel}: ${x}%, ${yLabel}: ${y}%`;
  const half = span / 2;
  const mid = pad + half;
  const cell = half - 1;
  const [lowLow, highLow, lowHigh, highHigh] = quadrantLabels;
  return (
    <figure className={styles.map}>
      <p className={styles.mapAxis}>{yLabel} <span aria-hidden="true">↑</span></p>
      <div className={styles.mapLabels}>
        <span>{lowHigh}</span>
        <span>{highHigh}</span>
      </div>
      <svg className={styles.plot} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <rect x={pad} y={pad} width={span} height={span} rx="7" className={styles.plotField} />
        <g className={styles.plotZones}>
          <rect x={pad + 1} y={pad + 1} width={cell} height={cell} rx="5" />
          <rect x={mid} y={pad + 1} width={cell} height={cell} rx="5" />
          <rect x={pad + 1} y={mid} width={cell} height={cell} rx="5" />
          <rect x={mid} y={mid} width={cell} height={cell} rx="5" />
        </g>
        <line x1={mid} y1={pad} x2={mid} y2={size - pad} className={styles.plotLine} />
        <line x1={pad} y1={mid} x2={size - pad} y2={mid} className={styles.plotLine} />
        {points ? (
          points.map((point) => (
            <g key={point.label}>
              <circle cx={px(point.x)} cy={py(point.y)} r="9" className={styles.plotHalo} />
              <circle cx={px(point.x)} cy={py(point.y)} r="4.5" className={styles.plotDot} />
              <text x={px(point.x)} y={py(point.y) - 13} textAnchor="middle" className={styles.plotLabel}>
                {point.label}
              </text>
            </g>
          ))
        ) : (
          <>
            <circle cx={cx} cy={cy} r="9" className={styles.plotHalo} />
            <circle cx={cx} cy={cy} r="4.5" className={styles.plotDot} />
          </>
        )}
      </svg>
      <div className={styles.mapLabels}>
        <span>{lowLow}</span>
        <span>{highLow}</span>
      </div>
      <p className={`${styles.mapAxis} ${styles.mapAxisX}`}>{xLabel} <span aria-hidden="true">→</span></p>
    </figure>
  );
}
