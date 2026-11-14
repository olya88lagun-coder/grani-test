import { TypeGem } from "@/components/TypeGem";
import styles from "./roadmap-trail.module.css";

const shapes = ["hexagon", "diamond", "pentagon", "square", "drop", "star"] as const;

export function RoadmapStone({ month, next = false }: { month: number; next?: boolean }) {
  return <span className={styles.stop} data-roadmap-stone data-next={next} aria-hidden="true">
    <span className={styles.stone}><TypeGem shape={shapes[month - 1] ?? "hexagon"} size={30} /></span>
    {next && <svg className={styles.lock} viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor">
      <rect x="4" y="7" width="8" height="6" rx="1" /><path d="M6 7V5a2 2 0 0 1 4 0v2" />
    </svg>}
  </span>;
}
