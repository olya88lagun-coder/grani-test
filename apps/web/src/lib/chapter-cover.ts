import type { ChapterKind } from "@grani/core";

// Имя из `chapter_money` → `money`: так названы файлы обложек в public/chapters
export function chapterCoverSlug(kind: ChapterKind): string {
  return kind.replace("chapter_", "");
}

// Значки тем: по значку на каждую из шести тем каждой главы
const SEED_ICONS: Partial<Record<ChapterKind, readonly string[]>> = {
  chapter_money: ["help", "surprise", "mood", "new", "periods", "shared"],
  chapter_conflict: ["notice", "voice", "position", "critique", "pause", "deal"],
  chapter_stress: ["signals", "overload", "uncertainty", "recovery", "ask", "routine"],
  chapter_relationships: ["start", "space", "feelings", "support", "home", "limits"],
};

export function seedIconPath(kind: ChapterKind, seed: string): string | null {
  return SEED_ICONS[kind]?.includes(seed) ? `/chapters/${chapterCoverSlug(kind)}/${seed}.webp` : null;
}
