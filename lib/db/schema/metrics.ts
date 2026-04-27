import {
  pgTable,
  text,
  timestamp,
  date,
  bigint,
  numeric,
  jsonb,
  integer,
  unique,
  index,
} from "drizzle-orm/pg-core";

import { connections } from "./connections";

// Per-day, per-campaign normalized metrics across all platforms. The
// `source` column duplicates connection.connectorId for query convenience
// (so dashboards can filter by source without joining).
//
// `campaignId` is null for account-level rollups; we rely on Postgres
// `NULLS NOT DISTINCT` (Postgres 15+) so the unique index treats two null
// campaign_ids on the same (connection, date) as a duplicate.
//
// `rawData` is a per-source JSONB blob preserving fields we don't (yet)
// promote to typed columns.
export const dailyMetrics = pgTable(
  "daily_metric",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),

    source: text("source").notNull(),
    date: date("date", { mode: "string" }).notNull(),

    campaignId: text("campaign_id"),
    campaignName: text("campaign_name"),

    impressions: bigint("impressions", { mode: "number" }),
    clicks: bigint("clicks", { mode: "number" }),
    spend: numeric("spend", { precision: 14, scale: 4 }),
    conversions: numeric("conversions", { precision: 14, scale: 4 }),
    revenue: numeric("revenue", { precision: 14, scale: 4 }),

    rawData: jsonb("raw_data").notNull().default({}),

    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("daily_metric_dedup")
      .on(t.connectionId, t.date, t.campaignId)
      .nullsNotDistinct(),
    index("daily_metric_source_date_idx").on(t.source, t.date),
  ],
);

export type DailyMetric = typeof dailyMetrics.$inferSelect;
export type NewDailyMetric = typeof dailyMetrics.$inferInsert;

// One row per sync attempt. Lets us audit failures and avoid re-syncing
// date ranges that already finished successfully.
export const syncRuns = pgTable(
  "sync_run",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),

    startedAt: timestamp("started_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { mode: "date", withTimezone: true }),
    status: text("status")
      .$type<"running" | "success" | "error">()
      .notNull()
      .default("running"),

    rangeStart: date("range_start", { mode: "string" }),
    rangeEnd: date("range_end", { mode: "string" }),

    recordsCount: integer("records_count"),
    errorMessage: text("error_message"),
  },
  (t) => [
    index("sync_run_connection_started_idx").on(t.connectionId, t.startedAt),
  ],
);

export type SyncRun = typeof syncRuns.$inferSelect;
export type NewSyncRun = typeof syncRuns.$inferInsert;
