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
  // Что о платном разборе можно показать до оплаты. Сами тексты разбора — только на сервере (short-tests/report.ts):
  // это определение уходит в браузер вместе с тестом
  readonly reportOffer?: { readonly title: string; readonly preview: readonly string[] };
  // Режим пары: что показать до оплаты разбора пары. Тексты разбора пары — тоже только на сервере
  readonly pairOffer?: { readonly title: string; readonly lead: string; readonly reportTitle: string; readonly preview: readonly string[] };
};

// Сочетание двух типов: бесплатно, видно на карте пары и на странице сочетаний
export type ShortPairCombination = { readonly key: string; readonly name: string; readonly phrase: string; readonly text: string };

// Платный разбор пары из готовых блоков: по сочетанию, по типу каждого и по разнице баллов на каждой оси
export type ShortPairReportBlocks = {
  readonly title: string;
  readonly preview: readonly string[];
  readonly byCombination: Readonly<Record<string, { readonly dynamics: ShortTestSection; readonly phrases: ShortTestSection; readonly exercises: readonly ShortReportExercise[] }>>;
  // Заголовок раздела строится с именем человека, поэтому здесь только тексты
  readonly byType: Readonly<Record<string, { readonly inConflict: ShortTestSection; readonly needs: ShortTestSection }>>;
  readonly axisGap: Readonly<Record<string, { readonly close: ShortTestSection; readonly far: ShortTestSection }>>;
};
