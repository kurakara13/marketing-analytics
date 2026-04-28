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

function formatMonthLabel(d: Date): string {
  return `${MONTH_LABELS_ID[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Compute the report's date layout based on calendar boundaries:
//   weekly  → ISO weeks (Mon–Sun)
//   monthly → calendar months (1st–end-of-month)
//
// Default behavior anchors on the LAST COMPLETED period, not "yesterday".
// Rationale: a user generating a Monday-morning weekly report wants the
// week that just finished (not "this week, only 1 day in"). Likewise a
// monthly report on the 5th of May should be for April, not for "the
// last 30 days".
//
// The optional `anchorDate` lets callers target a specific past period:
//   weekly  → any date inside the target week (rounded down to its Sunday)
//   monthly → any date inside the target month
function computePeriodLayout(args: {
  period: PeriodKey;
  anchorDate?: string;
}): {
  windowStart: string;
  windowEnd: string;
  previousStart: string;
  previousEnd: string;
  /** Earliest bucket start — used as the lower bound of the SQL query. */
  trendStart: string;
  trendBuckets: { label: string; start: string; end: string }[];
  weekNumber?: number;
  windowLabel: string;
} {
  const TREND_BUCKETS = 6;

  if (args.period === "weekly") {
    // Anchor: parse user-provided date or use today.
    const reference = args.anchorDate
      ? new Date(args.anchorDate + "T00:00:00Z")
      : todayUtc();

    // The window's last day is the Sunday of the most recently
    // completed ISO week. If the reference is itself a Sunday in the
    // past, that Sunday is the window end (it's complete). Otherwise,
    // walk back to the previous Sunday.
    const sunday = mostRecentCompletedSunday(reference);

    const windowEnd = sunday;
    const windowStart = addDays(sunday, -6);
    const previousEnd = addDays(sunday, -7);
    const previousStart = addDays(sunday, -13);

    const buckets: { label: string; start: string; end: string }[] = [];
    for (let i = TREND_BUCKETS - 1; i >= 0; i--) {
      const end = addDays(sunday, -7 * i);
      const start = addDays(end, -6);
      buckets.push({
        label: `W${isoWeekNumber(end)}`,
        start: isoDate(start),
        end: isoDate(end),
      });
    }

    return {
      windowStart: isoDate(windowStart),
      windowEnd: isoDate(windowEnd),
      previousStart: isoDate(previousStart),
      previousEnd: isoDate(previousEnd),
      trendStart: buckets[0].start,
      trendBuckets: buckets,
      weekNumber: isoWeekNumber(sunday),
      windowLabel: formatDateRangeLabel(
        isoDate(windowStart),
        isoDate(windowEnd),
      ),
    };
  }

  // ─── Monthly ────────────────────────────────────────────────────────
  // Window = the calendar month containing the reference date. Default
  // reference: last day of the previous month (so reports run on May 5
  // cover April).
  const today = todayUtc();
  const reference = args.anchorDate
    ? new Date(args.anchorDate + "T00:00:00Z")
    : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)); // last day of previous month

  const refYear = reference.getUTCFullYear();
  const refMonth = reference.getUTCMonth();

  const windowStart = new Date(Date.UTC(refYear, refMonth, 1));
  // Day 0 of next month = last day of this month (handles 28/29/30/31 correctly).
  const windowEnd = new Date(Date.UTC(refYear, refMonth + 1, 0));

  const previousStart = new Date(Date.UTC(refYear, refMonth - 1, 1));
  const previousEnd = new Date(Date.UTC(refYear, refMonth, 0));

  const buckets: { label: string; start: string; end: string }[] = [];
  for (let i = TREND_BUCKETS - 1; i >= 0; i--) {
    const monthStart = new Date(Date.UTC(refYear, refMonth - i, 1));
    const monthEnd = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
    );
    buckets.push({
      label: MONTH_LABELS_ID[monthStart.getUTCMonth()],
      start: isoDate(monthStart),
      end: isoDate(monthEnd),
    });
  }

  return {
    windowStart: isoDate(windowStart),
    windowEnd: isoDate(windowEnd),
    previousStart: isoDate(previousStart),
    previousEnd: isoDate(previousEnd),
    trendStart: buckets[0].start,
    trendBuckets: buckets,
    weekNumber: undefined,
    windowLabel: formatMonthLabel(windowStart),
  };
}

function todayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

// Returns the Sunday of the most recently completed ISO week, relative
// to `reference`. ISO weeks run Monday–Sunday.
//   reference Tue Apr 28 → Sun Apr 26
//   reference Mon Apr 27 → Sun Apr 26
//   reference Sun Apr 26 → Sun Apr 26   (today is Sunday and complete)
//   reference Sat Apr 25 → Sun Apr 19   (last complete week, since Apr 25
//                                         is mid-week-W17, not yet done)
//
// We treat "reference" as a snapshot taken at end-of-day: if it falls on
// a Sunday, that Sunday is considered complete. Otherwise we walk back
// to the previous Sunday (which is always complete).
function mostRecentCompletedSunday(reference: Date): Date {
  const dow = reference.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat
  if (dow === 0) return reference;
  return addDays(reference, -dow);
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
  /** Optional anchor date inside the target period. Defaults to the last
   *  completed period (last full ISO week for weekly, previous calendar
   *  month for monthly) so a Monday-morning report covers the week that
   *  just finished, not "this week, only 1 day in". */
  anchorDate?: string;
}): Promise<ReportData> {
  const period = args.period;
  const layout = computePeriodLayout({
    period,
    anchorDate: args.anchorDate,
  });
  const {
    windowStart,
    windowEnd,
    previousStart,
    previousEnd,
    trendStart,
    trendBuckets,
    weekNumber,
    windowLabel,
  } = layout;

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
      windowLabel,
      weekNumber,
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
  const buckets: TrendPoint[] = trendBuckets.map((b) => ({
    label: b.label,
    start: b.start,
    end: b.end,
    ...ZERO_TOTALS,
  }));

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
    windowLabel,
    weekNumber,
    totals,
    previousTotals,
    trend: buckets,
    campaigns,
    connectedSources,
    hasData: rows.some((r) => r.date >= windowStart && r.date <= windowEnd),
  };
}
