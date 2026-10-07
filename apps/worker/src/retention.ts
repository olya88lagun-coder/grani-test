import { purgeExpiredData, type Database } from "@grani/db";
import type { Logger } from "./log";

export type RetentionDeps = { db: Database; log: Logger; now?: Date; batchSize?: number };

// Страховка от бесконечного цикла: при порции 100 это 10 000 человек за один запуск, остальных доберёт следующий день
const MAX_BATCHES = 100;

// Ежедневное удаление по срокам из политики. В лог попадают только счётчики и id, без данных людей
export async function runRetention(deps: RetentionDeps) {
  const now = deps.now ?? new Date();
  const total = { usersDeleted: 0, purchasesDeleted: 0 };
  const failedUserIds = new Set<string>();
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const outcome = await purgeExpiredData(deps.db, { now, batchSize: deps.batchSize });
    total.usersDeleted += outcome.usersDeleted;
    total.purchasesDeleted += outcome.purchasesDeleted;
    for (const id of outcome.failedUserIds) failedUserIds.add(id);
    // Нет продвижения (пусто или остались только сбойные): дальше крутить нечего
    if (outcome.usersDeleted === 0 && outcome.purchasesDeleted === 0) break;
  }
  deps.log("info", "retention finished", { ...total });
  if (failedUserIds.size > 0) {
    deps.log("warn", "retention could not erase some accounts", { failed: failedUserIds.size, userIds: [...failedUserIds] });
    throw new Error(`retention: ${failedUserIds.size} accounts could not be erased`);
  }
  return total;
}
