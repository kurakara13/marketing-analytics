// Google Ads API admin endpoints. Used to discover which customer
// accounts the OAuth user can read.
// https://developers.google.com/google-ads/api/rest/reference/rest

// Google Ads API release cadence is ~3-4 months and old versions sunset
// after ~14 months. When this version sunsets, bump to the latest from
// https://developers.google.com/google-ads/api/docs/release-notes and
// re-test against searchStream output (response shape is generally stable
// but field renames happen between major versions).
const ADS_BASE = "https://googleads.googleapis.com/v24";

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
      manager?: boolean;
    };
  }>;
};

export type CustomerInfo = {
  /** Human-readable name (or null when the API doesn't surface one). */
  name: string | null;
  /** True when the customer record is itself a manager (MCC). */
  isManager: boolean;
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
 * Look up customer name + manager flag via a single GAQL query against
 * the customer resource. Returns null when the customer is inaccessible
 * (revoked, terminated, or requires a different login-customer-id than
 * we have).
 */
export async function getCustomerInfo(args: {
  accessToken: string;
  developerToken: string;
  customerId: string;
  loginCustomerId?: string;
}): Promise<CustomerInfo | null> {
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
          "SELECT customer.id, customer.descriptive_name, customer.manager FROM customer LIMIT 1",
      }),
    },
  );

  if (!response.ok) return null;

  const chunks = (await response.json()) as SearchStreamChunk[];
  for (const chunk of chunks ?? []) {
    for (const result of chunk.results ?? []) {
      const customer = result.customer;
      if (!customer) continue;
      return {
        name: customer.descriptiveName ?? null,
        isManager: customer.manager === true,
      };
    }
  }
  return null;
}
