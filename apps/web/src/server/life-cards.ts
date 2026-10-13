import { unlockedKinds, type GenerateJob, type Product } from "@grani/core";

// Карточки «В жизни»: включать вместе с LIFE_CARDS_V1 у воркера (см. deploy/server-setup.md)
export const lifeCardsEnabled = () => process.env.LIFE_CARDS_V1 === "1";

export type LifeCardsDeps = { enabled: boolean; enqueueGenerate: (job: GenerateJob) => Promise<void> };

// Уже купившим карточки ставятся при открытии страницы разбора. Id задачи детерминирован (`generate:<resultId>:life`),
// поэтому повторные открытия не плодят дубли
export async function requestLifeCards(deps: LifeCardsDeps, p: { resultId: string; owned: readonly Product[]; hasLife: boolean }): Promise<boolean> {
  if (!deps.enabled || p.hasLife || !unlockedKinds(p.owned).has("life")) return false;
  await deps.enqueueGenerate({ kind: "life", resultId: p.resultId });
  return true;
}
