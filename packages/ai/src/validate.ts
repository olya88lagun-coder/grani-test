import type { ReportKind } from "@grani/core";
import { findStopWords } from "@grani/content";
import { parseSections, sectionStrings, type ReportSections } from "./sections";

export type ValidationFailure = "not_json" | "schema" | "stop_words";

export function extractJson(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return undefined;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

export function validateModelOutput<K extends ReportKind>(
  kind: K,
  raw: string,
): { ok: true; sections: ReportSections[K] } | { ok: false; reason: ValidationFailure } {
  const value = extractJson(raw);
  if (value === undefined) return { ok: false, reason: "not_json" };
  const sections = parseSections(kind, value);
  if (!sections) return { ok: false, reason: "schema" };
  if (sectionStrings(sections).some((text) => findStopWords(text).length > 0)) return { ok: false, reason: "stop_words" };
  return { ok: true, sections };
}
