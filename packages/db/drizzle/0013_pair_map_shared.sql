CREATE TABLE "pair_map_agreement_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agreement_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"confirmed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "pair_map_agreement_confirmations_author" UNIQUE("agreement_id","user_id"),
	CONSTRAINT "pair_map_agreement_confirmations_revision" CHECK ("pair_map_agreement_confirmations"."revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "pair_map_agreement_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pair_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	"text" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "pair_map_agreement_drafts_author_slot" UNIQUE("pair_id","user_id","slot"),
	CONSTRAINT "pair_map_agreement_drafts_valid" CHECK ("pair_map_agreement_drafts"."slot" BETWEEN 0 AND 2 AND "pair_map_agreement_drafts"."revision" > 0 AND char_length("pair_map_agreement_drafts"."text") <= 600)
);
--> statement-breakpoint
CREATE TABLE "pair_map_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pair_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	"text" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"proposer_user_id" uuid NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "pair_map_agreements_slot" UNIQUE("pair_id","slot"),
	CONSTRAINT "pair_map_agreements_valid" CHECK ("pair_map_agreements"."slot" BETWEEN 0 AND 2 AND "pair_map_agreements"."revision" > 0 AND char_length("pair_map_agreements"."text") BETWEEN 1 AND 600)
);
--> statement-breakpoint
CREATE TABLE "pair_map_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pair_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"version" text NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	CONSTRAINT "pair_map_consents_author" UNIQUE("pair_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "pair_map_surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pair_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"draft" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"published" jsonb,
	"published_revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "pair_map_surveys_author" UNIQUE("pair_id","user_id"),
	CONSTRAINT "pair_map_surveys_revisions" CHECK ("pair_map_surveys"."revision" > 0 AND "pair_map_surveys"."published_revision" >= 0)
);
--> statement-breakpoint
ALTER TABLE "pair_map_agreement_confirmations" ADD CONSTRAINT "pair_map_agreement_confirmations_agreement_id_pair_map_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."pair_map_agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pair_map_agreement_confirmations" ADD CONSTRAINT "pair_map_agreement_confirmations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pair_map_agreement_drafts" ADD CONSTRAINT "pair_map_agreement_drafts_pair_id_pairs_id_fk" FOREIGN KEY ("pair_id") REFERENCES "public"."pairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pair_map_agreement_drafts" ADD CONSTRAINT "pair_map_agreement_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pair_map_agreements" ADD CONSTRAINT "pair_map_agreements_pair_id_pairs_id_fk" FOREIGN KEY ("pair_id") REFERENCES "public"."pairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pair_map_agreements" ADD CONSTRAINT "pair_map_agreements_proposer_user_id_users_id_fk" FOREIGN KEY ("proposer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pair_map_consents" ADD CONSTRAINT "pair_map_consents_pair_id_pairs_id_fk" FOREIGN KEY ("pair_id") REFERENCES "public"."pairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pair_map_consents" ADD CONSTRAINT "pair_map_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pair_map_surveys" ADD CONSTRAINT "pair_map_surveys_pair_id_pairs_id_fk" FOREIGN KEY ("pair_id") REFERENCES "public"."pairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pair_map_surveys" ADD CONSTRAINT "pair_map_surveys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;