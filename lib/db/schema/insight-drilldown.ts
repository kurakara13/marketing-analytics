import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { insights } from "./insights";

// Cached drill-down analysis on a specific observation. The drill-down
// is a focused GPT-5 run that takes ONE observation from a parent
// insight and digs deeper: cites supporting evidence, proposes ranked
// hypotheses for the root cause, and recommends concrete fix steps
// with platform-specific instructions (GA4 Admin paths, Google Ads
// settings, etc).
//
// Cache strategy: keyed by (insightId, observationIndex). Re-running
// drilldown on the same observation overwrites the cached row.

export type DrilldownEvidence = {
  type: "data_point" | "pattern" | "absence";
  description: string;
};

export type DrilldownHypothesis = {
  title: string;
  likelihood: "high" | "medium" | "low";
  reasoning: string;
};

export type DrilldownFix = {
  title: string;
  steps: string[];
  /** Platform-specific path the user has to navigate to apply the fix
   *  (e.g. "GA4 Admin → Data Streams → Web → Configure tag settings →
   *  Define internal traffic"). */
  where: string | null;
};

export type DrilldownContent = {
  /** Restate the focus area in one short paragraph so the user can
   *  re-anchor when they re-open the drilldown later. */
  summary: string;
  evidence: DrilldownEvidence[];
  hypotheses: DrilldownHypothesis[];
  fixes: DrilldownFix[];
};

export const insightDrilldowns = pgTable(
  "insight_drilldown",
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
    /** 0-based index into the parent insight's observations[] array. */
    observationIndex: integer("observation_index").notNull(),

    content: jsonb("content").notNull().$type<DrilldownContent>(),
    modelUsed: text("model_used").notNull(),

    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),

    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("insight_drilldown_target_idx").on(t.insightId, t.observationIndex),
    index("insight_drilldown_user_idx").on(t.userId),
  ],
);

export type InsightDrilldown = typeof insightDrilldowns.$inferSelect;
export type NewInsightDrilldown = typeof insightDrilldowns.$inferInsert;
