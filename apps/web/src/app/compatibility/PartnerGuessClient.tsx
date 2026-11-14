"use client";

import { PartnerGuess, type PartnerPrediction } from "./PartnerGuess";
import { reachGoal } from "@/lib/analytics";

type Props = { item: { id: string; text: string }; inviteHref: string };

// Прогноз остаётся в браузере: на сервер он не уходит и в события не попадает
const GUESS_KEY = "grani:partner-guess:v1";

async function keepGuess({ itemId, value }: PartnerPrediction): Promise<void> {
  window.localStorage.setItem(GUESS_KEY, JSON.stringify({ itemId, value, at: Date.now() }));
  reachGoal("fx_guess_invite");
}

export function PartnerGuessClient(props: Props) {
  return <PartnerGuess {...props} onInvite={keepGuess} />;
}
