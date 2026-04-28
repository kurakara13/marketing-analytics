import {
  pgTable,
  text,
  timestamp,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { insights } from "./insights";

// Feedback the user gave on individual observations / recommendations
// of an AI-generated insight. We use this signal later to (a) summarize
// which insight angles the user finds most useful in their dashboard,
// and (b) eventually feed it back into prompt tuning. Currently the
// data is stored but not yet acted upon by the prompt builder.
//
// Targeting: each observation/recommendation is identified by its index
// in the insight's array (the array is immutable once generated, so the
// index is stable for the lifetime of the insight row). `kind` tells
// us which array we're indexing into.
export const insightFeedback = pgTable(
  "insight_feedback",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    insightId: text("insight_id")
      .notNull()
      .references(() => insights.id, { onDelete: "cascade" }),

    /** Which list inside the insight the index refers to. */
    kind: text("kind").$type<"observation" | "recommendation">().notNull(),
    /** Zero-based index into observations[] / recommendations[]. */
    itemIndex: integer("item_index").notNull(),

    /** -1 = thumbs down, +1 = thumbs up. We store as integer so we can
     *  toggle via single upsert (replace value), and so any future
     *  "more granular" rating fits the same column type. */
    rating: integer("rating").notNull(),

    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("insight_feedback_unique").on(
      t.userId,
      t.insightId,
      t.kind,
      t.itemIndex,
    ),
    index("insight_feedback_insight_idx").on(t.insightId),
  ],
);

export type InsightFeedback = typeof insightFeedback.$inferSelect;
export type NewInsightFeedback = typeof insightFeedback.$inferInsert;
