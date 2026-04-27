// Thin client for the Google Analytics Admin API. Only the method we
// actually need today (list properties the user can see) lives here.
// https://developers.google.com/analytics/devguides/config/admin/v1

const ADMIN_BASE = "https://analyticsadmin.googleapis.com/v1beta";

type PropertySummary = {
  property: string;
  displayName: string;
  propertyType?: string;
  parent?: string;
};

type AccountSummary = {
  name: string;
  account: string;
  displayName: string;
  propertySummaries?: PropertySummary[];
};

type AccountSummariesResponse = {
  accountSummaries?: AccountSummary[];
  nextPageToken?: string;
};

export type GA4Property = {
  /** Bare numeric property id (e.g. "516537642"), without the "properties/" prefix. */
  propertyId: string;
  /** Human-readable label combining account and property names. */
  displayName: string;
};

/**
 * Returns every GA4 property the access token has read access to,
 * flattened across accounts. Handles pagination transparently.
 */
export async function listAccountSummaries(
  accessToken: string,
): Promise<GA4Property[]> {
  const properties: GA4Property[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${ADMIN_BASE}/accountSummaries`);
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `GA4 accountSummaries.list failed (${response.status}): ${detail}`,
      );
    }

    const json = (await response.json()) as AccountSummariesResponse;
    for (const account of json.accountSummaries ?? []) {
      for (const property of account.propertySummaries ?? []) {
        const propertyId = property.property.replace(/^properties\//, "");
        // Property names are commonly prefixed with the account name in GA4
        // ("XPND Indonesia - xpnd.co.id"). Avoid the "Account - Account - prop"
        // redundancy in those cases.
        const propertyName = property.displayName.trim();
        const accountName = account.displayName.trim();
        const displayName =
          propertyName === accountName ||
          propertyName.toLowerCase().startsWith(accountName.toLowerCase())
            ? propertyName
            : `${accountName} - ${propertyName}`;
        properties.push({ propertyId, displayName });
      }
    }
    pageToken = json.nextPageToken;
  } while (pageToken);

  return properties;
}
