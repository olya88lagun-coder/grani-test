// Карточка «Наши способы заботы» — итог месяца 1. Собирается только из пунктов, которые автор сам отметил для итоговой карточки;
// чужой текст автору не приписывается, смысл свободных ответов не разбирается

export type CareCategory = "attention" | "ease" | "ritual";
export type CareCandidate = { ownerId: string; category: CareCategory; action: string; context: string | null; sourceId: string };
export type CareEntry = { text: string; context: string | null };
export type CareRitual = { ownerId: string; ownerName: string; text: string; context: string | null };
export type CareMember = { id: string; name: string; attention: CareEntry[]; ease: CareEntry[] };
export type CareCard = { title: string; members: CareMember[]; rituals: CareRitual[]; complete: boolean; empty: boolean };

export const CARE_CARD_TITLE = "Наши способы заботы";
const ACTION_MAX = 180;
const CONTEXT_MAX = 100;

const clip = (value: string, max: number): string => [...value.trim()].slice(0, max).join("");

// Порядок пунктов — порядок карточек-источников (по номеру в sourceId); пары, где автор не из пары, пропускаются
const bySource = (a: CareCandidate, b: CareCandidate): number => a.sourceId.localeCompare(b.sourceId, "en");

export function buildCareCard(members: readonly [{ id: string; name: string }, { id: string; name: string }], candidates: readonly CareCandidate[]): CareCard {
  const known = new Map(members.map((member) => [member.id, member.name]));
  const entries = candidates
    .filter((candidate) => known.has(candidate.ownerId))
    .map((candidate) => ({ candidate, text: clip(candidate.action, ACTION_MAX), context: clip(candidate.context ?? "", CONTEXT_MAX) }))
    .filter((entry) => entry.text !== "")
    .sort((a, b) => bySource(a.candidate, b.candidate))
    .map((entry): { candidate: CareCandidate; entry: CareEntry } => ({ candidate: entry.candidate, entry: { text: entry.text, context: entry.context === "" ? null : entry.context } }));

  const cardMembers = members.map(
    (member): CareMember => ({
      id: member.id,
      name: member.name,
      attention: entries.filter((e) => e.candidate.ownerId === member.id && e.candidate.category === "attention").map((e) => e.entry),
      ease: entries.filter((e) => e.candidate.ownerId === member.id && e.candidate.category === "ease").map((e) => e.entry),
    }),
  );
  const rituals = entries
    .filter((e) => e.candidate.category === "ritual")
    .map((e): CareRitual => ({ ownerId: e.candidate.ownerId, ownerName: known.get(e.candidate.ownerId)!, text: e.entry.text, context: e.entry.context }));

  return {
    title: CARE_CARD_TITLE,
    members: cardMembers,
    rituals,
    complete: cardMembers.every((member) => member.attention.length > 0 && member.ease.length > 0),
    empty: entries.length === 0,
  };
}
