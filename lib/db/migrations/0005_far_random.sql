CREATE TABLE "monthly_target" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"metric" text NOT NULL,
	"value" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monthly_target_dedup" UNIQUE("user_id","year","month","metric")
);
--> statement-breakpoint
ALTER TABLE "monthly_target" ADD CONSTRAINT "monthly_target_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "monthly_target_user_idx" ON "monthly_target" USING btree ("user_id");