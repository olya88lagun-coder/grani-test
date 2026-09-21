import { GrammyError, HttpError } from "grammy";
import { expect, test, vi } from "vitest";
import { createTelegramSender, telegramOutcome } from "./telegram";

const apiError = (code: number, description: string) =>
  new GrammyError(`Call failed (${code}: ${description})`, { ok: false, error_code: code, description }, "sendMessage", {});

test("permanent refusals are not retried, temporary errors are", () => {
  expect(telegramOutcome(apiError(403, "Forbidden: bot was blocked by the user"))).toBe("rejected");
  expect(telegramOutcome(apiError(400, "Bad Request: chat not found"))).toBe("rejected");
  expect(telegramOutcome(apiError(429, "Too Many Requests"))).toBe("failed");
  expect(telegramOutcome(new HttpError("Network request failed", new Error("ECONNRESET")))).toBe("failed");
});

test("sends plain text without link previews", async () => {
  const api = { sendMessage: vi.fn().mockResolvedValue({}) };

  expect(await createTelegramSender(api)("42", "Привет")).toBe("sent");
  expect(api.sendMessage).toHaveBeenCalledWith("42", "Привет", { link_preview_options: { is_disabled: true } });
});
