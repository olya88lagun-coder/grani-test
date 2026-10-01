import { hasIdentity, type UserRecord } from "@grani/db";
import { notFound } from "next/navigation";
import { getDb } from "./db";
import { getEnv } from "./env";
import { currentUser } from "./viewer";

// Служебные страницы видит только владелица (OWNER_IDENTITY); остальным — обычная 404, без намёка, что страница есть
export async function requireOwner(): Promise<UserRecord> {
  const owner = getEnv().owner;
  const user = await currentUser();
  if (!owner || !user || !(await hasIdentity(getDb(), user.id, owner))) notFound();
  return user;
}
