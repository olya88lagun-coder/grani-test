import { parseBlocks } from "@grani/content";
import { RichText } from "./RichText";
import styles from "@/app/personality.module.css";

// Индекс блока связывает оглавление с заголовком даже при повторяющихся названиях.
export function PersonalityReading({ text }: { text: string }) {
  const headings = parseBlocks(text).flatMap((block, index) =>
    block.kind === "h2" ? [{ text: block.text, id: `reading-${index}` }] : [],
  );
  return (
    <div className={styles.reading}>
      {headings.length > 0 && (
        <nav className={styles.contents} aria-label="В этом описании">
          <p className="eyebrow">В этом описании</p>
          <ul>
            {headings.map((heading) => (
              <li key={heading.id}><a href={`#${heading.id}`}>{heading.text}</a></li>
            ))}
          </ul>
        </nav>
      )}
      <div className={styles.prose}><RichText text={text} headingIdPrefix="reading" /></div>
    </div>
  );
}
