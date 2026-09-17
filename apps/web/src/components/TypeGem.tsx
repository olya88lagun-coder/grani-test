import { gemPaths, type TypeShape } from "@/lib/type-visuals";

export function TypeGem({ shape, size }: { shape: TypeShape; size: number }) {
  const { outline, facets } = gemPaths(shape, size);
  const pad = 2;
  return (
    <svg width={size} height={size} viewBox={`${-pad} ${-pad} ${size + pad * 2} ${size + pad * 2}`} aria-hidden="true">
      <g fill="none" stroke="var(--accent)" strokeWidth={1.4} strokeLinejoin="round">
        <path d={outline} />
        <path d={facets} opacity={0.45} />
      </g>
    </svg>
  );
}
