// Google Ads API admin endpoints. Used to discover which customer
// accounts the OAuth user can read.
// https://developers.google.com/google-ads/api/rest/reference/rest

const ADS_BASE = "https://googleads.googleapis.com/v17";

type ListAccessibleCustomersResponse = {
  resourceNames?: string[];
};

type SearchStreamChunk = {
  results?: Array<{
    customer?: {
      id?: string;
      descriptiveName?: string;
      currencyCode?: string;
      timeZone?: string;
    };
  }>;
};

/**
 * Returns the bare numeric customer ids the OAuth user has read access
 * to. Each id corresponds to one Google Ads account.
 */
export async function listAccessibleCustomers(args: {
  accessToken: string;
  developerToken: string;
}): Promise<string[]> {
  const response = await fetch(
    `${ADS_BASE}/customers:listAccessibleCustomers`,
    {
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        "developer-token": args.developerToken,
      },
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Google Ads listAccessibleCustomers failed (${response.status}): ${detail}`,
    );
  }

  const json = (await response.json()) as ListAccessibleCustomersResponse;
  return (json.resourceNames ?? []).map((rn) => rn.replace(/^customers\//, ""));
}

/**
 * Look up the human-readable name for one customer id via GAQL.
 * Returns null if the customer is inaccessible (revoked, terminated, etc).
 */
export async function getCustomerName(args: {
  accessToken: string;
  developerToken: string;
  customerId: string;
  loginCustomerId?: string;
}): Promise<string | null> {
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
      body: JSON.stringify({
        query:
          "SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1",
      }),
    },
  );

  if (!response.ok) return null;

  const chunks = (await response.json()) as SearchStreamChunk[];
  for (const chunk of chunks ?? []) {
    for (const result of chunk.results ?? []) {
      const name = result.customer?.descriptiveName;
      if (name) return name;
    }
  }
  return null;
}
