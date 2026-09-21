import { describe, expect, test, vi } from "vitest";
import { createVkSender, VK_API_VERSION } from "./vk";

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

describe("createVkSender", () => {
  test("posts messages.send with the community token", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ response: 123 }));
    const send = createVkSender({ token: "vk-token", fetchFn, randomId: () => 777 });

    expect(await send("555", "Привет")).toBe("sent");
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://api.vk.ru/method/messages.send");
    expect(Object.fromEntries(new URLSearchParams(init.body as string))).toEqual({
      user_id: "555",
      random_id: "777",
      message: "Привет",
      access_token: "vk-token",
      v: VK_API_VERSION,
    });
  });

  test.each([
    [901, "rejected"],
    [902, "rejected"],
    [7, "rejected"],
    [6, "failed"],
    [10, "failed"],
  ] as const)("maps VK error %s to %s", async (code, outcome) => {
    const fetchFn = vi.fn().mockResolvedValue(json({ error: { error_code: code, error_msg: "x" } }));

    expect(await createVkSender({ token: "t", fetchFn })("1", "x")).toBe(outcome);
  });

  test("treats a network failure as temporary", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("ECONNRESET"));

    expect(await createVkSender({ token: "t", fetchFn })("1", "x")).toBe("failed");
  });
});
