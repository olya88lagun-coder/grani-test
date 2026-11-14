import { typeCodeToDir } from "@grani/content";
import { getPairForMember, listActivePairs } from "@grani/db";
import { GemPortrait } from "@/components/GemPortrait";
import { InviteLink } from "@/components/InviteLink";
import { gemAssetDir, type GemAssetDir } from "@/lib/gem-assets";
import { getDb } from "@/server/db";
import { firstName } from "@/server/friends-service";
import { PairShelfLink } from "./PairShelfLink";
import styles from "./pair-shelf.module.css";

const PAIR_GAINS = ["процент совместимости", "где вы похожи", "о чём лучше договориться заранее"] as const;

const RECENT_PAIR_MS = 10 * 60 * 1000;

export async function PairsBlock({ userId, resultId, dir }: { userId: string; resultId: string; dir: GemAssetDir }) {
  const db = getDb();
  const pairs = await listActivePairs(db, userId);
  const newest = pairs[0];
  const recentId = newest && Date.now() - newest.createdAt.getTime() < RECENT_PAIR_MS ? newest.id : null;
  const gallery = (await Promise.all(pairs.map(async (pair) => {
    const record = await getPairForMember(db, pair.id, userId);
    const partner = record?.members.find(member => member.user.id === pair.partner.id);
    return partner && { id: pair.id, name: firstName(partner.user.displayName), type: partner.result.typeCode };
  }))).filter(pair => pair !== undefined);

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
        <div className={styles.owner}>
          <GemPortrait dir={dir} size={136} />
          <span>Ваш камень</span>
        </div>
        {gallery.length > 0 && (
          <ul className="pair-block__list">
            {gallery.map(({ id, name, type }) => (
                <li key={id}>
                  <PairShelfLink href={`/pair/${id}`} recent={id === recentId}>
                    <span className={styles.line} aria-hidden="true" />
                    <span className={styles.stone} aria-hidden="true" data-partner-stone>
                      <GemPortrait dir={gemAssetDir(typeCodeToDir(type))} size={58} />
                    </span>
                    <span className="pair-block__text">
                      <strong>Пара: вы и {name}</strong>
                      <span>Открыть разбор пары</span>
                    </span>
                    <span className="pair-block__arrow" aria-hidden="true">→</span>
                  </PairShelfLink>
                </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
