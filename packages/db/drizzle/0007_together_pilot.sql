CREATE TYPE "public"."together_pilot_source" AS ENUM('code', 'invite');--> statement-breakpoint
CREATE TABLE "together_pilot_passes" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"source" "together_pilot_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "together_pilot_passes" ADD CONSTRAINT "together_pilot_passes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;