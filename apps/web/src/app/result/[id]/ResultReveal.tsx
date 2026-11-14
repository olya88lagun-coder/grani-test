"use client";

import { useEffect, useId, useRef } from "react";
import { reachGoal } from "@/lib/analytics";
import { GemPortrait } from "@/components/GemPortrait";
import { type GemAssetDir } from "@/lib/gem-assets";
import { gemStone } from "@/lib/gem-stone";
import { TYPE_VISUALS } from "@/lib/type-visuals";
import styles from "./result-reveal.module.css";

// skipped — человек сам закрыл раскрытие; иначе оно досмотрено до конца
function closeReveal(dialog: HTMLDialogElement | null, skipped = false) {
  if (!dialog?.open) return;
  reachGoal(skipped ? "fx_reveal_skip" : "fx_reveal_done");
  dialog.close();
  document.getElementById("result-name")?.focus({ preventScroll: true });
}

export function ResultReveal({ dir, name }: { dir: GemAssetDir; name: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const clipId = useId();
  const titleId = useId();
  const { shape, family } = TYPE_VISUALS[dir]!;
  const { outline, facets } = gemStone(shape, family);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog?.showModal || !window.matchMedia || window.location.hash || dialog.open) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;
    dialog.showModal();
    reachGoal("fx_reveal_start");
    function stopMotion() {
      if (reduced.matches) closeReveal(dialog, true);
    }
    reduced.addEventListener?.("change", stopMotion);
    const timer = window.setTimeout(() => closeReveal(dialog), 2600);
    return () => {
      window.clearTimeout(timer);
      reduced.removeEventListener?.("change", stopMotion);
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); closeReveal(dialogRef.current, true); }} data-result-reveal>
      <div className={styles.panel}>
        <p className="eyebrow" id={titleId}>Твой результат</p>
        <div className={styles.art} aria-hidden="true">
          <svg viewBox="0 0 200 200" className={styles.cut} focusable="false">
            <polygon className={styles.outline} points={outline} />
            {facets.map((facet, index) => (
              <polygon key={facet.points} className={styles.facet} points={facet.points} style={{ animationDelay: `${120 + index * 13}ms` }} />
            ))}
          </svg>
          <div className={styles.portrait}><GemPortrait dir={dir} size={260} /></div>
          <svg viewBox="0 0 200 200" className={styles.light} focusable="false">
            <defs><clipPath id={clipId}><polygon points={outline} /></clipPath></defs>
            <g clipPath={`url(#${clipId})`}><rect className={styles.glint} x="-60" y="-24" width="28" height="248" /></g>
          </svg>
        </div>
        <p className={styles.name} aria-hidden="true">{name}</p>
        <button type="button" className={`button button--ghost ${styles.skip}`} onClick={() => closeReveal(dialogRef.current, true)} autoFocus>Пропустить анимацию</button>
      </div>
    </dialog>
  );
}
