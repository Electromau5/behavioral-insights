CREATE TABLE "personas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_id" uuid NOT NULL REFERENCES "sites"("id"),
  "period" text NOT NULL,
  "data" jsonb NOT NULL,
  "generated_at" timestamp DEFAULT now() NOT NULL
);
