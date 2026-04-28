// Thin client for the Google Analytics Data API (runReport).
// https://developers.google.com/analytics/devguides/reporting/data/v1

const DATA_BASE = "https://analyticsdata.googleapis.com/v1beta";

export type RunReportResponse = {
  dimensionHeaders?: Array<{ name: string }>;
  metricHeaders?: Array<{ name: string; type?: string }>;
  rows?: Array<{
    dimensionValues?: Array<{ value: string }>;
    metricValues?: Array<{ value: string }>;
  }>;
  rowCount?: number;
};

// Subset of the GA4 FilterExpression shape we use. The full grammar
// supports andGroup / orGroup / notExpression nesting; we only need
// single-field filters (in-list and exact match) for the report
// queries today.
export type GA4DimensionFilter = {
  filter: {
    fieldName: string;
    inListFilter?: { values: string[]; caseSensitive?: boolean };
    stringFilter?: {
      value: string;
      matchType?: "EXACT" | "BEGINS_WITH" | "ENDS_WITH" | "CONTAINS";
      caseSensitive?: boolean;
    };
  };
};

export type GA4OrderBy = {
  metric?: { metricName: string };
  dimension?: { dimensionName: string };
  desc?: boolean;
};

export type RunReportArgs = {
  accessToken: string;
  /** Bare numeric property id (no "properties/" prefix). */
  propertyId: string;
  /** YYYY-MM-DD inclusive. */
  startDate: string;
  /** YYYY-MM-DD inclusive. */
  endDate: string;
  dimensions: readonly string[];
  metrics: readonly string[];
  /** Filter rows by a dimension value (e.g. only sessionSource in [...]). */
  dimensionFilter?: GA4DimensionFilter;
  /** Sort order — typically by a metric desc to grab top N rows. */
  orderBys?: GA4OrderBy[];
  /** Limit returned rows; default API behavior is up to 10000. */
  limit?: number;
};

export async function runReport(
  args: RunReportArgs,
): Promise<RunReportResponse> {
  const url = `${DATA_BASE}/properties/${args.propertyId}:runReport`;

  const body: Record<string, unknown> = {
    dateRanges: [{ startDate: args.startDate, endDate: args.endDate }],
    dimensions: args.dimensions.map((name) => ({ name })),
    metrics: args.metrics.map((name) => ({ name })),
  };
  if (args.dimensionFilter) body.dimensionFilter = args.dimensionFilter;
  if (args.orderBys) body.orderBys = args.orderBys;
  if (args.limit) body.limit = String(args.limit);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GA4 runReport failed (${response.status}): ${detail}`);
  }

  return (await response.json()) as RunReportResponse;
}
