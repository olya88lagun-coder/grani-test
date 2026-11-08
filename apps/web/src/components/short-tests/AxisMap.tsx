import { useId } from "react";
import styles from "./short-tests.module.css";

// points — несколько подписанных точек (карта пары); без них рисуется одна точка x, y
export type AxisMapPoint = { x: number; y: number; label: string };

type AxisMapProps = {
  xLabel: string;
  yLabel: string;
  x?: number;
  y?: number;
  points?: readonly AxisMapPoint[];
  quadrantLabels: readonly [string, string, string, string];
  texture?: string;
};

// Карта двух осей: x — вправо, y — вверх; подписи квадрантов — [левый низ, правый низ, левый верх, правый верх]
export function AxisMap({ xLabel, yLabel, x = 0, y = 0, points, quadrantLabels, texture }: AxisMapProps) {
  const clipId = useId();
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
  const edge = size - pad;
  const cell = half - 1;
  const [lowLow, highLow, lowHigh, highHigh] = quadrantLabels;
  return (
    <figure className={texture ? `${styles.map} ${styles.mapFaceted}` : styles.map}>
      <p className={styles.mapAxis}>{yLabel} <span aria-hidden="true">↑</span></p>
      <div className={styles.mapLabels}>
        <span>{lowHigh}</span>
        <span>{highHigh}</span>
      </div>
      <svg className={styles.plot} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <rect x={pad} y={pad} width={span} height={span} rx="7" className={styles.plotField} />
        {texture ? (
          <>
            <defs><clipPath id={clipId}><rect x={pad} y={pad} width={span} height={span} rx="7" /></clipPath></defs>
            <image href={texture} x={pad} y={pad} width={span} height={span} clipPath={`url(#${clipId})`} />
            <rect x={pad} y={pad} width={span} height={span} rx="7" className={styles.plotOutline} />
          </>
        ) : (
          <g className={styles.plotZones}>
            <rect x={pad + 1} y={pad + 1} width={cell} height={cell} rx="5" />
            <rect x={mid} y={pad + 1} width={cell} height={cell} rx="5" />
            <rect x={pad + 1} y={mid} width={cell} height={cell} rx="5" />
            <rect x={mid} y={mid} width={cell} height={cell} rx="5" />
          </g>
        )}
        <line x1={mid} y1={pad} x2={mid} y2={edge} className={styles.plotLine} />
        <line x1={pad} y1={mid} x2={edge} y2={mid} className={styles.plotLine} />
        {points ? (
          points.map((point, index) => (
            <g key={`${index}-${point.label}`} transform={`translate(${px(point.x)} ${py(point.y)})`}>
              {index === 0 ? (
                <circle r="9" className={styles.pairPlotRing} />
              ) : (
                <path d="M0 -5.5 5.5 0 0 5.5 -5.5 0Z" className={styles.pairPlotDiamond} />
              )}
            </g>
          ))
        ) : (
          <>
            {texture && <path d={`M${pad} ${cy} H${cx} V${edge}`} className={styles.plotGuides} />}
            <circle cx={cx} cy={cy} r="9" className={styles.plotHalo} />
            <circle cx={cx} cy={cy} r="4.5" className={styles.plotDot} />
          </>
        )}
      </svg>
      <div className={styles.mapLabels}>
        <span>{lowLow}</span>
        <span>{highLow}</span>
      </div>
      {points ? (
        <figcaption className={styles.pairMapFooter}>
          <p className={`${styles.mapAxis} ${styles.mapAxisX}`}>{xLabel} <span aria-hidden="true">→</span></p>
          <ul className={styles.pairMapLegend} role="list">
            {points.map((point, index) => (
              <li key={`${index}-${point.label}`}>
                <span className={index === 0 ? styles.pairLegendRing : styles.pairLegendDiamond} aria-hidden="true" />
                {point.label}
              </li>
            ))}
          </ul>
        </figcaption>
      ) : texture ? (
        <figcaption className={styles.mapFooter}>
          <span className={styles.mapLegend}>Ваша точка</span>
          <span className={styles.mapAxis}>{xLabel} <span aria-hidden="true">→</span></span>
        </figcaption>
      ) : (
        <p className={`${styles.mapAxis} ${styles.mapAxisX}`}>{xLabel} <span aria-hidden="true">→</span></p>
      )}
    </figure>
  );
}
