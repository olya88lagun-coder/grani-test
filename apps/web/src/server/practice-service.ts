import { getResultForOwner, listOwnedProducts, loadPracticeDraft, writePracticeDraft, type Database, type PracticeDraftRecord } from "@grani/db";
import { unlockedKinds, type ChapterKind } from "@grani/core";
import { initialMoneyData, moneyDataSchema, MAX_PRACTICE_REVISION } from "@/lib/money-practice";

// Register only implemented practices. Storage and access checks are shared by future chapters.
export const PRACTICES = { money: { product: "chapter_money" as ChapterKind, schemaVersion: 1, schema: moneyDataSchema, initial: initialMoneyData } };
export const moneyPracticeEnabled = () => process.env.MONEY_PRACTICE_V1 === "1";
export type PracticeResponse = { ok: true; draft: PracticeDraftRecord } | { ok: false; error: "not_found" | "access_required" | "invalid" | "conflict" | "incompatible" };
type Target = { userId: string; resultId: string; key: string };
async function access(db: Database, p: Target) {
  if (p.key !== "money") return { ok: false, error: "not_found" } as const;
  const result = await getResultForOwner(db, p.resultId, p.userId);
  if (!result) return { ok: false, error: "not_found" } as const;
  const products = await listOwnedProducts(db, { resultId: p.resultId });
  if (!unlockedKinds(products).has(PRACTICES.money.product)) return { ok: false, error: "access_required" } as const;
  return { ok: true, definition: PRACTICES.money } as const;
}
export async function readPractice(db: Database, p: Target): Promise<PracticeResponse> {
  const allowed = await access(db, p); if (!allowed.ok) return allowed;
  const draft = await loadPracticeDraft(db, p.resultId, p.key);
  if (draft && (draft.schemaVersion !== allowed.definition.schemaVersion || !allowed.definition.schema.safeParse(draft.data).success)) return { ok: false, error: "incompatible" };
  return { ok: true, draft: draft ?? { revision: 0, schemaVersion: allowed.definition.schemaVersion, data: allowed.definition.initial(), updatedAt: null } };
}
export async function savePractice(db: Database, p: Target & { expectedRevision: number; data: unknown }): Promise<PracticeResponse> {
  const allowed = await access(db, p); if (!allowed.ok) return allowed;
  const parsed = allowed.definition.schema.safeParse(p.data);
  if (!parsed.success || !Number.isSafeInteger(p.expectedRevision) || p.expectedRevision < 0 || p.expectedRevision > MAX_PRACTICE_REVISION) return { ok: false, error: "invalid" };
  const draft = await writePracticeDraft(db, { ...p, schemaVersion: allowed.definition.schemaVersion, data: parsed.data });
  return draft ? { ok: true, draft } : { ok: false, error: "conflict" };
}
