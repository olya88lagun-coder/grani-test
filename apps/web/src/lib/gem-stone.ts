// Гранёный камень для типа личности: цветные грани вместо контурного знака.
// Геометрия детерминирована (фиксированное зерно), поэтому сервер и браузер рисуют одно и то же.
// Форма берётся из знака типа (TypeShape), цвет из семьи типа (первые две буквы каталога).
import type { TypeShape } from "./gem-paths";

export type GemFamily = 1 | 2 | 3 | 4;
export const GEM_FAMILIES: readonly GemFamily[] = [1, 2, 3, 4];

export type GemFacet = { readonly points: string; readonly fill: string };
export type GemGeometry = { readonly outline: string; readonly facets: readonly GemFacet[] };

type Point = readonly [number, number];
type Rgb = readonly [number, number, number];
type Ramp = readonly [Rgb, Rgb, Rgb, Rgb];

const CENTER = 100;
const RADIUS = 88;
const LIGHT_ANGLE = -2.3;

// Тёмный, средний, светлый и блик. Семья 1 бирюза, 2 изумруд, 3 олива, 4 шампань
const RAMPS: Record<GemFamily, Ramp> = {
  1: [[4, 32, 42], [16, 89, 107], [63, 168, 184], [211, 241, 245]],
  2: [[4, 24, 15], [15, 90, 59], [47, 163, 110], [198, 240, 217]],
  3: [[20, 30, 8], [65, 89, 26], [143, 176, 77], [227, 240, 188]],
  4: [[42, 31, 8], [122, 98, 36], [205, 181, 123], [247, 237, 203]],
};

type Cut =
  | { readonly kind: "brilliant"; readonly sides: number; readonly ax: number; readonly ay: number; readonly seed: number }
  | { readonly kind: "step"; readonly w: number; readonly h: number; readonly seed: number };

const CUTS: Record<TypeShape, Cut> = {
  star: { kind: "brilliant", sides: 10, ax: 1, ay: 1, seed: 4 },
  triangle: { kind: "brilliant", sides: 3, ax: 1, ay: 1, seed: 5 },
  hexagon: { kind: "brilliant", sides: 6, ax: 1, ay: 1, seed: 6 },
  pentagon: { kind: "brilliant", sides: 5, ax: 1, ay: 1, seed: 12 },
  circle: { kind: "brilliant", sides: 14, ax: 1, ay: 1, seed: 11 },
  drop: { kind: "brilliant", sides: 12, ax: 0.8, ay: 1, seed: 13 },
  diamond: { kind: "brilliant", sides: 4, ax: 0.85, ay: 1.1, seed: 3 },
  square: { kind: "step", w: 0.9, h: 1, seed: 7 },
};

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function colorAt(ramp: Ramp, value: number): string {
  const clamped = Math.min(Math.max(value, 0), 0.999);
  const position = clamped * (ramp.length - 1);
  const index = Math.floor(position);
  const from = ramp[index] ?? ramp[0];
  const to = ramp[index + 1] ?? from;
  const t = position - index;
  const [r, g, b] = from.map((channel, i) => Math.round(lerp(channel, to[i] ?? channel, t)));
  return `rgb(${r}, ${g}, ${b})`;
}

const toPoints = (polygon: readonly Point[]) => polygon.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

function centroid(polygon: readonly Point[]): Point {
  const sum = polygon.reduce<Point>(([sx, sy], [x, y]) => [sx + x, sy + y], [0, 0]);
  return [sum[0] / polygon.length, sum[1] / polygon.length];
}

type Painter = (polygon: readonly Point[], bias: number, jitter: number) => GemFacet;

function painter(ramp: Ramp, random: () => number, ax: number, ay: number): Painter {
  return (polygon, bias, jitter) => {
    const [cx, cy] = centroid(polygon);
    const angle = Math.atan2((cy - CENTER) / ay, (cx - CENTER) / ax);
    const lit = 0.5 + 0.5 * Math.cos(angle - LIGHT_ANGLE);
    return { points: toPoints(polygon), fill: colorAt(ramp, lit * 0.72 + bias + (random() - 0.5) * jitter) };
  };
}

function brilliant(cut: Extract<Cut, { kind: "brilliant" }>, ramp: Ramp): GemGeometry {
  const { sides, ax, ay } = cut;
  const step = (2 * Math.PI) / sides;
  const at = (angle: number, scale: number): Point => [
    CENTER + RADIUS * scale * ax * Math.cos(angle),
    CENTER + RADIUS * scale * ay * Math.sin(angle),
  ];
  const ring = (scale: number, offset: number) =>
    Array.from({ length: sides }, (_, i) => at(-Math.PI / 2 + i * step + offset, scale));
  const outer = ring(1, 0);
  const middle = ring(0.7, step / 2);
  const table = ring(0.4, step / 2);
  const paint = painter(ramp, seededRandom(cut.seed), ax, ay);

  const bands = Array.from({ length: sides }, (_, i) => {
    const j = (i + 1) % sides;
    const o1 = outer[i] as Point;
    const o2 = outer[j] as Point;
    const m1 = middle[i] as Point;
    const m2 = middle[j] as Point;
    const t1 = table[i] as Point;
    const t2 = table[j] as Point;
    return [paint([o1, o2, m1], 0, 0.34), paint([m1, m2, o2], 0.08, 0.34), paint([m1, m2, t2, t1], 0.16, 0.3)];
  }).flat();
  const top: GemFacet = { points: toPoints(table), fill: colorAt(ramp, 0.82) };
  return { outline: toPoints(outer), facets: [...bands, top] };
}

const STEP_BASE: readonly Point[] = [[-0.6, -1], [0.6, -1], [1, -0.6], [1, 0.6], [0.6, 1], [-0.6, 1], [-1, 0.6], [-1, -0.6]];
const STEP_SCALES = [1, 0.76, 0.54, 0.32] as const;

function stepCut(cut: Extract<Cut, { kind: "step" }>, ramp: Ramp): GemGeometry {
  const random = seededRandom(cut.seed);
  const rings = STEP_SCALES.map((scale) =>
    STEP_BASE.map(([x, y]): Point => [CENTER + RADIUS * scale * x * cut.w, CENTER + RADIUS * scale * y * cut.h]),
  );
  const facets = rings.slice(0, -1).flatMap((outer, k) =>
    outer.map((from, i): GemFacet => {
      const j = (i + 1) % outer.length;
      const inner = rings[k + 1] ?? outer;
      const quad: Point[] = [from, outer[j] as Point, inner[j] as Point, inner[i] as Point];
      const [cx, cy] = centroid(quad);
      const lit = 0.5 + 0.5 * Math.cos(Math.atan2(cy - CENTER, cx - CENTER) - LIGHT_ANGLE);
      return { points: toPoints(quad), fill: colorAt(ramp, lit * 0.66 + k * 0.07 + (random() - 0.5) * 0.16) };
    }),
  );
  const innermost = rings[rings.length - 1] ?? [];
  return { outline: toPoints(rings[0] ?? []), facets: [...facets, { points: toPoints(innermost), fill: colorAt(ramp, 0.86) }] };
}

export function gemStone(shape: TypeShape, family: GemFamily): GemGeometry {
  const cut = CUTS[shape];
  const ramp = RAMPS[family];
  return cut.kind === "brilliant" ? brilliant(cut, ramp) : stepCut(cut, ramp);
}
