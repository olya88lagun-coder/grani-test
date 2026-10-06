import { PilotCodeForm } from "./PilotCodeForm";

// Нейтральная страница закрытого пилота: ничего не говорит о содержании «Вдвоём» и не показывает цену
export function PilotClosed({ signedIn, enterQuery = "" }: { signedIn: boolean; enterQuery?: string }) {
  return (
    <main className="page stack" data-palette="pair">
      <p className="eyebrow">Грани · Вдвоём</p>
      <h1 className="display">Закрытый пилот</h1>
      <section className="card stack">
        {signedIn ? (
          <>
            <p className="lead">Сейчас «Вдвоём» открыто по приглашению. Если у вас есть код доступа, введите его.</p>
            <PilotCodeForm />
            <p className="muted">Если вас пригласил партнёр, откройте его ссылку: код не нужен.</p>
          </>
        ) : (
          <>
            <p className="lead">Сейчас «Вдвоём» открыто по приглашению. Если у вас есть код доступа или ссылка от партнёра, войдите в свой аккаунт.</p>
            <a className="button button--block" href={`/api/together/enter?next=space${enterQuery}`}>
              Войти
            </a>
            <p className="muted">Вход только через VK ID.</p>
          </>
        )}
      </section>
    </main>
  );
}
