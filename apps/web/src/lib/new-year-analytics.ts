import { isAnalyticsReady, isOwnerDevice, readChoice, METRIKA_ID } from "./analytics";
import { SITE_URL } from "./site";

export type YearEvent = "new_year_start" | "new_year_complete" | "new_year_download" | "new_year_share" | "new_year_wallpaper" | "new_year_to_test";
// Fixed event names only. Reflections, profile values and result identifiers are never analytics parameters.
export function trackYearEvent(event: YearEvent): void {
  try {
    if (window.location.origin !== SITE_URL || readChoice(window.localStorage) !== "all" || isOwnerDevice(window.localStorage) || !isAnalyticsReady(window)) return;
    const ym = (window as Window & { ym?: (...args: unknown[]) => void }).ym;
    ym?.(METRIKA_ID, "reachGoal", event, undefined);
  } catch { /* Privacy-restricted browsers can still use the reflection. */ }
}
