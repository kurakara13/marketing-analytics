import {
  pgTable,
  text,
  timestamp,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { insightDrilldowns } from "./insight-drilldown";

// Per-element feedback inside a drill-down's hypotheses[] and fixes[]
// arrays. Same shape as insight_feedback but keyed by drilldownId so
// the two signal streams stay separate (insight-level feedback feeds
// the prompt cache; drilldown-level feedback is currently just stored
// for later prompt tuning).

export const drilldownFeedback = pgTable(
  "drilldown_feedback",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    drilldownId: text("drilldown_id")
      .notNull()
      .references(() => insightDrilldowns.id, { onDelete: "cascade" }),

    /** Which array inside the drilldown the index refers to. */
    kind: text("kind").$type<"hypothesis" | "fix">().notNull(),
    /** Zero-based index into hypotheses[] / fixes[]. */
    itemIndex: integer("item_index").notNull(),

    /** -1 thumbs down, +1 thumbs up. 0 reserved for cleared. */
    rating: integer("rating").notNull(),

    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("drilldown_feedback_unique").on(
      t.userId,
      t.drilldownId,
      t.kind,
      t.itemIndex,
    ),
    index("drilldown_feedback_drilldown_idx").on(t.drilldownId),
  ],
);

export type DrilldownFeedback = typeof drilldownFeedback.$inferSelect;
