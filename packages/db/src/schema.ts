import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uniqueIndex, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { REPORT_KINDS, type AnswerFields, type CardSnapshot } from "@grani/core";

export const authProviderEnum = pgEnum("auth_provider", ["telegram", "vk"]);
export const genderEnum = pgEnum("gender", ["female", "male"]);

export type AuthProvider = (typeof authProviderEnum.enumValues)[number];

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  gender: genderEnum("gender"),
  consentVersion: text("consent_version").notNull(),
  consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
  // Отдельное согласие на обработку ответов в «Вдвоём»: даётся при создании пространства или запросе по приглашению
  togetherConsentVersion: text("together_consent_version"),
  togetherConsentedAt: timestamp("together_consented_at", { withTimezone: true }),
  createdAt: createdAt(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const authIdentities = pgTable(
  "auth_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: authProviderEnum("provider").notNull(),
    externalId: text("external_id").notNull(),
    displayName: text("display_name").notNull(),
    canNotify: boolean("can_notify").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("auth_identities_provider_external_uq").on(t.provider, t.externalId),
    uniqueIndex("auth_identities_user_provider_uq").on(t.userId, t.provider),
  ],
);

export const results = pgTable(
  "results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    answers: jsonb("answers").$type<Record<string, number>>().notNull(),
    scores: jsonb("scores").$type<Record<string, number>>().notNull(),
    typeCode: text("type_code").notNull(),
    stability: text("stability").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("results_user_created_idx").on(t.userId, t.createdAt)],
);

export const pairInviteStatusEnum = pgEnum("pair_invite_status", ["open", "accepted"]);

export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  resultId: uuid("result_id")
    .notNull()
    .unique()
    .references(() => results.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: createdAt(),
});

export const friendResponses = pgTable(
  "friend_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inviteId: uuid("invite_id")
      .notNull()
      .references(() => invites.id, { onDelete: "cascade" }),
    answers: jsonb("answers").$type<Record<string, number>>().notNull(),
    deviceHash: text("device_hash").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("friend_responses_invite_device_uq").on(t.inviteId, t.deviceHash)],
);

export const pairInvites = pgTable(
  "pair_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull().unique(),
    inviterUserId: uuid("inviter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inviterResultId: uuid("inviter_result_id")
      .notNull()
      .references(() => results.id, { onDelete: "cascade" }),
    status: pairInviteStatusEnum("status").notNull().default("open"),
    createdAt: createdAt(),
  },
  (t) => [index("pair_invites_result_idx").on(t.inviterResultId)],
);

export const pairs = pgTable(
  "pairs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inviteId: uuid("invite_id")
      .notNull()
      .unique()
      .references(() => pairInvites.id, { onDelete: "cascade" }),
    userAId: uuid("user_a_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    resultAId: uuid("result_a_id")
      .notNull()
      .references(() => results.id, { onDelete: "cascade" }),
    userBId: uuid("user_b_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    resultBId: uuid("result_b_id")
      .notNull()
      .references(() => results.id, { onDelete: "cascade" }),
    partnerConsentAt: timestamp("partner_consent_at", { withTimezone: true }).notNull(),
    leftAt: timestamp("left_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("pairs_user_a_idx").on(t.userAId),
    index("pairs_user_b_idx").on(t.userBId),
    check("pairs_different_users", sql`${t.userAId} <> ${t.userBId}`),
  ],
);

export const togetherSpaceStatusEnum = pgEnum("together_space_status", ["pending", "active", "closed"]);
export const togetherClosedReasonEnum = pgEnum("together_closed_reason", ["left", "account_deleted"]);
export const togetherRoleEnum = pgEnum("together_role", ["initiator", "partner"]);
export const togetherInviteStatusEnum = pgEnum("together_invite_status", ["open", "requested", "accepted", "revoked"]);

export type TogetherSpaceStatus = (typeof togetherSpaceStatusEnum.enumValues)[number];
export type TogetherClosedReason = (typeof togetherClosedReasonEnum.enumValues)[number];
export type TogetherRole = (typeof togetherRoleEnum.enumValues)[number];

// Пространство пары «Вдвоём» не связано с results и pairs: тест для него не нужен
export const togetherSpaces = pgTable(
  "together_spaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: togetherSpaceStatusEnum("status").notNull().default("pending"),
    createdAt: createdAt(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedBy: uuid("closed_by").references(() => users.id, { onDelete: "set null" }),
    closedReason: togetherClosedReasonEnum("closed_reason"),
    // Код ссылки для друзей: появляется, когда пара становится активной и просит ссылку
    shareCode: text("share_code").unique(),
    // Пространство, по ссылке которого пришла эта пара; хранятся только идентификаторы, без данных людей
    referredBySpaceId: uuid("referred_by_space_id").references((): AnyPgColumn => togetherSpaces.id, { onDelete: "set null" }),
  },
  (t) => [check("together_spaces_closed_consistent", sql`(${t.status} = 'closed') = (${t.closedAt} is not null)`)],
);

export const togetherMembers = pgTable(
  "together_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => togetherSpaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: togetherRoleEnum("role").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull(),
    leftAt: timestamp("left_at", { withTimezone: true }),
    // Участник прочитал сообщение о том, что пространство закрыли без него: оно показывается один раз
    closeNoticeSeenAt: timestamp("close_notice_seen_at", { withTimezone: true }),
  },
  (t) => [
    // Не больше двух участников: по одному на роль
    uniqueIndex("together_members_space_role_uq").on(t.spaceId, t.role),
    uniqueIndex("together_members_space_user_uq").on(t.spaceId, t.userId),
    // Один активный кабинет на человека
    uniqueIndex("together_members_active_user_uq")
      .on(t.userId)
      .where(sql`${t.leftAt} is null`),
  ],
);

export const togetherInvites = pgTable(
  "together_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => togetherSpaces.id, { onDelete: "cascade" }),
    // Сам токен не хранится: по хешу ссылку найти можно, из базы её не восстановить
    tokenHash: text("token_hash").notNull().unique(),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => users.id),
    status: togetherInviteStatusEnum("status").notNull().default("open"),
    requesterUserId: uuid("requester_user_id").references(() => users.id),
    requestedAt: timestamp("requested_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    // Необязательная записка пригласившего: видна тому, у кого есть ссылка
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    check("together_invites_note_length", sql`${t.note} is null or char_length(${t.note}) <= 200`),
    // Одна живая ссылка на пространство; завершённых может быть сколько угодно
    uniqueIndex("together_invites_live_uq")
      .on(t.spaceId)
      .where(sql`${t.status} in ('open', 'requested')`),
  ],
);

export const togetherPilotSourceEnum = pgEnum("together_pilot_source", ["code", "invite"]);
export type TogetherPilotSource = (typeof togetherPilotSourceEnum.enumValues)[number];

// Допуск человека к закрытому пилоту «Вдвоём». Пропуск по общему коду занимает место в лимите, пропуск по приглашению — нет
export const togetherPilotPasses = pgTable("together_pilot_passes", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  source: togetherPilotSourceEnum("source").notNull(),
  createdAt: createdAt(),
});

export const productEnum = pgEnum("product", [
  "full",
  "chapter_money",
  "chapter_conflict",
  "chapter_stress",
  "chapter_relationships",
  "chapters_all",
  "pair",
  "together_30d",
]);
export const purchaseStatusEnum = pgEnum("purchase_status", ["pending", "succeeded", "canceled", "refunded"]);
export const reportKindEnum = pgEnum("report_kind", REPORT_KINDS);
export const reportSourceEnum = pgEnum("report_source", ["ai", "fallback"]);

export type PurchaseStatus = (typeof purchaseStatusEnum.enumValues)[number];
export type ReportSource = (typeof reportSourceEnum.enumValues)[number];

export const purchases = pgTable(
  "purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    product: productEnum("product").notNull(),
    // Записи об оплатах переживают удаление данных (налоговый учёт), поэтому ссылка обнуляется, а не удаляет покупку
    resultId: uuid("result_id").references(() => results.id, { onDelete: "set null" }),
    pairId: uuid("pair_id").references(() => pairs.id, { onDelete: "set null" }),
    spaceId: uuid("space_id").references(() => togetherSpaces.id, { onDelete: "set null" }),
    amountKopecks: integer("amount_kopecks").notNull(),
    status: purchaseStatusEnum("status").notNull().default("pending"),
    yookassaPaymentId: text("yookassa_payment_id").unique(),
    confirmationUrl: text("confirmation_url"),
    createdAt: createdAt(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    // Почта только для чека «Мой налог»: стирается, когда чек отправлен или пользователь удалил данные
    receiptEmail: text("receipt_email"),
    receiptSentAt: timestamp("receipt_sent_at", { withTimezone: true }),
  },
  (t) => [
    index("purchases_result_idx").on(t.resultId),
    index("purchases_pair_idx").on(t.pairId),
    index("purchases_space_idx").on(t.spaceId),
    index("purchases_user_idx").on(t.userId, t.createdAt),
    check("purchases_at_most_one_target", sql`num_nonnulls(${t.resultId}, ${t.pairId}, ${t.spaceId}) <= 1`),
  ],
);

// Журнал оплаченных интервалов: уникальный purchase_id делает выдачу доступа идемпотентной
export const togetherAccessPeriods = pgTable(
  "together_access_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => togetherSpaces.id, { onDelete: "cascade" }),
    purchaseId: uuid("purchase_id")
      .notNull()
      .unique()
      .references(() => purchases.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("together_access_periods_space_idx").on(t.spaceId, t.startsAt), check("together_access_periods_positive", sql`${t.endsAt} > ${t.startsAt}`)],
);

export const togetherAnswerStatusEnum = pgEnum("together_answer_status", ["submitted", "skipped"]);
export type TogetherAnswerStatus = (typeof togetherAnswerStatusEnum.enumValues)[number];

// Карточка пары: снимок хранится в строке, поэтому правка каталога не меняет уже выданное
export const togetherCards = pgTable(
  "together_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => togetherSpaces.id, { onDelete: "cascade" }),
    cardId: text("card_id").notNull(),
    position: integer("position").notNull(),
    snapshot: jsonb("snapshot").$type<CardSnapshot>().notNull(),
    createdAt: createdAt(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("together_cards_space_position_uq").on(t.spaceId, t.position),
    uniqueIndex("together_cards_space_card_uq").on(t.spaceId, t.cardId),
    // Опора составных ключей: ответ и отметка не могут указать на карточку чужого пространства.
    // Ограничение, а не индекс: оно создаётся вместе с таблицей, до внешних ключей
    unique("together_cards_id_space_uq").on(t.id, t.spaceId),
    // У пары не больше одной открытой карточки
    uniqueIndex("together_cards_open_uq")
      .on(t.spaceId)
      .where(sql`${t.closedAt} is null`),
    check("together_cards_position_positive", sql`${t.position} >= 1`),
  ],
);

export const togetherAnswers = pgTable(
  "together_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id").notNull(),
    spaceId: uuid("space_id").notNull(),
    userId: uuid("user_id").notNull(),
    status: togetherAnswerStatusEnum("status").notNull(),
    fields: jsonb("fields").$type<AnswerFields>().notNull().default({}),
    revision: integer("revision").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ columns: [t.cardId, t.spaceId], foreignColumns: [togetherCards.id, togetherCards.spaceId] }).onDelete("cascade"),
    // Автор — участник именно этого пространства
    foreignKey({ columns: [t.spaceId, t.userId], foreignColumns: [togetherMembers.spaceId, togetherMembers.userId] }),
    uniqueIndex("together_answers_card_user_uq").on(t.cardId, t.userId),
    check("together_answers_revision_positive", sql`${t.revision} >= 1`),
    check("together_answers_skipped_empty", sql`${t.status} <> 'skipped' or ${t.fields} = '{}'::jsonb`),
  ],
);

// Личные отметки: «я посмотрел итог» (строка есть ⇔ посмотрел) и «мы это сделали вместе».
// Нужны отдельно от ответов: у того, кто не отвечал, строки ответа нет, а итог пропуска партнёра показать нужно
export const togetherCardMarks = pgTable(
  "together_card_marks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id").notNull(),
    spaceId: uuid("space_id").notNull(),
    userId: uuid("user_id").notNull(),
    seenAt: timestamp("seen_at", { withTimezone: true }).notNull(),
    doneAt: timestamp("done_at", { withTimezone: true }),
  },
  (t) => [
    foreignKey({ columns: [t.cardId, t.spaceId], foreignColumns: [togetherCards.id, togetherCards.spaceId] }).onDelete("cascade"),
    foreignKey({ columns: [t.spaceId, t.userId], foreignColumns: [togetherMembers.spaceId, togetherMembers.userId] }),
    uniqueIndex("together_card_marks_card_user_uq").on(t.cardId, t.userId),
  ],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resultId: uuid("result_id").references(() => results.id, { onDelete: "cascade" }),
    pairId: uuid("pair_id").references(() => pairs.id, { onDelete: "cascade" }),
    kind: reportKindEnum("kind").notNull(),
    sections: jsonb("sections").notNull(),
    source: reportSourceEnum("source").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("reports_result_kind_uq").on(t.resultId, t.kind).where(sql`${t.resultId} is not null`),
    uniqueIndex("reports_pair_kind_uq").on(t.pairId, t.kind).where(sql`${t.pairId} is not null`),
    check("reports_one_target", sql`num_nonnulls(${t.resultId}, ${t.pairId}) = 1`),
  ],
);

// Результат теста до входа, переносимый в другой браузер по короткому коду (встроенный браузер ВК → Safari)
export const pendingHandoffs = pgTable(
  "pending_handoffs",
  {
    code: text("code").primaryKey(),
    pendingToken: text("pending_token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("pending_handoffs_expires_idx").on(t.expiresAt)],
);
