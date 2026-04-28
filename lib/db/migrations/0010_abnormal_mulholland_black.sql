CREATE TABLE "insight_drilldown" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"insight_id" text NOT NULL,
	"observation_index" integer NOT NULL,
	"content" jsonb NOT NULL,
	"model_used" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "insight_drilldown" ADD CONSTRAINT "insight_drilldown_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_drilldown" ADD CONSTRAINT "insight_drilldown_insight_id_insight_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insight"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "insight_drilldown_target_idx" ON "insight_drilldown" USING btree ("insight_id","observation_index");--> statement-breakpoint
CREATE INDEX "insight_drilldown_user_idx" ON "insight_drilldown" USING btree ("user_id");