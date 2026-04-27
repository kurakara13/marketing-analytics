// Public types for the connector contract. Platform-specific connector
// implementations (GA4, Google Ads, Meta Ads, ...) live in sibling
// folders and conform to the `Connector` interface below.

export type OAuthProvider = "google";

export type OAuthTokens = {
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: Date;
  scope: string;
};

export type ExternalAccount = {
  /** Stable id at the upstream platform (e.g. GA4 property id, Ads customer id). */
  id: string;
  /** Human-readable label shown in the UI. */
  name: string;
  /**
   * Connector-specific routing hint. For Google Ads: the manager (MCC)
   * customer id used in the `login-customer-id` header when fetching
   * data for a client account. Null/undefined when access is direct.
   */
  loginCustomerId?: string | null;
};

export type DateRange = {
  /** YYYY-MM-DD, inclusive. */
  start: string;
  /** YYYY-MM-DD, inclusive. */
  end: string;
};

// A single row produced by `fetchMetrics`. All metric fields are nullable
// because not every platform reports every metric (e.g. GA4 has no spend).
// `raw` preserves source-specific fields we haven't promoted to typed
// columns yet.
export type NormalizedMetric = {
  date: string;
  campaignId: string | null;
  campaignName: string | null;
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
  conversions: number | null;
  revenue: number | null;
  raw: Record<string, unknown>;
};

export interface Connector {
  /** Stable internal id. Persisted in `connection.connector_id`. */
  readonly id: string;
  /** Display name shown on the Data Sources page. */
  readonly name: string;
  /** Short description; surfaces under the connector card. */
  readonly description: string;
  /** OAuth provider; for now only Google. */
  readonly provider: OAuthProvider;
  /** Required OAuth scopes for this connector. */
  readonly scopes: readonly string[];

  /** List external accounts the user has granted this app access to. */
  listAccounts(tokens: OAuthTokens): Promise<ExternalAccount[]>;

  /** Fetch normalized metrics for one external account over a date range. */
  fetchMetrics(args: {
    tokens: OAuthTokens;
    accountId: string;
    range: DateRange;
    /**
     * Optional connector-specific routing hint persisted on the
     * connection (mirrors `loginCustomerId` from `ExternalAccount`).
     */
    loginCustomerId?: string | null;
  }): Promise<NormalizedMetric[]>;
}
