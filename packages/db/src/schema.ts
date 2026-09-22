import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { REPORT_KINDS } from "@grani/core";

export const authProviderEnum = pgEnum("auth_provider", ["telegram", "vk"]);
export const genderEnum = pgEnum("gender", ["female", "male"]);

export type AuthProvider = (typeof authProviderEnum.enumValues)[number];

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  gender: genderEnum("gender"),
  consentVersion: text("consent_version").notNull(),
  consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
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

export const productEnum = pgEnum("product", [
  "full",
  "chapter_money",
  "chapter_conflict",
  "chapter_stress",
  "chapter_relationships",
  "chapters_all",
  "pair",
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
    amountKopecks: integer("amount_kopecks").notNull(),
    status: purchaseStatusEnum("status").notNull().default("pending"),
    yookassaPaymentId: text("yookassa_payment_id").unique(),
    confirmationUrl: text("confirmation_url"),
    createdAt: createdAt(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [
    index("purchases_result_idx").on(t.resultId),
    index("purchases_pair_idx").on(t.pairId),
    index("purchases_user_idx").on(t.userId, t.createdAt),
    check("purchases_at_most_one_target", sql`num_nonnulls(${t.resultId}, ${t.pairId}) <= 1`),
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
