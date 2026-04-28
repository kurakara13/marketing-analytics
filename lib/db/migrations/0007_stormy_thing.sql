CREATE TABLE "user_business_context" (
	"user_id" text PRIMARY KEY NOT NULL,
	"industry" text,
	"target_audience" text,
	"brand_voice" text,
	"business_goals" text,
	"lead_event_name" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_business_context" ADD CONSTRAINT "user_business_context_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;