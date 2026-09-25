// Геометрия гранёного знака без зависимостей от пакетов: её берут клиентские компоненты (логотип в шапке),
// и импорт отсюда не должен тянуть в браузер контент-библиотеку
export type TypeShape = "diamond" | "hexagon" | "triangle" | "circle" | "star" | "square" | "pentagon" | "drop";

type Point = readonly [number, number];

const toPath = (points: readonly Point[]) => `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")} Z`;

function regular(sides: number, size: number, rotation: number, innerRatio?: number): Point[] {
  const center = size / 2;
  const count = innerRatio === undefined ? sides : sides * 2;
  return Array.from({ length: count }, (_, i) => {
    const radius = innerRatio !== undefined && i % 2 === 1 ? center * innerRatio : center;
    const angle = rotation + (i * 2 * Math.PI) / count;
    return [center + radius * Math.cos(angle), center + radius * Math.sin(angle)] as const;
  });
}

const UP = -Math.PI / 2;
const INNER_SCALE = 0.45;

function vertices(shape: TypeShape, size: number): Point[] | null {
  const half = size / 2;
  switch (shape) {
    case "square":
      return [[size * 0.08, size * 0.08], [size * 0.92, size * 0.08], [size * 0.92, size * 0.92], [size * 0.08, size * 0.92]];
    case "diamond":
      return [[half, 0], [size, half], [half, size], [0, half]];
    case "triangle":
      return regular(3, size, UP);
    case "pentagon":
      return regular(5, size, UP);
    case "hexagon":
      return regular(6, size, 0);
    case "star":
      return regular(5, size, UP, 0.42);
    default:
      return null;
  }
}

// Гранёный знак: внешний контур плюс «грани» — внутренний контур и линии от центра к вершинам
export function gemPaths(shape: TypeShape, size: number): { outline: string; facets: string } {
  const half = size / 2;
  const points = vertices(shape, size);
  if (points) {
    const inner = points.map(([x, y]) => [half + (x - half) * INNER_SCALE, half + (y - half) * INNER_SCALE] as const);
    const spokes = (shape === "star" ? points.filter((_, i) => i % 2 === 0) : points)
      .map(([x, y]) => `M${half} ${half} L${x.toFixed(1)} ${y.toFixed(1)}`)
      .join(" ");
    return { outline: toPath(points), facets: `${toPath(inner)} ${spokes}` };
  }
  if (shape === "circle") {
    return {
      outline: `M${half} 0 A${half} ${half} 0 1 1 ${half} ${size} A${half} ${half} 0 1 1 ${half} 0 Z`,
      facets: `M${half} ${size * 0.28} A${half * 0.72} ${half * 0.44} 0 1 1 ${half} ${size * 0.72} A${half * 0.72} ${half * 0.44} 0 1 1 ${half} ${size * 0.28} Z M0 ${half} L${size} ${half}`,
    };
  }
  return {
    outline: `M${half} 0 C${size * 0.85} ${size * 0.4} ${size} ${size * 0.6} ${size} ${size * 0.68} A${half} ${half * 0.64} 0 0 1 0 ${size * 0.68} C0 ${size * 0.6} ${size * 0.15} ${size * 0.4} ${half} 0 Z`,
    facets: `M${half} ${size * 0.3} C${size * 0.7} ${size * 0.5} ${size * 0.76} ${size * 0.62} ${size * 0.76} ${size * 0.7} A${half * 0.52} ${half * 0.36} 0 0 1 ${size * 0.24} ${size * 0.7} C${size * 0.24} ${size * 0.62} ${size * 0.3} ${size * 0.5} ${half} ${size * 0.3} Z M${half} 0 L${half} ${size}`,
  };
}
