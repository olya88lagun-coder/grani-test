// Локальная Postgres-совместимая БД для `next dev`: PGlite с данными в .dev-db/ и миграциями
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

const DEV_DB_PORT = 5433;
const dataDir = fileURLToPath(new URL("../../../.dev-db", import.meta.url));
const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

// Типы сообщений расширенного протокола: Parse, Bind, Describe, Execute, Close, Flush; конец пачки — Sync или простой Query
const EXTENDED_MESSAGES = new Set([0x50, 0x42, 0x44, 0x45, 0x43, 0x48]);
const BATCH_END_MESSAGES = new Set([0x53, 0x51]);

// PGLiteSocketServer ставит в очередь каждое сообщение отдельно и держит одного клиента только внутри транзакции.
// У всех клиентов одна сессия PGlite, поэтому Parse/Bind/Execute разных соединений перемешивались:
// «unnamed prepared statement does not exist», чужие параметры в запросе, пустые ответы воркеру.
// Здесь очередь отдаёт PGlite сообщения одного клиента подряд — от первого Parse до его Sync.
function keepExtendedProtocolTogether(queue) {
  let pinnedHandlerId = null;

  queue.processQueue = async function processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const owner = pinnedHandlerId ?? (this.db.isInTransaction() ? this.lastHandlerId : null);
      const index = owner === null ? 0 : this.queue.findIndex((item) => item.handlerId === owner);
      // Следующее сообщение владельца ещё не пришло: остальные ждут, очередь продолжит enqueue владельца
      if (index === -1) break;
      const [item] = this.queue.splice(index, 1);
      let bytes = 0;
      try {
        await this.db.runExclusive(() =>
          this.db.execProtocolRawStream(item.message, {
            onRawData: (data) => {
              bytes += data.length;
              item.onData(data);
            },
          }),
        );
      } catch (error) {
        pinnedHandlerId = null;
        item.reject(error);
        continue;
      }
      const type = item.message[0];
      if (EXTENDED_MESSAGES.has(type)) pinnedHandlerId = item.handlerId;
      else if (BATCH_END_MESSAGES.has(type)) pinnedHandlerId = null;
      this.lastHandlerId = item.handlerId;
      item.resolve(bytes);
    }
    this.processing = false;
  };

  // Клиент отключился посреди пачки — снимаем закрепление, иначе остальные ждали бы его вечно
  const clearQueueForHandler = queue.clearQueueForHandler.bind(queue);
  queue.clearQueueForHandler = (handlerId) => {
    clearQueueForHandler(handlerId);
    if (pinnedHandlerId === handlerId) pinnedHandlerId = null;
    void queue.processQueue();
  };
}

const db = await PGlite.create(dataDir);
await migrate(drizzle(db), { migrationsFolder });
// web (postgres.js + отправка в pg-boss) и воркер (postgres.js + pg-boss) держат до ~8 соединений; PGlite выполняет запросы по очереди
const server = new PGLiteSocketServer({ db, port: DEV_DB_PORT, host: "127.0.0.1", maxConnections: 10 });
keepExtendedProtocolTogether(server.queryQueue);
await server.start();
console.log(`dev db ready: postgres://postgres:postgres@127.0.0.1:${DEV_DB_PORT}/postgres`);

// Клиент, убитый без закрытия соединения (Ctrl+C в воркере, process.exit), даёт ECONNRESET на сокете,
// который PGLiteSocketServer не обрабатывает, и без этого падала бы вся локальная БД
process.on("uncaughtException", (error) => {
  if (error.code === "ECONNRESET" || error.code === "EPIPE") {
    console.warn(`dev db: client disconnected abruptly (${error.code})`);
    return;
  }
  console.error(error);
  process.exit(1);
});

process.on("SIGINT", async () => {
  await server.stop();
  await db.close();
  process.exit(0);
});
