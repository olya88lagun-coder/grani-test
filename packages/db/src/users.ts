import type { Gender } from "@grani/core";
import { and, asc, eq, isNull } from "drizzle-orm";
import { authIdentities, type AuthProvider, users } from "./schema";
import type { Database } from "./types";
import { isUuid } from "./uuid";

export type KnownGender = Exclude<Gender, null>;
export type IdentityInput = { provider: AuthProvider; externalId: string; displayName: string; gender: KnownGender | null };
export type Consent = { version: string; at: Date };
export type UserRecord = { id: string; displayName: string; gender: KnownGender | null };
export type UpsertOutcome = { ok: true; user: UserRecord; created: boolean } | { ok: false; reason: "CONSENT_REQUIRED" };

async function findOwner(db: Database, provider: AuthProvider, externalId: string) {
  const [row] = await db
    .select({ userId: authIdentities.userId, gender: users.gender })
    .from(authIdentities)
    .innerJoin(users, eq(users.id, authIdentities.userId))
    .where(and(eq(authIdentities.provider, provider), eq(authIdentities.externalId, externalId), isNull(users.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function upsertUserFromIdentity(
  db: Database,
  identity: IdentityInput,
  consent: Consent | null,
): Promise<UpsertOutcome> {
  const owner = await findOwner(db, identity.provider, identity.externalId);
  if (owner) {
    const gender = owner.gender ?? identity.gender;
    await db.transaction(async (tx) => {
      await tx
        .update(authIdentities)
        .set({ displayName: identity.displayName })
        .where(and(eq(authIdentities.provider, identity.provider), eq(authIdentities.externalId, identity.externalId)));
      if (gender !== owner.gender) await tx.update(users).set({ gender }).where(eq(users.id, owner.userId));
      if (consent) {
        await tx
          .update(users)
          .set({ consentVersion: consent.version, consentedAt: consent.at })
          .where(eq(users.id, owner.userId));
      }
    });
    return { ok: true, created: false, user: { id: owner.userId, displayName: identity.displayName, gender } };
  }
  if (!consent) return { ok: false, reason: "CONSENT_REQUIRED" };
  const user = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({ gender: identity.gender, consentVersion: consent.version, consentedAt: consent.at })
      .returning({ id: users.id });
    await tx.insert(authIdentities).values({
      userId: created!.id,
      provider: identity.provider,
      externalId: identity.externalId,
      displayName: identity.displayName,
    });
    return created!;
  });
  return { ok: true, created: true, user: { id: user.id, displayName: identity.displayName, gender: identity.gender } };
}

export async function getUser(db: Database, userId: string): Promise<UserRecord | null> {
  if (!isUuid(userId)) return null;
  const [row] = await db
    .select({ id: users.id, gender: users.gender, displayName: authIdentities.displayName })
    .from(users)
    .innerJoin(authIdentities, eq(authIdentities.userId, users.id))
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .orderBy(asc(authIdentities.createdAt))
    .limit(1);
  return row ?? null;
}
