// Локально (ИИ выключен): кладёт в базу тестовый отчёт «Портрет», чтобы посмотреть вкладку блоками.
// Запуск при работающей `pnpm dev:db`:  node scripts/seed-portrait-report.mjs <resultId> [--remove]
import { createRequire } from "node:module";

const require = createRequire(new URL("../packages/db/package.json", import.meta.url));
const postgres = require("postgres");

const [resultId, flag] = process.argv.slice(2);
if (!resultId) {
  console.error("usage: node scripts/seed-portrait-report.mjs <resultId> [--remove]");
  process.exit(2);
}
const databaseUrl = process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5433/postgres?sslmode=disable";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(databaseUrl)) {
  console.error("Скрипт пишет только в локальную базу (127.0.0.1 или localhost).");
  process.exit(2);
}

const HEADLINE = "Ты соединяешь интерес к новому с заботой о людях и порядком, и тебе важно беречь на это силы";
const BLOCKS = [
  ["start", "Как ты берёшься за дело", "Ты быстро загораешься новой идеей, а довести её до результата помогают понятные шаги. Поэтому полезно сразу записать первый маленький шаг и срок: так интерес не растворяется в планах, а превращается в действие."],
  ["talk", "Как ты общаешься", "В разговоре тебе важны и контакт, и спокойный темп. Ты слышишь собеседника, но иногда соглашаешься быстрее, чем успеваешь понять, чего хочется самому. Короткая пауза перед ответом возвращает голос и никого не обижает."],
  ["load", "Что происходит под нагрузкой", "Под нагрузкой тебе нужно сначала снизить шум вокруг, а уже потом принимать решения. Помогает список из трёх дел на сегодня и одно окно без уведомлений. Когда сигналов становится меньше, возвращаются ясность и ровное настроение."],
  ["energy", "Что даёт тебе энергию", "Силы к тебе возвращаются там, где есть и свобода пробовать новое, и живые люди рядом. Тихий вечер без планов полезен, но если он затягивается, тянет к разговору. Договорись с собой о паре встреч в неделю и одном дне для себя."],
  ["support", "На что в тебе можно опереться", "Тебе легко доверяют: ты замечаешь, что нужно другим, и помнишь про договорённости. Чтобы надёжность не превращалась в перегруз, заранее называй, сколько времени и сил можно дать, и оставляй запас на собственные дела."],
].map(([seed, title, text]) => ({ seed, title, text }));

const sql = postgres(databaseUrl, { max: 1 });
try {
  await sql`delete from reports where result_id = ${resultId} and kind = 'portrait'`;
  if (flag !== "--remove") {
    await sql`insert into reports (result_id, kind, sections, source) values (${resultId}, 'portrait', ${sql.json({ version: 1, headline: HEADLINE, blocks: BLOCKS })}, 'ai')`;
    console.log(`Отчёт portrait добавлен для ${resultId}`);
  } else {
    console.log(`Отчёт portrait удалён для ${resultId}`);
  }
} finally {
  await sql.end();
}
