import type { Connector, ExternalAccount, NormalizedMetric } from "../types";
import { getCustomerInfo, listAccessibleCustomers } from "./admin-api";
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

function getEnvLoginCustomerId(): string | undefined {
  // Env-level fallback (legacy / single-tenant). Per-connection
  // loginCustomerId from the database takes precedence.
  // Strip dashes — users often paste the display format ("243-701-0188")
  // but Google Ads expects 10 digits ("2437010188").
  const raw = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/-/g, "");
  return raw || undefined;
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

    const customerIds = await listAccessibleCustomers({
      accessToken: tokens.accessToken,
      developerToken,
    });

    // Probe each customer for name + manager flag in parallel. We probe
    // WITHOUT passing the env loginCustomerId — that env value is often
    // wrong (a fresh MCC that doesn't actually manage these customers)
    // and would cause every probe to 403, hiding which one is the real
    // manager. OAuth users with direct user-level access to a customer
    // (typical for managers themselves) succeed without the header.
    const probes = await Promise.all(
      customerIds.map(async (id) => {
        const info = await getCustomerInfo({
          accessToken: tokens.accessToken,
          developerToken,
          customerId: id,
        }).catch(() => null);
        return {
          id,
          name: info?.name ?? null,
          isManager: info?.isManager === true,
        };
      }),
    );

    const managers = probes.filter((p) => p.isManager);

    // Hide managers from the selection list — they don't have campaign
    // data of their own, only routing context. For each non-manager:
    // attach the first detected manager as loginCustomerId so subsequent
    // searchStream calls succeed when access is via MCC. If there are no
    // managers in the list, access is direct (no header needed).
    const accounts: ExternalAccount[] = probes
      .filter((p) => !p.isManager)
      .map((p) => ({
        id: p.id,
        name: p.name ?? p.id,
        // First detected manager wins. If none detected, leave null —
        // either the user has direct access (no header needed) or they
        // need to provide it via GOOGLE_ADS_LOGIN_CUSTOMER_ID env (used
        // as fallback in fetchMetrics).
        loginCustomerId: managers[0]?.id ?? null,
      }));

    return accounts;
  },

  async fetchMetrics({ tokens, accountId, range, loginCustomerId }) {
    const developerToken = getDeveloperToken();
    // Per-connection loginCustomerId takes priority over the env fallback.
    const effectiveLoginCustomerId = loginCustomerId ?? getEnvLoginCustomerId();

    const query = DAILY_GAQL.replace("$START", range.start).replace(
      "$END",
      range.end,
    );

    const adRows = await searchStream({
      accessToken: tokens.accessToken,
      developerToken,
      customerId: accountId,
      loginCustomerId: effectiveLoginCustomerId,
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
