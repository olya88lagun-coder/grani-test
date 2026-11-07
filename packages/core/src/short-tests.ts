import { ScoringError, type Answers } from "./scoring";

export type ShortTestItemKey = { readonly id: string; readonly axis: string; readonly reverse: boolean };
export type ShortTestTypeRule = { readonly key: string; readonly when: Readonly<Record<string, "low" | "high">> };
export type ShortTestScoring = {
  readonly axes: readonly string[];
  readonly items: readonly ShortTestItemKey[];
  // Ровно одно правило должно подходить к любым баллам: иначе тип не определён
  readonly types: readonly ShortTestTypeRule[];
  readonly threshold: number;
  readonly mixedBand: readonly [number, number];
};
export type ShortTestScore = {
  readonly axes: Readonly<Record<string, number>>;
  readonly typeKey: string;
  readonly mixedAxes: readonly string[];
};

const MIN = 1;
const MAX = 5;

function keyedValue(item: ShortTestItemKey, answers: Answers): number {
  const answer = answers[item.id];
  if (answer === undefined) throw new ScoringError(`No answer for item ${item.id}`);
  if (!Number.isInteger(answer) || answer < MIN || answer > MAX) throw new ScoringError(`Answer for item ${item.id} is outside ${MIN}–${MAX}: ${answer}`);
  return item.reverse ? MAX + MIN - answer : answer;
}

export function isShortTestComplete(scoring: ShortTestScoring, answers: Answers): boolean {
  return scoring.items.every((item) => answers[item.id] !== undefined);
}

export function scoreShortTest(scoring: ShortTestScoring, answers: Answers): ShortTestScore {
  const known = new Set(scoring.items.map((item) => item.id));
  const unknown = Object.keys(answers).find((id) => !known.has(id));
  if (unknown) throw new ScoringError(`Unknown item ${unknown}`);

  const axes: Record<string, number> = {};
  for (const axis of scoring.axes) {
    const items = scoring.items.filter((item) => item.axis === axis);
    if (items.length === 0) throw new ScoringError(`No items for axis ${axis}`);
    const mean = items.reduce((sum, item) => sum + keyedValue(item, answers), 0) / items.length;
    axes[axis] = Math.round(((mean - MIN) / (MAX - MIN)) * 100);
  }

  const level = (axis: string) => ((axes[axis] ?? 0) >= scoring.threshold ? "high" : "low");
  const matches = scoring.types.filter((rule) => Object.entries(rule.when).every(([axis, want]) => level(axis) === want));
  if (matches.length !== 1) throw new ScoringError(`Expected exactly one type rule to match, got ${matches.length}`);

  const [low, high] = scoring.mixedBand;
  const mixedAxes = scoring.axes.filter((axis) => (axes[axis] ?? 0) >= low && (axes[axis] ?? 0) <= high);
  return { axes, typeKey: matches[0]!.key, mixedAxes };
}
