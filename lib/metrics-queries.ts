import { and, eq, gte, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { connections, dailyMetrics } from "@/lib/db/schema";

// Aggregations powering /dashboard. We pull all rows in the window into
// memory and reduce in JS — fine for the expected scale (one user × few
// connectors × ~30 days × handful of campaigns = at most a few thousand
// rows). Switch to SQL aggregation if this ever exceeds ~50k rows.

export type MetricsTotals = {
  sessions: number;
  pageviews: number;
  conversions: number;
  revenue: number;
  impressions: number;
  clicks: number;
  spend: number;
};

export type DailyPoint = MetricsTotals & {
  date: string;
};

export type MetricsSummary = {
  totals: MetricsTotals;
  daily: DailyPoint[];
  hasData: boolean;
  connectedSources: number;
  windowDays: number;
};

const ZERO_TOTALS: MetricsTotals = {
  sessions: 0,
  pageviews: 0,
  conversions: 0,
  revenue: 0,
  impressions: 0,
  clicks: 0,
  spend: 0,
};

function isoDateNDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function asNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function getMetricsSummary(args: {
  userId: string;
  days: number;
}): Promise<MetricsSummary> {
  const { userId, days } = args;
  const sinceDate = isoDateNDaysAgo(days);

  const userConnections = await db
    .select()
    .from(connections)
    .where(eq(connections.userId, userId));

  const realConnections = userConnections.filter(
    (c) => !c.externalAccountId.startsWith("_pending_"),
  );

  if (realConnections.length === 0) {
    return {
      totals: { ...ZERO_TOTALS },
      daily: [],
      hasData: false,
      connectedSources: 0,
      windowDays: days,
    };
  }

  const rows = await db
    .select()
    .from(dailyMetrics)
    .where(
      and(
        inArray(
          dailyMetrics.connectionId,
          realConnections.map((c) => c.id),
        ),
        gte(dailyMetrics.date, sinceDate),
      ),
    );

  const dailyMap = new Map<string, DailyPoint>();
  for (const row of rows) {
    const point = dailyMap.get(row.date) ?? {
      date: row.date,
      ...ZERO_TOTALS,
    };

    point.conversions += asNumber(row.conversions);
    point.revenue += asNumber(row.revenue);
    point.impressions += asNumber(row.impressions);
    point.clicks += asNumber(row.clicks);
    point.spend += asNumber(row.spend);

    // Source-specific metrics that don't have typed columns yet live in
    // raw_data. GA4 uses these names; when we add more sources we can
    // add their equivalents (or promote to typed columns).
    const raw = row.rawData as Record<string, unknown> | null;
    if (raw) {
      point.sessions += asNumber(raw.sessions);
      point.pageviews += asNumber(raw.screenPageViews);
    }

    dailyMap.set(row.date, point);
  }

  const daily = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const totals: MetricsTotals = daily.reduce(
    (acc, p) => ({
      sessions: acc.sessions + p.sessions,
      pageviews: acc.pageviews + p.pageviews,
      conversions: acc.conversions + p.conversions,
      revenue: acc.revenue + p.revenue,
      impressions: acc.impressions + p.impressions,
      clicks: acc.clicks + p.clicks,
      spend: acc.spend + p.spend,
    }),
    { ...ZERO_TOTALS },
  );

  return {
    totals,
    daily,
    hasData: rows.length > 0,
    connectedSources: realConnections.length,
    windowDays: days,
  };
}
