// Google Ads searchStream endpoint — runs a GAQL query and returns rows.
// https://developers.google.com/google-ads/api/docs/query/overview

const ADS_BASE = "https://googleads.googleapis.com/v17";

export type GoogleAdsRow = {
  campaign?: {
    id?: string;
    name?: string;
    status?: string;
  };
  segments?: {
    date?: string;
  };
  metrics?: {
    impressions?: string;
    clicks?: string;
    costMicros?: string;
    conversions?: number;
    conversionsValue?: number;
    ctr?: number;
    averageCpc?: string;
  };
  customer?: {
    id?: string;
    descriptiveName?: string;
    currencyCode?: string;
    timeZone?: string;
  };
};

type SearchStreamChunk = {
  results?: GoogleAdsRow[];
  fieldMask?: string;
  requestId?: string;
};

export type SearchStreamArgs = {
  accessToken: string;
  developerToken: string;
  /** Bare numeric customer id the query targets. */
  customerId: string;
  /**
   * Manager (MCC) customer id, required when accessing accounts under
   * a manager account. Omit for direct (non-MCC) access.
   */
  loginCustomerId?: string;
  /** GAQL query string. */
  query: string;
};

export async function searchStream(
  args: SearchStreamArgs,
): Promise<GoogleAdsRow[]> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${args.accessToken}`,
    "developer-token": args.developerToken,
    "Content-Type": "application/json",
  };
  if (args.loginCustomerId) {
    headers["login-customer-id"] = args.loginCustomerId;
  }

  const response = await fetch(
    `${ADS_BASE}/customers/${args.customerId}/googleAds:searchStream`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ query: args.query }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Google Ads searchStream failed (${response.status}): ${detail}`,
    );
  }

  // REST searchStream buffers and returns the full result as an array of
  // chunks, each carrying a slice of `results`. Flatten.
  const chunks = (await response.json()) as SearchStreamChunk[];
  const rows: GoogleAdsRow[] = [];
  for (const chunk of chunks ?? []) {
    for (const row of chunk.results ?? []) {
      rows.push(row);
    }
  }
  return rows;
}
