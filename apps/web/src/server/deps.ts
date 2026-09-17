import { getDb } from "./db";
import { getEnv } from "./env";
import type { LoginDeps } from "./login-service";

export function loginDeps(): LoginDeps {
  return { db: getDb(), env: getEnv(), now: () => new Date(), fetchFn: (input, init) => fetch(input, init) };
}
