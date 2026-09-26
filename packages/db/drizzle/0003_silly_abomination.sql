CREATE TABLE "pending_handoffs" (
	"code" text PRIMARY KEY NOT NULL,
	"pending_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "pending_handoffs_expires_idx" ON "pending_handoffs" USING btree ("expires_at");