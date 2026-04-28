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
  /** GA4 event name that the user considers a "lead" (e.g.
   *  "generate_lead", "form_submit", "book_demo"). When set, the AI
   *  is told to use this term consistently when discussing leads. */
  leadEventName: text("lead_event_name"),

  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UserBusinessContext = typeof userBusinessContext.$inferSelect;
export type NewUserBusinessContext = typeof userBusinessContext.$inferInsert;
