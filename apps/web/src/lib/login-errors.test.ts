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
