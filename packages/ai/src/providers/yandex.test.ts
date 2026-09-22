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
