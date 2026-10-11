CREATE TABLE "practice_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_id" uuid NOT NULL,
	"practice_key" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_drafts_revision_positive" CHECK ("practice_drafts"."revision">0),
	CONSTRAINT "practice_drafts_version_positive" CHECK ("practice_drafts"."schema_version">0)
);
--> statement-breakpoint
ALTER TABLE "practice_drafts" ADD CONSTRAINT "practice_drafts_result_id_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "practice_drafts_result_key_uq" ON "practice_drafts" USING btree ("result_id","practice_key");
