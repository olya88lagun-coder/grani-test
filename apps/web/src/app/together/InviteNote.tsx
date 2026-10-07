"use client";

import { TogetherMark } from "./TogetherMark";
import styles from "./together-extras.module.css";

type Props = {
  note: string;
  maxLength: number;
  working: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
};

// Управляемая форма; сохранение и сообщения остаются у TogetherSpace.
export function InviteNote({ note, maxLength, working, onChange, onSave }: Props) {
  const removing = note.trim() === "";
  return (
    <form className={styles.note} aria-labelledby="invite-note-title" aria-busy={working} onSubmit={(event) => { event.preventDefault(); onSave(); }}>
      <div className={styles.noteHeading}>
        <div>
          <p className="eyebrow">Личное приглашение</p>
          <h2 id="invite-note-title">Пара слов от вас</h2>
        </div>
        <TogetherMark kind="note" className={styles.mark} />
      </div>
      <p className={styles.hint}>Добавьте записку: партнёр увидит её рядом с вашим именем и первым вопросом.</p>
      <div className={styles.noteField}>
        <label className={styles.label} htmlFor="together-note">Записка партнёру · Необязательно</label>
        <textarea
          id="together-note"
          className={`${styles.input} ${styles.noteTextarea}`}
          rows={3}
          maxLength={maxLength}
          value={note}
          disabled={working}
          aria-describedby="invite-note-count invite-note-help"
          placeholder="Давай найдём несколько минут для нас двоих."
          onChange={(event) => onChange(event.target.value)}
        />
        <p id="invite-note-count" className={styles.count}>{note.length} / {maxLength}</p>
      </div>
      <div className={styles.noteActions}>
        <button type="submit" className="button button--ghost" disabled={working}>
          {working ? "Сохраняем…" : removing ? "Убрать записку" : "Сохранить записку"}
        </button>
        <p className={styles.hint}>{removing ? "Сохранение пустого поля удалит прежнюю записку из приглашения." : "Записка изменится только после сохранения."}</p>
      </div>
      <p id="invite-note-help" className={styles.hint}>После обновления страницы поле может быть пустым, а прежняя записка остаётся в приглашении. Напишите новый текст, чтобы заменить её, или сохраните пустое поле, чтобы убрать.</p>
    </form>
  );
}

