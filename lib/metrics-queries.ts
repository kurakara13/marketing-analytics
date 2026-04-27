import { and, eq, gte, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { connections, dailyMetrics, type DailyMetric } from "@/lib/db/schema";

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
  /**
   * Same totals computed for the immediately-preceding window of equal
   * length (e.g. for a 30-day window: days [60-31] before today). Used
   * by KPI cards to render period-over-period deltas.
   */
  previousTotals: MetricsTotals;
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

function rowToDelta(row: DailyMetric): MetricsTotals {
  const raw = row.rawData as Record<string, unknown> | null;
  return {
    conversions: asNumber(row.conversions),
    revenue: asNumber(row.revenue),
    impressions: asNumber(row.impressions),
    clicks: asNumber(row.clicks),
    spend: asNumber(row.spend),
    sessions: raw ? asNumber(raw.sessions) : 0,
    pageviews: raw ? asNumber(raw.screenPageViews) : 0,
  };
}

function addTotals(a: MetricsTotals, b: MetricsTotals): MetricsTotals {
  return {
    sessions: a.sessions + b.sessions,
    pageviews: a.pageviews + b.pageviews,
    conversions: a.conversions + b.conversions,
    revenue: a.revenue + b.revenue,
    impressions: a.impressions + b.impressions,
    clicks: a.clicks + b.clicks,
    spend: a.spend + b.spend,
  };
}

export async function getMetricsSummary(args: {
  userId: string;
  days: number;
}): Promise<MetricsSummary> {
  const { userId, days } = args;
  const currentSinceDate = isoDateNDaysAgo(days);
  const previousSinceDate = isoDateNDaysAgo(days * 2);

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
      previousTotals: { ...ZERO_TOTALS },
      daily: [],
      hasData: false,
      connectedSources: 0,
      windowDays: days,
    };
  }

  // Single query covering both windows (current + immediately-preceding),
  // then split in JS to avoid a second round trip.
  const rows = await db
    .select()
    .from(dailyMetrics)
    .where(
      and(
        inArray(
          dailyMetrics.connectionId,
          realConnections.map((c) => c.id),
        ),
        gte(dailyMetrics.date, previousSinceDate),
      ),
    );

  const dailyMap = new Map<string, DailyPoint>();
  let previousTotals: MetricsTotals = { ...ZERO_TOTALS };

  for (const row of rows) {
    const delta = rowToDelta(row);

    if (row.date >= currentSinceDate) {
      const point = dailyMap.get(row.date) ?? {
        date: row.date,
        ...ZERO_TOTALS,
      };
      dailyMap.set(row.date, addTotalsInto(point, delta));
    } else {
      previousTotals = addTotals(previousTotals, delta);
    }
  }

  const daily = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const totals: MetricsTotals = daily.reduce((acc, p) => addTotals(acc, p), {
    ...ZERO_TOTALS,
  });

  return {
    totals,
    previousTotals,
    daily,
    // hasData reflects the current window only; previous-window data is
    // additive context, not required for the dashboard to render.
    hasData: daily.length > 0,
    connectedSources: realConnections.length,
    windowDays: days,
  };
}

function addTotalsInto<T extends MetricsTotals>(
  point: T,
  delta: MetricsTotals,
): T {
  point.sessions += delta.sessions;
  point.pageviews += delta.pageviews;
  point.conversions += delta.conversions;
  point.revenue += delta.revenue;
  point.impressions += delta.impressions;
  point.clicks += delta.clicks;
  point.spend += delta.spend;
  return point;
}

export type CampaignRow = MetricsTotals & {
  /** Stable composite key for React lists. */
  key: string;
  source: string;
  /** External account display name (from connection.externalAccountName). */
  accountName: string;
  /** Bare external account id. */
  accountId: string;
  /** Null for account-level rollup rows (e.g. GA4 with no campaign dimension). */
  campaignId: string | null;
  /** Null when campaignId is null. */
  campaignName: string | null;
};

/**
 * Aggregate daily_metric over the window, grouped by (connection,
 * campaign). Returns rows sorted by spend desc (then clicks desc) so the
 * highest-impact campaigns surface first.
 */
export async function getCampaignBreakdown(args: {
  userId: string;
  days: number;
}): Promise<CampaignRow[]> {
  const { userId, days } = args;
  const sinceDate = isoDateNDaysAgo(days);

  const userConnections = await db
    .select()
    .from(connections)
    .where(eq(connections.userId, userId));

  const realConnections = userConnections.filter(
    (c) => !c.externalAccountId.startsWith("_pending_"),
  );
  if (realConnections.length === 0) return [];

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

  // Group by (connectionId, campaignId — null for account rollups).
  const map = new Map<string, CampaignRow>();
  const connectionsById = new Map(realConnections.map((c) => [c.id, c]));

  for (const row of rows) {
    const conn = connectionsById.get(row.connectionId);
    if (!conn) continue;

    const campaignKey = row.campaignId ?? "__rollup__";
    const key = `${row.connectionId}::${campaignKey}`;

    const existing = map.get(key) ?? {
      key,
      source: row.source,
      accountName: conn.externalAccountName ?? conn.externalAccountId,
      accountId: conn.externalAccountId,
      campaignId: row.campaignId,
      campaignName: row.campaignName,
      ...ZERO_TOTALS,
    };

    const delta = rowToDelta(row);
    addTotalsInto(existing, delta);
    map.set(key, existing);
  }

  const result = Array.from(map.values());

  // Sort: highest spend first, fall back to clicks for ad-less rows
  // (GA4), then alphabetical for full ties.
  result.sort((a, b) => {
    if (b.spend !== a.spend) return b.spend - a.spend;
    if (b.clicks !== a.clicks) return b.clicks - a.clicks;
    if (b.sessions !== a.sessions) return b.sessions - a.sessions;
    return (a.campaignName ?? a.accountName).localeCompare(
      b.campaignName ?? b.accountName,
    );
  });

  return result;
}
