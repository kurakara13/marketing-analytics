// Thin client for the Google Search Console (Webmasters v3) sites
// endpoint. Used to discover which verified sites the OAuth user can
// read.
// https://developers.google.com/webmaster-tools/v1/sites/list

const SC_BASE = "https://www.googleapis.com/webmasters/v3";

type SiteEntry = {
  siteUrl: string;
  permissionLevel?:
    | "siteOwner"
    | "siteFullUser"
    | "siteRestrictedUser"
    | "siteUnverifiedUser";
};

type SitesListResponse = {
  siteEntry?: SiteEntry[];
};

export type SearchConsoleSite = {
  /** Raw siteUrl as Search Console returns it. Two formats:
   *  - URL property:    "https://example.com/"
   *  - Domain property: "sc-domain:example.com"
   */
  siteUrl: string;
  /** Human-readable label derived from siteUrl. */
  displayName: string;
};

/**
 * Returns every verified Search Console site the access token can query.
 * Excludes `siteUnverifiedUser` entries — those have no data-read access.
 */
export async function listSites(
  accessToken: string,
): Promise<SearchConsoleSite[]> {
  const response = await fetch(`${SC_BASE}/sites`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Search Console sites.list failed (${response.status}): ${detail}`,
    );
  }

  const json = (await response.json()) as SitesListResponse;
  const entries = json.siteEntry ?? [];

  return entries
    .filter((e) => e.permissionLevel && e.permissionLevel !== "siteUnverifiedUser")
    .map((e) => ({
      siteUrl: e.siteUrl,
      displayName: prettySiteName(e.siteUrl),
    }));
}

function prettySiteName(siteUrl: string): string {
  // "sc-domain:example.com" → "example.com (Domain)"
  if (siteUrl.startsWith("sc-domain:")) {
    return `${siteUrl.slice("sc-domain:".length)} (Domain)`;
  }
  // "https://example.com/" → "example.com"
  try {
    const url = new URL(siteUrl);
    const path = url.pathname === "/" ? "" : url.pathname;
    return `${url.host}${path}`;
  } catch {
    return siteUrl;
  }
}
