import type { Metadata } from "next";
import Link from "next/link";
import { InviteLink } from "@/components/InviteLink";
import { pairConsentLabel } from "@/lib/pair-view";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { getPairInvitePage } from "@/server/pairs-service";
import { currentUser } from "@/server/viewer";
import { AcceptPairForm } from "./AcceptPairForm";

export const metadata: Metadata = { title: "Совместимость" };

const joinUrl = (token: string, next: "test" | "login") => `/api/pairs/join?token=${token}&next=${next}`;

export default async function PairInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const page = await getPairInvitePage(getDb(), token, await currentUser());

  return (
    <main className="page stack" data-palette="pair">
      <p className="eyebrow">Грани · совместимость пары</p>
      {page.state === "not_found" && (
        <>
          <h1 className="display">Ссылка не работает</h1>
          <p className="lead">Попросите прислать её ещё раз. А пока можно узнать свой тип.</p>
          <div><Link className="button" href="/test">Пройти тест</Link></div>
        </>
      )}
      {page.state === "used" && (
        <>
          <h1 className="display">Ссылка уже использована</h1>
          <p className="lead">Приглашение одноразовое, и по нему уже создана пара. Если это были не вы, попросите новую ссылку.</p>
        </>
      )}
      {page.state === "own" && (
        <>
          <h1 className="display">Это ваша ссылка</h1>
          <p className="lead">Отправьте её партнёру: после его согласия откроется страница пары.</p>
          <InviteLink endpoint="" body={{}} initialUrl={new URL(`/p/${page.token}`, getEnv().APP_URL).toString()} getLabel="" shareTitle="Проверим нашу совместимость?" />
        </>
      )}
      {(page.state === "needs_login" || page.state === "needs_result" || page.state === "ready") && (
        <h1 className="display">{page.inviterFirstName} зовёт вас пройти тест на совместимость</h1>
      )}
      {page.state === "needs_login" && (
        <section className="card stack">
          <p className="lead">Пройдите тест из 50 утверждений — или войдите, если результат у вас уже есть. Потом подтвердите, что готовы показать друг другу типы и шкалы.</p>
          <a className="button button--block" href={joinUrl(page.token, "test")}>Пройти тест</a>
          <a className="button button--ghost button--block" href={joinUrl(page.token, "login")}>У меня уже есть результат — войти</a>
        </section>
      )}
      {page.state === "needs_result" && (
        <section className="card stack">
          <p className="lead">Для пары нужен ваш результат. Тест — 50 утверждений, около 10 минут.</p>
          <a className="button button--block" href={joinUrl(page.token, "test")}>Пройти тест</a>
        </section>
      )}
      {page.state === "ready" && (
        <section className="card stack">
          <p className="lead">Вы увидите оба типа, шкалы рядом и процент совместимости. Из пары можно выйти в любой момент — страница скроется у обоих.</p>
          <AcceptPairForm token={page.token} consentLabel={pairConsentLabel(page.inviterFirstName, page.inviterGender)} />
        </section>
      )}
    </main>
  );
}
