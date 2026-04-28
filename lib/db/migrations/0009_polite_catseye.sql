ALTER TABLE "insight" ADD COLUMN "share_token" text;--> statement-breakpoint
CREATE INDEX "insight_share_token_idx" ON "insight" USING btree ("share_token");