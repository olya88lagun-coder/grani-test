// Карта двух осей: x — вправо, y — вверх; подписи квадрантов — [левый низ, правый низ, левый верх, правый верх]
export function AxisMap({ xLabel, yLabel, x, y, quadrantLabels }: { xLabel: string; yLabel: string; x: number; y: number; quadrantLabels: readonly [string, string, string, string] }) {
  const size = 300;
  const pad = 28;
  const span = size - pad * 2;
  const cx = pad + (Math.min(100, Math.max(0, x)) / 100) * span;
  const cy = pad + (1 - Math.min(100, Math.max(0, y)) / 100) * span;
  const mid = pad + span / 2;
  const [lowLow, highLow, lowHigh, highHigh] = quadrantLabels;
  return (
    <svg className="axis-map" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${xLabel}: ${x}%, ${yLabel}: ${y}%`}>
      <rect x={pad} y={pad} width={span} height={span} rx="10" className="axis-map__field" />
      <line x1={mid} y1={pad} x2={mid} y2={size - pad} className="axis-map__line" />
      <line x1={pad} y1={mid} x2={size - pad} y2={mid} className="axis-map__line" />
      <text x={pad + span / 4} y={pad + span * 0.75} className="axis-map__quadrant">{lowLow}</text>
      <text x={pad + span * 0.75} y={pad + span * 0.75} className="axis-map__quadrant">{highLow}</text>
      <text x={pad + span / 4} y={pad + span / 4} className="axis-map__quadrant">{lowHigh}</text>
      <text x={pad + span * 0.75} y={pad + span / 4} className="axis-map__quadrant">{highHigh}</text>
      <text x={size / 2} y={size - 6} className="axis-map__axis">{xLabel} →</text>
      <text x={10} y={size / 2} className="axis-map__axis" transform={`rotate(-90 10 ${size / 2})`}>{yLabel} →</text>
      <circle cx={cx} cy={cy} r="9" className="axis-map__dot" />
    </svg>
  );
}
