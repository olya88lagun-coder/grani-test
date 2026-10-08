import { typeCodeToDir } from "@grani/content";
import { listActivePairs } from "@grani/db";
import Link from "next/link";
import { GemPortrait } from "@/components/GemPortrait";
import { InviteLink } from "@/components/InviteLink";
import { gemAssetDir } from "@/lib/gem-assets";
import { getDb } from "@/server/db";
import { firstName } from "@/server/friends-service";

const PAIR_GAINS = ["процент совместимости", "где вы похожи", "о чём лучше договориться заранее"] as const;

export async function PairsBlock({ userId, resultId }: { userId: string; resultId: string }) {
  const pairs = await listActivePairs(getDb(), userId);

  return (
    <section className="card result-block result-block--pair" data-palette="pair" data-band="night" aria-labelledby="pairs">
      <div className="pair-block__copy">
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
        <InviteLink endpoint="/api/pairs/invites" body={{ resultId }} initialUrl={null} getLabel="Позвать партнёра" shareTitle="Проверим нашу совместимость?" shareGoal="pair_invite_shared" />
        <p className="muted">Ссылка личная. Без согласия партнёра пара не создаётся.</p>
      </div>
      <div className="pair-block__side">
        <div className="pair-block__gems" aria-hidden="true">
          <GemPortrait dir={gemAssetDir(typeCodeToDir("+-++"))} size={130} />
          <span className="pair-block__thread" />
          <GemPortrait dir={gemAssetDir(typeCodeToDir("++--"))} size={130} />
        </div>
        {pairs.length > 0 && (
          <ul className="pair-block__list">
            {pairs.map((pair) => {
              const name = firstName(pair.partner.displayName);
              return (
                <li key={pair.id}>
                  <Link className="pair-block__item" href={`/pair/${pair.id}`}>
                    <span className="pair-block__avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
                    <span className="pair-block__text">
                      <strong>Пара: вы и {name}</strong>
                      <span>Открыть разбор пары</span>
                    </span>
                    <span className="pair-block__arrow" aria-hidden="true">→</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
