// Thin client for the Search Console searchAnalytics.query endpoint.
// https://developers.google.com/webmaster-tools/v1/searchanalytics/query

const SC_BASE = "https://www.googleapis.com/webmasters/v3";

export type SearchAnalyticsRow = {
  /** Dimension values in the order the request asked for. */
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

type SearchAnalyticsResponse = {
  rows?: SearchAnalyticsRow[];
};

export type SearchAnalyticsArgs = {
  accessToken: string;
  /** Either "https://example.com/" or "sc-domain:example.com". */
  siteUrl: string;
  /** YYYY-MM-DD inclusive. */
  startDate: string;
  /** YYYY-MM-DD inclusive. */
  endDate: string;
  /** Default: ["date"] (daily rollup). */
  dimensions?: readonly string[];
  /** Cap is 25000 per request. */
  rowLimit?: number;
};

/**
 * Run a Search Console searchAnalytics query and return the raw rows.
 * Pagination is rarely needed for daily rollups (one row per day, max
 * ~3 years × 365 ≈ 1095 rows, well below the 25000 limit).
 */
export async function querySearchAnalytics(
  args: SearchAnalyticsArgs,
): Promise<SearchAnalyticsRow[]> {
  // siteUrl can contain "://" and "sc-domain:" — encode it for the path.
  const encoded = encodeURIComponent(args.siteUrl);

  const response = await fetch(
    `${SC_BASE}/sites/${encoded}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: args.startDate,
        endDate: args.endDate,
        dimensions: args.dimensions ?? ["date"],
        rowLimit: args.rowLimit ?? 25000,
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Search Console searchAnalytics.query failed (${response.status}): ${detail}`,
    );
  }

  const json = (await response.json()) as SearchAnalyticsResponse;
  return json.rows ?? [];
}
