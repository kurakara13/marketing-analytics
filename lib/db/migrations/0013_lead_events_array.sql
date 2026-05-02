-- Replace single lead_event_name TEXT with multi-value lead_events
-- TEXT[] array + custom lead_label TEXT. Reasoning: a "lead" is
-- typically multiple GA4 events (generate_lead + ebook_download +
-- whatsapp_click) and varies per user. The single-event field was
-- too restrictive and silently produced wrong totals for users with
-- multiple lead-defining events.
--
-- Existing lead_event_name values are migrated into a single-element
-- array so users don't lose their setting.

ALTER TABLE "user_business_context"
  ADD COLUMN IF NOT EXISTS "lead_events" text[];

ALTER TABLE "user_business_context"
  ADD COLUMN IF NOT EXISTS "lead_label" text;

-- Migrate existing single value into array (only when set).
UPDATE "user_business_context"
  SET "lead_events" = ARRAY["lead_event_name"]
  WHERE "lead_event_name" IS NOT NULL
    AND ("lead_events" IS NULL OR cardinality("lead_events") = 0);

ALTER TABLE "user_business_context"
  DROP COLUMN IF EXISTS "lead_event_name";
