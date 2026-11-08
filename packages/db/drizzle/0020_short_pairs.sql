ALTER TYPE "public"."product" ADD VALUE 'attachment_pair';--> statement-breakpoint
ALTER TYPE "public"."product" ADD VALUE 'attachment_pair_discount';--> statement-breakpoint
CREATE TABLE "short_pair_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"test_slug" text NOT NULL,
	"inviter_user_id" uuid NOT NULL,
	"inviter_short_result_id" uuid NOT NULL,
	"status" "pair_invite_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "short_pair_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "short_pairs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invite_id" uuid NOT NULL,
	"test_slug" text NOT NULL,
	"user_a_id" uuid NOT NULL,
	"short_result_a_id" uuid NOT NULL,
	"user_b_id" uuid NOT NULL,
	"short_result_b_id" uuid NOT NULL,
	"partner_consent_at" timestamp with time zone NOT NULL,
	"partner_consent_version" text NOT NULL,
	"left_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "short_pairs_invite_id_unique" UNIQUE("invite_id"),
	CONSTRAINT "short_pairs_different_users" CHECK ("short_pairs"."user_a_id" <> "short_pairs"."user_b_id")
);
--> statement-breakpoint
ALTER TABLE "purchases" DROP CONSTRAINT "purchases_at_most_one_target";--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "short_pair_id" uuid;--> statement-breakpoint
ALTER TABLE "short_pair_invites" ADD CONSTRAINT "short_pair_invites_inviter_user_id_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_pair_invites" ADD CONSTRAINT "short_pair_invites_inviter_short_result_id_short_test_results_id_fk" FOREIGN KEY ("inviter_short_result_id") REFERENCES "public"."short_test_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_pairs" ADD CONSTRAINT "short_pairs_invite_id_short_pair_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."short_pair_invites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_pairs" ADD CONSTRAINT "short_pairs_user_a_id_users_id_fk" FOREIGN KEY ("user_a_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_pairs" ADD CONSTRAINT "short_pairs_short_result_a_id_short_test_results_id_fk" FOREIGN KEY ("short_result_a_id") REFERENCES "public"."short_test_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_pairs" ADD CONSTRAINT "short_pairs_user_b_id_users_id_fk" FOREIGN KEY ("user_b_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_pairs" ADD CONSTRAINT "short_pairs_short_result_b_id_short_test_results_id_fk" FOREIGN KEY ("short_result_b_id") REFERENCES "public"."short_test_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "short_pair_invites_result_idx" ON "short_pair_invites" USING btree ("inviter_short_result_id");--> statement-breakpoint
CREATE INDEX "short_pairs_user_a_idx" ON "short_pairs" USING btree ("user_a_id");--> statement-breakpoint
CREATE INDEX "short_pairs_user_b_idx" ON "short_pairs" USING btree ("user_b_id");--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_short_pair_id_short_pairs_id_fk" FOREIGN KEY ("short_pair_id") REFERENCES "public"."short_pairs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchases_short_pair_idx" ON "purchases" USING btree ("short_pair_id");--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_at_most_one_target" CHECK (num_nonnulls("purchases"."result_id", "purchases"."pair_id", "purchases"."space_id", "purchases"."short_result_id", "purchases"."short_pair_id") <= 1);