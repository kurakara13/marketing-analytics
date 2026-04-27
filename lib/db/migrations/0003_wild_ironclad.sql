CREATE TABLE "insight" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"window_days" integer NOT NULL,
	"window_start" date NOT NULL,
	"window_end" date NOT NULL,
	"executive_summary" text NOT NULL,
	"observations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommendations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"input_snapshot" jsonb NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cache_read_tokens" integer,
	"model_used" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "insight" ADD CONSTRAINT "insight_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "insight_user_created_idx" ON "insight" USING btree ("user_id","created_at");