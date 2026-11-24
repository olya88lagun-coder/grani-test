import styles from "./TestAccessNote.module.css";

export function TestAccessNote() {
  return (
    <p className={`${styles.note} test-access-note`}>
      Результат видно сразу. Чтобы сохранить его, поделиться карточкой, позвать друзей или купить разбор, войди через VK ID.
    </p>
  );
}
