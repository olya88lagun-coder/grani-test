import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".", testMatch: "money-practice.spec.ts", outputDir: "test-results/money", workers: 1, timeout: 90_000,
  expect: { timeout: 20_000 }, reporter: [["list"]],
  use: { baseURL: process.env.MONEY_QA_BASE_URL ?? "http://127.0.0.1:4351", locale: "ru-RU", viewport: { width: 1440, height: 1000 }, channel: "chrome", trace: "retain-on-failure",
    storageState: { cookies: [], origins: [{ origin: process.env.MONEY_QA_BASE_URL ?? "http://127.0.0.1:4351", localStorage: [{ name: "grani-cookie-consent", value: "necessary" }] }] },
  },
});
