import { MIN_FRIENDS } from "@grani/core";
import { GemPortrait } from "@/components/GemPortrait";
import { GoalOnView } from "@/components/GoalOnView";
import { TypeGem } from "@/components/TypeGem";
import type { GemAssetDir } from "@/lib/gem-assets";
import type { FriendRow } from "@/lib/friends-view";
import styles from "./friends-stones.module.css";

function contour(scores: readonly number[]) {
  return scores.map((score, index) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / scores.length;
    const radius = 14 + score * .66;
    return `${(100 + Math.cos(angle) * radius).toFixed(1)},${(100 + Math.sin(angle) * radius).toFixed(1)}`;
  }).join(" ");
}

export function FriendsStones({ count, dir, rows }: { count: number; dir: GemAssetDir; rows?: readonly FriendRow[] }) {
  return (
    <figure className={styles.figure} data-friends-stones data-compared={Boolean(rows)}>
      <GoalOnView goal="fx_friends_seen" />
      <div className={styles.owner}>
        <GemPortrait dir={dir} size={144} />
        <span>Твой камень</span>
      </div>
      {rows && (
        <div className={styles.comparison} data-friends-comparison>
          <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">
            <polygon className={styles.grid} points={contour(rows.map(() => 100))} />
            <polygon className={styles.grid} points={contour(rows.map(() => 50))} />
            <polygon className={styles.friends} points={contour(rows.map(row => row.friends))} />
            <polygon className={styles.self} points={contour(rows.map(row => row.self))} />
          </svg>
          <div className={styles.legend}><span><i />Ты</span><span><i />Среднее друзей</span></div>
        </div>
      )}
      <figcaption className={styles.shelf}>
        <ul aria-hidden="true">
          {Array.from({ length: Math.max(count, MIN_FRIENDS) }, (_, index) => (
            <li key={index} data-answered={index < count}><TypeGem shape="diamond" size={24} /></li>
          ))}
        </ul>
        <span>{count < MIN_FRIENDS ? "Позови друзей, чтобы увидеть общий взгляд." : "Каждый камень отмечает ответ друга."}</span>
      </figcaption>
    </figure>
  );
}
