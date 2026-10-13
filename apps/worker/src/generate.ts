import { buildFriendsInput, buildPairInput, buildPersonalInput, generateChapterCards, generateLifeCards, generateReport, type GeneratedReport, type ReportInput, type ReportWriter } from "@grani/ai";
import { compareFriendAnswers, hasCardsFormat, type Library } from "@grani/content";
import { CHAPTER_KINDS, friendsReportDue, unlockedKinds, type ChapterKind, type GenerateJob, type NotifyJob } from "@grani/core";
import {
  getActivePair,
  getInviteForResult,
  getReport,
  getResult,
  listFriendAnswers,
  listOwnedProducts,
  listReports,
  saveReport,
  type Database,
  type ReportTarget,
} from "@grani/db";
import type { Logger } from "./log";

export type GenerateDeps = {
  db: Database;
  library: Library;
  writer: ReportWriter | null;
  log: Logger;
  enqueueNotify: (job: NotifyJob) => Promise<void>;
  // Пилот: главы с темами пишутся карточками; по умолчанию выключено
  chapterCardsV2?: boolean;
  // Карточки «В жизни»; по умолчанию выключено
  lifeCardsV1?: boolean;
};

const targetOf = (job: GenerateJob): ReportTarget => (job.kind === "pair" ? { pairId: job.pairId } : { resultId: job.resultId });

async function buildInput(job: GenerateJob, deps: GenerateDeps): Promise<ReportInput | null> {
  if (job.kind === "pair") {
    const pair = await getActivePair(deps.db, job.pairId);
    return pair ? buildPairInput(deps.library, pair.members[0].result.scores, pair.members[1].result.scores) : null;
  }
  // Карточки «В жизни» идут отдельным путём без общего входа и без запасного текста (см. runLife)
  if (job.kind === "life") return null;
  const result = await getResult(deps.db, job.resultId);
  if (!result) return null;
  if (job.kind !== "friends") return buildPersonalInput(deps.library, job.kind, result);

  // Сайт проверил условия при постановке задачи; проверяем ещё раз — между ними могло пройти время
  const invite = await getInviteForResult(deps.db, result.id);
  const friendAnswers = invite ? await listFriendAnswers(deps.db, invite.id) : [];
  if (!friendsReportDue(await listOwnedProducts(deps.db, { resultId: result.id }), friendAnswers.length)) return null;
  const comparison = compareFriendAnswers(result.answers, friendAnswers);
  return comparison ? buildFriendsInput(result, comparison) : null;
}

const isChapter = (kind: GenerateJob["kind"]) => (CHAPTER_KINDS as readonly string[]).includes(kind);

// Главы из набора «все четыре» объявляются одним сообщением: его ставит та задача, после которой готовы все четыре.
// Id уведомления выводится из результата, поэтому даже две одновременные «последние» главы дадут одно сообщение
async function announcementFor(job: GenerateJob, reportId: string, deps: GenerateDeps): Promise<NotifyJob | null> {
  if (job.kind === "pair" || !isChapter(job.kind)) return { kind: "report_ready", reportId };
  const target = { resultId: job.resultId };
  const owned = await listOwnedProducts(deps.db, target);
  if (!owned.includes("chapters_all")) return { kind: "report_ready", reportId };
  const ready = new Set((await listReports(deps.db, target)).map((report) => report.kind));
  return CHAPTER_KINDS.every((kind) => ready.has(kind)) ? { kind: "chapters_ready", resultId: job.resultId } : null;
}

type ChapterJob = { kind: ChapterKind; resultId: string };

// Формат карточек — только у глав с темами и только при включённом флаге и подключённом ИИ
function usesCards(job: GenerateJob, deps: GenerateDeps): job is ChapterJob {
  return deps.chapterCardsV2 === true && deps.writer !== null && isChapter(job.kind) && hasCardsFormat(job.kind as ChapterKind);
}

async function generateCards(job: ChapterJob, deps: GenerateDeps): Promise<GeneratedReport | null> {
  const result = await getResult(deps.db, job.resultId);
  if (!result || !deps.writer) return null;
  const cards = await generateChapterCards(deps.writer, { library: deps.library, kind: job.kind, result }, { log: (message, extra) => deps.log("warn", message, extra) });
  return cards ? { sections: cards.sections, source: "ai", attempts: cards.attempts } : null;
}

type LifeJob = { kind: "life"; resultId: string };
const isLife = (job: GenerateJob): job is LifeJob => job.kind === "life";

// У карточек «В жизни» нет запасного текста: запасной вариант — статичные сценарии на странице.
// Поэтому без ИИ, без флага, без оплаченного разбора или после исчерпанных попыток отчёт просто не сохраняется
async function runLife(job: LifeJob, deps: GenerateDeps): Promise<void> {
  if (deps.lifeCardsV1 !== true || deps.writer === null) {
    deps.log("info", "report skipped", { kind: job.kind });
    return;
  }
  const target = { resultId: job.resultId };
  const result = await getResult(deps.db, job.resultId);
  // Сайт проверил доступ при постановке задачи; проверяем ещё раз — между ними могло пройти время
  if (!result || !unlockedKinds(await listOwnedProducts(deps.db, target)).has("life")) {
    deps.log("info", "report skipped", { kind: job.kind });
    return;
  }
  const cards = await generateLifeCards(deps.writer, { library: deps.library, result }, { log: (message, extra) => deps.log("warn", message, extra) });
  if (!cards) {
    deps.log("warn", "life cards failed", { kind: job.kind });
    return;
  }
  const { created } = await saveReport(deps.db, { target, kind: "life", sections: cards.sections, source: "ai" });
  deps.log("info", "report generated", { kind: job.kind, source: "ai", attempts: cards.attempts, created });
}

export async function runGenerate(job: GenerateJob, deps: GenerateDeps): Promise<void> {
  const target = targetOf(job);
  if (await getReport(deps.db, target, job.kind)) return;
  if (isLife(job)) return runLife(job, deps);
  const input = await buildInput(job, deps);
  if (!input) {
    deps.log("info", "report skipped", { kind: job.kind });
    return;
  }
  const cardsRequested = usesCards(job, deps);
  const cards = cardsRequested ? await generateCards(job, deps) : null;
  // Если карточки не получились, глава собирается из блоков без повторного обращения к модели
  const generated = cards ?? (await generateReport(cardsRequested ? null : deps.writer, input, { log: (message, extra) => deps.log("warn", message, extra) }));
  const { report, created } = await saveReport(deps.db, { target, kind: job.kind, sections: generated.sections, source: generated.source });
  deps.log("info", "report generated", { kind: job.kind, source: generated.source, attempts: generated.attempts, created });
  if (!created) return;
  const announcement = await announcementFor(job, report.id, deps);
  if (announcement) await deps.enqueueNotify(announcement);
}
