import type { ChapterKind } from "@grani/core";

// Имя из `chapter_money` → `money`: так названы файлы обложек в public/chapters
export function chapterCoverSlug(kind: ChapterKind): string {
  return kind.replace("chapter_", "");
}
