import { sourceLabel, type Source } from "@grani/content";

// Список литературы: DOI-ссылка на публикацию и одной строкой — что из текста она подтверждает
export function SourceList({ sources }: { sources: readonly Source[] }) {
  return (
    <section className="sources" aria-labelledby="sources">
      <h2 id="sources">Источники</h2>
      <ol className="sources__list">
        {sources.map((source) => (
          <li key={source.url}>
            <a href={source.url} target="_blank" rel="noopener">
              {sourceLabel(source)}
            </a>
            <span className="sources__note"> — {source.note}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
