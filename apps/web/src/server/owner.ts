import { hasIdentity, type UserRecord } from "@grani/db";
import { notFound } from "next/navigation";
import { getDb } from "./db";
import { getEnv } from "./env";
import { currentUser } from "./viewer";

export async function isOwnerUser(user: UserRecord): Promise<boolean> {
  const owner = getEnv().owner;
  return owner !== null && (await hasIdentity(getDb(), user.id, owner));
}

// Служебные страницы видит только владелица (OWNER_IDENTITY); остальным — обычная 404, без намёка, что страница есть
export async function requireOwner(): Promise<UserRecord> {
  const user = await currentUser();
  if (!user || !(await isOwnerUser(user))) notFound();
  return user;
}
