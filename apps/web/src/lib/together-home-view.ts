import { TOGETHER_SEASON } from "@grani/content/together-season";
import type { CardView } from "./together-cards-view";
import type { SpaceView } from "./together-view";

export type TogetherHomeView = {
  membership: "none" | "pending" | "active";
  access: "unknown" | "free" | "paid" | "expired";
  activity: "loading" | "none" | "available" | "payment_locked" | "month_locked" | "waiting" | "revealed" | "skipped" | "error" | "gone";
  theme: { month: number | null; title: string } | null;
  primaryAction: "answer" | "check" | "continue" | "payment" | "retry" | null;
  stats: SpaceView["stats"] | null;
  sectionsAvailability: { history: boolean; care: boolean; savedMoments: "not_connected" };
};

// Только представление серверного снимка. Ответы и разрешения на публикацию не попадают в модель главной.
export function buildTogetherHomeView({ space, card, cardLoad }: {
  space: SpaceView | null;
  card: CardView | null;
  cardLoad: "loading" | "ready" | "error" | "gone";
}): TogetherHomeView {
  const active = space?.status === "active";
  const membership = !space ? "none" : space.status;
  const access = !active ? "unknown" : space.access.active ? "paid" : space.access.accessUntil ? "expired" : "free";
  const activity: TogetherHomeView["activity"] = !active ? "none" : cardLoad !== "ready" ? cardLoad : !card ? "none" : card.locked ? card.lock?.kind === "month" ? "month_locked" : "payment_locked" : card.state === "answer" ? "available" : card.state;
  let theme: TogetherHomeView["theme"] = null;
  if (active && cardLoad === "ready" && card) {
    if (card.position <= 3) theme = { month: null, title: "Знакомство с пространством" };
    else {
      const month = Math.floor((card.position - 4) / 26) + 1;
      const season = TOGETHER_SEASON.find((item) => item.month === month);
      if (season) theme = { month, title: season.title };
    }
  }
  const actions = { available: "answer", waiting: "check", revealed: "continue", skipped: "continue", payment_locked: "payment", error: "retry" } as const;
  return {
    membership, access, activity, theme,
    primaryAction: activity in actions ? actions[activity as keyof typeof actions] : null,
    stats: active ? space.stats ?? null : null,
    sectionsAvailability: { history: active && cardLoad !== "gone", care: active && cardLoad !== "gone", savedMoments: "not_connected" },
  };
}
