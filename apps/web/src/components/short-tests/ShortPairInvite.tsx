import Link from "next/link";
import { InviteLink } from "@/components/InviteLink";
import styles from "./short-tests.module.css";

type ActivePair = { id: string; partnerFirstName: string };

// Блок «Пройти вдвоём» на сохранённом результате: ссылка для партнёра и уже собранные пары. Вёрстка — за Codex
export function ShortPairInvite({ shortResultId, title, lead, pairs }: { shortResultId: string; title: string; lead: string; pairs: readonly ActivePair[] }) {
  return (
    <section id="pair" className={styles.offer} aria-labelledby="pair-invite">
      <h2 id="pair-invite">{title}</h2>
      <p>{lead}</p>
      <InviteLink
        endpoint="/api/short-pairs/invites"
        body={{ shortResultId }}
        initialUrl={null}
        getLabel="Получить ссылку для партнёра"
        shareTitle="Пройдём тест на тип привязанности вдвоём?"
        shareGoal="attachment_invite"
      />
      {pairs.length > 0 && (
        <ul aria-label="Ваши пары">
          {pairs.map((pair) => (
            <li key={pair.id}>
              <Link href={`/short-pair/${pair.id}`}>Карта пары: вы и {pair.partnerFirstName}</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
