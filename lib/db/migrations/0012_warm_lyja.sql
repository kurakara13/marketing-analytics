CREATE TABLE "drilldown_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"drilldown_id" text NOT NULL,
	"kind" text NOT NULL,
	"item_index" integer NOT NULL,
	"rating" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drilldown_feedback" ADD CONSTRAINT "drilldown_feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drilldown_feedback" ADD CONSTRAINT "drilldown_feedback_drilldown_id_insight_drilldown_id_fk" FOREIGN KEY ("drilldown_id") REFERENCES "public"."insight_drilldown"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "drilldown_feedback_unique" ON "drilldown_feedback" USING btree ("user_id","drilldown_id","kind","item_index");--> statement-breakpoint
CREATE INDEX "drilldown_feedback_drilldown_idx" ON "drilldown_feedback" USING btree ("drilldown_id");