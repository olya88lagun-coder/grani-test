CREATE TYPE "public"."pair_invite_status" AS ENUM('open', 'accepted');--> statement-breakpoint
CREATE TABLE "friend_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invite_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"device_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_id" uuid NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_result_id_unique" UNIQUE("result_id"),
	CONSTRAINT "invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "pair_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"inviter_user_id" uuid NOT NULL,
	"inviter_result_id" uuid NOT NULL,
	"status" "pair_invite_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pair_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "pairs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invite_id" uuid NOT NULL,
	"user_a_id" uuid NOT NULL,
	"result_a_id" uuid NOT NULL,
	"user_b_id" uuid NOT NULL,
	"result_b_id" uuid NOT NULL,
	"partner_consent_at" timestamp with time zone NOT NULL,
	"left_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pairs_invite_id_unique" UNIQUE("invite_id"),
	CONSTRAINT "pairs_different_users" CHECK ("pairs"."user_a_id" <> "pairs"."user_b_id")
);
--> statement-breakpoint
ALTER TABLE "auth_identities" ADD COLUMN "can_notify" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "friend_responses" ADD CONSTRAINT "friend_responses_invite_id_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."invites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_result_id_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pair_invites" ADD CONSTRAINT "pair_invites_inviter_user_id_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pair_invites" ADD CONSTRAINT "pair_invites_inviter_result_id_results_id_fk" FOREIGN KEY ("inviter_result_id") REFERENCES "public"."results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairs" ADD CONSTRAINT "pairs_invite_id_pair_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."pair_invites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairs" ADD CONSTRAINT "pairs_user_a_id_users_id_fk" FOREIGN KEY ("user_a_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairs" ADD CONSTRAINT "pairs_result_a_id_results_id_fk" FOREIGN KEY ("result_a_id") REFERENCES "public"."results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairs" ADD CONSTRAINT "pairs_user_b_id_users_id_fk" FOREIGN KEY ("user_b_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairs" ADD CONSTRAINT "pairs_result_b_id_results_id_fk" FOREIGN KEY ("result_b_id") REFERENCES "public"."results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "friend_responses_invite_device_uq" ON "friend_responses" USING btree ("invite_id","device_hash");--> statement-breakpoint
CREATE INDEX "pair_invites_result_idx" ON "pair_invites" USING btree ("inviter_result_id");--> statement-breakpoint
CREATE INDEX "pairs_user_a_idx" ON "pairs" USING btree ("user_a_id");--> statement-breakpoint
CREATE INDEX "pairs_user_b_idx" ON "pairs" USING btree ("user_b_id");