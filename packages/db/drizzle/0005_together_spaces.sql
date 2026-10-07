CREATE TYPE "public"."together_closed_reason" AS ENUM('left', 'account_deleted');--> statement-breakpoint
CREATE TYPE "public"."together_invite_status" AS ENUM('open', 'requested', 'accepted', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."together_role" AS ENUM('initiator', 'partner');--> statement-breakpoint
CREATE TYPE "public"."together_space_status" AS ENUM('pending', 'active', 'closed');--> statement-breakpoint
ALTER TYPE "public"."product" ADD VALUE 'together_30d';--> statement-breakpoint
CREATE TABLE "together_access_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"purchase_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "together_access_periods_purchase_id_unique" UNIQUE("purchase_id"),
	CONSTRAINT "together_access_periods_positive" CHECK ("together_access_periods"."ends_at" > "together_access_periods"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "together_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"inviter_id" uuid NOT NULL,
	"status" "together_invite_status" DEFAULT 'open' NOT NULL,
	"requester_user_id" uuid,
	"requested_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "together_invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "together_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "together_role" NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "together_spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "together_space_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" uuid,
	"closed_reason" "together_closed_reason",
	CONSTRAINT "together_spaces_closed_consistent" CHECK (("together_spaces"."status" = 'closed') = ("together_spaces"."closed_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "purchases" DROP CONSTRAINT "purchases_at_most_one_target";--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "space_id" uuid;--> statement-breakpoint
ALTER TABLE "together_access_periods" ADD CONSTRAINT "together_access_periods_space_id_together_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."together_spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "together_access_periods" ADD CONSTRAINT "together_access_periods_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "together_invites" ADD CONSTRAINT "together_invites_space_id_together_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."together_spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "together_invites" ADD CONSTRAINT "together_invites_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "together_invites" ADD CONSTRAINT "together_invites_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "together_members" ADD CONSTRAINT "together_members_space_id_together_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."together_spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "together_members" ADD CONSTRAINT "together_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "together_spaces" ADD CONSTRAINT "together_spaces_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "together_access_periods_space_idx" ON "together_access_periods" USING btree ("space_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "together_invites_live_uq" ON "together_invites" USING btree ("space_id") WHERE "together_invites"."status" in ('open', 'requested');--> statement-breakpoint
CREATE UNIQUE INDEX "together_members_space_role_uq" ON "together_members" USING btree ("space_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "together_members_space_user_uq" ON "together_members" USING btree ("space_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "together_members_active_user_uq" ON "together_members" USING btree ("user_id") WHERE "together_members"."left_at" is null;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_space_id_together_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."together_spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchases_space_idx" ON "purchases" USING btree ("space_id");--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_at_most_one_target" CHECK (num_nonnulls("purchases"."result_id", "purchases"."pair_id", "purchases"."space_id") <= 1);