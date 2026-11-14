import { InviteLink } from "@/components/InviteLink";
import type { GemAssetDir } from "@/lib/gem-assets";
import { FriendsStones } from "./FriendsStones";
import { buildFriendsView } from "@/lib/friends-view";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { getFriendsSummary } from "@/server/friends-service";

export async function FriendsBlock({ resultId, dir }: { resultId: string; dir: GemAssetDir }) {
  const summary = await getFriendsSummary(getDb(), resultId);
  const view = buildFriendsView(summary, getEnv().APP_URL);
  const shareUrl = view.state === "no_link" ? null : view.shareUrl;

  return (
    <section className="card stack result-block" aria-labelledby="friends">
      <p className="eyebrow">Как тебя видят другие</p>
      <h2 id="friends">{view.state === "ready" ? view.summary : "Узнай, как тебя видят друзья"}</h2>
      {view.state !== "ready" && (
        <p className="lead">Отправь ссылку трём друзьям или больше. Они ответят на 20 вопросов о тебе анонимно — ты увидишь только среднее.</p>
      )}
      {view.state !== "no_link" && <p className="tag">{view.counter}</p>}
      <FriendsStones dir={dir} count={summary.friendsCount} rows={view.state === "ready" ? view.rows : undefined} />

      {view.state === "ready" && (
        <div className="stack">
          {view.rows.map((row) => (
            <div key={row.trait} className="compare">
              <div className="scale__head">
                <span>{row.label}</span>
              </div>
              <div className="compare__bars">
                <div className="compare__bar">
                  <span>Ты</span>
                  <span className="scale__track"><span className="scale__fill" style={{ width: `${row.self}%` }} /></span>
                  <b>{row.self}</b>
                </div>
                <div className="compare__bar">
                  <span>Друзья</span>
                  <span className="scale__track"><span className="scale__fill" style={{ width: `${row.friends}%` }} /></span>
                  <b>{row.friends}</b>
                </div>
              </div>
              <span className={row.notable ? "compare__note" : "muted"}>{row.phrase}</span>
            </div>
          ))}
        </div>
      )}

      <InviteLink
        endpoint="/api/invites"
        body={{ resultId }}
        initialUrl={shareUrl}
        getLabel="Получить ссылку для друзей"
        shareTitle="Ответь на 20 вопросов обо мне"
        shareGoal="invite_shared"
      />
    </section>
  );
}
