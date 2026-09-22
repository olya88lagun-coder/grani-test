# Task 8: Превью и покупка на странице результата, страница ожидания, страница разбора

**Files:**
- Create: `apps/web/src/lib/report-view.ts`, `report-view.test.ts`
- Create: `apps/web/src/components/BuyButton.tsx`, `apps/web/src/components/PurchaseStatus.tsx`, `apps/web/src/components/AutoRefresh.tsx`, `apps/web/src/components/Paragraphs.tsx`
- Create: `apps/web/src/app/result/[id]/ReportOffer.tsx`, `apps/web/src/app/purchases/[id]/page.tsx`, `apps/web/src/app/report/[resultId]/page.tsx`
- Modify: `apps/web/src/app/result/[id]/page.tsx`, `apps/web/src/app/globals.css`

**Interfaces:**
- Consumes: `buildPersonalInput`, `fallbackSections`, `parseSections`, `FullSections`, `ChapterSections` (Tasks 3–4); `canBuy`, `unlockedKinds`, `CHAPTER_KINDS`, `PRODUCT_PRICES`, `formatRub`, `MIN_FRIENDS`, `Product` (`@grani/core`); `CHAPTER_TITLES` (Task 1); `listOwnedProducts`, `listReports`, `ReportRecord`, `getResultForOwner`, `getInviteForResult`, `countFriendResponses`; `getPurchaseView`, `PurchaseView`, `paymentsDeps` (Tasks 5–6); `friendsCounter` (план 4).
- Produces:
  ```ts
  // lib/report-view.ts
  type PreviewSection = { title: string; teaser: string };
  function buildReportPreview(library: Library, result: PersonalScores): readonly PreviewSection[];
  type ChapterView =
    | { kind: ChapterKind; title: string; state: "ready"; sections: ChapterSections }
    | { kind: ChapterKind; title: string; state: "preparing" }
    | { kind: ChapterKind; title: string; state: "available"; price: string };
  type FriendsSectionView = { state: "ready"; text: string } | { state: "preparing" } | { state: "waiting"; counter: string };
  type ReportPageView = { full: FullSections | null; friends: FriendsSectionView; chapters: readonly ChapterView[]; bundle: { price: string } | null; preparing: boolean };
  function buildReportPageView(p: { owned: readonly Product[]; reports: readonly ReportRecord[]; friendsCount: number }): ReportPageView;
  const REPORT_DISCLAIMER = "Материалы для самопознания, не психологическая и не медицинская диагностика.";

  // components
  function BuyButton(props: { product: Product; targetId: string; label: string; ghost?: boolean }): ReactElement;   // client
  function PurchaseStatus(props: { initial: PurchaseView }): ReactElement;                                          // client
  function AutoRefresh(props: { seconds: number }): null;                                                           // client
  function Paragraphs(props: { text: string }): ReactElement;
  ```

Раздел 2.1, шаги 4–6 спецификации. На бесплатном результате — превью полного разбора: заголовки разделов и первые строки, остальное размыто, кнопка «Открыть за 299 ₽». Первые строки — настоящие, из сборки по блокам этого результата (это не раскрывает разбор: блоки и так бесплатны на страницах уровней черт). Размытая часть — нейтральный текст-заглушка, а не продолжение разбора, чтобы платное содержимое не лежало в HTML.

Под кнопкой покупки — «Нажимая кнопку, вы принимаете условия [оферты](/offer) и подтверждаете, что вам есть 18 лет».

Страница ожидания `/purchases/<id>` опрашивает `GET /api/purchases/<id>` каждые 3 секунды:
- «Ждём подтверждения оплаты»;
- «Готовим разбор, около минуты. Страницу можно не обновлять — когда всё будет готово, придёт сообщение»;
- когда готово — сразу переходит на разбор;
- если оплата отменена — «Оплата не прошла, деньги не списаны» и ссылка обратно.

Страница разбора `/report/<resultId>` видна владельцу, если полный разбор оплачен (иначе переход на результат). Разделы, которые ещё генерируются, показаны строкой «Готовим…», страница сама обновляется раз в 5 секунд, пока есть такие разделы.
- **«Как меня видят другие»:** готовый текст, «готовим», или счётчик «Ответили N из 3» со ссылкой на результат, где лежит ссылка для друзей.
- **Главы:** открытые — текст и советы; неоткрытые — кнопка «Глава «Деньги» — 99 ₽»; набор «Все четыре главы — 249 ₽» — пока не куплена ни одна глава.

- [ ] **Step 1: Тесты модели страницы (падают)**

`apps/web/src/lib/report-view.test.ts`:
```ts
import { getLibrary } from "@grani/content/data";
import type { ReportRecord } from "@grani/db";
import { describe, expect, test } from "vitest";
import { buildPersonalInput, fallbackSections } from "@grani/ai";
import { buildReportPageView, buildReportPreview } from "./report-view";

const RESULT = { scores: { openness: 80, conscientiousness: 40, extraversion: 70, agreeableness: 65, stability: 50 }, typeCode: "+-++", stability: "calm" } as const;

const report = (kind: ReportRecord["kind"], sections: unknown): ReportRecord => ({
  id: `${kind}-id`,
  resultId: "r1",
  pairId: null,
  kind,
  sections,
  source: "fallback",
  createdAt: new Date(),
});
const FULL = fallbackSections(buildPersonalInput(getLibrary(), "full", RESULT));
const MONEY = fallbackSections(buildPersonalInput(getLibrary(), "chapter_money", RESULT));

describe("buildReportPreview", () => {
  test("shows the section titles with a short real beginning", () => {
    const preview = buildReportPreview(getLibrary(), RESULT);

    expect(preview.map((section) => section.title)).toEqual(["Портрет", "Сильные стороны", "Слепые зоны", "Инструкция по применению меня", "Как меня видят другие"]);
    for (const section of preview) expect(section.teaser.length).toBeLessThanOrEqual(121);
  });
});

describe("buildReportPageView", () => {
  test("a fresh purchase is being prepared, friends are counted", () => {
    const view = buildReportPageView({ owned: ["full"], reports: [], friendsCount: 1 });

    expect(view).toMatchObject({ full: null, friends: { state: "waiting", counter: "Ответили 1 из 3" }, bundle: { price: "249 ₽" }, preparing: true });
    expect(view.chapters.map((chapter) => chapter.state)).toEqual(["available", "available", "available", "available"]);
  });

  test("ready sections, a bought chapter and the friends section", () => {
    const view = buildReportPageView({
      owned: ["full", "chapter_money"],
      reports: [report("full", FULL), report("chapter_money", MONEY), report("friends", { text: "т".repeat(300) })],
      friendsCount: 3,
    });

    expect(view.full).toEqual(FULL);
    expect(view.friends).toEqual({ state: "ready", text: "т".repeat(300) });
    expect(view.chapters[0]).toMatchObject({ kind: "chapter_money", state: "ready" });
    expect(view.chapters[1]).toEqual({ kind: "chapter_conflict", title: "Конфликты", state: "available", price: "99 ₽" });
    expect(view.bundle).toBeNull();
    expect(view.preparing).toBe(false);
  });

  test("the bundle prepares all chapters, three friends without a text mean preparing", () => {
    const view = buildReportPageView({ owned: ["full", "chapters_all"], reports: [report("full", FULL)], friendsCount: 4 });

    expect(view.chapters.every((chapter) => chapter.state === "preparing")).toBe(true);
    expect(view.friends).toEqual({ state: "preparing" });
    expect(view.preparing).toBe(true);
  });
});
```

Цены — с неразрывным пробелом, как возвращает `formatRub`.

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run apps/web/src/lib/report-view.test.ts
```
Expected: FAIL — модуля нет.

- [ ] **Step 2: Модель страницы**

В `apps/web/package.json` в `dependencies` добавить `"@grani/ai": "workspace:*"`; `pnpm install && pnpm dedupe`.

`apps/web/src/lib/report-view.ts`:
```ts
import { buildPersonalInput, fallbackSections, parseSections, type ChapterSections, type FullSections, type PersonalScores } from "@grani/ai";
import { CHAPTER_TITLES, type Library } from "@grani/content";
import { canBuy, CHAPTER_KINDS, formatRub, MIN_FRIENDS, PRODUCT_PRICES, unlockedKinds, type ChapterKind, type Product } from "@grani/core";
import type { ReportRecord } from "@grani/db";
import { friendsCounter } from "./friends-view";

export const REPORT_DISCLAIMER = "Материалы для самопознания, не психологическая и не медицинская диагностика.";

export type PreviewSection = { title: string; teaser: string };
export type ChapterView =
  | { kind: ChapterKind; title: string; state: "ready"; sections: ChapterSections }
  | { kind: ChapterKind; title: string; state: "preparing" }
  | { kind: ChapterKind; title: string; state: "available"; price: string };
export type FriendsSectionView = { state: "ready"; text: string } | { state: "preparing" } | { state: "waiting"; counter: string };
export type ReportPageView = {
  full: FullSections | null;
  friends: FriendsSectionView;
  chapters: readonly ChapterView[];
  bundle: { price: string } | null;
  preparing: boolean;
};

const TEASER_LENGTH = 120;
const teaser = (text: string) => (text.length <= TEASER_LENGTH ? text : `${text.slice(0, TEASER_LENGTH).trimEnd()}…`);

export function buildReportPreview(library: Library, result: PersonalScores): readonly PreviewSection[] {
  const full = fallbackSections(buildPersonalInput(library, "full", result)) as FullSections;
  return [
    { title: "Портрет", teaser: teaser(full.portrait) },
    { title: "Сильные стороны", teaser: teaser(full.strengths[0]!) },
    { title: "Слепые зоны", teaser: teaser(full.blind_spots[0]!.text) },
    { title: "Инструкция по применению меня", teaser: teaser(`Как со мной работать: ${full.manual.work[0]!}`) },
    { title: "Как меня видят другие", teaser: "Появится, когда ответят трое друзей: где их взгляд совпадает с твоим и где расходится." },
  ];
}

export function buildReportPageView(p: { owned: readonly Product[]; reports: readonly ReportRecord[]; friendsCount: number }): ReportPageView {
  const unlocked = unlockedKinds(p.owned);
  const byKind = new Map(p.reports.map((report) => [report.kind, report]));
  const full = byKind.has("full") ? parseSections("full", byKind.get("full")!.sections) : null;

  const friendsText = byKind.has("friends") ? parseSections("friends", byKind.get("friends")!.sections)?.text : undefined;
  const friends: FriendsSectionView = friendsText
    ? { state: "ready", text: friendsText }
    : p.friendsCount >= MIN_FRIENDS
      ? { state: "preparing" }
      : { state: "waiting", counter: friendsCounter(p.friendsCount) };

  const chapters = CHAPTER_KINDS.map((kind): ChapterView => {
    const title = CHAPTER_TITLES[kind];
    const sections = byKind.has(kind) ? parseSections(kind, byKind.get(kind)!.sections) : null;
    if (sections) return { kind, title, state: "ready", sections };
    if (unlocked.has(kind)) return { kind, title, state: "preparing" };
    return { kind, title, state: "available", price: formatRub(PRODUCT_PRICES[kind]) };
  });

  return {
    full,
    friends,
    chapters,
    bundle: canBuy("chapters_all", p.owned) ? { price: formatRub(PRODUCT_PRICES.chapters_all) } : null,
    preparing: full === null || friends.state === "preparing" || chapters.some((chapter) => chapter.state === "preparing"),
  };
}
```

```bash
pnpm vitest run apps/web/src/lib/report-view.test.ts
```
Expected: PASS.

- [ ] **Step 3: Компоненты**

`apps/web/src/components/Paragraphs.tsx`:
```tsx
export function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n\s*\n/).map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </>
  );
}
```

`apps/web/src/components/AutoRefresh.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Пока разделы генерируются, страница сама перечитывает данные с сервера
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}
```

`apps/web/src/components/BuyButton.tsx`:
```tsx
"use client";

import type { Product } from "@grani/core";
import { useState } from "react";

const ERRORS: Record<string, string> = {
  unauthorized: "Войдите, чтобы купить разбор.",
  not_available: "Это уже куплено — обновите страницу.",
  not_found: "Не нашли результат. Обновите страницу.",
  payments_unavailable: "Оплата временно недоступна. Попробуйте позже.",
  rate_limited: "Слишком много попыток. Подождите минуту.",
};
const FALLBACK = "Не получилось перейти к оплате. Проверьте интернет и попробуйте ещё раз.";

export function BuyButton({ product, targetId, label, ghost = false }: { product: Product; targetId: string; label: string; ghost?: boolean }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/purchases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ product, targetId }) });
      const body = (await response.json()) as { ok: boolean; url?: string; error?: string };
      if (body.ok && body.url) {
        window.location.assign(body.url);
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
      <button type="button" className={ghost ? "button button--ghost" : "button"} disabled={sending} onClick={buy}>
        {sending ? "Переходим к оплате…" : label}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
```

`apps/web/src/components/PurchaseStatus.tsx`:
```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PurchaseView } from "@/server/payments-service";

const POLL_MS = 3000;

export function PurchaseStatus({ initial }: { initial: PurchaseView }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const finished = view.ready || view.status === "canceled" || view.status === "refunded";

  useEffect(() => {
    if (view.ready) {
      router.replace(view.reportUrl);
      return;
    }
    if (finished) return;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/purchases/${view.id}`, { cache: "no-store" });
        if (response.ok) setView((await response.json()) as PurchaseView);
      } catch {
        // Сеть мигнула — следующий опрос через 3 секунды
      }
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [view, finished, router]);

  if (view.status === "canceled" || view.status === "refunded") {
    return (
      <div className="stack">
        <h1 className="display">Оплата не прошла</h1>
        <p className="lead">Деньги не списаны. Можно попробовать ещё раз.</p>
        <div>
          <Link className="button" href={view.reportUrl.startsWith("/pair/") ? view.reportUrl : "/me"}>
            Вернуться
          </Link>
        </div>
      </div>
    );
  }
  if (view.status === "pending") {
    return (
      <div className="stack" role="status">
        <h1 className="display">Ждём подтверждения оплаты</h1>
        <p className="lead">Обычно это занимает несколько секунд.</p>
      </div>
    );
  }
  return (
    <div className="stack" role="status">
      <h1 className="display">{view.ready ? "Разбор готов" : "Готовим разбор"}</h1>
      <p className="lead">Около минуты. Страницу можно не обновлять — когда всё будет готово, придёт сообщение.</p>
      {view.ready && (
        <div>
          <Link className="button" href={view.reportUrl}>
            Открыть разбор <span aria-hidden="true">→</span>
          </Link>
        </div>
      )}
    </div>
  );
}
```

`import type` из серверного модуля в клиентском компоненте безопасен: тип стирается при сборке.

- [ ] **Step 4: Страницы**

`apps/web/src/app/purchases/[id]/page.tsx`:
```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PurchaseStatus } from "@/components/PurchaseStatus";
import { paymentsDeps } from "@/server/payments-deps";
import { getPurchaseView } from "@/server/payments-service";
import { requireUser } from "@/server/viewer";

export const metadata: Metadata = { title: "Оплата" };

export default async function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, requireUser()]);
  const deps = paymentsDeps();
  const view = deps ? await getPurchaseView(deps, { purchaseId: id, userId: user.id }) : null;
  if (!view) notFound();
  return (
    <main className="page">
      <PurchaseStatus initial={view} />
    </main>
  );
}
```

`apps/web/src/app/result/[id]/ReportOffer.tsx`:
```tsx
import { getLibrary } from "@grani/content/data";
import { formatRub, PRODUCT_PRICES, unlockedKinds } from "@grani/core";
import { listOwnedProducts, type ResultRecord } from "@grani/db";
import Link from "next/link";
import { BuyButton } from "@/components/BuyButton";
import { buildReportPreview } from "@/lib/report-view";
import { getDb } from "@/server/db";

const BLURRED = "Здесь продолжение раздела: конкретные наблюдения о сочетании твоих черт, примеры из работы и отношений и то, что с этим делать.";

export async function ReportOffer({ result }: { result: ResultRecord }) {
  const owned = await listOwnedProducts(getDb(), { resultId: result.id });
  if (unlockedKinds(owned).has("full")) {
    return (
      <section className="card card--3 stack" aria-labelledby="report">
        <p className="eyebrow">Полный разбор</p>
        <h2 id="report">Разбор открыт</h2>
        <div>
          <Link className="button" href={`/report/${result.id}`}>
            Читать разбор <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    );
  }
  const preview = buildReportPreview(getLibrary(), result);
  return (
    <section className="card card--3 stack" aria-labelledby="report">
      <p className="eyebrow">Полный разбор</p>
      <h2 id="report">Что откроется в полном разборе</h2>
      {preview.map((section) => (
        <div key={section.title} className="preview">
          <h3>{section.title}</h3>
          <p>{section.teaser}</p>
          <p className="preview__blur" aria-hidden="true">{BLURRED}</p>
        </div>
      ))}
      <BuyButton product="full" targetId={result.id} label={`Открыть за ${formatRub(PRODUCT_PRICES.full)}`} />
      <p className="muted">
        Нажимая кнопку, вы принимаете условия <Link href="/offer">оферты</Link> и подтверждаете, что вам есть 18 лет.
      </p>
    </section>
  );
}
```

В `apps/web/src/app/result/[id]/page.tsx` после `<FriendsBlock resultId={result.id} />` добавить `<ReportOffer result={result} />` и импорт `import { ReportOffer } from "./ReportOffer";`.

`apps/web/src/app/report/[resultId]/page.tsx`:
```tsx
import { countFriendResponses, getInviteForResult, getResultForOwner, listOwnedProducts, listReports } from "@grani/db";
import { unlockedKinds } from "@grani/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { BuyButton } from "@/components/BuyButton";
import { Paragraphs } from "@/components/Paragraphs";
import { buildReportPageView, REPORT_DISCLAIMER } from "@/lib/report-view";
import { getDb } from "@/server/db";
import { requireUser } from "@/server/viewer";

export const metadata: Metadata = { title: "Полный разбор" };

const REFRESH_SECONDS = 5;

function Preparing({ what }: { what: string }) {
  return <p className="muted" role="status">Готовим {what}… Страница обновится сама.</p>;
}

export default async function ReportPage({ params }: { params: Promise<{ resultId: string }> }) {
  const [{ resultId }, user] = await Promise.all([params, requireUser()]);
  const db = getDb();
  const result = await getResultForOwner(db, resultId, user.id);
  if (!result) notFound();
  const owned = await listOwnedProducts(db, { resultId });
  if (!unlockedKinds(owned).has("full")) redirect(`/result/${resultId}`);
  const invite = await getInviteForResult(db, resultId);
  const view = buildReportPageView({
    owned,
    reports: await listReports(db, { resultId }),
    friendsCount: invite ? await countFriendResponses(db, invite.id) : 0,
  });

  return (
    <main className="page">
      {view.preparing && <AutoRefresh seconds={REFRESH_SECONDS} />}
      <div className="stack">
        <section className="card card--2 stack report">
          <p className="eyebrow">Полный разбор</p>
          {view.full ? (
            <>
              <h1 className="display">Портрет</h1>
              <Paragraphs text={view.full.portrait} />
              <h2>Сильные стороны</h2>
              <ul>{view.full.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
              <h2>Слепые зоны</h2>
              <ul>
                {view.full.blind_spots.map((item) => (
                  <li key={item.text}>
                    {item.text} <span className="tip">Что с этим делать: {item.tip}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Preparing what="разбор" />
          )}
        </section>

        {view.full && (
          <section className="card card--paper stack report" aria-labelledby="manual">
            <p className="eyebrow">Инструкция по применению меня</p>
            <h2 id="manual">Как со мной</h2>
            <h3>Как со мной работать</h3>
            <ul>{view.full.manual.work.map((item) => <li key={item}>{item}</li>)}</ul>
            <h3>Как со мной ссориться</h3>
            <ul>{view.full.manual.fight.map((item) => <li key={item}>{item}</li>)}</ul>
            <h3>Что меня бесит</h3>
            <ul>{view.full.manual.annoys.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        )}

        <section className="card stack report" data-palette="friends" aria-labelledby="friends-report">
          <p className="eyebrow">Как меня видят другие</p>
          <h2 id="friends-report">Взгляд друзей</h2>
          {view.friends.state === "ready" && <Paragraphs text={view.friends.text} />}
          {view.friends.state === "preparing" && <Preparing what="раздел" />}
          {view.friends.state === "waiting" && (
            <>
              <p className="lead">Раздел появится, когда ответят трое друзей. {view.friends.counter}.</p>
              <div>
                <Link className="button button--ghost" href={`/result/${resultId}`}>
                  Ссылка для друзей
                </Link>
              </div>
            </>
          )}
        </section>

        <section className="card card--paper stack report" aria-labelledby="chapters">
          <p className="eyebrow">Главы по сферам</p>
          <h2 id="chapters">Деньги, конфликты, стресс, отношения</h2>
          {view.bundle && <BuyButton product="chapters_all" targetId={resultId} label={`Все четыре главы — ${view.bundle.price}`} />}
          {view.chapters.map((chapter) => (
            <div key={chapter.kind} className="stack">
              <h3>{chapter.title}</h3>
              {chapter.state === "ready" && (
                <>
                  <Paragraphs text={chapter.sections.text} />
                  <ul>{chapter.sections.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
                </>
              )}
              {chapter.state === "preparing" && <Preparing what="главу" />}
              {chapter.state === "available" && (
                <BuyButton product={chapter.kind} targetId={resultId} label={`Глава «${chapter.title}» — ${chapter.price}`} ghost />
              )}
            </div>
          ))}
        </section>

        <p className="muted">{REPORT_DISCLAIMER}</p>
        <div className="row">
          <Link className="button button--ghost" href={`/result/${resultId}`}>
            К результату
          </Link>
        </div>
      </div>
    </main>
  );
}
```

В `apps/web/src/app/globals.css` перед `.footer`:
```css
.preview h3 { margin: 0 0 6px; }
.preview p { margin: 0; }
.preview__blur { filter: blur(5px); user-select: none; color: var(--ink-soft); }
.report ul { margin: 0; padding-left: 21px; display: grid; gap: 9px; }
.report h3 { margin: 21px 0 0; }
.tip { display: block; margin-top: 4px; color: var(--ink-soft); }
```

- [ ] **Step 5: Проверка в браузере**

С запущенными `pnpm dev:db`, `pnpm dev:web`, `pnpm dev:worker` (`PAYMENTS_FAKE=1`, `AI_PROVIDER=none`, `NOTIFICATIONS_DRY_RUN=1`):
1. `/api/dev/login?name=Аня` → результат: блок «Что откроется в полном разборе» — пять заголовков, первые строки читаются, продолжение размыто; кнопка «Открыть за 299 ₽», строка об оферте.
2. Нажать кнопку → `/dev/pay/<id>` с суммой «299 ₽» → «Оплатить» → `/purchases/<id>`: «Готовим разбор» → через несколько секунд переход на `/report/<resultId>`: портрет, сильные стороны, слепые зоны с подсказками, инструкция, раздел друзей со счётчиком, четыре кнопки глав и кнопка набора.
3. В логе воркера — `report generated` с `"source":"fallback"` и `dry run notification` «Готово: полный разбор».
4. «Все четыре главы — 249 ₽» → оплатить → на странице разбора четыре раздела «Готовим главу…» сменяются текстами; кнопок глав и набора больше нет.
5. Новая покупка → «Отменить» на поддельной странице → «Оплата не прошла».
6. На результате блок «Разбор открыт» со ссылкой. Ширина 375px — без горизонтальной прокрутки; консоль без ошибок.

- [ ] **Step 6: Тесты и коммит**

```bash
pnpm test && pnpm typecheck
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): report preview and purchase on the result page, waiting page, full report page with chapters and friends section"
```
