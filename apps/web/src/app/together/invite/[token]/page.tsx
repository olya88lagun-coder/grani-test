import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { peekTogetherInvite } from "@/server/together-service";
import { currentUser } from "@/server/viewer";
import { InviteJoin } from "../../InviteJoin";

export const dynamic = "force-dynamic";

// Ссылка личная: не индексируется и не передаётся в Referer на другие сайты
export const metadata: Metadata = { title: "Приглашение во Вдвоём", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function TogetherInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await currentUser();
  const { valid } = await peekTogetherInvite({ db: getDb(), now: () => new Date(), appUrl: getEnv().APP_URL }, token, user?.id);

  return (
    <main className="page stack" data-palette="pair">
      <p className="eyebrow">Грани · Вдвоём</p>
      {!valid && (
        <section className="card stack">
          <h1 className="display">Эта ссылка сейчас недоступна</h1>
          <p className="lead">Она могла истечь, быть заменена или уже использована. Попросите партнёра отправить новое приглашение.</p>
          <Link className="button button--block" href="/together">Вернуться во Вдвоём</Link>
        </section>
      )}
      {valid && !user && (
        <section className="card stack">
          <h1 className="display">Время для вас двоих</h1>
          <p className="lead">Вас пригласили создать общее пространство. Войдите в свой аккаунт: после входа вернём вас к приглашению.</p>
          <a className="button button--block" href={`/api/together/enter?next=invite&token=${encodeURIComponent(token)}`}>
            Войти и продолжить
          </a>
          <p className="muted">До подтверждения вы не получаете доступа к общим материалам. Личные данные пары по ссылке не раскрываются.</p>
        </section>
      )}
      {valid && user && <InviteJoin token={token} />}
    </main>
  );
}
