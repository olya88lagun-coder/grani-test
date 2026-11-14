"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./reply-opening.module.css";

export function ReplyOpening({ animate, children }: { animate: boolean; children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [playing, setPlaying] = useState(false);

  function finish() {
    if (document.activeElement === button.current) container.current?.focus({ preventScroll: true });
    setPlaying(false);
  }

  useEffect(() => {
    if (!animate || !window.matchMedia) return;
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
    if (!motion.matches) return;
    setPlaying(true);
    function onChange() {
      if (!motion.matches) finish();
    }
    motion.addEventListener?.("change", onChange);
    const timer = window.setTimeout(finish, 1500);
    return () => {
      window.clearTimeout(timer);
      motion.removeEventListener?.("change", onChange);
    };
  }, [animate]);

  return (
    <div ref={container} className={styles.opening} tabIndex={-1} data-reply-opening={playing ? "playing" : "ready"} onKeyDown={(event) => {
      if (playing && event.key === "Escape") finish();
    }}>
      <header className={styles.head}>
        <p role="status">Оба ответа открыты</p>
        <button type="button" ref={button} className={styles.skip} disabled={!playing} onClick={finish}>Пропустить</button>
      </header>
      <div className="tc-replies">{children}</div>
    </div>
  );
}
