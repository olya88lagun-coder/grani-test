import type { NextRequest } from "next/server";
import { inAppBrowser } from "@/lib/in-app-browser";

// Без персональных данных: только шаг и семейство браузера — видно, где отваливается вход во встроенных браузерах.
// Полный user agent пишем, пока браузер не опознан: так узнаём, как называют себя новые встроенные браузеры
export function logVkStep(step: string, request: NextRequest, extra: Record<string, unknown> = {}): void {
  const userAgent = request.headers.get("user-agent") ?? "";
  const browser = inAppBrowser(userAgent);
  const mobile = /iPhone|iPad|Android/i.test(userAgent);
  console.info(JSON.stringify({ event: "vk_login", step, browser, mobile, ...(browser || !mobile ? {} : { userAgent }), ...extra }));
}
