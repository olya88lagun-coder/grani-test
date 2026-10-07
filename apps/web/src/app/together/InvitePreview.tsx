import { TogetherMark } from "./TogetherMark";
import styles from "./together-extras.module.css";

type Props = { inviterName: string; note: string | null; prompt: string };

// Публично разрешённый сервером preview. Не запрашивает ответы или материалы пары.
export function InvitePreview({ inviterName, note, prompt }: Props) {
  return (
    <section className={styles.preview} aria-labelledby="invite-question-title">
      <div className={styles.inviter}>
        <TogetherMark kind="note" className={styles.mark} />
        <span>{inviterName} приглашает вас</span>
      </div>
      {note && (
        <div className={styles.letter}>
          <p className={styles.letterLabel}>Записка для вас</p>
          <blockquote className={styles.letterText}>{note}</blockquote>
        </div>
      )}
      <div className={styles.question}>
        <h2 id="invite-question-title">Первый вопрос</h2>
        <p className={styles.questionText}>{prompt}</p>
        <p className={styles.hint}>Каждый ответит отдельно. Ответы откроются, когда ответите вы оба.</p>
      </div>
    </section>
  );
}

