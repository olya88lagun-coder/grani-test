ALTER TYPE "public"."product" ADD VALUE 'attachment_solo';--> statement-breakpoint
CREATE TABLE "short_test_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"test_slug" text NOT NULL,
	"answers" jsonb NOT NULL,
	"scores" jsonb NOT NULL,
	"type_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchases" DROP CONSTRAINT "purchases_at_most_one_target";--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "short_result_id" uuid;--> statement-breakpoint
ALTER TABLE "short_test_results" ADD CONSTRAINT "short_test_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "short_test_results_user_test_idx" ON "short_test_results" USING btree ("user_id","test_slug","created_at");--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_short_result_id_short_test_results_id_fk" FOREIGN KEY ("short_result_id") REFERENCES "public"."short_test_results"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchases_short_result_idx" ON "purchases" USING btree ("short_result_id");--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_at_most_one_target" CHECK (num_nonnulls("purchases"."result_id", "purchases"."pair_id", "purchases"."space_id", "purchases"."short_result_id") <= 1);