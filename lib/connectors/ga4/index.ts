import type { Connector, NormalizedMetric } from "../types";
import { listAccountSummaries } from "./admin-api";
import { runReport } from "./data-api";

export const GA4_SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
] as const;

// Daily account-level rollup. We pull one row per date with both
// engagement and outcome metrics. Campaign/source breakdowns can be
// added later by passing additional dimensions.
const DAILY_DIMENSIONS = ["date"] as const;
const DAILY_METRICS = [
  "sessions",
  "screenPageViews",
  "activeUsers",
  "conversions",
  "totalRevenue",
  "engagementRate",
] as const;

// Per-event breakdown query. Sidecar to the daily totals query —
// gives us count of every event_name per day, which downstream
// (fetch-report-data + AI prompt) uses to compute user-defined
// "lead" totals (sum of selected event names) and per-event trend.
//
// Why a separate query: the daily totals query is dimensioned
// only by date so we get one row per day. Adding eventName here
// would multiply the row count and conflate the per-day rollup
// with per-event rows. Cleaner to keep the rollup pure and store
// the breakdown as a JSON map in raw_data.
const EVENT_BREAKDOWN_DIMENSIONS = ["date", "eventName"] as const;
const EVENT_BREAKDOWN_METRICS = ["eventCount"] as const;

function parseGA4Date(yyyymmdd: string): string {
  // GA4 returns dates as "YYYYMMDD" with the `date` dimension.
  if (!/^\d{8}$/.test(yyyymmdd)) return "";
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function parseNumericMetric(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export const ga4Connector: Connector = {
  id: "ga4",
  name: "Google Analytics 4",
  description:
    "Pageviews, sessions, conversions, dan funnel metrik dari GA4 property Anda.",
  provider: "google",
  scopes: GA4_SCOPES,

  async listAccounts(tokens) {
    const properties = await listAccountSummaries(tokens.accessToken);
    return properties.map((p) => ({
      id: p.propertyId,
      name: p.displayName,
    }));
  },

  async fetchMetrics({ tokens, accountId, range }) {
    // Fetch daily totals + event breakdown in parallel — both queries
    // hit the same property, both bounded by the same date range.
    const [dailyResponse, breakdownResponse] = await Promise.all([
      runReport({
        accessToken: tokens.accessToken,
        propertyId: accountId,
        startDate: range.start,
        endDate: range.end,
        dimensions: DAILY_DIMENSIONS,
        metrics: DAILY_METRICS,
      }),
      runReport({
        accessToken: tokens.accessToken,
        propertyId: accountId,
        startDate: range.start,
        endDate: range.end,
        dimensions: EVENT_BREAKDOWN_DIMENSIONS,
        metrics: EVENT_BREAKDOWN_METRICS,
      }),
    ]);

    // Build per-day event count map: { "2026-04-20": { form_submit: 5,
    // generate_lead: 12, ... }, ... }. Used by downstream code to sum
    // user-defined "lead events" without needing another fetch.
    const eventBreakdownByDate = new Map<string, Record<string, number>>();
    {
      const dimNames =
        breakdownResponse.dimensionHeaders?.map((h) => h.name) ?? [];
      const metNames =
        breakdownResponse.metricHeaders?.map((h) => h.name) ?? [];
      const dIdx = dimNames.indexOf("date");
      const eIdx = dimNames.indexOf("eventName");
      const cIdx = metNames.indexOf("eventCount");
      for (const row of breakdownResponse.rows ?? []) {
        const dimVals = row.dimensionValues ?? [];
        const metVals = row.metricValues ?? [];
        const date = parseGA4Date(dimVals[dIdx]?.value ?? "");
        const eventName = dimVals[eIdx]?.value;
        const count = parseNumericMetric(metVals[cIdx]?.value);
        if (!date || !eventName || count === null) continue;
        const map = eventBreakdownByDate.get(date) ?? {};
        map[eventName] = (map[eventName] ?? 0) + count;
        eventBreakdownByDate.set(date, map);
      }
    }

    // ─── Daily totals → NormalizedMetric rows ─────────────────────
    const dimensionNames =
      dailyResponse.dimensionHeaders?.map((h) => h.name) ?? [];
    const metricNames = dailyResponse.metricHeaders?.map((h) => h.name) ?? [];

    const dateIdx = dimensionNames.indexOf("date");
    const conversionsIdx = metricNames.indexOf("conversions");
    const revenueIdx = metricNames.indexOf("totalRevenue");

    const rows: NormalizedMetric[] = [];
    for (const row of dailyResponse.rows ?? []) {
      const dimVals = row.dimensionValues ?? [];
      const metVals = row.metricValues ?? [];

      const dateRaw = dateIdx >= 0 ? (dimVals[dateIdx]?.value ?? "") : "";
      const date = parseGA4Date(dateRaw);
      if (!date) continue;

      // Stash every metric (typed + untyped) in raw so downstream can
      // surface things like sessions/pageviews without a schema
      // change. Plus the eventBreakdown for this date.
      const raw: Record<string, unknown> = {};
      for (let i = 0; i < metricNames.length; i++) {
        raw[metricNames[i]] = parseNumericMetric(metVals[i]?.value);
      }
      const breakdown = eventBreakdownByDate.get(date);
      if (breakdown) {
        raw.eventBreakdown = breakdown;
      }

      rows.push({
        date,
        campaignId: null,
        campaignName: null,
        impressions: null,
        clicks: null,
        spend: null,
        conversions:
          conversionsIdx >= 0
            ? parseNumericMetric(metVals[conversionsIdx]?.value)
            : null,
        revenue:
          revenueIdx >= 0
            ? parseNumericMetric(metVals[revenueIdx]?.value)
            : null,
        raw,
      });
    }

    return rows;
  },
};
