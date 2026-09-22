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
