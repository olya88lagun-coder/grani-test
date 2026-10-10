CREATE TABLE "personality_atlas_drafts" (
  "result_id" uuid PRIMARY KEY NOT NULL REFERENCES "results"("id") ON DELETE CASCADE,
  "revision" integer DEFAULT 1 NOT NULL,
  "data" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "personality_atlas_revision_positive" CHECK ("revision" > 0)
);
