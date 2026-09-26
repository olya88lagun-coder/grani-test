import { describe, expect, test } from "vitest";
import { inAppBrowser } from "./in-app-browser";

const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1";

describe("inAppBrowser", () => {
  test("recognises the VK app browser on iPhone and Android", () => {
    expect(inAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 com.vk.vkclient/1.0")).toBe("vk");
    expect(inAppBrowser("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 VKAndroidApp/8.100")).toBe("vk");
  });

  test("recognises Telegram, Instagram, Facebook and OK", () => {
    expect(inAppBrowser(SAFARI, { telegramBridge: true })).toBe("telegram");
    expect(inAppBrowser("Mozilla/5.0 (Linux; Android 14) Telegram-Android/11.2")).toBe("telegram");
    expect(inAppBrowser(`${SAFARI} Instagram 350.0`)).toBe("instagram");
    expect(inAppBrowser(`${SAFARI} [FBAN/FBIOS;FBAV/480.0]`)).toBe("facebook");
    expect(inAppBrowser(`${SAFARI} OKApp/24.9`)).toBe("ok");
  });

  test("ordinary browsers are not in-app", () => {
    expect(inAppBrowser(SAFARI)).toBeNull();
    expect(inAppBrowser("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36")).toBeNull();
    expect(inAppBrowser("")).toBeNull();
  });
});
