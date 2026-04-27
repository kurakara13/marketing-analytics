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
    const response = await runReport({
      accessToken: tokens.accessToken,
      propertyId: accountId,
      startDate: range.start,
      endDate: range.end,
      dimensions: DAILY_DIMENSIONS,
      metrics: DAILY_METRICS,
    });

    const dimensionNames = response.dimensionHeaders?.map((h) => h.name) ?? [];
    const metricNames = response.metricHeaders?.map((h) => h.name) ?? [];

    const dateIdx = dimensionNames.indexOf("date");
    const conversionsIdx = metricNames.indexOf("conversions");
    const revenueIdx = metricNames.indexOf("totalRevenue");

    const rows: NormalizedMetric[] = [];
    for (const row of response.rows ?? []) {
      const dimVals = row.dimensionValues ?? [];
      const metVals = row.metricValues ?? [];

      const dateRaw = dateIdx >= 0 ? (dimVals[dateIdx]?.value ?? "") : "";
      const date = parseGA4Date(dateRaw);
      if (!date) continue;

      // Stash every metric (typed + untyped) in raw so downstream can
      // surface things like sessions/pageviews without a schema change.
      const raw: Record<string, unknown> = {};
      for (let i = 0; i < metricNames.length; i++) {
        raw[metricNames[i]] = parseNumericMetric(metVals[i]?.value);
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
