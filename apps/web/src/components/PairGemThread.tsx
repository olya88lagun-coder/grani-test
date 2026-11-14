import type { ReactNode } from "react";
import { GoalOnView } from "./GoalOnView";
import styles from "./pair-gem-thread.module.css";

export function PairGemStone({ side, className, children }: { side: "left" | "right"; className?: string; children: ReactNode }) {
  return <span className={[styles.stone, className].filter(Boolean).join(" ")} data-pair-stone={side}>{children}</span>;
}

export function PairGemThread({ className, analytics = true }: { className?: string; analytics?: boolean }) {
  return <span className={[styles.thread, className].filter(Boolean).join(" ")} data-pair-thread aria-hidden="true">{analytics && <GoalOnView goal="fx_pair_seen" />}</span>;
}
