import { renderToStaticMarkup } from "react-dom/server";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { SiteHeader } from "../../../apps/web/src/components/SiteHeader";
import { Footer } from "../../../apps/web/src/components/Footer";
import { TogetherLanding } from "../../../apps/web/src/app/together/TogetherLanding";
import { TogetherStats } from "../../../apps/web/src/app/together/TogetherStats";
import "../../../apps/web/src/app/globals.css";

export function renderLanding() {
  return renderToStaticMarkup(<PathnameContext.Provider value="/together"><SiteHeader /><TogetherLanding enterQuery="&from=Abcdefghijklmnopqrstuvwx" /><Footer /></PathnameContext.Provider>);
}

// Только изолированная проверка представления: эти числа никогда не попадают в продукт.
export function renderStats(stats: { days: number; conversations: number; dates: number }) {
  return renderToStaticMarkup(<main className="page stack" data-palette="pair"><TogetherStats stats={stats} /></main>);
}
