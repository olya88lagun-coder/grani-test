CREATE TYPE "public"."product" AS ENUM('full', 'chapter_money', 'chapter_conflict', 'chapter_stress', 'chapter_relationships', 'chapters_all', 'pair');--> statement-breakpoint
CREATE TYPE "public"."purchase_status" AS ENUM('pending', 'succeeded', 'canceled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."report_kind" AS ENUM('full', 'friends', 'chapter_money', 'chapter_conflict', 'chapter_stress', 'chapter_relationships', 'pair');--> statement-breakpoint
CREATE TYPE "public"."report_source" AS ENUM('ai', 'fallback');--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product" "product" NOT NULL,
	"result_id" uuid,
	"pair_id" uuid,
	"amount_kopecks" integer NOT NULL,
	"status" "purchase_status" DEFAULT 'pending' NOT NULL,
	"yookassa_payment_id" text,
	"confirmation_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "purchases_yookassa_payment_id_unique" UNIQUE("yookassa_payment_id"),
	CONSTRAINT "purchases_at_most_one_target" CHECK (num_nonnulls("purchases"."result_id", "purchases"."pair_id") <= 1)
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_id" uuid,
	"pair_id" uuid,
	"kind" "report_kind" NOT NULL,
	"sections" jsonb NOT NULL,
	"source" "report_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_one_target" CHECK (num_nonnulls("reports"."result_id", "reports"."pair_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_result_id_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."results"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_pair_id_pairs_id_fk" FOREIGN KEY ("pair_id") REFERENCES "public"."pairs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_result_id_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_pair_id_pairs_id_fk" FOREIGN KEY ("pair_id") REFERENCES "public"."pairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchases_result_idx" ON "purchases" USING btree ("result_id");--> statement-breakpoint
CREATE INDEX "purchases_pair_idx" ON "purchases" USING btree ("pair_id");--> statement-breakpoint
CREATE INDEX "purchases_user_idx" ON "purchases" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_result_kind_uq" ON "reports" USING btree ("result_id","kind") WHERE "reports"."result_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "reports_pair_kind_uq" ON "reports" USING btree ("pair_id","kind") WHERE "reports"."pair_id" is not null;