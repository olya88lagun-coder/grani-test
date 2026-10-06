import { TOGETHER_SEASON } from "@grani/content/together-season";

type Props = { from?: number; compact?: boolean };

// Маршрут на полгода: тема каждого месяца и два настоящих вопроса из него. Без состояния и без клиентского кода,
// поэтому годится и для публичной страницы, и для закрытой карточки
export function SeasonRoadmap({ from = 1, compact = false }: Props) {
  return (
    <ol className="tc-season">
      {TOGETHER_SEASON.filter((month) => month.month >= from).map((month) => (
        <li key={month.month} className="tc-season__item">
          <p className="eyebrow">Месяц {month.month}</p>
          <p className="tc-season__title">{month.title}</p>
          <p>{month.promise}</p>
          {!compact && (
            <>
              <p className="muted">Вы соберёте: {month.result.charAt(0).toLowerCase() + month.result.slice(1)}.</p>
              <ul className="tc-season__teasers">
                {month.teasers.map((teaser) => (
                  <li key={teaser}>«{teaser}»</li>
                ))}
              </ul>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}
