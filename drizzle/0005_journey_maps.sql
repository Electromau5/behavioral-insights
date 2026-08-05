CREATE TABLE "journey_maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL REFERENCES "sites"("id"),
	"period" text NOT NULL,
	"stages" jsonb NOT NULL,
	"summary" jsonb,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
