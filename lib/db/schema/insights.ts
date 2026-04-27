import {
  pgTable,
  text,
  timestamp,
  date,
  jsonb,
  integer,
  index,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

// One row per generated insight. We persist the input snapshot so the
// historical insight can be re-rendered without re-querying daily_metric
// (which may have changed if the user re-syncs and the source revises
// historical numbers).

export type InsightObservation = {
  title: string;
  description: string;
  severity: "info" | "warning" | "alert";
};

export type InsightRecommendation = {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
};

export type InsightInputSnapshot = {
  windowDays: number;
  windowStart: string;
  windowEnd: string;
  connectedSources: number;
  totals: Record<string, number>;
  daily: Array<Record<string, string | number>>;
};

export const insights = pgTable(
  "insight",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    windowDays: integer("window_days").notNull(),
    windowStart: date("window_start", { mode: "string" }).notNull(),
    windowEnd: date("window_end", { mode: "string" }).notNull(),

    executiveSummary: text("executive_summary").notNull(),
    observations: jsonb("observations")
      .notNull()
      .default([])
      .$type<InsightObservation[]>(),
    recommendations: jsonb("recommendations")
      .notNull()
      .default([])
      .$type<InsightRecommendation[]>(),

    inputSnapshot: jsonb("input_snapshot")
      .notNull()
      .$type<InsightInputSnapshot>(),

    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cacheReadTokens: integer("cache_read_tokens"),

    modelUsed: text("model_used").notNull(),

    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("insight_user_created_idx").on(t.userId, t.createdAt)],
);

export type Insight = typeof insights.$inferSelect;
export type NewInsight = typeof insights.$inferInsert;
