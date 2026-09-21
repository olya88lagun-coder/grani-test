import { getLibrary } from "@grani/content/data";
import { getResultForOwner } from "@grani/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScaleBar } from "@/components/ScaleBar";
import { TypeGem } from "@/components/TypeGem";
import { buildResultView } from "@/lib/result-view";
import { TYPE_VISUALS } from "@/lib/type-visuals";
import { getDb } from "@/server/db";
import { requireUser } from "@/server/viewer";
import { FriendsBlock } from "./FriendsBlock";
import { ShareCard } from "./ShareCard";

export const metadata: Metadata = { title: "Мой результат" };

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, requireUser()]);
  const result = await getResultForOwner(getDb(), id, user.id);
  if (!result) notFound();
  const view = buildResultView(getLibrary(), result, user.gender);
  const visual = TYPE_VISUALS[view.dir];
  if (!visual) notFound();

  return (
    <main className="page">
      <div className="stack">
        <section className="card card--2 stack">
          <div className="row" style={{ gap: 21 }}>
            <span className="type-gem" data-family={visual.family}>
              <TypeGem shape={visual.shape} size={60} />
            </span>
            <div>
              <span className="tag">{view.stabilityTag}</span>
              <h1 className="display">{view.name}</h1>
            </div>
          </div>
          <p className="lead">{view.shortText}</p>
          <p className="muted">{view.stabilityText}</p>
        </section>

        <section className="card card--paper stack" aria-labelledby="scales">
          <p className="eyebrow">Пять шкал личности</p>
          <h2 id="scales">Из чего складывается тип</h2>
          {view.scales.map((scale) => (
            <ScaleBar key={scale.trait} scale={scale} />
          ))}
        </section>

        <ShareCard
          cardUrl={`/cards/${view.dir}${user.gender === "female" ? "?f=1" : ""}`}
          fileName={`grani-${view.dir}.png`}
          typeName={view.name}
        />

        <FriendsBlock resultId={result.id} />

        <div className="row">
          <Link className="button button--ghost" href="/test">
            Пройти заново
          </Link>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="button button--ghost">
              Выйти
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
