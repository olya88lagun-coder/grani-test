import { createHash, createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import { verifyTelegramLoginWidget } from "./telegram";

const BOT_TOKEN = "123456:TEST-TOKEN";
const NOW = new Date("2026-09-17T12:00:00Z");
const nowSec = Math.floor(NOW.getTime() / 1000);

function signWidget(fields: Record<string, string>, token = BOT_TOKEN): URLSearchParams {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");
  const secret = createHash("sha256").update(token).digest();
  const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...fields, hash });
}

describe("verifyTelegramLoginWidget", () => {
  test("accepts correctly signed fresh widget params", () => {
    const params = signWidget({ id: "42", first_name: "Аня", last_name: "Петрова", username: "anya", auth_date: String(nowSec) });

    expect(verifyTelegramLoginWidget(params, BOT_TOKEN, NOW)).toEqual({
      ok: true,
      user: { id: 42, firstName: "Аня", lastName: "Петрова", username: "anya" },
    });
  });

  test("rejects tampered params", () => {
    const params = signWidget({ id: "42", first_name: "Аня", auth_date: String(nowSec) });
    params.set("id", "43");

    expect(verifyTelegramLoginWidget(params, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "BAD_HASH" });
  });

  test("rejects params signed for another bot", () => {
    const params = signWidget({ id: "42", first_name: "Аня", auth_date: String(nowSec) }, "999:OTHER");

    expect(verifyTelegramLoginWidget(params, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "BAD_HASH" });
  });

  test("rejects stale params", () => {
    const params = signWidget({ id: "42", first_name: "Аня", auth_date: String(nowSec - 86401) });

    expect(verifyTelegramLoginWidget(params, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "EXPIRED" });
  });

  test("rejects a missing hash and a missing first name", () => {
    expect(verifyTelegramLoginWidget(new URLSearchParams({ id: "42" }), BOT_TOKEN, NOW)).toEqual({
      ok: false,
      reason: "MISSING_HASH",
    });
    const noName = signWidget({ id: "42", auth_date: String(nowSec) });
    expect(verifyTelegramLoginWidget(noName, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "MALFORMED" });
  });
});
