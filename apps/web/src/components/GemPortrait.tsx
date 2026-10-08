"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { GemStone } from "./GemStone";
import { TYPE_VISUALS } from "@/lib/type-visuals";
import { gemAssetPath, type GemAssetDir } from "@/lib/gem-assets";
import styles from "./GemPortrait.module.css";

export function GemPortrait({ dir, size, priority = false }: { dir: GemAssetDir; size: number; priority?: boolean }) {
  const source = gemAssetPath(dir);
  const visual = TYPE_VISUALS[dir]!;
  const imageRef = useRef<HTMLImageElement>(null);
  const [decodedSource, setDecodedSource] = useState<string | null>(null);
  const loaded = decodedSource === source;

  useEffect(() => {
    let active = true;
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) {
      image.decode().catch(() => undefined).then(() => { if (active && image.naturalWidth > 0) setDecodedSource(source); });
    }
    return () => { active = false; };
  }, [source]);

  return (
    <span className={styles.frame} style={{ "--gem-size": `${size}px` } as CSSProperties} data-gem-dir={dir} data-loaded={loaded ? "true" : "false"} aria-hidden="true">
      <span className={styles.fallback}>
        <GemStone shape={visual.shape} family={visual.family} size={size} />
      </span>
      <img ref={imageRef} className={styles.photo} src={source} width={640} height={640} alt="" loading={priority ? "eager" : "lazy"} decoding="async" fetchPriority={priority ? "high" : undefined}
        onLoad={(event) => {
          const image = event.currentTarget;
          image.decode().catch(() => undefined).then(() => { if (image.naturalWidth > 0 && image.getAttribute("src") === source) setDecodedSource(source); });
        }}
        onError={() => setDecodedSource(null)} />
      {/* The same small spark set is shared by every stone, separate from the raster. */}
      <svg className={styles.sparks} data-shared-gem-sparks viewBox="0 0 200 200" focusable="false" aria-hidden="true">
        <g fill="none" stroke="var(--gold)" strokeWidth=".6" strokeLinejoin="round">
          <path d="m139 34 1 3.5 3.5 1-3.5 1-1 3.5-1-3.5-3.5-1 3.5-1Z" />
          <path d="m39 90 .6 2.4 2.4 .6-2.4 .6-.6 2.4-.6-2.4-2.4-.6 2.4-.6Z" />
          <path d="m133 157 .6 2.4 2.4 .6-2.4 .6-.6 2.4-.6-2.4-2.4-.6 2.4-.6Z" />
        </g>
      </svg>
    </span>
  );
}
