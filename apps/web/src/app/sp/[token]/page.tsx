import type { Metadata } from "next";
import Link from "next/link";
import { InviteLink } from "@/components/InviteLink";
import { ShortTestRunner } from "@/components/short-tests/ShortTestRunner";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { getShortPairInvitePage } from "@/server/short-pairs-service";
import { currentUser } from "@/server/viewer";
import { AcceptShortPairForm } from "./AcceptShortPairForm";

export const metadata: Metadata = { title: "Тест на тип привязанности вдвоём", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Приглашение в пару по тесту на тип привязанности. Партнёр проходит тест здесь же и видит свой результат без входа;
// войти нужно только чтобы открыть общую карту. Вёрстка — за Codex
export default async function ShortPairInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const page = await getShortPairInvitePage(getDb(), token, await currentUser());

  return (
    <main className="inner-page" data-palette="pair">
      <div className="page stack">
        <p className="eyebrow">Грани · тест на тип привязанности вдвоём</p>
        {page.state === "not_found" && (
          <>
            <h1 className="display">Ссылка не работает</h1>
            <p className="lead">Попросите прислать её ещё раз. А пока можно пройти тест самому.</p>
            <div>
              <Link className="button" href="/privyazannost">
                Пройти тест
              </Link>
            </div>
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
            <p className="lead">Отправьте её партнёру: когда он пройдёт тест и согласится, вы оба увидите общую карту.</p>
            <InviteLink endpoint="" body={{}} initialUrl={new URL(`/sp/${page.token}`, getEnv().APP_URL).toString()} getLabel="" shareTitle="Пройдём тест на тип привязанности вдвоём?" />
          </>
        )}
        {(page.state === "needs_result" || page.state === "ready") && (
          <h1 className="display">{page.inviterFirstName} зовёт вас пройти тест на тип привязанности вдвоём</h1>
        )}
        {page.state === "needs_result" && (
          <>
            <p className="lead">30 утверждений, около 5 минут. Свой результат вы увидите сразу, без регистрации. Чтобы открыть общую карту, нужно будет войти и согласиться объединить результаты.</p>
            <ShortTestRunner slug={page.slug} invite={page.token} />
          </>
        )}
        {page.state === "ready" && (
          <section className="card stack">
            <p className="lead">Ваш результат: {page.typeName.toLowerCase()}. Подтвердите, что готовы объединить результаты. Из пары можно выйти в любой момент — карта скроется у обоих.</p>
            <AcceptShortPairForm token={page.token} inviterFirstName={page.inviterFirstName} />
          </section>
        )}
      </div>
    </main>
  );
}
