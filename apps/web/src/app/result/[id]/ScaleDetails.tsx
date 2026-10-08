import { parseBlocks } from "@grani/content";
import type { ScaleView } from "@/lib/result-view";

// Пункты пояснения шкалы: из списка или из абзацев, чтобы первый показывать сразу, остальные раскрывать
function pointsOf(text: string): string[] {
  return parseBlocks(text).flatMap((block) => (block.kind === "ul" ? block.items : block.kind === "p" ? [block.text] : []));
}

export function ScaleDetails({ scale, open }: { scale: ScaleView; open?: boolean }) {
  const [first, ...rest] = pointsOf(scale.text);
  return (
    <details className="result-scale" open={open}>
      <summary>
        <span className="result-scale__score" aria-hidden="true">{scale.score}</span>
        <span className="result-scale__main">
          <span className="result-scale__title">
            <h3>{scale.label}</h3>
            {scale.borderline && <span className="result-scale__mark">на границе</span>}
          </span>
          {first && <p className="result-scale__lead">{first}</p>}
        </span>
        <span className="result-scale__meter" role="img" aria-label={`${scale.label}: ${scale.score} из 100`}>
          <span style={{ width: `${scale.score}%` }} />
        </span>
        {rest.length > 0 && <span className="result-scale__toggle" aria-hidden="true" />}
      </summary>
      {rest.length > 0 && (
        <ul className="result-scale__more">
          {rest.map((point) => <li key={point}>{point}</li>)}
        </ul>
      )}
    </details>
  );
}
