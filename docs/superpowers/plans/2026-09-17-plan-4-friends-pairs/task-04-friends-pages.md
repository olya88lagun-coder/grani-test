# Task 4: Страница друга и блок «Как тебя видят другие»

**Files:**
- Create: `apps/web/src/lib/friends-view.ts`, `apps/web/src/components/InviteLink.tsx`
- Create: `apps/web/src/app/f/[token]/page.tsx`, `apps/web/src/app/f/[token]/done/page.tsx`, `apps/web/src/app/result/[id]/FriendsBlock.tsx`
- Modify: `apps/web/src/app/result/[id]/page.tsx`, `apps/web/src/app/globals.css`
- Test: `apps/web/src/lib/friends-view.test.ts`

**Interfaces:**
- Consumes: `getFriendPage`, `getFriendsSummary`, `FriendsSummary` (Task 3); `Questionnaire` (Task 2); `TRAIT_LABELS` (план 3); `TRAITS`, `Gender` (`@grani/core`); `currentUser`, `getInviteByToken` (план 3, Task 1).
- Produces:
  ```ts
  // lib/friends-view.ts
  type FriendRow = { trait: Trait; label: string; self: number; friends: number; phrase: string; notable: boolean };
  type FriendsView =
    | { state: "no_link" }
    | { state: "waiting"; shareUrl: string; counter: string }
    | { state: "ready"; shareUrl: string; counter: string; summary: string; rows: readonly FriendRow[] };
  function friendIntro(firstName: string, gender: Gender): string;
  function friendsCounter(friendsCount: number): string;
  function buildFriendsView(summary: FriendsSummary, appUrl: string): FriendsView;

  // components/InviteLink.tsx (client)
  function InviteLink(props: { endpoint: string; body: Record<string, string>; initialUrl: string | null; getLabel: string; shareTitle: string }): ReactElement;
  ```

Раздел друзей — в палитре «Туман»: страница друга целиком (`data-palette="friends"` на `main`), на странице результата — сама панель блока. Тексты без родовых окончаний. Отдельные ответы друзей не показываются нигде; до трёх ответов виден только счётчик.

- [ ] **Step 1: Тесты (падают)**

`apps/web/src/lib/friends-view.test.ts`:
```ts
import { TRAITS, type FriendComparison } from "@grani/core";
import { describe, expect, test } from "vitest";
import { buildFriendsView, friendIntro, friendsCounter } from "./friends-view";

const APP_URL = "https://grani-test.ru";

function comparison(diffs: Partial<Record<(typeof TRAITS)[number], number>>): FriendComparison {
  const traits = Object.fromEntries(
    TRAITS.map((trait) => {
      const diff = diffs[trait] ?? 0;
      return [trait, { self: 50, friends: 50 + diff, diff, notable: Math.abs(diff) > 15 }];
    }),
  ) as FriendComparison["traits"];
  return { friendsCount: 3, average: { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, stability: 50 }, traits };
}

describe("friendIntro", () => {
  test("uses the pronoun only when gender is known", () => {
    expect(friendIntro("Аня", "female")).toBe("Аня просит оценить её. 20 вопросов, около 3 минут, анонимно.");
    expect(friendIntro("Борис", "male")).toBe("Борис просит оценить его. 20 вопросов, около 3 минут, анонимно.");
    expect(friendIntro("Саша", null)).toBe("Саша просит ответить на 20 вопросов о себе. Около 3 минут, анонимно.");
  });
});

describe("friendsCounter", () => {
  test("counts up to three and then just the total", () => {
    expect(friendsCounter(0)).toBe("Ответили 0 из 3");
    expect(friendsCounter(2)).toBe("Ответили 2 из 3");
    expect(friendsCounter(3)).toBe("Ответили 3 друга");
    expect(friendsCounter(5)).toBe("Ответили 5 друзей");
    expect(friendsCounter(21)).toBe("Ответил 21 друг");
  });
});

describe("buildFriendsView", () => {
  test("offers to create a link when there is none", () => {
    expect(buildFriendsView({ inviteToken: null, friendsCount: 0, needed: 3, comparison: null }, APP_URL)).toEqual({ state: "no_link" });
  });

  test("shows only the counter while fewer than three answered", () => {
    expect(buildFriendsView({ inviteToken: "t".repeat(24), friendsCount: 1, needed: 2, comparison: null }, APP_URL)).toEqual({
      state: "waiting",
      shareUrl: `${APP_URL}/f/${"t".repeat(24)}`,
      counter: "Ответили 1 из 3",
    });
  });

  test("describes notable differences and says when views match", () => {
    const view = buildFriendsView({ inviteToken: "t".repeat(24), friendsCount: 3, needed: 0, comparison: comparison({ openness: 22, stability: -18, extraversion: 15 }) }, APP_URL);

    expect(view.state).toBe("ready");
    if (view.state !== "ready") return;
    expect(view.summary).toBe("Заметнее всего расходятся оценки по шкалам: открытость опыту, эмоциональная устойчивость.");
    expect(view.rows.find((row) => row.trait === "openness")).toMatchObject({ self: 50, friends: 72, notable: true, phrase: "Друзья оценивают выше на 22" });
    expect(view.rows.find((row) => row.trait === "stability")?.phrase).toBe("Друзья оценивают ниже на 18");
    expect(view.rows.find((row) => row.trait === "extraversion")).toMatchObject({ notable: false, phrase: "Примерно так же, как ты" });
  });

  test("says that friends see the owner the same way when nothing is notable", () => {
    const view = buildFriendsView({ inviteToken: "t".repeat(24), friendsCount: 4, needed: 0, comparison: comparison({}) }, APP_URL);

    expect(view.state === "ready" && view.summary).toBe("Друзья видят тебя примерно так же, как ты себя.");
  });
});
```

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run apps/web/src/lib/friends-view.test.ts
```
Expected: FAIL — модуля нет.

- [ ] **Step 2: Модель отображения**

`apps/web/src/lib/friends-view.ts`:
```ts
import { MIN_FRIENDS, TRAITS, type Gender, type Trait } from "@grani/core";
import type { FriendsSummary } from "@/server/friends-service";
import { TRAIT_LABELS } from "./result-view";

export type FriendRow = { trait: Trait; label: string; self: number; friends: number; phrase: string; notable: boolean };
export type FriendsView =
  | { state: "no_link" }
  | { state: "waiting"; shareUrl: string; counter: string }
  | { state: "ready"; shareUrl: string; counter: string; summary: string; rows: readonly FriendRow[] };

const PRONOUNS: Readonly<Record<Exclude<Gender, null>, string>> = { female: "её", male: "его" };

export function friendIntro(firstName: string, gender: Gender): string {
  if (gender === null) return `${firstName} просит ответить на 20 вопросов о себе. Около 3 минут, анонимно.`;
  return `${firstName} просит оценить ${PRONOUNS[gender]}. 20 вопросов, около 3 минут, анонимно.`;
}

// 1 друг, 2–4 друга, 5–20 друзей; 11–14 — «друзей»
function pluralFriends(count: number): { verb: string; noun: string } {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return { verb: "Ответил", noun: "друг" };
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return { verb: "Ответили", noun: "друга" };
  return { verb: "Ответили", noun: "друзей" };
}

export function friendsCounter(friendsCount: number): string {
  if (friendsCount < MIN_FRIENDS) return `Ответили ${friendsCount} из ${MIN_FRIENDS}`;
  const { verb, noun } = pluralFriends(friendsCount);
  return `${verb} ${friendsCount} ${noun}`;
}

function phraseFor(diff: number, notable: boolean): string {
  if (!notable) return "Примерно так же, как ты";
  return diff > 0 ? `Друзья оценивают выше на ${diff}` : `Друзья оценивают ниже на ${-diff}`;
}

export function buildFriendsView(summary: FriendsSummary, appUrl: string): FriendsView {
  if (!summary.inviteToken) return { state: "no_link" };
  const shareUrl = new URL(`/f/${summary.inviteToken}`, appUrl).toString();
  const counter = friendsCounter(summary.friendsCount);
  if (!summary.comparison) return { state: "waiting", shareUrl, counter };

  const traits = summary.comparison.traits;
  const rows = TRAITS.map((trait) => {
    const { self, friends, diff, notable } = traits[trait];
    return { trait, label: TRAIT_LABELS[trait], self, friends, notable, phrase: phraseFor(diff, notable) };
  });
  const notableLabels = rows.filter((row) => row.notable).map((row) => row.label.toLowerCase());
  const summaryText =
    notableLabels.length === 0
      ? "Друзья видят тебя примерно так же, как ты себя."
      : `Заметнее всего расходятся оценки по шкалам: ${notableLabels.join(", ")}.`;
  return { state: "ready", shareUrl, counter, summary: summaryText, rows };
}
```

```bash
pnpm vitest run apps/web/src/lib/friends-view.test.ts
```
Expected: PASS.

- [ ] **Step 3: Ссылка-приглашение**

`apps/web/src/components/InviteLink.tsx` — общий для друзей и партнёра:
```tsx
"use client";

import { useState } from "react";

type InviteLinkProps = {
  endpoint: string;
  body: Record<string, string>;
  initialUrl: string | null;
  getLabel: string;
  shareTitle: string;
};

export function InviteLink({ endpoint, body, initialUrl, getLabel, shareTitle }: InviteLinkProps) {
  const [url, setUrl] = useState(initialUrl);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = (await response.json()) as { ok: boolean; url?: string };
      if (data.ok && data.url) setUrl(data.url);
      else setStatus("Не получилось создать ссылку. Обновите страницу и попробуйте ещё раз.");
    } catch {
      setStatus("Не получилось создать ссылку. Проверьте интернет.");
    }
    setLoading(false);
  }

  async function share() {
    if (!url) return;
    setStatus(null);
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setStatus("Ссылка скопирована.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("Не получилось поделиться — скопируйте ссылку из поля.");
    }
  }

  if (!url) {
    return (
      <div className="stack">
        <button type="button" className="button" disabled={loading} onClick={create}>
          {loading ? "Создаём…" : getLabel}
        </button>
        {status && <p className="error" role="alert">{status}</p>}
      </div>
    );
  }

  return (
    <div className="stack">
      <input className="invite-link" readOnly value={url} aria-label="Ссылка-приглашение" onFocus={(event) => event.currentTarget.select()} />
      <button type="button" className="button" onClick={share}>
        Отправить ссылку <span aria-hidden="true">→</span>
      </button>
      {status && <p className="muted" role="status">{status}</p>}
    </div>
  );
}
```

В `apps/web/src/app/globals.css` перед `.footer`:
```css
.invite-link { width: 100%; min-height: 52px; padding: 14px 18px; border: 0; border-radius: var(--radius); background: var(--bg); color: var(--ink); font: inherit; font-size: 14px; }

.compare { display: grid; gap: 9px; padding-bottom: 21px; border-bottom: 1px solid var(--line); }
.compare:last-child { border-bottom: 0; padding-bottom: 0; }
.compare__bars { display: grid; gap: 6px; }
.compare__bar { display: grid; grid-template-columns: 72px 1fr 34px; align-items: center; gap: 9px; font-size: 13px; color: var(--ink-soft); }
.compare__bar b { font-weight: 400; text-align: right; color: var(--accent); }
.compare__note { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); }
```

- [ ] **Step 4: Страницы друга**

`apps/web/src/app/f/[token]/page.tsx`:
```tsx
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
      />
    </main>
  );
}
```

Заголовок «{Имя} ждёт твоих ответов» не требует склонять имя и не зависит от пола.

`apps/web/src/app/f/[token]/done/page.tsx`:
```tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Спасибо" };

export default function FriendDonePage() {
  return (
    <main className="page stack" data-palette="friends">
      <p className="eyebrow">Ответы переданы анонимно</p>
      <h1 className="display">Спасибо! А какой тип у тебя?</h1>
      <p className="lead">50 коротких утверждений, 10 минут — и ты узнаешь свой тип и пять шкал личности.</p>
      <div>
        <Link className="button button--lg" href="/test">
          Пройти тест <span aria-hidden="true">→</span>
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Блок на странице результата**

`apps/web/src/app/result/[id]/FriendsBlock.tsx`:
```tsx
import { InviteLink } from "@/components/InviteLink";
import { buildFriendsView } from "@/lib/friends-view";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { getFriendsSummary } from "@/server/friends-service";

export async function FriendsBlock({ resultId }: { resultId: string }) {
  const view = buildFriendsView(await getFriendsSummary(getDb(), resultId), getEnv().APP_URL);
  const shareUrl = view.state === "no_link" ? null : view.shareUrl;

  return (
    <section className="card stack" data-palette="friends" aria-labelledby="friends">
      <p className="eyebrow">Как тебя видят другие</p>
      <h2 id="friends">{view.state === "ready" ? view.summary : "Узнай, как тебя видят друзья"}</h2>
      {view.state !== "ready" && (
        <p className="lead">Отправь ссылку трём друзьям или больше. Они ответят на 20 вопросов о тебе анонимно — ты увидишь только среднее.</p>
      )}
      {view.state !== "no_link" && <p className="tag">{view.counter}</p>}

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
      />
    </section>
  );
}
```

Палитра на панели меняет только её переменные: `.card` берёт `--surface` «Тумана», поэтому блок выглядит голубой панелью посреди зелёной страницы. Правило плана 3 `[data-palette] { background: var(--bg); color: var(--ink); min-height: 100vh; }` рассчитано на страницу целиком — в `globals.css` сузить его до `main[data-palette]`, иначе панель растянется на высоту экрана и получит фон страницы.

В `apps/web/src/app/result/[id]/page.tsx` после `<ShareCard … />` добавить `<FriendsBlock resultId={result.id} />` и импорт `import { FriendsBlock } from "./FriendsBlock";`.

- [ ] **Step 6: Проверка в браузере**

С запущенными `pnpm dev:db` и `pnpm dev:web`:
1. `/api/dev/login?name=Аня` → результат (если результата нет — пройти тест). В блоке «Как тебя видят другие» нажать «Получить ссылку для друзей» → появилась ссылка `http://localhost:3000/f/<token>`.
2. Открыть ссылку в окне инкогнито: палитра «Туман», заголовок с именем, 4 вопроса на экран, 5 экранов; «Отправить ответы» → «Спасибо! А какой тип у тебя?».
3. Отправить ответы ещё раз из того же инкогнито-окна (очистив `localStorage`) → «С этого браузера … уже ответили».
4. Открыть ссылку во вкладке, где вошла Аня → «Это твоя ссылка».
5. Ответить ещё из двух разных браузерных профилей (или очистить cookie `grani_device` между ответами) → на странице результата «Ответили 3 друга», пять пар полосок «Ты / Друзья» и итоговая фраза.
6. Ширина 375px — без горизонтальной прокрутки. Консоль без ошибок.

- [ ] **Step 7: Тесты и коммит**

```bash
pnpm test && pnpm typecheck
git add apps/web/src/lib/friends-view.ts apps/web/src/lib/friends-view.test.ts apps/web/src/components/InviteLink.tsx apps/web/src/app/f apps/web/src/app/result apps/web/src/app/globals.css
git commit -m "feat(web): friend questionnaire page and friends comparison block on the result page"
```
