import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Questionnaire } from "@/components/Questionnaire";
import { friendIntro } from "@/lib/friends-view";
import { getDb } from "@/server/db";
import { getFriendPage } from "@/server/friends-service";
import { currentUser } from "@/server/viewer";
import { getInviteByToken } from "@grani/db";

export const metadata: Metadata = { title: "Вопросы от друга" };

const FRIEND_PAGE_SIZE = 4;

export default async function FriendPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [page, viewer, invite] = await Promise.all([getFriendPage(getDb(), token), currentUser(), getInviteByToken(getDb(), token)]);
  if (!page || !invite) notFound();

  if (viewer?.id === invite.owner.id) {
    return (
      <main className="page stack" data-palette="friends">
        <p className="eyebrow">Как тебя видят другие</p>
        <h1 className="display">Это твоя ссылка</h1>
        <p className="lead">Отправь её друзьям: когда ответят трое, на странице результата откроется сравнение.</p>
      </main>
    );
  }

  return (
    <main className="page stack" data-palette="friends">
      <section className="card stack">
        <p className="eyebrow">Грани · вопросы от друга</p>
        <h1 className="display">{page.ownerFirstName} ждёт твоих ответов</h1>
        <p className="lead">{friendIntro(page.ownerFirstName, page.ownerGender)}</p>
        <p className="muted">Ответы видны только в среднем, вместе с ответами других друзей, и не раньше, чем ответят трое.</p>
      </section>
      <Questionnaire
        items={page.items}
        storageKey={`grani:friend:${token}`}
        submitUrl={`/api/f/${token}`}
        submitLabel="Отправить ответы"
        pageSize={FRIEND_PAGE_SIZE}
        finishGoal="friend_answered"
      />
    </main>
  );
}
