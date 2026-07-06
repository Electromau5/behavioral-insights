ALTER TABLE "sites" ADD COLUMN "ip_exclusion_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "excluded_ips" jsonb;