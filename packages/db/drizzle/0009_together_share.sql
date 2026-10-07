ALTER TABLE "together_spaces" ADD COLUMN "share_code" text;--> statement-breakpoint
ALTER TABLE "together_spaces" ADD COLUMN "referred_by_space_id" uuid;--> statement-breakpoint
ALTER TABLE "together_spaces" ADD CONSTRAINT "together_spaces_referred_by_space_id_together_spaces_id_fk" FOREIGN KEY ("referred_by_space_id") REFERENCES "public"."together_spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "together_spaces" ADD CONSTRAINT "together_spaces_share_code_unique" UNIQUE("share_code");