ALTER TABLE "events" ADD COLUMN "is_excluded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "is_excluded" boolean DEFAULT false NOT NULL;