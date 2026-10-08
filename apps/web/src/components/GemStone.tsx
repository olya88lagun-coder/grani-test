import { type TypeShape } from "@/lib/gem-paths";
import { gemStone, type GemFamily } from "@/lib/gem-stone";

type Props = {
  shape: TypeShape;
  family: GemFamily;
  size: number;
  // Сколько граней закрашено. Остальные показаны контуром: так камень работает как индикатор прогресса
  lit?: number;
};

export function GemStone({ shape, family, size, lit }: Props) {
  const { outline, facets } = gemStone(shape, family);
  const all = lit === undefined;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      {facets.map((facet, index) => {
        const on = all || index < lit;
        return (
          <polygon
            key={index}
            points={facet.points}
            fill={on ? facet.fill : "rgba(205, 181, 123, 0.07)"}
            stroke={on ? "rgba(255, 255, 255, 0.17)" : "rgba(205, 181, 123, 0.55)"}
            strokeWidth={on ? 0.5 : 3}
            strokeLinejoin="round"
          />
        );
      })}
      <polygon points={outline} fill="none" stroke="rgba(224, 203, 150, 0.6)" strokeWidth={all ? 0.9 : 4} strokeLinejoin="round" />
    </svg>
  );
}
