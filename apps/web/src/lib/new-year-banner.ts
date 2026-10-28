// The banner stays up through 15 January 2027 (Moscow time) and then hides itself.
// Remove <NewYearBanner /> from the home page and this file when the special project is retired.
const BANNER_UNTIL = Date.parse("2027-01-16T00:00:00+03:00");

// An unreadable clock keeps the banner: hiding it on NaN would be a silent failure.
export function isNewYearBannerActive(now: Date): boolean {
  const time = now.getTime();
  return Number.isNaN(time) || time < BANNER_UNTIL;
}
