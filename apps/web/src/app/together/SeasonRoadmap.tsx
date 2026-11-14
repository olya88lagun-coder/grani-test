import { TOGETHER_SEASON } from "@grani/content/together-season";
import { RoadmapTrail } from "./RoadmapTrail";
import { RoadmapStone } from "./RoadmapStone";

type Props = { from?: number; compact?: boolean };

// Тема и вопросы берутся из каталога. В закрытой карточке from задаёт следующий месяц.
export function SeasonRoadmap({ from = 1, compact = false }: Props) {
  return (
    <RoadmapTrail className="tc-season">
      {TOGETHER_SEASON.filter((month) => month.month >= from).map((month) => (
        <li key={month.month} className="tc-season__item">
          <RoadmapStone month={month.month} next={month.month === Math.max(2, from)} />
          <p className="eyebrow">Месяц {month.month}</p>
          <p className="tc-season__title">{month.title}</p>
          <p>{month.promise}</p>
          {!compact && (
            <>
              <p className="muted">
                {month.resultReady ? "Вы соберёте" : "Мы готовим для этого месяца"}: {month.result.charAt(0).toLowerCase() + month.result.slice(1)}.
              </p>
              <ul className="tc-season__teasers">
                {month.teasers.map((teaser) => (
                  <li key={teaser}>«{teaser}»</li>
                ))}
              </ul>
            </>
          )}
        </li>
      ))}
    </RoadmapTrail>
  );
}
