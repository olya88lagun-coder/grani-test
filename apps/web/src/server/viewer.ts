import type { UserRecord } from "@grani/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { getEnv } from "./env";
import { SESSION_COOKIE } from "./http";
import { getCurrentUser } from "./login-service";

export async function currentUser(): Promise<UserRecord | null> {
  const store = await cookies();
  return getCurrentUser({ db: getDb(), env: getEnv() }, store.get(SESSION_COOKIE)?.value ?? null);
}

export async function requireUser(): Promise<UserRecord> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
