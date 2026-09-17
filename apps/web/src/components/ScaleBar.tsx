import type { ScaleView } from "@/lib/result-view";

export function ScaleBar({ scale }: { scale: ScaleView }) {
  return (
    <div className="scale">
      <div className="scale__head">
        <span>{scale.label}</span>
        <span>{scale.score}</span>
      </div>
      <div className="scale__track" role="img" aria-label={`${scale.label}: ${scale.score} из 100`}>
        <span className="scale__fill" style={{ width: `${scale.score}%` }} />
      </div>
      {scale.borderline && <span className="scale__mark">на границе</span>}
      <p className="muted">{scale.text}</p>
    </div>
  );
}
