import { GemPortrait } from "@/components/GemPortrait";
import styles from "./attachment-pair.module.css";

export function AttachmentPairArt() {
  return (
    <div className={styles.gems} aria-hidden="true">
      <GemPortrait dir="pmmp" size={146} />
      <span />
      <GemPortrait dir="ppmm" size={146} />
    </div>
  );
}
