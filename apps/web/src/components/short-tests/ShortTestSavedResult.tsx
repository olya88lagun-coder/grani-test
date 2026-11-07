"use client";

import { getShortTest } from "@grani/content/short-tests";
import { shortResultView } from "@/lib/short-test-result";
import { ShortTestResult } from "./ShortTestResult";

// Сохранённый результат на /short/[id]: тот же экран, что после теста, но без «Пройти заново» и без кнопки покупки
export function ShortTestSavedResult({ slug, axes, typeKey, mixedAxes }: { slug: string; axes: Readonly<Record<string, number>>; typeKey: string; mixedAxes: readonly string[] }) {
  const test = getShortTest(slug);
  if (!test) return null;
  return <ShortTestResult test={test} view={shortResultView(test, { axes, typeKey, mixedAxes })} saved />;
}
