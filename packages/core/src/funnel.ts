// Шаги от начала теста до входа, которые сайт считает сам; остальные цели есть только в Метрике
export const FUNNEL_STEPS = ["test_start", "test_finish", "login_consent", "login_start", "login", "attachment_start", "attachment_finish", "temperament_start", "temperament_finish"] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export function isFunnelStep(value: string): value is FunnelStep {
  return (FUNNEL_STEPS as readonly string[]).includes(value);
}

// От какого шага считать долю: вход — от закончивших Big Five, конец короткого теста — от его начала; у начал доли нет
const FUNNEL_BASE: Readonly<Record<FunnelStep, FunnelStep | null>> = {
  test_start: null,
  test_finish: null,
  login_consent: "test_finish",
  login_start: "test_finish",
  login: "test_finish",
  attachment_start: null,
  attachment_finish: "attachment_start",
  temperament_start: null,
  temperament_finish: "temperament_start",
};

export function funnelBase(step: FunnelStep): FunnelStep | null {
  return FUNNEL_BASE[step];
}
