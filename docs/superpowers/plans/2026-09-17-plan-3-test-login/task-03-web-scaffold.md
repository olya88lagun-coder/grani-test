# Task 3: `@grani/web` — каркас Next.js, окружение, база, стили, CI

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/vitest.config.ts`, `apps/web/.env.development.example`, `apps/web/public/.gitkeep`
- Create: `apps/web/src/server/env.ts`, `apps/web/src/server/db.ts`, `apps/web/src/server/http.ts`
- Create: `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`, `apps/web/src/app/api/health/route.ts`
- Create: `.github/workflows/ci.yml`
- Test: `apps/web/src/server/env.test.ts`, `apps/web/src/server/http.test.ts`
- Modify: `package.json` (скрипт `dev:web`), `vitest.config.ts` (покрытие `apps/web/src/server`, `apps/web/src/lib`)

**Interfaces:**
- Consumes: `createDb`, `Database` (Task 2); значения из `docs/design/visual-direction.md` (Task 1).
- Produces:
  ```ts
  type AppEnv = { APP_URL: string; DATABASE_URL: string; SESSION_SECRET: string; TELEGRAM_BOT_TOKEN: string; TELEGRAM_BOT_USERNAME: string; VK_CLIENT_ID: string };
  function readEnv(source?: Record<string, string | undefined>): AppEnv;
  function getEnv(): AppEnv;
  function getDb(): Database;

  const SESSION_COOKIE = "grani_session";
  const PENDING_COOKIE = "grani_pending";
  const CONSENT_COOKIE = "grani_consent";
  const VK_STATE_COOKIE = "grani_vk_oauth";
  type CookieOptions = { httpOnly: true; secure: boolean; sameSite: "lax"; path: string; maxAge: number };
  function sessionCookieOptions(appUrl: string): CookieOptions;
  function pendingCookieOptions(appUrl: string): CookieOptions;
  function consentCookieOptions(appUrl: string): CookieOptions;
  function vkStateCookieOptions(appUrl: string): CookieOptions;
  function expiredCookieOptions(options: CookieOptions): CookieOptions; // maxAge 0
  function isSameOrigin(request: Request, appUrl: string): boolean;
  ```
  CSS-классы для задач 7–9: `.page`, `.page--wide`, `.eyebrow`, `.display`, `.lead`, `.muted`, `.error`, `.card`, `.card--2`, `.card--3`, `.card--4`, `.card--paper`, `.button`, `.button--lg`, `.button--ghost`, `.button--block`, `.progress`, `.progress__bar`, `.question`, `.choices`, `.choice`, `.scale`, `.scale__head`, `.scale__track`, `.scale__fill`, `.scale__mark`, `.tag`, `.stack`, `.row`, `.footer`; палитры `data-palette="friends"` и `data-palette="pair"`.

Сроки жизни cookie — из Global Constraints. `secure` включается, только если `APP_URL` начинается с `https://`: на `http://localhost` браузер не сохранит Secure-cookie.

- [ ] **Step 1: Пакет и конфиги**

`apps/web/package.json`:
```json
{
  "name": "@grani/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@grani/content": "workspace:*",
    "@grani/core": "workspace:*",
    "@grani/db": "workspace:*",
    "drizzle-orm": "0.45.2",
    "jose": "6.2.12",
    "next": "16.3.5",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "zod": "4.6.5"
  },
  "devDependencies": {
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0"
  }
}
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "allowJs": false,
    "types": ["node"],
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "src", ".next/types/**/*.ts", "next.config.ts"],
  "exclude": ["node_modules"]
}
```

`apps/web/next.config.ts`:
```ts
import path from "node:path";
import type { NextConfig } from "next";

// `next build` запускается из apps/web (pnpm --filter), корень монорепо — на два уровня выше
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  transpilePackages: ["@grani/core", "@grani/content", "@grani/db"],
  poweredByHeader: false,
};

export default nextConfig;
```

`apps/web/vitest.config.ts`:
```ts
import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

export default defineProject({
  // В tsconfig Next стоит jsx: "preserve" — для тестов JSX нужно компилировать самим
  oxc: { jsx: { runtime: "automatic", importSource: "react" } },
  test: { name: "web", environment: "node", testTimeout: 30000, hookTimeout: 30000 },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
```

`apps/web/.env.development.example`:
```
# Скопировать в apps/web/.env.development.local
APP_URL=http://localhost:3000
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres?sslmode=disable
DATABASE_POOL_MAX=1
SESSION_SECRET=local-dev-secret-local-dev-secret-local
TELEGRAM_BOT_TOKEN=123456:local-dev-token
TELEGRAM_BOT_USERNAME=test_grani_bot
VK_CLIENT_ID=1
DEV_LOGIN=1
```

`apps/web/public/.gitkeep` — пустой файл.

В корневой `package.json` в `scripts` добавить:
```json
    "dev:web": "pnpm --filter @grani/web dev"
```

В корневом `vitest.config.ts` в `coverage.include` добавить `"apps/web/src/server/**/*.ts"`, `"apps/web/src/lib/**/*.{ts,tsx}"`.

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm install
```

- [ ] **Step 2: Тесты (падают)**

`apps/web/src/server/env.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { readEnv } from "./env";

const VALID = {
  APP_URL: "https://grani-test.ru",
  DATABASE_URL: "postgres://u:p@db:5432/grani",
  SESSION_SECRET: "x".repeat(32),
  TELEGRAM_BOT_TOKEN: "123456:ABC-def_1",
  TELEGRAM_BOT_USERNAME: "test_grani_bot",
  VK_CLIENT_ID: "54770000",
};

describe("readEnv", () => {
  test("accepts a complete environment", () => {
    expect(readEnv(VALID)).toEqual(VALID);
  });

  test("names the invalid variables without printing their values", () => {
    const run = () => readEnv({ ...VALID, SESSION_SECRET: "short", VK_CLIENT_ID: undefined });

    expect(run).toThrow(/SESSION_SECRET/);
    expect(run).toThrow(/VK_CLIENT_ID/);
    expect(run).not.toThrow(/short/);
  });
});
```

`apps/web/src/server/http.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import {
  consentCookieOptions,
  expiredCookieOptions,
  isSameOrigin,
  pendingCookieOptions,
  sessionCookieOptions,
  vkStateCookieOptions,
} from "./http";

describe("cookie options", () => {
  test("are secure on https and not on localhost", () => {
    expect(sessionCookieOptions("https://grani-test.ru").secure).toBe(true);
    expect(sessionCookieOptions("http://localhost:3000").secure).toBe(false);
  });

  test("use the agreed lifetimes and paths", () => {
    const url = "https://grani-test.ru";

    expect(sessionCookieOptions(url)).toEqual({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 2592000 });
    expect(pendingCookieOptions(url).maxAge).toBe(86400);
    expect(consentCookieOptions(url).maxAge).toBe(3600);
    expect(vkStateCookieOptions(url)).toMatchObject({ path: "/api/auth/vk", maxAge: 600 });
  });

  test("expire a cookie immediately", () => {
    expect(expiredCookieOptions(sessionCookieOptions("https://grani-test.ru")).maxAge).toBe(0);
  });
});

describe("isSameOrigin", () => {
  const request = (origin: string | null) =>
    new Request("https://grani-test.ru/api/results", { method: "POST", headers: origin ? { origin } : {} });

  test("accepts the app origin", () => {
    expect(isSameOrigin(request("https://grani-test.ru"), "https://grani-test.ru")).toBe(true);
  });

  test("rejects a missing or foreign origin", () => {
    expect(isSameOrigin(request(null), "https://grani-test.ru")).toBe(false);
    expect(isSameOrigin(request("https://evil.example"), "https://grani-test.ru")).toBe(false);
  });
});
```

```bash
pnpm vitest run apps/web/src/server
```
Expected: FAIL — `Failed to resolve import "./env"` и `"./http"`.

- [ ] **Step 3: Реализация сервера**

`apps/web/src/server/env.ts`:
```ts
import { z } from "zod";

const envSchema = z.object({
  APP_URL: z.url(),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[\w-]+$/),
  TELEGRAM_BOT_USERNAME: z.string().min(1),
  VK_CLIENT_ID: z.string().regex(/^\d+$/),
});

export type AppEnv = z.infer<typeof envSchema>;

export function readEnv(source: Record<string, string | undefined> = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid environment variables: ${fields}`);
  }
  return parsed.data;
}

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  cached ??= readEnv();
  return cached;
}
```

`apps/web/src/server/db.ts`:
```ts
import { createDb, type Database } from "@grani/db";
import { getEnv } from "./env";

// Route handlers и страницы Next собираются в разные бандлы, а HMR перезагружает модули:
// храним пул в globalThis, чтобы на процесс было ровно одно подключение
const holder = globalThis as typeof globalThis & { __graniDb?: Database };

export function getDb(): Database {
  // Локальная PGlite-БД обслуживает одно соединение: DATABASE_POOL_MAX=1 в .env.development.local
  const maxConnections = process.env.DATABASE_POOL_MAX ? Number(process.env.DATABASE_POOL_MAX) : undefined;
  holder.__graniDb ??= createDb(getEnv().DATABASE_URL, { maxConnections });
  return holder.__graniDb;
}
```

`apps/web/src/server/http.ts`:
```ts
export const SESSION_COOKIE = "grani_session";
export const PENDING_COOKIE = "grani_pending";
export const CONSENT_COOKIE = "grani_consent";
export const VK_STATE_COOKIE = "grani_vk_oauth";

const DAY_SECONDS = 86400;
const SESSION_MAX_AGE_SECONDS = 30 * DAY_SECONDS;
const PENDING_MAX_AGE_SECONDS = DAY_SECONDS;
const CONSENT_MAX_AGE_SECONDS = 3600;
const VK_STATE_MAX_AGE_SECONDS = 600;

export type CookieOptions = { httpOnly: true; secure: boolean; sameSite: "lax"; path: string; maxAge: number };

function options(appUrl: string, maxAge: number, path = "/"): CookieOptions {
  return { httpOnly: true, secure: appUrl.startsWith("https://"), sameSite: "lax", path, maxAge };
}

export const sessionCookieOptions = (appUrl: string) => options(appUrl, SESSION_MAX_AGE_SECONDS);
export const pendingCookieOptions = (appUrl: string) => options(appUrl, PENDING_MAX_AGE_SECONDS);
export const consentCookieOptions = (appUrl: string) => options(appUrl, CONSENT_MAX_AGE_SECONDS);
export const vkStateCookieOptions = (appUrl: string) => options(appUrl, VK_STATE_MAX_AGE_SECONDS, "/api/auth/vk");

export function expiredCookieOptions(cookie: CookieOptions): CookieOptions {
  return { ...cookie, maxAge: 0 };
}

export function isSameOrigin(request: Request, appUrl: string): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(appUrl).origin;
}
```

`apps/web/src/app/api/health/route.ts`:
```ts
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("health check failed", error);
    return Response.json({ ok: false }, { status: 503 });
  }
}
```

- [ ] **Step 4: Раскладка и стили**

Стиль — `docs/design/visual-direction.md` (выбран в Task 1): кремовая «бумага», плоские тонированные панели без теней, заголовки Cormorant Garamond 300, текст Golos Text, один «чернильный» цвет `--accent`. Три палитры переключаются атрибутом `data-palette`; в этом плане все страницы в палитре по умолчанию «Оранжерея», палитры «Туман» и «Глина» заводятся сразу, чтобы план 4 их только применил.

`apps/web/src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Cormorant_Garamond, Golos_Text } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const display = Cormorant_Garamond({ subsets: ["latin", "cyrillic"], weight: ["300"], variable: "--font-cormorant" });
const body = Golos_Text({ subsets: ["latin", "cyrillic"], weight: ["400", "600"], variable: "--font-golos" });

// Абсолютные адреса для превью ссылок; при сборке образа переменных окружения ещё нет
const PUBLIC_URL = process.env.APP_URL ?? "https://grani-test.ru";

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_URL),
  title: { default: "Грани — тест личности", template: "%s — Грани" },
  description: "Узнай свой тип личности и как тебя видят другие. 10 минут, бесплатно.",
  // Индексация включается в плане 6, когда будут документы и страницы под поиск
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

`apps/web/src/app/globals.css`:
```css
/* Палитра A «Оранжерея» — тест и личный результат (по умолчанию) */
:root {
  --bg: #FFFEFC;
  --surface: #E1F4DF;
  --surface-2: #CFE7D3;
  --surface-3: #B1DBB8;
  --surface-4: #B6CED5;
  --accent: #0F3E17;
  --accent-hover: #0C2F10;
  --accent-ink: #FFFEFC;
  --ink: #222222;
  --ink-soft: #5E6660;
  --line: #EFEEEB;
  --danger: #B42318;
  --radius: 14px;
  --font-display: var(--font-cormorant), Georgia, serif;
  --font-body: var(--font-golos), system-ui, sans-serif;
}

/* Палитра B «Туман» — как меня видят другие (план 4) */
[data-palette="friends"] {
  --bg: #FCFDFE; --surface: #E3EDF2; --surface-2: #D3E2EA; --surface-3: #B9CFDB; --surface-4: #D9D6E8;
  --accent: #1D3A4F; --accent-hover: #142B3B; --accent-ink: #FCFDFE;
  --ink: #1F2328; --ink-soft: #5C6670; --line: #E8ECEF;
}

/* Палитра C «Глина» — совместимость пары (план 4) */
[data-palette="pair"] {
  --bg: #FFFCFA; --surface: #F6E8E1; --surface-2: #EED8CF; --surface-3: #E2C2B6; --surface-4: #D8D3C4;
  --accent: #4A2230; --accent-hover: #3A1A26; --accent-ink: #FFFCFA;
  --ink: #2A2224; --ink-soft: #6E6164; --line: #F0E8E4;
}

* { box-sizing: border-box; }
html, body { margin: 0; }
body { background: var(--bg); color: var(--ink); font-family: var(--font-body); font-size: 16px; line-height: 1.55; -webkit-font-smoothing: antialiased; }
[data-palette] { background: var(--bg); color: var(--ink); min-height: 100vh; }
a { color: var(--accent); text-underline-offset: 4px; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
h1, h2, h3 { font-family: var(--font-display); font-weight: 300; color: var(--accent); margin: 0; }
h2 { font-size: 40px; line-height: 1.2; letter-spacing: -0.01em; }
h3 { font-size: 30px; line-height: 1.2; }

.page { max-width: 640px; margin: 0 auto; padding: 28px 16px 96px; }
@media (min-width: 900px) { .page--wide { max-width: 1200px; padding: 42px 28px 120px; } }
/* body повышает специфичность: иначе margin: 0 у .lead, .eyebrow и других классов ниже отменял бы отступ */
body .stack > * + * { margin-top: 21px; }
.row { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; }

.eyebrow { margin: 0; font-family: var(--font-body); font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); }
.display { font-size: clamp(44px, 11vw, 74px); line-height: 1.05; letter-spacing: -0.03em; }
.lead { font-size: 18px; line-height: 1.5; color: var(--ink); margin: 0; }
.muted { color: var(--ink-soft); font-size: 14px; }
.error { color: var(--danger); font-weight: 600; }
.tag { display: inline-flex; align-items: center; width: fit-content; padding: 9px 14px; border-radius: 999px; background: var(--bg); color: var(--accent); font-size: 14px; }

/* Панели: глубина только тоном, без теней и цветных рамок */
.card { background: var(--surface); border: 0; border-radius: var(--radius); padding: 28px 21px; margin-inline: 0; min-inline-size: 0; }
@media (min-width: 760px) { .card { padding: 42px; } }
.card--2 { background: var(--surface-2); }
.card--3 { background: var(--surface-3); }
.card--4 { background: var(--surface-4); }
.card--paper { background: var(--bg); box-shadow: inset 0 0 0 1px var(--line); }

.button { display: inline-flex; align-items: center; justify-content: center; gap: 12px; min-height: 52px; padding: 14px 21px; border: 0; border-radius: var(--radius); background: var(--accent); color: var(--accent-ink); font: inherit; font-size: 15px; text-decoration: none; cursor: pointer; transition: background 200ms ease; }
.button:hover { background: var(--accent-hover); }
.button:disabled { opacity: 0.45; cursor: not-allowed; }
.button--lg { padding: 21px 28px; font-size: 16px; }
.button--ghost { background: transparent; color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.button--ghost:hover { background: var(--surface); }
.button--block { width: 100%; }

.progress { display: grid; gap: 9px; font-size: 14px; }
.progress__bar { height: 6px; border-radius: 999px; background: var(--surface); overflow: hidden; }
.progress__bar > span { display: block; height: 100%; border-radius: 999px; background: var(--accent); transition: width 200ms ease; }

/* legend во fieldset: float убирает его из рамки fieldset, clear у .choices возвращает поток */
.question { float: left; width: 100%; font-family: var(--font-display); font-weight: 300; font-size: clamp(30px, 7vw, 44px); line-height: 1.15; letter-spacing: -0.02em; color: var(--accent); padding: 0; margin: 0 0 21px; }
.choices { clear: both; display: grid; gap: 9px; margin: 0; padding: 0; border: 0; }
.choice { display: flex; align-items: center; gap: 14px; min-height: 52px; padding: 14px 18px; border-radius: var(--radius); background: var(--bg); color: var(--ink); font-size: 15px; cursor: pointer; transition: background 200ms ease, color 200ms ease; }
.choice input { appearance: none; flex: none; display: grid; place-items: center; width: 20px; height: 20px; margin: 0; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--accent); }
.choice input::after { content: ""; width: 10px; height: 10px; border-radius: 50%; background: var(--accent-ink); transform: scale(0); transition: transform 200ms ease; }
.choice:has(input:checked) { background: var(--accent); color: var(--accent-ink); }
.choice input:checked { box-shadow: inset 0 0 0 1.5px var(--accent-ink); }
.choice input:checked::after { transform: scale(1); }
.choice input[type="checkbox"], .choice input[type="checkbox"]::after { border-radius: 5px; }
.choice:has(input:focus-visible) { outline: 2px solid var(--accent); outline-offset: 3px; }

.scale { display: grid; gap: 9px; padding-bottom: 21px; border-bottom: 1px solid var(--line); }
.scale:last-child { border-bottom: 0; padding-bottom: 0; }
.scale__head { display: flex; justify-content: space-between; align-items: baseline; gap: 9px; }
.scale__head > :last-child { font-family: var(--font-display); font-size: 34px; line-height: 1; color: var(--accent); }
.scale__track { position: relative; height: 8px; border-radius: 999px; background: var(--surface); }
.scale__fill { position: absolute; inset: 0 auto 0 0; border-radius: 999px; background: var(--accent); }
.scale__mark { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); }

.footer { margin-top: 84px; padding-top: 21px; border-top: 1px solid var(--line); font-size: 14px; color: var(--ink-soft); }
.footer a { margin-right: 21px; color: var(--ink-soft); }

@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
```

Тёмная тема в первую версию не входит: палитры светлые по решению Task 1.

- [ ] **Step 5: CI**

`.github/workflows/ci.yml`:
```yaml
name: ci
on:
  push:
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test:coverage
```

- [ ] **Step 6: Запуск — тесты проходят, dev-сервер поднимается**

```bash
pnpm test && pnpm typecheck
cp apps/web/.env.development.example apps/web/.env.development.local
```
Expected: тесты зелёные, typecheck без ошибок.

Проверить в двух терминалах: `pnpm dev:db` (Expected: `dev db ready: postgres://…:5433/postgres`) и `pnpm dev:web`, затем `curl http://localhost:3000/api/health` → `{"ok":true}`. Остановить оба процесса.

- [ ] **Step 7: Коммит**

```bash
git add package.json vitest.config.ts pnpm-lock.yaml .github apps/web
git commit -m "feat(web): Next.js app scaffold, env, database, styles and CI"
```
