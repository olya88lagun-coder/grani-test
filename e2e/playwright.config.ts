import { defineConfig, devices } from "@playwright/test";

// Только локальное приложение: dev-вход работает лишь с DEV_LOGIN=1 и не в production.
// Браузер — установленный Chrome: CDN со сборками Playwright с машины разработчика недоступен.
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: ".",
  outputDir: "test-results",
  timeout: 90_000,
  retries: 0,
  // next dev компилирует страницу при первом заходе — переход на новую страницу бывает дольше 5 секунд по умолчанию
  expect: { timeout: 20_000 },
  // Локальная PGlite выполняет запросы по очереди: на четырёх параллельных сценариях отправка формы упиралась в таймаут
  workers: 2,
  use: {
    baseURL: BASE_URL,
    locale: "ru-RU",
    trace: "retain-on-failure",
    // Cookie-баннер закрывает низ экрана — в сценариях выбор уже сделан; сценарий баннера сбрасывает его сам
    storageState: { cookies: [], origins: [{ origin: BASE_URL, localStorage: [{ name: "grani-cookie-consent", value: "necessary" }] }] },
  },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"], channel: process.env.PW_CHANNEL ?? "chrome" } }],
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
});
