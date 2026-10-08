export const GEM_ASSET_DIRS = [
  "pppp", "pppm", "ppmp", "ppmm", "pmpp", "pmpm", "pmmp", "pmmm",
  "mppp", "mppm", "mpmp", "mpmm", "mmpp", "mmpm", "mmmp", "mmmm",
] as const;

export type GemAssetDir = (typeof GEM_ASSET_DIRS)[number];

export function gemAssetPath(dir: GemAssetDir): string {
  return `/gems/${dir}.webp`;
}
