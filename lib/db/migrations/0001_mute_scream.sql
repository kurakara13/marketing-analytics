CREATE TABLE "connection" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"connector_id" text NOT NULL,
	"external_account_id" text NOT NULL,
	"external_account_name" text,
	"encrypted_refresh_token" text,
	"encrypted_access_token" text,
	"access_token_expires_at" timestamp,
	"scope" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_metric" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"source" text NOT NULL,
	"date" date NOT NULL,
	"campaign_id" text,
	"campaign_name" text,
	"impressions" bigint,
	"clicks" bigint,
	"spend" numeric(14, 4),
	"conversions" numeric(14, 4),
	"revenue" numeric(14, 4),
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "daily_metric_dedup" UNIQUE NULLS NOT DISTINCT("connection_id","date","campaign_id")
);
--> statement-breakpoint
CREATE TABLE "sync_run" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"status" text DEFAULT 'running' NOT NULL,
	"range_start" date,
	"range_end" date,
	"records_count" integer,
	"error_message" text
);
--> statement-breakpoint
ALTER TABLE "connection" ADD CONSTRAINT "connection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_metric" ADD CONSTRAINT "daily_metric_connection_id_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_run" ADD CONSTRAINT "sync_run_connection_id_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "connection_user_connector_account_unique" ON "connection" USING btree ("user_id","connector_id","external_account_id");--> statement-breakpoint
CREATE INDEX "connection_user_idx" ON "connection" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "daily_metric_source_date_idx" ON "daily_metric" USING btree ("source","date");--> statement-breakpoint
CREATE INDEX "sync_run_connection_started_idx" ON "sync_run" USING btree ("connection_id","started_at");