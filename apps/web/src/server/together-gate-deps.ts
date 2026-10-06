import { getDb } from "./db";
import { getEnv } from "./env";
import type { GateDeps } from "./together-gate";

// Зависимости допуска для серверных страниц; маршруты берут их из authorizeTogether
export function pageGateDeps(): GateDeps {
  const env = getEnv();
  return { db: getDb(), now: () => new Date(), together: env.together, owner: env.owner };
}
