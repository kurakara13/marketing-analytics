import type { Connector, NormalizedMetric } from "../types";
import { getCustomerName, listAccessibleCustomers } from "./admin-api";
import { searchStream } from "./data-api";

export const GOOGLE_ADS_SCOPES = [
  "https://www.googleapis.com/auth/adwords",
] as const;

function getDeveloperToken(): string {
  const token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!token) {
    throw new Error(
      "GOOGLE_ADS_DEVELOPER_TOKEN belum di-set. Apply di Google Ads → Tools → API Center.",
    );
  }
  return token;
}

function getLoginCustomerId(): string | undefined {
  // Optional. Required only when accessing customers under a manager
  // (MCC) account.
  return process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || undefined;
}

function microsToUnits(micros: string | undefined): number | null {
  if (!micros) return null;
  const n = Number(micros);
  return Number.isFinite(n) ? n / 1_000_000 : null;
}

function parseString(value: string | number | undefined): number | null {
  if (value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

const DAILY_GAQL = `
  SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    segments.date,
    metrics.impressions,
    metrics.clicks,
    metrics.cost_micros,
    metrics.conversions,
    metrics.conversions_value,
    metrics.ctr,
    metrics.average_cpc
  FROM campaign
  WHERE segments.date BETWEEN '$START' AND '$END'
`
  .replace(/\s+/g, " ")
  .trim();

export const googleAdsConnector: Connector = {
  id: "google_ads",
  name: "Google Ads",
  description:
    "Campaign metrik harian (impressions, clicks, spend, conversions) dari akun Google Ads.",
  provider: "google",
  scopes: GOOGLE_ADS_SCOPES,

  async listAccounts(tokens) {
    const developerToken = getDeveloperToken();
    const loginCustomerId = getLoginCustomerId();

    const customerIds = await listAccessibleCustomers({
      accessToken: tokens.accessToken,
      developerToken,
    });

    // Resolve names in parallel. Failed lookups (e.g. inactive customers)
    // fall back to the raw id so the user can still see + disconnect them.
    const accounts = await Promise.all(
      customerIds.map(async (id) => {
        const name = await getCustomerName({
          accessToken: tokens.accessToken,
          developerToken,
          customerId: id,
          loginCustomerId,
        }).catch(() => null);
        return { id, name: name ?? id };
      }),
    );

    return accounts;
  },

  async fetchMetrics({ tokens, accountId, range }) {
    const developerToken = getDeveloperToken();
    const loginCustomerId = getLoginCustomerId();

    const query = DAILY_GAQL.replace("$START", range.start).replace(
      "$END",
      range.end,
    );

    const adRows = await searchStream({
      accessToken: tokens.accessToken,
      developerToken,
      customerId: accountId,
      loginCustomerId,
      query,
    });

    const rows: NormalizedMetric[] = [];
    for (const row of adRows) {
      const date = row.segments?.date;
      if (!date) continue;

      const metrics = row.metrics ?? {};
      const campaignId = row.campaign?.id?.toString() ?? null;
      const campaignName = row.campaign?.name ?? null;

      rows.push({
        date,
        campaignId,
        campaignName,
        impressions: parseString(metrics.impressions),
        clicks: parseString(metrics.clicks),
        spend: microsToUnits(metrics.costMicros),
        conversions: parseString(metrics.conversions),
        revenue: parseString(metrics.conversionsValue),
        raw: {
          ...metrics,
          campaignStatus: row.campaign?.status,
          averageCpc: microsToUnits(metrics.averageCpc),
        },
      });
    }
    return rows;
  },
};
