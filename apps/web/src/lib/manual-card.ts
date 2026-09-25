import type { FullSections } from "@grani/ai";
import type { TypeVisual } from "./type-visuals";

export type ManualCardModel = { typeName: string; visual: TypeVisual; lists: readonly { title: string; items: readonly string[] }[] };

// Сторис читают с телефона: два пункта в разделе и не больше двух строк на пункт
export const MANUAL_ITEM_LENGTH = 72;
const ITEMS_PER_LIST = 2;

export function shortenItem(text: string, max = MANUAL_ITEM_LENGTH): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:—-]+$/, "")}…`;
}

export function buildManualCardModel(full: FullSections, typeName: string, visual: TypeVisual): ManualCardModel {
  const list = (title: string, items: readonly string[]) => ({ title, items: items.slice(0, ITEMS_PER_LIST).map((item) => shortenItem(item)) });
  return {
    typeName,
    visual,
    lists: [
      list("Как со мной работать", full.manual.work),
      list("Как со мной спорить", full.manual.fight),
      list("Что меня бесит", full.manual.annoys),
    ],
  };
}
