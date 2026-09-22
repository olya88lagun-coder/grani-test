import { getLibrary } from "@grani/content/data";
import { getPairForMember } from "@grani/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TypeGem } from "@/components/TypeGem";
import { buildPairView, type PairPerson } from "@/lib/pair-view";
import { TYPE_VISUALS } from "@/lib/type-visuals";
import { getDb } from "@/server/db";
import { requireUser } from "@/server/viewer";

export const metadata: Metadata = { title: "Пара" };

function Person({ label, person }: { label: string; person: PairPerson }) {
  const visual = TYPE_VISUALS[person.dir];
  return (
    <div className="pair-person">
      {visual && (
        <span className="type-gem" data-family={visual.family}>
          <TypeGem shape={visual.shape} size={52} />
        </span>
      )}
      <div>
        <p className="eyebrow">{label}</p>
        <h2>{person.typeName}</h2>
      </div>
    </div>
  );
}

export default async function PairPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, requireUser()]);
  const pair = await getPairForMember(getDb(), id, user.id);
  if (!pair) notFound();
  const view = buildPairView(getLibrary(), pair, user.id);

  return (
    <main className="page stack" data-palette="pair">
      <section className="card stack">
        <p className="eyebrow">Совместимость пары</p>
        <div className="pair-people">
          <Person label={`Вы · ${view.you.firstName}`} person={view.you} />
          <Person label={view.partner.firstName} person={view.partner} />
        </div>
        <p className="pair-score" aria-label={`Совместимость ${view.score} процентов`}>{view.score}%</p>
        <h1 className="display">{view.phrase}</h1>
        <p className="lead">{view.text}</p>
        <p className="muted">Это не прогноз отношений: число показывает, насколько похожи ваши профили и сколько у пары ресурса на доброжелательность и спокойствие.</p>
      </section>

      <section className="card card--paper stack" aria-labelledby="pair-scales">
        <p className="eyebrow">Шкалы рядом</p>
        <h2 id="pair-scales">Где вы похожи и где разные</h2>
        {view.rows.map((row) => (
          <div key={row.trait} className="compare">
            <div className="scale__head"><span>{row.label}</span></div>
            <div className="compare__bars">
              <div className="compare__bar">
                <span>Вы</span>
                <span className="scale__track"><span className="scale__fill" style={{ width: `${row.you}%` }} /></span>
                <b>{row.you}</b>
              </div>
              <div className="compare__bar">
                <span>{view.partner.firstName}</span>
                <span className="scale__track"><span className="scale__fill" style={{ width: `${row.partner}%` }} /></span>
                <b>{row.partner}</b>
              </div>
            </div>
          </div>
        ))}
      </section>

      <details className="card card--paper">
        <summary className="muted">Выйти из пары</summary>
        <div className="stack">
          <p>Страница пары скроется у обоих, и вы больше не будете видеть результаты друг друга. Чтобы снова сравниться, понадобится новое приглашение.</p>
          <form action={`/api/pairs/${view.pairId}/leave`} method="post">
            <button type="submit" className="button button--ghost">Выйти из пары</button>
          </form>
        </div>
      </details>
    </main>
  );
}
