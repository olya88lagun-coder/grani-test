import { gemStone, type GemFamily } from "@/lib/gem-stone";
import styles from "./progress-crystal.module.css";

const cuts = ([1, 2, 3, 4] as const).map((family) => {
  const { outline, facets } = gemStone("hexagon", family);
  return { outline, facets: [facets[facets.length - 1]!, ...facets.slice(0, -1)] };
});
export const PROGRESS_FACET_COUNT = cuts[0]!.facets.length;

export function ProgressCrystal({ family, size, lit }: { family?: GemFamily; size: number; lit: number }) {
  const { outline, facets } = cuts[(family ?? 2) - 1]!;
  return (
    <svg className={styles.crystal} width={size} height={size} viewBox="0 0 200 200" aria-hidden="true" focusable="false" data-progress-crystal>
      <polygon points={outline} className={styles.back} />
      {facets.map((facet, index) => (
        <polygon key={facet.points} points={facet.points} fill={facet.fill} className={styles.facet} data-lit={index < lit} />
      ))}
      <g className={styles.lines} fill="none">
        {facets.map((facet) => <polygon key={facet.points} points={facet.points} />)}
        <polygon points={outline} className={styles.outline} />
      </g>
    </svg>
  );
}
