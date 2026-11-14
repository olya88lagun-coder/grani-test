"use client";

import { HomeTrial, type TrialAnswer } from "./HomeTrial";
import { reachGoal } from "@/lib/analytics";
import { mergeTrialAnswer, STORAGE_KEY } from "@/lib/test-progress";

type Props = { item: { id: string; text: string }; continueHref: string; remaining: number };

// Ответ остаётся в браузере: кладём его в черновик полного теста, на сервер ничего не уходит
async function carryOver({ itemId, value }: TrialAnswer): Promise<void> {
  const { raw, started } = mergeTrialAnswer(window.localStorage.getItem(STORAGE_KEY), itemId, value);
  window.localStorage.setItem(STORAGE_KEY, raw);
  // Тест откроется уже с одним ответом, и его собственный старт не сработает
  if (started) reachGoal("test_start");
  reachGoal("fx_trial_handoff");
}

export function HomeTrialClient(props: Props) {
  return <HomeTrial {...props} onContinue={carryOver} />;
}
