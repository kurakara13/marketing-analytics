import { and, eq, gte, inArray, lte } from "drizzle-orm";

import { db } from "@/lib/db";
import { connections, dailyMetrics } from "@/lib/db/schema";

// Per-period aggregations for a report. Reports cover one current period
// (window) plus the previous period (for delta) plus a 6-period trend.
//
// Period = "weekly" → 7-day window, 6 weeks of trend
// Period = "monthly" → 30-day window, 6 months of trend

export type PeriodKey = "weekly" | "monthly";

export type ReportTotals = {
  // GA4 (engagement / outcomes)
  sessions: number;
  pageviews: number;
  conversions: number;
  revenue: number;
  // Google Ads (paid)
  impressions: number;
  clicks: number;
  spend: number;
  // Search Console (organic)
  organicImpressions: number;
  organicClicks: number;
  /** Sum of (position × impressions) per day. Divide by organicImpressions
   *  to get the impression-weighted average position over the window. */
  organicPositionWeightedSum: number;
};

export type TrendPoint = ReportTotals & {
  /** Label for the bucket (e.g. "W14", "Apr"). */
  label: string;
  /** Inclusive start date (YYYY-MM-DD) of the bucket. */
  start: string;
  /** Inclusive end date (YYYY-MM-DD) of the bucket. */
  end: string;
};

export type CampaignBreakdownRow = ReportTotals & {
  source: string;
  accountName: string;
  campaignId: string | null;
  campaignName: string | null;
};

export type ReportData = {
  period: PeriodKey;
  /** Inclusive YYYY-MM-DD. */
  windowStart: string;
  windowEnd: string;
  /** Display label e.g. "Week 17 — 21–27 Apr 2026" or "Apr 2026". */
  windowLabel: string;
  /** Week-of-year number (only meaningful for weekly). */
  weekNumber?: number;
  totals: ReportTotals;
  previousTotals: ReportTotals;
  trend: TrendPoint[];
  campaigns: CampaignBreakdownRow[];
  connectedSources: string[];
  hasData: boolean;
};

const ZERO_TOTALS: ReportTotals = {
  sessions: 0,
  pageviews: 0,
  conversions: 0,
  revenue: 0,
  impressions: 0,
  clicks: 0,
  spend: 0,
  organicImpressions: 0,
  organicClicks: 0,
  organicPositionWeightedSum: 0,
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function asNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function addInto(target: ReportTotals, row: ReportTotals): void {
  target.sessions += row.sessions;
  target.pageviews += row.pageviews;
  target.conversions += row.conversions;
  target.revenue += row.revenue;
  target.impressions += row.impressions;
  target.clicks += row.clicks;
  target.spend += row.spend;
  target.organicImpressions += row.organicImpressions;
  target.organicClicks += row.organicClicks;
  target.organicPositionWeightedSum += row.organicPositionWeightedSum;
}

// ISO week number per ISO-8601 (week starts Monday, week 1 contains 4 Jan).
function isoWeekNumber(d: Date): number {
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

const MONTH_LABELS_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function formatDateRangeLabel(start: string, end: string): string {
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  const sameMonth =
    s.getUTCMonth() === e.getUTCMonth() &&
    s.getUTCFullYear() === e.getUTCFullYear();
  const sDay = s.getUTCDate();
  const eDay = e.getUTCDate();
  const sMonth = MONTH_LABELS_ID[s.getUTCMonth()];
  const eMonth = MONTH_LABELS_ID[e.getUTCMonth()];
  const eYear = e.getUTCFullYear();
  if (sameMonth) {
    return `${sDay}–${eDay} ${eMonth} ${eYear}`;
  }
  return `${sDay} ${sMonth} – ${eDay} ${eMonth} ${eYear}`;
}

// Convert one stored daily_metrics row into a ReportTotals delta, routing
// fields to the right channel based on `row.source`. This prevents
// organic clicks (Search Console) from being summed with paid clicks
// (Google Ads) — they share the same `clicks` column at the storage
// level but are semantically different in the report.
function rowToDelta(row: typeof dailyMetrics.$inferSelect): ReportTotals {
  const raw = row.rawData as Record<string, unknown> | null;
  const delta = { ...ZERO_TOTALS };

  switch (row.source) {
    case "ga4": {
      delta.conversions = asNumber(row.conversions);
      delta.revenue = asNumber(row.revenue);
      delta.sessions = raw ? asNumber(raw.sessions) : 0;
      delta.pageviews = raw ? asNumber(raw.screenPageViews) : 0;
      break;
    }
    case "google_ads": {
      delta.impressions = asNumber(row.impressions);
      delta.clicks = asNumber(row.clicks);
      delta.spend = asNumber(row.spend);
      // Ads conversions / revenue stay channel-local; we surface them in
      // the campaign breakdown table, not in the GA4 conversion KPI.
      break;
    }
    case "search_console": {
      const impressions = asNumber(row.impressions);
      delta.organicImpressions = impressions;
      delta.organicClicks = asNumber(row.clicks);
      const position = raw ? asNumber(raw.position) : 0;
      delta.organicPositionWeightedSum = position * impressions;
      break;
    }
    default: {
      // Unknown source — drop silently. New connectors should be added
      // here explicitly so we don't accidentally double-count metrics.
      break;
    }
  }

  return delta;
}

export async function fetchReportData(args: {
  userId: string;
  period: PeriodKey;
  /** Optional anchor date inside the window. Defaults to "yesterday" so
   *  the window covers the most recent complete day. */
  anchorDate?: string;
}): Promise<ReportData> {
  const period = args.period;
  const windowDays = period === "weekly" ? 7 : 30;
  const trendBuckets = 6;

  // Anchor = end of current window. Default: yesterday.
  const anchor = args.anchorDate
    ? new Date(args.anchorDate + "T00:00:00Z")
    : addDays(new Date(), -1);

  const windowEnd = isoDate(anchor);
  const windowStart = isoDate(addDays(anchor, -(windowDays - 1)));
  const previousEnd = isoDate(addDays(anchor, -windowDays));
  const previousStart = isoDate(addDays(anchor, -(windowDays * 2 - 1)));
  const trendStart = isoDate(addDays(anchor, -(windowDays * trendBuckets - 1)));

  const userConnections = await db
    .select()
    .from(connections)
    .where(eq(connections.userId, args.userId));
  const realConnections = userConnections.filter(
    (c) => !c.externalAccountId.startsWith("_pending_"),
  );

  if (realConnections.length === 0) {
    return {
      period,
      windowStart,
      windowEnd,
      windowLabel: formatDateRangeLabel(windowStart, windowEnd),
      weekNumber: period === "weekly" ? isoWeekNumber(anchor) : undefined,
      totals: { ...ZERO_TOTALS },
      previousTotals: { ...ZERO_TOTALS },
      trend: [],
      campaigns: [],
      connectedSources: [],
      hasData: false,
    };
  }

  const connectionIds = realConnections.map((c) => c.id);
  const connectionsById = new Map(realConnections.map((c) => [c.id, c]));

  // One query for the full trend window — includes current + previous +
  // earlier buckets used for the trend chart.
  const rows = await db
    .select()
    .from(dailyMetrics)
    .where(
      and(
        inArray(dailyMetrics.connectionId, connectionIds),
        gte(dailyMetrics.date, trendStart),
        lte(dailyMetrics.date, windowEnd),
      ),
    );

  // Bucket rows into the 6 trend buckets.
  const buckets: TrendPoint[] = [];
  for (let i = trendBuckets - 1; i >= 0; i--) {
    const bucketEnd = isoDate(addDays(anchor, -(windowDays * i)));
    const bucketStart = isoDate(addDays(anchor, -(windowDays * (i + 1) - 1)));
    const label =
      period === "weekly"
        ? `W${isoWeekNumber(new Date(bucketEnd + "T00:00:00Z"))}`
        : MONTH_LABELS_ID[new Date(bucketEnd + "T00:00:00Z").getUTCMonth()];
    buckets.push({
      label,
      start: bucketStart,
      end: bucketEnd,
      ...ZERO_TOTALS,
    });
  }

  // Aggregate row-by-row.
  const totals: ReportTotals = { ...ZERO_TOTALS };
  const previousTotals: ReportTotals = { ...ZERO_TOTALS };
  const campaignMap = new Map<string, CampaignBreakdownRow>();

  for (const row of rows) {
    const delta = rowToDelta(row);

    if (row.date >= windowStart && row.date <= windowEnd) {
      addInto(totals, delta);

      // Campaign breakdown only for the current window.
      const conn = connectionsById.get(row.connectionId);
      const campaignKey = `${row.connectionId}::${row.campaignId ?? "_rollup_"}`;
      const existing =
        campaignMap.get(campaignKey) ??
        ({
          source: row.source,
          accountName:
            conn?.externalAccountName ?? conn?.externalAccountId ?? "",
          campaignId: row.campaignId,
          campaignName: row.campaignName,
          ...ZERO_TOTALS,
        } as CampaignBreakdownRow);
      addInto(existing, delta);
      campaignMap.set(campaignKey, existing);
    } else if (row.date >= previousStart && row.date <= previousEnd) {
      addInto(previousTotals, delta);
    }

    // Trend bucketing.
    for (const bucket of buckets) {
      if (row.date >= bucket.start && row.date <= bucket.end) {
        addInto(bucket, delta);
        break;
      }
    }
  }

  const campaigns = Array.from(campaignMap.values()).sort((a, b) => {
    if (b.spend !== a.spend) return b.spend - a.spend;
    if (b.clicks !== a.clicks) return b.clicks - a.clicks;
    return b.sessions - a.sessions;
  });

  const connectedSources = Array.from(
    new Set(realConnections.map((c) => c.connectorId)),
  );

  return {
    period,
    windowStart,
    windowEnd,
    windowLabel: formatDateRangeLabel(windowStart, windowEnd),
    weekNumber: period === "weekly" ? isoWeekNumber(anchor) : undefined,
    totals,
    previousTotals,
    trend: buckets,
    campaigns,
    connectedSources,
    hasData: rows.some((r) => r.date >= windowStart && r.date <= windowEnd),
  };
}
