import styles from "./TestAccessNote.module.css";

export function TestAccessNote() {
  return <p className={`${styles.note} test-access-note`}>Для просмотра и сохранения результата нужен вход через VK ID.</p>;
}
