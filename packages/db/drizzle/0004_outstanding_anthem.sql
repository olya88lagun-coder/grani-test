ALTER TABLE "purchases" ADD COLUMN "receipt_email" text;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "receipt_sent_at" timestamp with time zone;