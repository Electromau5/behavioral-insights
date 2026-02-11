CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"visitor_id" text NOT NULL,
	"event_type" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"url" text NOT NULL,
	"path" text NOT NULL,
	"referrer" text,
	"device_type" text,
	"user_agent" text,
	"screen_width" integer,
	"screen_height" integer,
	"viewport_width" integer,
	"viewport_height" integer,
	"language" text,
	"timezone" text,
	"event_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"type" text NOT NULL,
	"severity" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"metric" text,
	"value" real,
	"previous_value" real,
	"change_percent" real,
	"period_start" timestamp,
	"period_end" timestamp,
	"is_read" boolean DEFAULT false,
	"is_dismissed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screenshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"event_id" uuid,
	"path" text NOT NULL,
	"url" text NOT NULL,
	"image_data" text NOT NULL,
	"width" integer,
	"height" integer,
	"device_type" text,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" uuid NOT NULL,
	"visitor_id" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"duration" integer,
	"page_views" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"max_scroll_depth" real DEFAULT 0,
	"entry_page" text,
	"exit_page" text,
	"referrer" text,
	"device_type" text,
	"is_bounce" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"api_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"business_type" text,
	"description" text,
	"target_audience" text,
	"primary_goals" jsonb,
	"page_context" jsonb,
	CONSTRAINT "sites_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "user_flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"visitor_id" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"duration" integer,
	"total_events" integer DEFAULT 0 NOT NULL,
	"pages_visited" integer DEFAULT 0 NOT NULL,
	"total_clicks" integer DEFAULT 0 NOT NULL,
	"entry_page" text,
	"exit_page" text,
	"device_type" text,
	"country" text,
	"flow_path" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"name" text,
	"email_verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_flows" ADD CONSTRAINT "user_flows_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;