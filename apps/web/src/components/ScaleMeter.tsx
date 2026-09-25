import type { ScaleView } from "@/lib/result-view";

// Короткая шкала для карточки результата: название, число и полоса; пояснения — в разделе ниже
export function ScaleMeter({ scale }: { scale: ScaleView }) {
  return (
    <div className="meter">
      <div className="meter__head">
        <span className="meter__label">{scale.label}</span>
        <span className="meter__value">{scale.score}</span>
      </div>
      <div className="meter__track" role="img" aria-label={`${scale.label}: ${scale.score} из 100`}>
        <span className="meter__fill" style={{ width: `${scale.score}%` }} />
      </div>
      {scale.borderline && <span className="scale__mark">на границе</span>}
    </div>
  );
}
