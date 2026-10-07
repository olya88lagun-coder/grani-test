import { CARE_READY_CARD_ID, CARE_SOURCES } from "@grani/content/together";
import { buildCareCard, type CareCandidate, type CareCard } from "@grani/core";
import { loadCareSources } from "@grani/db";
import { firstName } from "./friends-service";
import type { TogetherDeps } from "./together-service";

export type CareResponse = { ok: true; ready: false } | { ok: true; ready: true; card: CareCard } | { ok: false; error: "not_found" };

const SOURCE_IDS = Object.keys(CARE_SOURCES);

// Итог месяца 1: «Наши способы заботы». В карточку попадают только пункты, которые автор отметил для итоговой карточки,
// каждый под именем автора; свободный текст ответа не используется
export async function getTogetherCareCard(deps: TogetherDeps, p: { userId: string }): Promise<CareResponse> {
  const sources = await loadCareSources(deps.db, { userId: p.userId, sourceIds: SOURCE_IDS, readyCardId: CARE_READY_CARD_ID });
  if (!sources) return { ok: false, error: "not_found" };
  if (!sources.ready) return { ok: true, ready: false };
  const [first, second] = sources.members;
  if (!first || !second) return { ok: false, error: "not_found" };

  const candidates = sources.answers.flatMap((answer): CareCandidate[] => {
    const category = CARE_SOURCES[answer.cardId];
    const { care_action: action, care_context: context, allow_care_reward: offered } = answer.fields;
    if (!category || offered !== true || typeof action !== "string") return [];
    return [{ ownerId: answer.userId, category, action, context: typeof context === "string" ? context : null, sourceId: answer.cardId }];
  });
  const member = (entry: { userId: string; displayName: string }) => ({ id: entry.userId, name: firstName(entry.displayName) });
  return { ok: true, ready: true, card: buildCareCard([member(first), member(second)], candidates) };
}
