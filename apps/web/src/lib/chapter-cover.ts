import type { ChapterKind } from "@grani/core";

// Имя из `chapter_money` → `money`: так названы файлы обложек в public/chapters
export function chapterCoverSlug(kind: ChapterKind): string {
  return kind.replace("chapter_", "");
}

// Значки тем: у главы «Деньги» есть по значку на каждую из шести тем, у остальных глав значков пока нет
const SEED_ICONS: Partial<Record<ChapterKind, readonly string[]>> = {
  chapter_money: ["help", "surprise", "mood", "new", "periods", "shared"],
};

export function seedIconPath(kind: ChapterKind, seed: string): string | null {
  return SEED_ICONS[kind]?.includes(seed) ? `/chapters/${chapterCoverSlug(kind)}/${seed}.webp` : null;
}
