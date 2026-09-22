# Task 6: Страница приглашения, страница пары, блок пар на странице результата

**Files:**
- Create: `apps/web/src/lib/pair-view.ts`
- Create: `apps/web/src/app/p/[token]/page.tsx`, `apps/web/src/app/p/[token]/AcceptPairForm.tsx`, `apps/web/src/app/pair/[id]/page.tsx`, `apps/web/src/app/result/[id]/PairsBlock.tsx`
- Modify: `apps/web/src/app/result/[id]/page.tsx`, `apps/web/src/app/globals.css`
- Test: `apps/web/src/lib/pair-view.test.ts`

**Interfaces:**
- Consumes: `getPairInvitePage`, `PairInvitePage` (Task 5); `getPairForMember`, `listActivePairs`, `PairRecord` (Task 1); `compatibilityScore`, `compatibilityLevel`, `typeName`, `TRAITS`, `Gender` (`@grani/core`); `compatibilityTexts`, `typeCodeToDir`, `Library` (`@grani/content`); `TRAIT_LABELS` (план 3); `TYPE_VISUALS`, `TypeGem` (план 3); `InviteLink` (Task 4); `firstName` (Task 3).
- Produces:
  ```ts
  // lib/pair-view.ts
  type PairPerson = { firstName: string; typeName: string; dir: string };
  type PairRow = { trait: Trait; label: string; you: number; partner: number };
  type PairView = { pairId: string; score: number; phrase: string; text: string; you: PairPerson; partner: PairPerson; rows: readonly PairRow[] };
  function buildPairView(library: Library, pair: PairRecord, viewerId: string): PairView;
  function pairConsentLabel(inviterFirstName: string, gender: Gender): string;
  ```

Раздел пары — в палитре «Глина» (`data-palette="pair"`). Страница пары показывается обоим одинаково, но «вы» — всегда тот, кто смотрит. Число совместимости — как посчитало ядро, без округления вверх; под ним формулировка уровня, текст уровня и дисклеймер «это не прогноз отношений». Выход из пары — через раскрывающийся блок с пояснением, что страница скроется у обоих, без JavaScript.

- [ ] **Step 1: Тесты (падают)**

`apps/web/src/lib/pair-view.test.ts`:
```ts
import { compatibilityLevel, compatibilityScore, type TraitScores } from "@grani/core";
import { compatibilityTexts } from "@grani/content";
import { getLibrary } from "@grani/content/data";
import type { PairRecord } from "@grani/db";
import { describe, expect, test } from "vitest";
import { buildPairView, pairConsentLabel } from "./pair-view";

const ANNA: TraitScores = { openness: 80, conscientiousness: 40, extraversion: 70, agreeableness: 65, stability: 55 };
const BORIS: TraitScores = { openness: 45, conscientiousness: 70, extraversion: 30, agreeableness: 60, stability: 40 };

const PAIR: PairRecord = {
  id: "pair-1",
  createdAt: new Date("2026-09-17T12:00:00Z"),
  members: [
    { user: { id: "u-anna", displayName: "Аня Петрова", gender: "female" }, result: { id: "r-a", scores: ANNA, typeCode: "+-++", stability: "calm" } },
    { user: { id: "u-boris", displayName: "Борис", gender: "male" }, result: { id: "r-b", scores: BORIS, typeCode: "-+-+", stability: "sensitive" } },
  ],
};

describe("buildPairView", () => {
  test("puts the viewer first and the partner second", () => {
    const forBoris = buildPairView(getLibrary(), PAIR, "u-boris");

    expect(forBoris.you).toEqual({ firstName: "Борис", typeName: "Тихий хранитель", dir: "mpmp" });
    expect(forBoris.partner).toEqual({ firstName: "Аня", typeName: "Искра", dir: "pmpp" });
    expect(forBoris.rows.find((row) => row.trait === "openness")).toEqual({ trait: "openness", label: "Открытость опыту", you: 45, partner: 80 });
  });

  test("uses the core score and the level texts for both viewers", () => {
    const score = compatibilityScore(ANNA, BORIS);
    const texts = compatibilityTexts(getLibrary(), compatibilityLevel(score));

    const forAnna = buildPairView(getLibrary(), PAIR, "u-anna");

    expect(forAnna).toMatchObject({ pairId: "pair-1", score, phrase: texts.phrase, text: texts.text });
    expect(buildPairView(getLibrary(), PAIR, "u-boris").score).toBe(score);
    expect(forAnna.you.typeName).toBe("Искра");
  });
});

describe("pairConsentLabel", () => {
  test("names what each side will see without guessing gender", () => {
    expect(pairConsentLabel("Аня", "female")).toBe("Аня увидит мой тип и шкалы, а я — её");
    expect(pairConsentLabel("Борис", "male")).toBe("Борис увидит мой тип и шкалы, а я — его");
    expect(pairConsentLabel("Саша", null)).toBe("Саша и я увидим типы и шкалы друг друга");
  });
});
```

`typeName` для «Тихий хранитель» проверяется с мужским полом Бориса, для «Искры» женская форма совпадает с общей.

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run apps/web/src/lib/pair-view.test.ts
```
Expected: FAIL — модуля нет.

- [ ] **Step 2: Модель отображения**

`apps/web/src/lib/pair-view.ts`:
```ts
import { compatibilityLevel, compatibilityScore, TRAITS, typeName, type Gender, type Trait } from "@grani/core";
import { compatibilityTexts, typeCodeToDir, type Library } from "@grani/content";
import type { PairMember, PairRecord } from "@grani/db";
import { firstName } from "@/server/friends-service";
import { TRAIT_LABELS } from "./result-view";

export type PairPerson = { firstName: string; typeName: string; dir: string };
export type PairRow = { trait: Trait; label: string; you: number; partner: number };
export type PairView = { pairId: string; score: number; phrase: string; text: string; you: PairPerson; partner: PairPerson; rows: readonly PairRow[] };

function person(member: PairMember): PairPerson {
  return {
    firstName: firstName(member.user.displayName),
    typeName: typeName(member.result.typeCode, member.user.gender),
    dir: typeCodeToDir(member.result.typeCode),
  };
}

export function buildPairView(library: Library, pair: PairRecord, viewerId: string): PairView {
  const [a, b] = pair.members;
  const [you, partner] = a.user.id === viewerId ? [a, b] : [b, a];
  const score = compatibilityScore(a.result.scores, b.result.scores);
  const texts = compatibilityTexts(library, compatibilityLevel(score));
  return {
    pairId: pair.id,
    score,
    phrase: texts.phrase,
    text: texts.text,
    you: person(you),
    partner: person(partner),
    rows: TRAITS.map((trait) => ({ trait, label: TRAIT_LABELS[trait], you: you.result.scores[trait], partner: partner.result.scores[trait] })),
  };
}

const OBJECT_PRONOUNS: Readonly<Record<Exclude<Gender, null>, string>> = { female: "её", male: "его" };

export function pairConsentLabel(inviterFirstName: string, gender: Gender): string {
  // Без пола местоимение не угадываем: формулировка про обоих не требует ни «её», ни «его», ни склонения имени
  if (gender === null) return `${inviterFirstName} и я увидим типы и шкалы друг друга`;
  return `${inviterFirstName} увидит мой тип и шкалы, а я — ${OBJECT_PRONOUNS[gender]}`;
}
```

```bash
pnpm vitest run apps/web/src/lib/pair-view.test.ts
```
Expected: PASS.

- [ ] **Step 3: Страница приглашения**

`apps/web/src/app/p/[token]/AcceptPairForm.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ERRORS: Record<string, string> = {
  consent_required: "Отметьте согласие — без него пара не создаётся.",
  no_result: "Сначала пройдите тест: для пары нужен ваш результат.",
  already_used: "По этой ссылке пара уже создана. Попросите новую ссылку.",
  already_paired: "Вы уже в паре с этим человеком.",
  own_invite: "Это ваша собственная ссылка.",
  not_found: "Ссылка не работает. Попросите прислать её ещё раз.",
};
const FALLBACK = "Не получилось создать пару. Проверьте интернет и попробуйте ещё раз.";

export function AcceptPairForm({ token, consentLabel }: { token: string; consentLabel: string }) {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/pairs/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, consent }) });
      const body = (await response.json()) as { ok: boolean; redirect?: string; error?: string };
      if (body.ok && body.redirect) {
        router.push(body.redirect);
        return;
      }
      setError(ERRORS[body.error ?? ""] ?? FALLBACK);
    } catch {
      setError(FALLBACK);
    }
    setSending(false);
  }

  return (
    <div className="stack">
      <label className="choice">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>{consentLabel}</span>
      </label>
      <button type="button" className="button button--block" disabled={!consent || sending} onClick={accept}>
        {sending ? "Создаём пару…" : "Узнать совместимость"}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
```

`apps/web/src/app/p/[token]/page.tsx`:
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { InviteLink } from "@/components/InviteLink";
import { pairConsentLabel } from "@/lib/pair-view";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { getPairInvitePage } from "@/server/pairs-service";
import { currentUser } from "@/server/viewer";
import { AcceptPairForm } from "./AcceptPairForm";

export const metadata: Metadata = { title: "Совместимость" };

const joinUrl = (token: string, next: "test" | "login") => `/api/pairs/join?token=${token}&next=${next}`;

export default async function PairInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const page = await getPairInvitePage(getDb(), token, await currentUser());

  return (
    <main className="page stack" data-palette="pair">
      <p className="eyebrow">Грани · совместимость пары</p>
      {page.state === "not_found" && (
        <>
          <h1 className="display">Ссылка не работает</h1>
          <p className="lead">Попросите прислать её ещё раз. А пока можно узнать свой тип.</p>
          <div><Link className="button" href="/test">Пройти тест</Link></div>
        </>
      )}
      {page.state === "used" && (
        <>
          <h1 className="display">Ссылка уже использована</h1>
          <p className="lead">Приглашение одноразовое, и по нему уже создана пара. Если это были не вы, попросите новую ссылку.</p>
        </>
      )}
      {page.state === "own" && (
        <>
          <h1 className="display">Это ваша ссылка</h1>
          <p className="lead">Отправьте её партнёру: после его согласия откроется страница пары.</p>
          <InviteLink endpoint="" body={{}} initialUrl={new URL(`/p/${page.token}`, getEnv().APP_URL).toString()} getLabel="" shareTitle="Проверим нашу совместимость?" />
        </>
      )}
      {(page.state === "needs_login" || page.state === "needs_result" || page.state === "ready") && (
        <h1 className="display">{page.inviterFirstName} зовёт вас пройти тест на совместимость</h1>
      )}
      {page.state === "needs_login" && (
        <section className="card stack">
          <p className="lead">Пройдите тест из 50 утверждений — или войдите, если результат у вас уже есть. Потом подтвердите, что готовы показать друг другу типы и шкалы.</p>
          <a className="button button--block" href={joinUrl(page.token, "test")}>Пройти тест</a>
          <a className="button button--ghost button--block" href={joinUrl(page.token, "login")}>У меня уже есть результат — войти</a>
        </section>
      )}
      {page.state === "needs_result" && (
        <section className="card stack">
          <p className="lead">Для пары нужен ваш результат. Тест — 50 утверждений, около 10 минут.</p>
          <a className="button button--block" href={joinUrl(page.token, "test")}>Пройти тест</a>
        </section>
      )}
      {page.state === "ready" && (
        <section className="card stack">
          <p className="lead">Вы увидите оба типа, шкалы рядом и процент совместимости. Из пары можно выйти в любой момент — страница скроется у обоих.</p>
          <AcceptPairForm token={page.token} consentLabel={pairConsentLabel(page.inviterFirstName, page.inviterGender)} />
        </section>
      )}
    </main>
  );
}
```

`InviteLink` с готовым `initialUrl` сразу показывает поле и кнопку «Отправить ссылку» — `endpoint` и `getLabel` в этом случае не используются.

- [ ] **Step 4: Страница пары**

`apps/web/src/app/pair/[id]/page.tsx`:
```tsx
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
```

В `apps/web/src/app/globals.css` перед `.footer`:
```css
.pair-people { display: grid; gap: 21px; }
@media (min-width: 560px) { .pair-people { grid-template-columns: 1fr 1fr; } }
.pair-person { display: flex; align-items: center; gap: 14px; }
.pair-person .type-gem { width: 72px; height: 72px; }
.pair-score { margin: 0; font-family: var(--font-display); font-weight: 300; font-size: clamp(72px, 20vw, 120px); line-height: 1; color: var(--accent); letter-spacing: -0.03em; }
.card--paper .compare__bar .scale__track { background: var(--surface); }
details.card > summary { cursor: pointer; }
details.card[open] > summary { margin-bottom: 21px; }
```

- [ ] **Step 5: Блок пар на странице результата**

`apps/web/src/app/result/[id]/PairsBlock.tsx`:
```tsx
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
      <InviteLink endpoint="/api/pairs/invites" body={{ resultId }} initialUrl={null} getLabel="Позвать партнёра" shareTitle="Проверим нашу совместимость?" />
    </section>
  );
}
```

«Пара: вы и {Имя}» не требует склонять имя.

В `apps/web/src/app/result/[id]/page.tsx` после `<FriendsBlock … />` добавить `<PairsBlock userId={user.id} resultId={result.id} />` и импорт.

- [ ] **Step 6: Проверка в браузере**

С запущенными `pnpm dev:db` и `pnpm dev:web`:
1. Вкладка A: `/api/dev/login?name=Аня` → результат → «Позвать партнёра» → ссылка `/p/<token>`.
2. Окно инкогнито B: открыть ссылку → «Аня зовёт вас…», палитра «Глина» → «Пройти тест» → тест → `/login` → `/api/dev/login?name=Борис` → возврат на `/p/<token>` с галочкой согласия; без галочки кнопка неактивна → отметить → страница пары: оба типа, процент, формулировка, дисклеймер, шкалы рядом.
3. Вкладка A: обновить результат → в блоке «Пара: вы и Борис» → страница пары, «Вы · Аня» первой.
4. Вкладка A: снова открыть `/p/<token>` → «Ссылка уже использована».
5. Вкладка B: «Выйти из пары» → `/me`; вкладка A: страница пары → 404, в блоке пар пусто.
6. Ширина 375px — без горизонтальной прокрутки. Консоль без ошибок.

- [ ] **Step 7: Тесты и коммит**

```bash
pnpm test && pnpm typecheck
git add apps/web/src/lib/pair-view.ts apps/web/src/lib/pair-view.test.ts apps/web/src/app/p apps/web/src/app/pair apps/web/src/app/result apps/web/src/app/globals.css apps/web/src/server/pairs-service.ts apps/web/src/server/pairs-service.test.ts
git commit -m "feat(web): pair invite page with consent, pair page with compatibility, pairs on the result page"
```
