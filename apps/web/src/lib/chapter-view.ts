import type { ChapterCardsSections, ChapterSections } from "@grani/ai";

// Только типы из @grani/ai: клиентский код не тянет в бандл ИИ-пакет и библиотеку текстов
export function isChapterCards(sections: ChapterSections): sections is ChapterCardsSections {
  return "version" in sections && sections.version === 2;
}
