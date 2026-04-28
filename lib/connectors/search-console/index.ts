import type { Connector, NormalizedMetric } from "../types";
import { listSites } from "./admin-api";
import { querySearchAnalytics } from "./data-api";

export const SEARCH_CONSOLE_SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
] as const;

export const searchConsoleConnector: Connector = {
  id: "search_console",
  name: "Google Search Console",
  description:
    "Organic search performance — clicks, impressions, CTR, dan posisi rata-rata dari Search Console.",
  provider: "google",
  scopes: SEARCH_CONSOLE_SCOPES,

  async listAccounts(tokens) {
    const sites = await listSites(tokens.accessToken);
    return sites.map((s) => ({
      // siteUrl is the routing key — Search Console identifies properties
      // by URL ("https://example.com/") or domain prefix ("sc-domain:example.com"),
      // not by numeric id.
      id: s.siteUrl,
      name: s.displayName,
    }));
  },

  async fetchMetrics({ tokens, accountId, range }) {
    const rows = await querySearchAnalytics({
      accessToken: tokens.accessToken,
      siteUrl: accountId,
      startDate: range.start,
      endDate: range.end,
      dimensions: ["date"],
    });

    const metrics: NormalizedMetric[] = [];
    for (const row of rows) {
      const date = row.keys?.[0];
      if (!date) continue;

      metrics.push({
        date,
        campaignId: null,
        campaignName: null,
        impressions: row.impressions ?? null,
        clicks: row.clicks ?? null,
        spend: null,
        conversions: null,
        revenue: null,
        raw: {
          ctr: row.ctr ?? null,
          position: row.position ?? null,
        },
      });
    }
    return metrics;
  },
};
