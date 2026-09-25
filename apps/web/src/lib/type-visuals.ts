import { ALL_TYPE_CODES, type TypeCode } from "@grani/core";
import { typeCodeToDir } from "@grani/content";
import type { TypeShape } from "./gem-paths";

export { gemPaths, type TypeShape } from "./gem-paths";

export type TypeFamily = 1 | 2 | 3 | 4;
export type TypeVisual = { family: TypeFamily; shape: TypeShape };

// docs/design/visual-direction.md, «Типы: семья и знак»
const SHAPES: Readonly<Record<string, TypeShape>> = {
  pppp: "star", pppm: "triangle", ppmp: "hexagon", ppmm: "square",
  pmpp: "star", pmpm: "triangle", pmmp: "drop", pmmm: "diamond",
  mppp: "hexagon", mppm: "pentagon", mpmp: "circle", mpmm: "square",
  mmpp: "circle", mmpm: "diamond", mmmp: "drop", mmmm: "pentagon",
};

const FAMILIES: Readonly<Record<string, TypeFamily>> = { pp: 1, pm: 2, mp: 3, mm: 4 };

export const TYPE_VISUALS: Readonly<Record<string, TypeVisual>> = Object.fromEntries(
  Object.entries(SHAPES).map(([dir, shape]) => [dir, { family: FAMILIES[dir.slice(0, 2)] as TypeFamily, shape }]),
);

const CODE_BY_DIR: ReadonlyMap<string, TypeCode> = new Map(ALL_TYPE_CODES.map((code) => [typeCodeToDir(code), code]));

export function dirToTypeCode(dir: string): TypeCode | null {
  return CODE_BY_DIR.get(dir) ?? null;
}

function channel(hex: string, offset: number): number {
  const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

// Формула контраста WCAG 2.x; цвета — в виде #RRGGBB
export function contrastRatio(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}
