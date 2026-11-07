import type { ShortTestScoring } from "@grani/core";

export type ShortTestSection = { readonly heading: string; readonly text: string };

export type ShortTestType = {
  readonly key: string;
  // slug страницы типа: /<path теста>/<slug>
  readonly slug: string;
  readonly name: string;
  readonly tagline: string;
  // 3–4 предложения для бесплатного результата
  readonly summary: string;
  readonly page: { readonly title: string; readonly description: string; readonly sections: readonly ShortTestSection[] };
};

// Платный разбор из готовых блоков: по типу, по уровню каждой оси и упражнения
export type ShortReportExercise = { readonly title: string; readonly text: string };
export type ShortReportBlocks = {
  readonly title: string;
  // Заголовки разделов для размытого превью до оплаты
  readonly preview: readonly string[];
  readonly byType: Readonly<Record<string, readonly ShortTestSection[]>>;
  readonly byAxisLevel: Readonly<Record<string, Readonly<Record<"low" | "mid" | "high", ShortTestSection>>>>;
  readonly exercises: Readonly<Record<string, readonly ShortReportExercise[]>>;
};

export type ShortTestAxisInfo = { readonly key: string; readonly label: string; readonly low: string; readonly high: string; readonly mixed: string };

export type ShortTestDefinition = {
  readonly slug: string;
  readonly path: string;
  readonly title: string;
  readonly description: string;
  readonly h1: string;
  // Блок «Кратко» в начале страницы — под сниппет и ответы Алисы
  readonly brief: string;
  readonly intro: string;
  readonly items: readonly { readonly id: string; readonly text: string }[];
  readonly scoring: ShortTestScoring;
  readonly axes: readonly ShortTestAxisInfo[];
  readonly types: readonly ShortTestType[];
  readonly sections: readonly ShortTestSection[];
  readonly faq: readonly { readonly question: string; readonly answer: string }[];
  readonly sources: readonly string[];
  readonly disclaimer: string;
  // Нет поля — нет платного разбора
  readonly report?: ShortReportBlocks;
};
