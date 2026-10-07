import { PilotCodeForm } from "./PilotCodeForm";
import { TogetherMark } from "./TogetherMark";
import styles from "./together-extras.module.css";

// Нейтральная страница закрытого пилота: ничего не говорит о содержании «Вдвоём» и не показывает цену
export function PilotClosed({ signedIn, enterQuery = "" }: { signedIn: boolean; enterQuery?: string }) {
  return (
    <main className={`page page--wide ${styles.pilot}`} data-palette="pair">
      <header className={styles.pilotHeading}>
        <p className="eyebrow">Грани · Вдвоём</p>
        <h1 className={styles.pilotTitle}>Закрытый пилот</h1>
      </header>
      <div className={styles.pilotGrid}>
        <aside className={styles.pilotAside}>
          <TogetherMark className={styles.mark} />
          <h2 className={styles.pilotAsideTitle}>По приглашению</h2>
          <p className={styles.hint}>Сейчас раздел доступен участникам закрытого пилота.</p>
          <p className={styles.hint}>Если вас пригласил партнёр, откройте его личную ссылку. Вводить код пилота не потребуется.</p>
        </aside>
        <section className={styles.pilotCard} aria-labelledby="pilot-entry-title">
        {signedIn ? (
          <>
            <h2 id="pilot-entry-title" className={styles.pilotCardTitle}>У вас есть код?</h2>
            <p className={styles.pilotCopy}>Введите код доступа, который получили для участия в пилоте.</p>
            <PilotCodeForm />
          </>
        ) : (
          <>
            <h2 id="pilot-entry-title" className={styles.pilotCardTitle}>Сначала войдите</h2>
            <p className={styles.pilotCopy}>Войдите в свой аккаунт. Затем сможете ввести код доступа.</p>
            <a className="button button--block" href={`/api/together/enter?next=space${enterQuery}`}>
              Войти
            </a>
            <p className={`${styles.hint} ${styles.pilotFooter}`}>Вход только через VK ID.</p>
          </>
        )}
        </section>
      </div>
    </main>
  );
}
