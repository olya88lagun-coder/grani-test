"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import type { Trait } from "@grani/core";
import { reachGoalOnce } from "@/lib/analytics";
import { gemAssetPath, type GemAssetDir } from "@/lib/gem-assets";
import styles from "./my-facets.module.css";

type Facet = { trait: Trait; label: string; score: number };

const facets = [
  "100,10 184,71 127,86 100,61",
  "184,71 152,170 119,125 127,86",
  "152,170 48,170 82,125 119,125",
  "48,170 16,71 73,86 82,125",
  "16,71 100,10 100,61 73,86",
];

export function MyFacets({ dir, scales, children }: { dir: GemAssetDir; scales: readonly Facet[]; children: ReactNode }) {
  const [chosen, setChosen] = useState(0);
  const [preview, setPreview] = useState<number | null>(null);
  const current = preview ?? chosen;
  const active = scales[current]!;
  const choose = (index: number) => {
    reachGoalOnce("fx_facet_pick");
    setChosen(index);
  };

  return (
    <div className={styles.facets} data-my-facets>
      <div className={styles.art}>
        <div className={styles.portrait}>{children}</div>
        <svg className={styles.drawing} viewBox="0 0 200 200" aria-hidden="true" style={{ "--portrait-mask": `url(${gemAssetPath(dir)})` } as CSSProperties}>
          {facets.map((points, index) => (
            <polygon key={points} points={points} data-current={index === current}
              onPointerEnter={(event) => { if (event.pointerType === "mouse") setPreview(index); }}
              onPointerLeave={() => setPreview(null)} onClick={() => choose(index)} />
          ))}
        </svg>
        <div className={styles.score} aria-hidden="true">{active.score}</div>
      </div>
      <div className={styles.labels} aria-label="Мои грани">
        {scales.map((scale, index) => (
          <button key={scale.trait} type="button" aria-pressed={chosen === index} aria-label={`${scale.label}, ${scale.score} из 100`}
            data-current={current === index} onPointerEnter={(event) => { if (event.pointerType === "mouse") setPreview(index); }}
            onPointerLeave={() => setPreview(null)} onFocus={() => setPreview(index)} onBlur={() => setPreview(null)}
            onClick={() => choose(index)}>
            <span>{scale.label}</span><b aria-hidden="true">{scale.score}</b>
          </button>
        ))}
      </div>
      <span className={styles.status} role="status">{scales[chosen]!.label}: {scales[chosen]!.score} из 100</span>
    </div>
  );
}
