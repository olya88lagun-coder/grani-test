// Шаги от начала теста до входа, которые сайт считает сам; остальные цели есть только в Метрике
export const FUNNEL_STEPS = ["test_start", "test_finish", "login_consent", "login_start", "login", "attachment_start", "attachment_finish"] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export function isFunnelStep(value: string): value is FunnelStep {
  return (FUNNEL_STEPS as readonly string[]).includes(value);
}
