import { z } from "zod";
import type { CardField, CardKind, CardSnapshot } from "@grani/core";
import intro from "./intro.json";
import month01 from "./month-01.json";

const fieldSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string().min(1), type: z.literal("short_text"), label: z.string().min(1), required: z.boolean(), maxLength: z.number().int().positive().max(1200) }),
  z.object({ id: z.string().min(1), type: z.literal("boolean"), label: z.string().min(1), required: z.boolean(), availableAt: z.literal("after_reveal").optional() }),
]);

const cardSchema = z
  .object({
    id: z.string().min(1),
    version: z.number().int().positive(),
    title: z.string().min(1),
    estimatedMinutes: z.number().int().positive(),
    prompt: z.string().min(1),
    hint: z.string().min(1),
    fields: z.array(fieldSchema).min(1),
    revealPolicy: z.literal("after_both_submit"),
    jointAction: z.string().min(1),
    skipAllowed: z.boolean(),
  })
  .refine((card) => card.fields.some((field) => field.id === "answer" && field.type === "short_text" && field.required), "card needs a required text answer field");

type ParsedField = z.infer<typeof fieldSchema>;

const toField = (field: ParsedField): CardField =>
  field.type === "short_text"
    ? { id: field.id, type: field.type, label: field.label, required: field.required, maxLength: field.maxLength }
    : { id: field.id, type: field.type, label: field.label, required: field.required, ...(field.availableAt ? { availableAt: field.availableAt } : {}) };

// Из редакционной карточки берётся только то, что нужно серверу; награды и книга подключаются на своих этапах
export function toSnapshot(raw: unknown, kind: CardKind): CardSnapshot {
  const card = cardSchema.parse(raw);
  return {
    id: card.id,
    version: card.version,
    kind,
    title: card.title,
    estimatedMinutes: card.estimatedMinutes,
    prompt: card.prompt,
    hint: card.hint,
    jointAction: card.jointAction,
    skipAllowed: card.skipAllowed,
    fields: card.fields.map(toField),
  };
}

const INTRO_IDS = ["intro-01", "intro-02", "intro-03"];
// m01-d27 и m01-d28 выбирают кандидатов для карточки заботы (этап 4): в маршрут этапа 2 не входят и схемой не разбираются
const MAIN_IDS = Array.from({ length: 26 }, (_, index) => `m01-d${String(index + 1).padStart(2, "0")}`);

const find = (cards: readonly unknown[], id: string): unknown => {
  const raw = cards.find((card) => typeof card === "object" && card !== null && (card as { id?: unknown }).id === id);
  if (raw === undefined) throw new Error(`together card ${id} is missing from the catalog`);
  return raw;
};

export function buildTrack(introCards: readonly unknown[], monthCards: readonly unknown[]): CardSnapshot[] {
  return [...INTRO_IDS.map((id) => toSnapshot(find(introCards, id), "intro")), ...MAIN_IDS.map((id) => toSnapshot(find(monthCards, id), "main"))];
}

export const TOGETHER_TRACK: readonly CardSnapshot[] = buildTrack(intro.cards, month01.cards);
