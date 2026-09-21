import { defineConfig, devices } from "@playwright/test";

// Только локальное приложение: dev-вход работает лишь с DEV_LOGIN=1 и не в production.
// Браузер — установленный Chrome: CDN со сборками Playwright с машины разработчика недоступен.
export default defineConfig({
  testDir: ".",
  outputDir: "test-results",
  timeout: 90_000,
  retries: 0,
  // next dev компилирует страницу при первом заходе — переход на новую страницу бывает дольше 5 секунд по умолчанию
  expect: { timeout: 15_000 },
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", locale: "ru-RU", trace: "retain-on-failure" },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"], channel: process.env.PW_CHANNEL ?? "chrome" } }],
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
});
