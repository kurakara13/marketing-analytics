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
};

export async function runReport(
  args: RunReportArgs,
): Promise<RunReportResponse> {
  const url = `${DATA_BASE}/properties/${args.propertyId}:runReport`;

  const body = {
    dateRanges: [{ startDate: args.startDate, endDate: args.endDate }],
    dimensions: args.dimensions.map((name) => ({ name })),
    metrics: args.metrics.map((name) => ({ name })),
  };

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
