import { ProgressCrystal } from "./ProgressCrystal";
import { GemPortrait } from "./GemPortrait";
import { PairGemStone, PairGemThread } from "./PairGemThread";
import styles from "./pair-facet-art.module.css";

export function PairFacetArt({ joined, animateJoin = false, waiting = false, preview = false }: { joined: boolean; animateJoin?: boolean; waiting?: boolean; preview?: boolean }) {
  const stone = <GemPortrait dir="ppmp" size={156} />;
  return (
    <div className={styles.scene} data-pair-facets data-joined={joined} data-confirmed={animateJoin} data-waiting={waiting} aria-hidden="true">
      <span className={styles.orbit} />
      <span className={styles.left}>{animateJoin ? <PairGemStone side="left">{stone}</PairGemStone> : stone}</span>
      <span className={styles.center}>
        {joined && <PairGemThread analytics={false} />}
        <span className={styles.spark}>✧</span>
      </span>
      <span className={styles.right}>
        {joined && animateJoin ? <PairGemStone side="right">{stone}</PairGemStone> : joined ? stone : preview ? (
          <ProgressCrystal family={1} size={156} lit={0} />
        ) : (
          <svg className={styles.empty} viewBox="0 0 156 156">
            <path className={styles.solid} d="M78 9 134 42 134 111 78 146 22 111 22 42Z" />
            <path d="M52 46 102 43 119 77 101 112 55 112 36 78Z M78 9 52 46 22 42 M78 9 102 43 134 42 119 77 134 111 101 112 78 146 55 112 22 111 36 78 22 42" />
          </svg>
        )}
      </span>
    </div>
  );
}
