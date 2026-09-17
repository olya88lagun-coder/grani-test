# Task 8: Вход, результат, «мой результат», текст согласия

**Files:**
- Create: `apps/web/src/lib/result-view.ts`, `apps/web/src/lib/login-errors.ts`, `apps/web/src/lib/legal.ts`
- Create: `apps/web/src/components/ScaleBar.tsx`
- Create: `apps/web/src/app/login/page.tsx`, `apps/web/src/app/login/LoginPanel.tsx`, `apps/web/src/app/login/TelegramLoginButton.tsx`
- Create: `apps/web/src/app/result/[id]/page.tsx`, `apps/web/src/app/me/page.tsx`, `apps/web/src/app/consent/page.tsx`
- Test: `apps/web/src/lib/result-view.test.ts`, `apps/web/src/lib/login-errors.test.ts`

**Interfaces:**
- Consumes: `TRAITS`, `Trait`, `TraitScores`, `TypeCode`, `Stability`, `Gender`, `typeName`, `traitLevel`, `isBorderline` (`@grani/core`); `getLibrary` (`@grani/content/data`); `typeTexts`, `stabilityText`, `traitBlock`, `typeCodeToDir` (`@grani/content`); `ResultRecord`, `getResultForOwner`, `getLatestResultId` (Task 2); `currentUser`, `requireUser`, `CONSENT_VERSION` (Task 6); `getEnv`, `getDb` (Task 3); `POST /api/consent`, `GET /api/auth/vk/start`, `GET /api/auth/telegram/widget`, `POST /api/auth/logout` (Task 6).
- Produces:
  ```ts
  // result-view.ts
  const TRAIT_LABELS: Readonly<Record<Trait, string>>;
  type ScaleView = { trait: Trait; label: string; score: number; borderline: boolean; text: string };
  type ResultView = {
    typeCode: TypeCode; dir: string; name: string; stabilityTag: string; stabilityText: string;
    shortText: string; scales: readonly ScaleView[];
  };
  function buildResultView(library: Library, result: Pick<ResultRecord, "typeCode" | "stability" | "scores">, gender: Gender): ResultView;
  // login-errors.ts
  function loginErrorMessage(code: string | null): string | null;
  // legal.ts
  const OPERATOR: { name: string; email: string };
  ```

Бесплатный результат (раздел 2.1 спецификации): название типа с учётом пола, уточнение «спокойствие» или «чувствительность», короткое описание типа, 5 шкал с баллами и одной фразой о сильной стороне уровня. Для шкалы стабильности балл показывается как есть, подпись — «Эмоциональная устойчивость». Пограничный балл (45–55) отмечается подписью «на границе» — текст берётся из уровня `borderline`.

Результат видит только его владелец: чужой или несуществующий id → 404 (одинаково, чтобы не выдавать существование результата).

**Данные от пользователя до Step 5:** имя оператора персональных данных (ФИО самозанятой, как в «Мой налог») и адрес почты для запросов по данным — для текста согласия. Без них Step 5 не выполняется: агент спрашивает и ждёт.

- [ ] **Step 1: Тесты (падают)**

`apps/web/src/lib/result-view.test.ts`:
```ts
import type { TraitScores } from "@grani/core";
import { typeTexts } from "@grani/content";
import { getLibrary } from "@grani/content/data";
import { describe, expect, test } from "vitest";
import { TRAIT_LABELS, buildResultView } from "./result-view";

const scores: TraitScores = { openness: 80, conscientiousness: 30, extraversion: 50, agreeableness: 62, stability: 40 };
const result = { typeCode: "+-++" as const, stability: "sensitive" as const, scores };

describe("buildResultView", () => {
  test("uses the gendered type name when gender is known", () => {
    expect(buildResultView(getLibrary(), result, "female").name).toBe("Искра");
    expect(buildResultView(getLibrary(), { ...result, typeCode: "++-+" }, "female").name).toBe("Созидательница");
    expect(buildResultView(getLibrary(), { ...result, typeCode: "++-+" }, null).name).toBe("Созидатель");
  });

  test("maps the type code to its directory and texts", () => {
    const view = buildResultView(getLibrary(), result, null);
    expect(view.dir).toBe("pmpp");
    expect(view.shortText).toBe(typeTexts(getLibrary(), "+-++").short);
    expect(view.stabilityTag).toBe("Чувствительность");
    expect(view.stabilityText).toBe(getLibrary().stability.sensitive);
  });

  test("lists five scales in trait order with labels and level texts", () => {
    const view = buildResultView(getLibrary(), result, null);
    expect(view.scales.map((scale) => scale.label)).toEqual(Object.values(TRAIT_LABELS));
    const extraversion = view.scales.find((scale) => scale.trait === "extraversion");
    expect(extraversion).toMatchObject({ score: 50, borderline: true });
    expect(extraversion?.text).toBe(getLibrary().traits.extraversion.borderline.strengths);
    const openness = view.scales.find((scale) => scale.trait === "openness");
    expect(openness).toMatchObject({ score: 80, borderline: false, text: getLibrary().traits.openness.high.strengths });
  });

  test("labels a calm result", () => {
    expect(buildResultView(getLibrary(), { ...result, stability: "calm" }, null).stabilityTag).toBe("Спокойствие");
  });
});
```

`apps/web/src/lib/login-errors.test.ts`:
```ts
import { expect, test } from "vitest";
import { loginErrorMessage } from "./login-errors";

test("no error code means no message", () => {
  expect(loginErrorMessage(null)).toBeNull();
});

test("explains that consent is required", () => {
  expect(loginErrorMessage("consent_required")).toMatch(/согласи/i);
});

test.each(["telegram_BAD_HASH", "vk_state_mismatch", "vk_missing_params", "invalid_grant", "network"])(
  "shows a readable message for %s",
  (code) => {
    const message = loginErrorMessage(code);
    expect(message).toBeTypeOf("string");
    expect(message).not.toContain(code);
  },
);
```

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run apps/web/src/lib/result-view.test.ts apps/web/src/lib/login-errors.test.ts
```
Expected: FAIL — модулей нет.

- [ ] **Step 2: Реализация**

`apps/web/src/lib/result-view.ts`:
```ts
import { TRAITS, traitLevel, typeName, isBorderline, type Gender, type Stability, type Trait, type TraitScores, type TypeCode } from "@grani/core";
import { stabilityText, traitBlock, typeCodeToDir, typeTexts, type Library } from "@grani/content";

export const TRAIT_LABELS: Readonly<Record<Trait, string>> = {
  openness: "Открытость опыту",
  conscientiousness: "Добросовестность",
  extraversion: "Экстраверсия",
  agreeableness: "Доброжелательность",
  stability: "Эмоциональная устойчивость",
};

const STABILITY_TAGS: Readonly<Record<Stability, string>> = { calm: "Спокойствие", sensitive: "Чувствительность" };

export type ScaleView = { trait: Trait; label: string; score: number; borderline: boolean; text: string };

export type ResultView = {
  typeCode: TypeCode;
  dir: string;
  name: string;
  stabilityTag: string;
  stabilityText: string;
  shortText: string;
  scales: readonly ScaleView[];
};

type ResultInput = { typeCode: TypeCode; stability: Stability; scores: TraitScores };

export function buildResultView(library: Library, result: ResultInput, gender: Gender): ResultView {
  return {
    typeCode: result.typeCode,
    dir: typeCodeToDir(result.typeCode),
    name: typeName(result.typeCode, gender),
    stabilityTag: STABILITY_TAGS[result.stability],
    stabilityText: stabilityText(library, result.stability),
    shortText: typeTexts(library, result.typeCode).short,
    scales: TRAITS.map((trait) => {
      const score = result.scores[trait];
      return {
        trait,
        label: TRAIT_LABELS[trait],
        score,
        borderline: isBorderline(score),
        text: traitBlock(library, trait, traitLevel(score), "strengths"),
      };
    }),
  };
}
```

`apps/web/src/lib/login-errors.ts`:
```ts
const MESSAGES: Readonly<Record<string, string>> = {
  consent_required: "Чтобы сохранить результат, отметьте согласие на обработку данных и войдите ещё раз.",
  vk_state_mismatch: "Вход через VK ID занял слишком много времени. Попробуйте ещё раз.",
  vk_missing_params: "VK ID не вернул данные для входа. Попробуйте ещё раз.",
};

const TELEGRAM_FALLBACK = "Telegram не подтвердил вход. Попробуйте ещё раз.";
const GENERIC_FALLBACK = "Не получилось войти. Попробуйте ещё раз или выберите другой способ.";

export function loginErrorMessage(code: string | null): string | null {
  if (code === null) return null;
  const known = MESSAGES[code];
  if (known) return known;
  return code.startsWith("telegram_") ? TELEGRAM_FALLBACK : GENERIC_FALLBACK;
}
```

```bash
pnpm vitest run apps/web/src/lib/result-view.test.ts apps/web/src/lib/login-errors.test.ts
```
Expected: PASS.

- [ ] **Step 3: Страница входа**

`apps/web/src/app/login/TelegramLoginButton.tsx` — перенести из `C:\dev\wishlist\apps\web\src\app\login\TelegramLoginButton.tsx` без изменений поведения (скрипт виджета создаётся внутри контейнера, `data-auth-url`, `data-request-access="write"`), `data-radius` — число из `--radius` выбранного направления без `px`.

`apps/web/src/app/login/LoginPanel.tsx`:
```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { TelegramLoginButton } from "./TelegramLoginButton";

export function LoginPanel({ botUsername, authUrl, hasPendingResult }: { botUsername: string; authUrl: string; hasPendingResult: boolean }) {
  const [agreed, setAgreed] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Согласие фиксируется на сервере до входа: виджет Telegram не передаёт дополнительные параметры
  async function confirm() {
    setError(null);
    try {
      const response = await fetch("/api/consent", { method: "POST" });
      if (!response.ok) throw new Error(`consent ${response.status}`);
      setReady(true);
    } catch {
      setError("Не получилось сохранить согласие. Проверьте интернет и попробуйте ещё раз.");
    }
  }

  return (
    <div className="stack">
      <p className="lead">
        {hasPendingResult
          ? "Результат посчитан. Войдите, чтобы увидеть и сохранить его."
          : "Войдите, чтобы открыть свои результаты."}
      </p>

      {!ready && (
        <>
          <label className="choice">
            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
            <span>
              Я соглашаюсь на <Link href="/consent">обработку персональных данных</Link>
            </span>
          </label>
          <button type="button" className="button button--block" disabled={!agreed} onClick={confirm}>
            Продолжить
          </button>
        </>
      )}

      {ready && (
        <>
          <TelegramLoginButton botUsername={botUsername} authUrl={authUrl} />
          <a className="button button--ghost button--block" href="/api/auth/vk/start">
            Войти через VK ID
          </a>
        </>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
```

`apps/web/src/app/login/page.tsx`:
```tsx
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loginErrorMessage } from "@/lib/login-errors";
import { getEnv } from "@/server/env";
import { PENDING_COOKIE } from "@/server/http";
import { currentUser } from "@/server/viewer";
import { LoginPanel } from "./LoginPanel";

export const metadata: Metadata = { title: "Вход — Грани" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, user, store] = await Promise.all([searchParams, currentUser(), cookies()]);
  if (user) redirect("/me");
  const env = getEnv();
  const message = loginErrorMessage(error ?? null);
  return (
    <main className="page">
      <h1 className="display">Вход</h1>
      {message && (
        <p className="error" role="alert">
          {message}
        </p>
      )}
      <LoginPanel
        botUsername={env.TELEGRAM_BOT_USERNAME}
        authUrl={new URL("/api/auth/telegram/widget", env.APP_URL).toString()}
        hasPendingResult={store.has(PENDING_COOKIE)}
      />
    </main>
  );
}
```

Уже вошедший человек, который отправил тест, сохраняется сразу (Task 5) и на `/login` не попадает, поэтому `redirect("/me")` не теряет ответы.

- [ ] **Step 4: Результат и «мой результат»**

`apps/web/src/components/ScaleBar.tsx`:
```tsx
import type { ScaleView } from "@/lib/result-view";

export function ScaleBar({ scale }: { scale: ScaleView }) {
  return (
    <div className="scale">
      <div className="scale__head">
        <span>{scale.label}</span>
        <span>{scale.score}</span>
      </div>
      <div className="scale__track" role="img" aria-label={`${scale.label}: ${scale.score} из 100`}>
        <span className="scale__fill" style={{ width: `${scale.score}%` }} />
      </div>
      {scale.borderline && <span className="scale__mark">на границе</span>}
      <p className="muted">{scale.text}</p>
    </div>
  );
}
```

`apps/web/src/app/result/[id]/page.tsx`:
```tsx
import { getLibrary } from "@grani/content/data";
import { getResultForOwner } from "@grani/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScaleBar } from "@/components/ScaleBar";
import { buildResultView } from "@/lib/result-view";
import { getDb } from "@/server/db";
import { requireUser } from "@/server/viewer";

export const metadata: Metadata = { title: "Мой результат — Грани" };

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, requireUser()]);
  const result = await getResultForOwner(getDb(), id, user.id);
  if (!result) notFound();
  const view = buildResultView(getLibrary(), result, user.gender);

  return (
    <main className="page">
      <div className="stack">
        <section className="card card--2 stack">
          <div className="row" style={{ gap: 21 }}>
            {/* Знак типа — Task 9 */}
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

        {/* Карточка для сторис — Task 9 */}

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
```

Форма выхода — обычный POST с той же страницы, поэтому проверка `Origin` в маршруте выхода проходит.

`apps/web/src/app/me/page.tsx`:
```tsx
import { getLatestResultId } from "@grani/db";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db";
import { requireUser } from "@/server/viewer";

export default async function MePage() {
  const user = await requireUser();
  const resultId = await getLatestResultId(getDb(), user.id);
  redirect(resultId ? `/result/${resultId}` : "/test");
}
```

- [ ] **Step 5: Текст согласия**

Спросить у пользователя ФИО оператора и почту для запросов (см. «Данные от пользователя»). Записать в `apps/web/src/lib/legal.ts`:
```ts
// Оператор персональных данных — самозанятая, указана так же, как в «Мой налог»
export const OPERATOR = { name: "<ФИО от пользователя>", email: "<почта от пользователя>" } as const;
```

`apps/web/src/app/consent/page.tsx`:
```tsx
import type { Metadata } from "next";
import { OPERATOR } from "@/lib/legal";
import { CONSENT_VERSION } from "@/server/login-service";

export const metadata: Metadata = { title: "Согласие на обработку персональных данных — Грани" };

export default function ConsentPage() {
  return (
    <main className="page">
      <article className="stack">
        <h1 className="display">Согласие на обработку персональных данных</h1>
        <p className="muted">Редакция {CONSENT_VERSION}</p>
        <p>
          Отмечая согласие на сайте grani-test.ru, я даю {OPERATOR.name} (далее — оператор) согласие на обработку моих
          персональных данных на условиях ниже.
        </p>
        <h2>Какие данные</h2>
        <p>
          Идентификатор и имя в Telegram или VK ID; пол, если его передаёт VK ID; ответы на вопросы теста и рассчитанный
          по ним результат; дата и время согласия.
        </p>
        <h2>Зачем</h2>
        <p>Чтобы входить на сайт, сохранять и показывать мне результаты теста.</p>
        <h2>Что с ними делают</h2>
        <p>
          Сбор, запись, хранение, использование, удаление. Данные хранятся на серверах в России и не передаются третьим
          лицам, кроме случаев, предусмотренных законом.
        </p>
        <h2>Срок и отзыв</h2>
        <p>
          Согласие действует до отзыва. Отозвать его и попросить удалить данные можно письмом на{" "}
          <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a> — данные удаляются в течение 30 дней.
        </p>
        <p className="muted">
          Результаты теста описывают черты личности по модели «Большая пятёрка» и не являются медицинским или
          психологическим диагнозом.
        </p>
      </article>
    </main>
  );
}
```

Это рабочая редакция для закрытого от индексации сайта; финальную редакцию вместе с политикой конфиденциальности готовит план 6.

- [ ] **Step 6: Проверка в браузере**

С запущенными `pnpm dev:db` и `pnpm dev:web`:
1. Пройти тест до конца → `/login` с текстом «Результат посчитан…»; «Продолжить» неактивна без галочки.
2. Открыть `/api/dev/login?name=Проверка` → переход на `/result/<id>`: тег уточнения, название типа, описание, 5 шкал; ширина 375px без горизонтальной прокрутки.
3. `/me` → тот же результат. `/result/00000000-0000-0000-0000-000000000000` → 404.
4. «Выйти» → `/`; `/me` → `/login`.
5. `/login?error=consent_required` → понятный текст ошибки. `/consent` — текст с ФИО и почтой.

Консоль браузера и логи сервера без ошибок.

- [ ] **Step 7: Тесты и коммит**

```bash
pnpm test && pnpm typecheck
git add apps/web/src/lib apps/web/src/components apps/web/src/app/login apps/web/src/app/result apps/web/src/app/me apps/web/src/app/consent
git commit -m "feat(web): login page with consent, free result page, my result redirect and consent text"
```
