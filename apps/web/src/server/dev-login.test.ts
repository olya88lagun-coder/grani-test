import { expect, test } from "vitest";
import { isDevLoginEnabled } from "./dev-login";

test("dev login works only with DEV_LOGIN=1 outside production", () => {
  expect(isDevLoginEnabled({ NODE_ENV: "development", DEV_LOGIN: "1" })).toBe(true);
  expect(isDevLoginEnabled({ NODE_ENV: "production", DEV_LOGIN: "1" })).toBe(false);
  expect(isDevLoginEnabled({ NODE_ENV: "development" })).toBe(false);
});
