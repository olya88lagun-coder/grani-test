# Task 4: Инструкция модели, проверка ответа, попытки с таймаутом, провайдеры YandexGPT и GigaChat

**Files:**
- Create: `packages/ai/src/prompt.ts`, `prompt.test.ts`, `packages/ai/src/validate.ts`, `validate.test.ts`, `packages/ai/src/generate.ts`, `generate.test.ts`
- Create: `packages/ai/src/providers/yandex.ts`, `yandex.test.ts`, `packages/ai/src/providers/gigachat.ts`, `gigachat.test.ts`
- Modify: `packages/ai/src/index.ts`

**Interfaces:**
- Consumes: `ReportInput`, `fallbackSections`, `parseSections`, `sectionStrings`, `ReportSections` (Task 3); `findStopWords` (`@grani/content`).
- Produces:
  ```ts
  // prompt.ts
  type Prompt = { system: string; user: string };
  function buildPrompt(input: ReportInput): Prompt;

  // validate.ts
  type ValidationFailure = "not_json" | "schema" | "stop_words";
  function extractJson(raw: string): unknown;               // undefined, если JSON не найден
  function validateModelOutput<K extends ReportKind>(kind: K, raw: string): { ok: true; sections: ReportSections[K] } | { ok: false; reason: ValidationFailure };

  // generate.ts
  type ReportWriter = { readonly name: string; complete(prompt: Prompt, signal: AbortSignal): Promise<string> };
  type GenerateLog = (message: string, extra: Record<string, unknown>) => void;
  type GeneratedReport = { sections: ReportSections[ReportKind]; source: "ai" | "fallback"; attempts: number };
  const GENERATION_TIMEOUT_MS = 60_000;
  const GENERATION_ATTEMPTS = 3;
  function generateReport(writer: ReportWriter | null, input: ReportInput, options?: { timeoutMs?: number; attempts?: number; log?: GenerateLog }): Promise<GeneratedReport>;

  // providers
  const YANDEX_COMPLETION_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";
  function createYandexWriter(p: { apiKey: string; folderId: string; fetchFn: typeof fetch; model?: string }): ReportWriter;
  const GIGACHAT_OAUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
  const GIGACHAT_CHAT_URL = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions";
  function createGigaChatWriter(p: { authKey: string; scope: string; fetchFn: typeof fetch; now?: () => number; requestId?: () => string; model?: string }): ReportWriter;
  ```

Раздел 4.4 спецификации: одна попытка — один запрос к модели с таймаутом 60 с; ошибка, таймаут или непрошедшая проверка — ещё до двух попыток; затем разбор из блоков. В лог попадают только вид разбора, номер попытки и причина — без текста ответа и без входа (в нём нет имён, но есть баллы).

Модели отвечают JSON-ом по-разному: YandexGPT с `jsonObject: true` отдаёт чистый объект, GigaChat иногда оборачивает его в Markdown-блок. `extractJson` снимает обёртку и берёт текст от первой `{` до последней `}`.

Провайдеры — тонкие обёртки над `fetch` (запросы — по документации Yandex AI Studio и GigaChat API):
- **YandexGPT:** `POST YANDEX_COMPLETION_URL`, заголовки `Authorization: Api-Key <ключ>` и `x-folder-id`, тело `{ modelUri: "gpt://<каталог>/yandexgpt/latest", completionOptions: { stream: false, temperature: 0.3, maxTokens: "6000" }, messages: [{ role: "system", text }, { role: "user", text }], jsonObject: true }`; ответ — `result.alternatives[0].message.text`.
- **GigaChat:** токен — `POST GIGACHAT_OAUTH_URL` с `Authorization: Basic <ключ авторизации>`, `RqUID: <uuid>`, телом `scope=<scope>`; ответ `{ access_token, expires_at }` (миллисекунды). Токен живёт 30 минут и переиспользуется, обновляется за минуту до истечения и после ответа 401. Запрос — `POST GIGACHAT_CHAT_URL` с `Authorization: Bearer <токен>`, тело `{ model: "GigaChat", messages: [{ role: "system", content }, { role: "user", content }], temperature: 0.3, max_tokens: 6000 }`; ответ — `choices[0].message.content`. Сертификат Минцифры для TLS подключается переменной `NODE_EXTRA_CA_CERTS` на сервере (план 6); проверку сертификатов не отключать.

- [ ] **Step 1: Тесты инструкции и проверки (падают)**

`packages/ai/src/prompt.test.ts`:
```ts
import { getLibrary } from "@grani/content/data";
import { expect, test } from "vitest";
import { buildPairInput, buildPersonalInput } from "./input";
import { buildPrompt } from "./prompt";

const RESULT = { scores: { openness: 80, conscientiousness: 40, extraversion: 70, agreeableness: 65, stability: 50 }, typeCode: "+-++", stability: "calm" } as const;

test("the personal instruction speaks to «ты», forbids new facts and describes the JSON shape", () => {
  const prompt = buildPrompt(buildPersonalInput(getLibrary(), "full", RESULT));

  expect(prompt.system).toContain("на «ты»");
  expect(prompt.system).toContain("не добавляй фактов");
  expect(prompt.system).toContain('"blind_spots"');
  expect(JSON.parse(prompt.user).facts.typeName).toBe("Искра");
});

test("the pair instruction speaks to «вы» and lists the five sections", () => {
  const prompt = buildPrompt(buildPairInput(getLibrary(), RESULT.scores, RESULT.scores));

  expect(prompt.system).toContain("на «вы»");
  for (const key of ["similar", "differences", "conflicts", "home_money", "support"]) expect(prompt.system).toContain(`"${key}"`);
});
```

`packages/ai/src/validate.test.ts`:
```ts
import { getLibrary } from "@grani/content/data";
import { describe, expect, test } from "vitest";
import { fallbackSections } from "./fallback";
import { buildPersonalInput } from "./input";
import { extractJson, validateModelOutput } from "./validate";

const RESULT = { scores: { openness: 80, conscientiousness: 40, extraversion: 70, agreeableness: 65, stability: 50 }, typeCode: "+-++", stability: "calm" } as const;
const VALID = fallbackSections(buildPersonalInput(getLibrary(), "full", RESULT)) as { portrait: string };

describe("extractJson", () => {
  test("reads plain JSON and JSON wrapped in a markdown block", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('Вот ответ:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson("нет json")).toBeUndefined();
    expect(extractJson("{битый")).toBeUndefined();
  });
});

describe("validateModelOutput", () => {
  test("accepts sections that match the schema", () => {
    expect(validateModelOutput("full", JSON.stringify(VALID))).toEqual({ ok: true, sections: VALID });
  });

  test("names the reason of a rejection", () => {
    expect(validateModelOutput("full", "не json")).toEqual({ ok: false, reason: "not_json" });
    expect(validateModelOutput("full", JSON.stringify({ portrait: "коротко" }))).toEqual({ ok: false, reason: "schema" });
    expect(validateModelOutput("full", JSON.stringify({ ...VALID, portrait: `${VALID.portrait} Возможно, это депрессия.` }))).toEqual({ ok: false, reason: "stop_words" });
  });
});
```

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run packages/ai/src/prompt.test.ts packages/ai/src/validate.test.ts
```
Expected: FAIL — модулей нет.

- [ ] **Step 2: Инструкция и проверка**

`packages/ai/src/prompt.ts`:
```ts
import type { ReportKind } from "@grani/core";
import type { ReportInput } from "./input";

export type Prompt = { system: string; user: string };

const COMMON_RULES = [
  "Ты — редактор сервиса самопознания «Грани». Тебе дают баллы по пяти чертам Big Five (0–100) и готовые блоки текста.",
  "Задача: связать блоки в цельный, тёплый и конкретный текст. Опирайся только на данные и блоки: не добавляй фактов, которых там нет, не придумывай истории и цифры.",
  "Нельзя упоминать диагнозы и расстройства, болезни, лекарства и лечение, самоповреждение и внешность. Это не психологическая и не медицинская диагностика.",
  "Не используй родовые окончания в обращении к читателю: вместо «ты рад» пиши «тебе радостно», вместо «ты устал» — «накапливается усталость».",
  "Ответ — только JSON-объект без пояснений и без Markdown, строго с ключами из схемы ниже.",
];

const PERSONAL = "Пиши по-русски, на «ты», обращаясь к одному человеку.";
const PAIR = "Пиши по-русски, на «вы», обращаясь к паре. Не называй, кто из двоих какой: говори о сочетании черт.";

const SHAPES: Readonly<Record<ReportKind, string>> = {
  full: [
    '{"portrait": "связный текст о сочетании черт, 600–1800 знаков",',
    ' "strengths": ["4–5 сильных сторон, по 1–2 предложения"],',
    ' "blind_spots": [{"text": "3–4 слепые зоны, 1–2 предложения", "tip": "что с этим делать, 1 предложение"}],',
    ' "manual": {"work": ["3–4 пункта «как со мной работать»"], "fight": ["3–4 пункта «как со мной ссориться»"], "annoys": ["3–4 пункта «что меня бесит»"]}}',
    "Пункты «manual» пиши от первого лица читателя, как инструкцию для других: «Давай мне время подумать».",
  ].join("\n"),
  friends: '{"text": "600–1500 знаков: как друзья видят человека по сравнению с его самооценкой, где взгляды совпадают и где расходятся, с бережной интерпретацией"}',
  chapter_money: '{"text": "глава «Деньги», 800–2500 знаков", "tips": ["3–5 конкретных советов"]}',
  chapter_conflict: '{"text": "глава «Конфликты», 800–2500 знаков", "tips": ["3–5 конкретных советов"]}',
  chapter_stress: '{"text": "глава «Стресс», 800–2500 знаков", "tips": ["3–5 конкретных советов"]}',
  chapter_relationships: '{"text": "глава «Отношения», 800–2500 знаков", "tips": ["3–5 конкретных советов"]}',
  pair: [
    '{"similar": "в чём вы похожи, 500–1500 знаков",',
    ' "differences": "где вы разные и как это использовать, 500–1500 знаков",',
    ' "conflicts": "откуда будут конфликты и как договариваться, 500–1500 знаков",',
    ' "home_money": "быт и деньги, 500–1500 знаков",',
    ' "support": "как поддерживать друг друга, 500–1500 знаков"}',
  ].join("\n"),
};

export function buildPrompt(input: ReportInput): Prompt {
  const voice = input.kind === "pair" ? PAIR : PERSONAL;
  return {
    system: [...COMMON_RULES, voice, `Схема ответа:\n${SHAPES[input.kind]}`].join("\n\n"),
    // Во входе только баллы, уровни, название типа и блоки — имён и идентификаторов в нём нет
    user: JSON.stringify(input),
  };
}
```

`packages/ai/src/validate.ts`:
```ts
import type { ReportKind } from "@grani/core";
import { findStopWords } from "@grani/content";
import { parseSections, sectionStrings, type ReportSections } from "./sections";

export type ValidationFailure = "not_json" | "schema" | "stop_words";

export function extractJson(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return undefined;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

export function validateModelOutput<K extends ReportKind>(
  kind: K,
  raw: string,
): { ok: true; sections: ReportSections[K] } | { ok: false; reason: ValidationFailure } {
  const value = extractJson(raw);
  if (value === undefined) return { ok: false, reason: "not_json" };
  const sections = parseSections(kind, value);
  if (!sections) return { ok: false, reason: "schema" };
  if (sectionStrings(sections).some((text) => findStopWords(text).length > 0)) return { ok: false, reason: "stop_words" };
  return { ok: true, sections };
}
```

```bash
pnpm vitest run packages/ai/src/prompt.test.ts packages/ai/src/validate.test.ts
```
Expected: PASS.

- [ ] **Step 3: Тесты генерации (падают)**

`packages/ai/src/generate.test.ts`:
```ts
import { getLibrary } from "@grani/content/data";
import { describe, expect, test, vi } from "vitest";
import { fallbackSections } from "./fallback";
import { generateReport, type ReportWriter } from "./generate";
import { buildPersonalInput } from "./input";

const RESULT = { scores: { openness: 80, conscientiousness: 40, extraversion: 70, agreeableness: 65, stability: 50 }, typeCode: "+-++", stability: "calm" } as const;
const INPUT = buildPersonalInput(getLibrary(), "full", RESULT);
const GOOD = JSON.stringify(fallbackSections(INPUT));

function writer(...answers: (string | Error | "hang")[]): ReportWriter & { complete: ReturnType<typeof vi.fn> } {
  const complete = vi.fn();
  for (const answer of answers) {
    if (answer === "hang") complete.mockImplementationOnce(() => new Promise(() => {}));
    else if (answer instanceof Error) complete.mockRejectedValueOnce(answer);
    else complete.mockResolvedValueOnce(answer);
  }
  return { name: "stub", complete };
}

describe("generateReport", () => {
  test("uses the first valid answer of the model", async () => {
    const stub = writer(GOOD);

    const report = await generateReport(stub, INPUT);

    expect(report).toMatchObject({ source: "ai", attempts: 1 });
    expect(stub.complete.mock.calls[0]![0].system).toContain("на «ты»");
  });

  test("retries after a broken answer, an error and a timeout, then succeeds", async () => {
    const log = vi.fn();
    const stub = writer("не json", "hang", GOOD);

    const report = await generateReport(stub, INPUT, { timeoutMs: 20, log });

    expect(report).toMatchObject({ source: "ai", attempts: 3 });
    expect(log.mock.calls.map((call) => call[1].reason)).toEqual(["not_json", "timeout"]);
  });

  test("falls back to the library after three failed attempts", async () => {
    const stub = writer(new Error("503"), "{}", JSON.stringify({ portrait: "депрессия" }));

    const report = await generateReport(stub, INPUT);

    expect(report).toEqual({ sections: fallbackSections(INPUT), source: "fallback", attempts: 3 });
  });

  test("without a writer the report is built from the library right away", async () => {
    expect(await generateReport(null, INPUT)).toEqual({ sections: fallbackSections(INPUT), source: "fallback", attempts: 0 });
  });
});
```

```bash
pnpm vitest run packages/ai/src/generate.test.ts
```
Expected: FAIL — нет `./generate`.

- [ ] **Step 4: Генерация**

`packages/ai/src/generate.ts`:
```ts
import type { ReportKind } from "@grani/core";
import { fallbackSections } from "./fallback";
import type { ReportInput } from "./input";
import { buildPrompt, type Prompt } from "./prompt";
import type { ReportSections } from "./sections";
import { validateModelOutput } from "./validate";

export type ReportWriter = { readonly name: string; complete(prompt: Prompt, signal: AbortSignal): Promise<string> };
export type GenerateLog = (message: string, extra: Record<string, unknown>) => void;
export type GeneratedReport = { sections: ReportSections[ReportKind]; source: "ai" | "fallback"; attempts: number };

export const GENERATION_TIMEOUT_MS = 60_000;
export const GENERATION_ATTEMPTS = 3;

class TimeoutError extends Error {}

// Сигнал отменяет запрос у провайдера; гонка с таймером страхует, если провайдер сигнал не слушает
async function completeWithTimeout(writer: ReportWriter, prompt: Prompt, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError());
    }, timeoutMs);
  });
  try {
    return await Promise.race([writer.complete(prompt, controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function generateReport(
  writer: ReportWriter | null,
  input: ReportInput,
  options: { timeoutMs?: number; attempts?: number; log?: GenerateLog } = {},
): Promise<GeneratedReport> {
  if (!writer) return { sections: fallbackSections(input), source: "fallback", attempts: 0 };
  const attempts = options.attempts ?? GENERATION_ATTEMPTS;
  const prompt = buildPrompt(input);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let reason: string;
    try {
      const raw = await completeWithTimeout(writer, prompt, options.timeoutMs ?? GENERATION_TIMEOUT_MS);
      const checked = validateModelOutput(input.kind, raw);
      if (checked.ok) return { sections: checked.sections, source: "ai", attempts: attempt };
      reason = checked.reason;
    } catch (error) {
      reason = error instanceof TimeoutError ? "timeout" : `error: ${String(error)}`;
    }
    // Текст ответа в лог не пишется: в нём может оказаться то, что проверка как раз не пропустила
    options.log?.("report attempt rejected", { kind: input.kind, writer: writer.name, attempt, reason });
  }
  return { sections: fallbackSections(input), source: "fallback", attempts };
}
```

```bash
pnpm vitest run packages/ai/src/generate.test.ts
```
Expected: PASS.

- [ ] **Step 5: Тесты провайдеров (падают)**

`packages/ai/src/providers/yandex.test.ts`:
```ts
import { describe, expect, test, vi } from "vitest";
import { createYandexWriter, YANDEX_COMPLETION_URL } from "./yandex";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const PROMPT = { system: "инструкция", user: '{"kind":"full"}' };

describe("createYandexWriter", () => {
  test("asks the folder's model for a JSON object", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ result: { alternatives: [{ message: { role: "assistant", text: '{"ok":1}' }, status: "ALTERNATIVE_STATUS_FINAL" }] } }));
    const writer = createYandexWriter({ apiKey: "key", folderId: "b1g", fetchFn });

    expect(await writer.complete(PROMPT, new AbortController().signal)).toBe('{"ok":1}');
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe(YANDEX_COMPLETION_URL);
    expect(init.headers).toMatchObject({ authorization: "Api-Key key", "x-folder-id": "b1g" });
    expect(JSON.parse(init.body as string)).toEqual({
      modelUri: "gpt://b1g/yandexgpt/latest",
      completionOptions: { stream: false, temperature: 0.3, maxTokens: "6000" },
      messages: [
        { role: "system", text: "инструкция" },
        { role: "user", text: '{"kind":"full"}' },
      ],
      jsonObject: true,
    });
  });

  test("throws on an error status or an unexpected body", async () => {
    const failing = createYandexWriter({ apiKey: "k", folderId: "f", fetchFn: vi.fn().mockResolvedValue(json({}, 429)) });
    const empty = createYandexWriter({ apiKey: "k", folderId: "f", fetchFn: vi.fn().mockResolvedValue(json({ result: {} })) });

    await expect(failing.complete(PROMPT, new AbortController().signal)).rejects.toThrow(/429/);
    await expect(empty.complete(PROMPT, new AbortController().signal)).rejects.toThrow(/no text/);
  });
});
```

`packages/ai/src/providers/gigachat.test.ts`:
```ts
import { describe, expect, test, vi } from "vitest";
import { createGigaChatWriter, GIGACHAT_CHAT_URL, GIGACHAT_OAUTH_URL } from "./gigachat";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const PROMPT = { system: "инструкция", user: "{}" };
const signal = () => new AbortController().signal;
const HOUR = 3_600_000;

// Токен живёт 30 минут от момента выдачи по часам теста
function stubFetch(clock: () => number) {
  return vi.fn(async (input: string | URL | Request) => {
    if (String(input) === GIGACHAT_OAUTH_URL) return json({ access_token: `token-${clock()}`, expires_at: clock() + 30 * 60_000 });
    return json({ choices: [{ message: { role: "assistant", content: '{"ok":1}' } }] });
  });
}

describe("createGigaChatWriter", () => {
  test("gets a token once and sends the chat request with it", async () => {
    const fetchFn = stubFetch(() => 1_000);
    const writer = createGigaChatWriter({ authKey: "base64key", scope: "GIGACHAT_API_PERS", fetchFn, now: () => 1_000, requestId: () => "rq-1" });

    expect(await writer.complete(PROMPT, signal())).toBe('{"ok":1}');
    await writer.complete(PROMPT, signal());

    const urls = fetchFn.mock.calls.map((call) => call[0]);
    expect(urls).toEqual([GIGACHAT_OAUTH_URL, GIGACHAT_CHAT_URL, GIGACHAT_CHAT_URL]);
    const [, oauth] = fetchFn.mock.calls[0]! as unknown as [string, RequestInit];
    expect(oauth.headers).toMatchObject({ authorization: "Basic base64key", rquid: "rq-1" });
    expect(oauth.body).toBe("scope=GIGACHAT_API_PERS");
    const [, chat] = fetchFn.mock.calls[1]! as unknown as [string, RequestInit];
    expect(chat.headers).toMatchObject({ authorization: "Bearer token-1000" });
    expect(JSON.parse(chat.body as string)).toEqual({
      model: "GigaChat",
      messages: [
        { role: "system", content: "инструкция" },
        { role: "user", content: "{}" },
      ],
      temperature: 0.3,
      max_tokens: 6000,
    });
  });

  test("refreshes an expiring token and forgets it after 401", async () => {
    let now = 1_000;
    const fetchFn = stubFetch(() => now);
    const writer = createGigaChatWriter({ authKey: "k", scope: "s", fetchFn, now: () => now });
    await writer.complete(PROMPT, signal());

    now += HOUR;
    await writer.complete(PROMPT, signal());
    fetchFn.mockImplementationOnce(async () => json({ message: "Unauthorized" }, 401));
    await expect(writer.complete(PROMPT, signal())).rejects.toThrow(/401/);
    await writer.complete(PROMPT, signal());

    expect(fetchFn.mock.calls.filter((call) => call[0] === GIGACHAT_OAUTH_URL)).toHaveLength(3);
  });

  test("throws when the answer has no content", async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request) => (String(input) === GIGACHAT_OAUTH_URL ? json({ access_token: "t", expires_at: 10 ** 13 }) : json({ choices: [] })));
    const writer = createGigaChatWriter({ authKey: "k", scope: "s", fetchFn, now: () => 0 });

    await expect(writer.complete(PROMPT, signal())).rejects.toThrow(/no content/);
  });
});
```

Во втором тесте первый вызов после 401 — это запрос чата со старым токеном (ответ 401), поэтому `mockImplementationOnce` подменяет именно его: к этому моменту токен ещё действителен.

```bash
pnpm vitest run packages/ai/src/providers
```
Expected: FAIL — модулей нет.

- [ ] **Step 6: Провайдеры**

`packages/ai/src/providers/yandex.ts`:
```ts
import type { ReportWriter } from "../generate";

export const YANDEX_COMPLETION_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";
const DEFAULT_MODEL = "yandexgpt/latest";

type CompletionBody = { result?: { alternatives?: { message?: { text?: unknown } }[] } };

export function createYandexWriter(p: { apiKey: string; folderId: string; fetchFn: typeof fetch; model?: string }): ReportWriter {
  return {
    name: "yandexgpt",
    async complete(prompt, signal) {
      const response = await p.fetchFn(YANDEX_COMPLETION_URL, {
        method: "POST",
        signal,
        headers: { authorization: `Api-Key ${p.apiKey}`, "x-folder-id": p.folderId, "content-type": "application/json" },
        body: JSON.stringify({
          modelUri: `gpt://${p.folderId}/${p.model ?? DEFAULT_MODEL}`,
          completionOptions: { stream: false, temperature: 0.3, maxTokens: "6000" },
          messages: [
            { role: "system", text: prompt.system },
            { role: "user", text: prompt.user },
          ],
          jsonObject: true,
        }),
      });
      if (!response.ok) throw new Error(`YandexGPT responded ${response.status}`);
      const body = (await response.json()) as CompletionBody;
      const text = body.result?.alternatives?.[0]?.message?.text;
      if (typeof text !== "string") throw new Error("YandexGPT answer has no text");
      return text;
    },
  };
}
```

`packages/ai/src/providers/gigachat.ts`:
```ts
import { randomUUID } from "node:crypto";
import type { ReportWriter } from "../generate";

export const GIGACHAT_OAUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
export const GIGACHAT_CHAT_URL = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions";
const DEFAULT_MODEL = "GigaChat";
const REFRESH_MARGIN_MS = 60_000;
const UNAUTHORIZED = 401;

type Token = { value: string; expiresAt: number };
type ChatBody = { choices?: { message?: { content?: unknown } }[] };

export function createGigaChatWriter(p: {
  authKey: string;
  scope: string;
  fetchFn: typeof fetch;
  now?: () => number;
  requestId?: () => string;
  model?: string;
}): ReportWriter {
  const now = p.now ?? Date.now;
  let token: Token | null = null;

  async function accessToken(signal: AbortSignal): Promise<string> {
    if (token && now() < token.expiresAt - REFRESH_MARGIN_MS) return token.value;
    const response = await p.fetchFn(GIGACHAT_OAUTH_URL, {
      method: "POST",
      signal,
      headers: {
        authorization: `Basic ${p.authKey}`,
        rquid: (p.requestId ?? randomUUID)(),
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: `scope=${encodeURIComponent(p.scope)}`,
    });
    if (!response.ok) throw new Error(`GigaChat OAuth responded ${response.status}`);
    const body = (await response.json()) as { access_token?: unknown; expires_at?: unknown };
    if (typeof body.access_token !== "string" || typeof body.expires_at !== "number") throw new Error("GigaChat OAuth answer has no token");
    token = { value: body.access_token, expiresAt: body.expires_at };
    return token.value;
  }

  return {
    name: "gigachat",
    async complete(prompt, signal) {
      const response = await p.fetchFn(GIGACHAT_CHAT_URL, {
        method: "POST",
        signal,
        headers: { authorization: `Bearer ${await accessToken(signal)}`, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          model: p.model ?? DEFAULT_MODEL,
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
          temperature: 0.3,
          max_tokens: 6000,
        }),
      });
      // Отозванный или просроченный токен: следующая попытка получит новый
      if (response.status === UNAUTHORIZED) token = null;
      if (!response.ok) throw new Error(`GigaChat responded ${response.status}`);
      const body = (await response.json()) as ChatBody;
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("GigaChat answer has no content");
      return content;
    },
  };
}
```

В `packages/ai/src/index.ts` дописать:
```ts
export * from "./prompt";
export * from "./validate";
export * from "./generate";
export * from "./providers/yandex";
export * from "./providers/gigachat";
```

- [ ] **Step 7: Запуск и коммит**

```bash
pnpm vitest run packages/ai && pnpm typecheck
```
Expected: PASS.

```bash
git add packages/ai
git commit -m "feat(ai): model instruction, answer validation, retries with timeout, YandexGPT and GigaChat writers"
```
