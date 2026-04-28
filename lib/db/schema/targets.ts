import {
  pgTable,
  text,
  timestamp,
  integer,
  bigint,
  unique,
  index,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

// Per-month, per-metric target values set by the user. Used by the
// Website Performance slide to render "actual vs target" bar charts.
//
// Keep one row per (userId, year, month, metric). Currently we only ship
// the `sessions` metric — the column is kept open-typed so future
// targets (leads, conversions, organic_clicks, ...) don't need a schema
// change.
export const monthlyTargets = pgTable(
  "monthly_target",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    year: integer("year").notNull(),
    month: integer("month").notNull(), // 1–12 (calendar month)
    metric: text("metric").notNull(), // "sessions" for now
    value: bigint("value", { mode: "number" }).notNull(),

    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("monthly_target_dedup").on(t.userId, t.year, t.month, t.metric),
    index("monthly_target_user_idx").on(t.userId),
  ],
);

export type MonthlyTarget = typeof monthlyTargets.$inferSelect;
export type NewMonthlyTarget = typeof monthlyTargets.$inferInsert;
