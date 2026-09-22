import { listActivePairs } from "@grani/db";
import Link from "next/link";
import { InviteLink } from "@/components/InviteLink";
import { getDb } from "@/server/db";
import { firstName } from "@/server/friends-service";

export async function PairsBlock({ userId, resultId }: { userId: string; resultId: string }) {
  const pairs = await listActivePairs(getDb(), userId);

  return (
    <section className="card stack" data-palette="pair" aria-labelledby="pairs">
      <p className="eyebrow">Совместимость</p>
      <h2 id="pairs">Проверить совместимость с партнёром</h2>
      <p className="lead">Партнёр пройдёт тест по вашей ссылке и подтвердит, что готов показать свой тип. Вы оба увидите процент совместимости и шкалы рядом.</p>
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
    </section>
  );
}
