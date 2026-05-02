import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";

// Per-user business context fed to the AI insight engine. All fields
// optional — when set, they are injected into the insights prompt so
// the model frames observations & recommendations in the user's own
// business terms instead of generic marketing speak.
//
// Single row per user (userId is PK, not FK + id). Created lazily on
// first save; absent rows are treated as "no context configured".
export const userBusinessContext = pgTable("user_business_context", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** e.g. "B2B SaaS for HR teams", "Fashion e-commerce", "Online course". */
  industry: text("industry"),
  /** e.g. "Mid-market HR managers in Indonesia", "Gen-Z female shoppers". */
  targetAudience: text("target_audience"),
  /** Tone preference for narrative output. */
  brandVoice: text("brand_voice").$type<"professional" | "casual" | "technical">(),
  /** Free-form goals — e.g. "Lower CPL below 50K, grow MQL volume 2x". */
  businessGoals: text("business_goals"),

  /** ─── Lead definition ─────────────────────────────────────────
   *  Set of GA4 event names that the user considers "leads"
   *  (qualified actions, MQL signals, dst). Stored as JSON array of
   *  strings. When set, the AI insight engine sums daily counts of
   *  these events as the "lead" metric instead of using GA4's
   *  generic `conversions` metric (which aggregates ALL events
   *  marked as conversions in the property settings).
   *
   *  Example: ["generate_lead", "ebook_download", "whatsapp_click"]
   *
   *  Empty / null = use GA4 `conversions` total as fallback. */
  leadEvents: text("lead_events").array(),
  /** Custom label the user uses to refer to the lead-equivalent
   *  metric. Defaults to "lead" but can be "MQL", "qualified action",
   *  "form submission", etc. Surfaced in AI narrative so output
   *  matches the user's vocabulary. */
  leadLabel: text("lead_label"),

  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UserBusinessContext = typeof userBusinessContext.$inferSelect;
export type NewUserBusinessContext = typeof userBusinessContext.$inferInsert;
