import { listActivePairs } from "@grani/db";
import Link from "next/link";
import { InviteLink } from "@/components/InviteLink";
import { getDb } from "@/server/db";
import { firstName } from "@/server/friends-service";

const PAIR_GAINS = ["процент совместимости", "где вы похожи", "о чём лучше договориться заранее"] as const;

export async function PairsBlock({ userId, resultId }: { userId: string; resultId: string }) {
  const pairs = await listActivePairs(getDb(), userId);

  return (
    <section className="card stack result-block result-block--pair" aria-labelledby="pairs">
      <p className="eyebrow">Совместимость</p>
      <h2 id="pairs">Посмотреть, как вы сочетаетесь</h2>
      <p className="lead">
        Партнёр пройдёт тест по вашей ссылке и сам подтвердит доступ. Вы увидите процент, шкалы рядом и сможете открыть разбор пары для двоих.
      </p>
      <ul className="pair-gains">
        {PAIR_GAINS.map((gain) => (
          <li key={gain}>{gain}</li>
        ))}
      </ul>
      {pairs.length > 0 && (
        <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {pairs.map((pair) => (
            <li key={pair.id}>
              <Link href={`/pair/${pair.id}`}>Пара: вы и {firstName(pair.partner.displayName)}</Link>
            </li>
          ))}
        </ul>
      )}
      <InviteLink endpoint="/api/pairs/invites" body={{ resultId }} initialUrl={null} getLabel="Позвать партнёра" shareTitle="Проверим нашу совместимость?" shareGoal="pair_invite_shared" />
      <p className="muted">Ссылка личная. Без согласия партнёра пара не создаётся.</p>
    </section>
  );
}
