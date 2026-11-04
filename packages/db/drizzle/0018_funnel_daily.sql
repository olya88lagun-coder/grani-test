CREATE TABLE "funnel_daily" (
	"day" text NOT NULL,
	"step" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "funnel_daily_day_step" UNIQUE("day","step")
);
