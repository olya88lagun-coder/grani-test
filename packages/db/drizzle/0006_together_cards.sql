CREATE TYPE "public"."together_answer_status" AS ENUM('submitted', 'skipped');--> statement-breakpoint
CREATE TABLE "together_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"space_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "together_answer_status" NOT NULL,
	"fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "together_answers_revision_positive" CHECK ("together_answers"."revision" >= 1),
	CONSTRAINT "together_answers_skipped_empty" CHECK ("together_answers"."status" <> 'skipped' or "together_answers"."fields" = '{}'::jsonb)
);
--> statement-breakpoint
CREATE TABLE "together_card_marks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"space_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"seen_at" timestamp with time zone NOT NULL,
	"done_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "together_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"card_id" text NOT NULL,
	"position" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "together_cards_id_space_uq" UNIQUE("id","space_id"),
	CONSTRAINT "together_cards_position_positive" CHECK ("together_cards"."position" >= 1)
);
--> statement-breakpoint
ALTER TABLE "together_answers" ADD CONSTRAINT "together_answers_card_id_space_id_together_cards_id_space_id_fk" FOREIGN KEY ("card_id","space_id") REFERENCES "public"."together_cards"("id","space_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "together_answers" ADD CONSTRAINT "together_answers_space_id_user_id_together_members_space_id_user_id_fk" FOREIGN KEY ("space_id","user_id") REFERENCES "public"."together_members"("space_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "together_card_marks" ADD CONSTRAINT "together_card_marks_card_id_space_id_together_cards_id_space_id_fk" FOREIGN KEY ("card_id","space_id") REFERENCES "public"."together_cards"("id","space_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "together_card_marks" ADD CONSTRAINT "together_card_marks_space_id_user_id_together_members_space_id_user_id_fk" FOREIGN KEY ("space_id","user_id") REFERENCES "public"."together_members"("space_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "together_cards" ADD CONSTRAINT "together_cards_space_id_together_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."together_spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "together_answers_card_user_uq" ON "together_answers" USING btree ("card_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "together_card_marks_card_user_uq" ON "together_card_marks" USING btree ("card_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "together_cards_space_position_uq" ON "together_cards" USING btree ("space_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "together_cards_space_card_uq" ON "together_cards" USING btree ("space_id","card_id");--> statement-breakpoint
CREATE UNIQUE INDEX "together_cards_open_uq" ON "together_cards" USING btree ("space_id") WHERE "together_cards"."closed_at" is null;