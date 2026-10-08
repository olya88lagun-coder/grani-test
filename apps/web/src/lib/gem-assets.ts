export const GEM_ASSET_DIRS = [
  "pppp", "pppm", "ppmp", "ppmm", "pmpp", "pmpm", "pmmp", "pmmm",
  "mppp", "mppm", "mpmp", "mpmm", "mmpp", "mmpm", "mmmp", "mmmm",
] as const;

export type GemAssetDir = (typeof GEM_ASSET_DIRS)[number];

// Неизвестный каталог роняет сборку, а не показывает пустую карточку
export function gemAssetDir(dir: string): GemAssetDir {
  const known = GEM_ASSET_DIRS.find((candidate) => candidate === dir);
  if (!known) throw new Error(`Unknown gem asset directory: ${dir}`);
  return known;
}

export function gemAssetPath(dir: GemAssetDir): string {
  return `/gems/${dir}.webp`;
}
