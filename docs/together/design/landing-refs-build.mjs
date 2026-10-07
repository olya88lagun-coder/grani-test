// Снимки главной страницы (эталон оформления) и текущей /together (что переделывать) на 1440 и 390 пикселей.
// Запуск при работающем сайте: node docs/together/design/landing-refs-build.mjs [адрес сайта]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const base = process.argv[2] ?? "http://localhost:3000";
const out = fileURLToPath(new URL("./landing-refs/", import.meta.url));
mkdirSync(out, { recursive: true });

const pages = [
  { name: "home", path: "/" },
  { name: "together-now", path: "/together" },
];
const sizes = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "chrome" });
for (const size of sizes) {
  const context = await browser.newContext({ viewport: size, locale: "ru-RU", deviceScaleFactor: 1, storageState: { cookies: [], origins: [{ origin: base, localStorage: [{ name: "grani-cookie-consent", value: "necessary" }] }] } });
  const page = await context.newPage();
  for (const { name, path } of pages) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${out}${name}-${size.width}.jpg`, type: "jpeg", quality: 72, fullPage: true });
  }
  await context.close();
}
await browser.close();
console.log("ok", out);
