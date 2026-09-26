// Встроенные браузеры приложений: в них VK ID уводит подтверждение входа в приложение ВК и не замечает возврата,
// поэтому таким посетителям предлагаем открыть сайт в Safari или Chrome
export type InAppBrowser = "vk" | "telegram" | "instagram" | "facebook" | "ok";

const PATTERNS: readonly (readonly [InAppBrowser, RegExp])[] = [
  ["vk", /com\.vk\.vkclient|VKAndroidApp|VKClient|vkontakte/i],
  ["telegram", /Telegram/i],
  ["instagram", /Instagram/i],
  ["facebook", /FBAN|FBAV|FB_IAB/],
  ["ok", /OKApp|OdnoklassnikiApp/i],
];

// telegramBridge — объект TelegramWebviewProxy: встроенный браузер Telegram на iPhone не меняет user agent
export function inAppBrowser(userAgent: string, hints: { telegramBridge?: boolean } = {}): InAppBrowser | null {
  if (hints.telegramBridge) return "telegram";
  return PATTERNS.find(([, pattern]) => pattern.test(userAgent))?.[0] ?? null;
}

// Название в родительном падеже: «внутри приложения …»
export const IN_APP_NAMES: Readonly<Record<InAppBrowser, string>> = {
  vk: "ВКонтакте",
  telegram: "Telegram",
  instagram: "Instagram",
  facebook: "Facebook",
  ok: "Одноклассников",
};
