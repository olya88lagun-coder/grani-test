"use client";

import { COOKIE_SETTINGS_EVENT } from "@/lib/analytics";

export function CookieSettingsButton() {
  return (
    <button type="button" className="link-button" onClick={() => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))}>
      Настройки cookie
    </button>
  );
}
