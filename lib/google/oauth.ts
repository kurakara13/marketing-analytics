// Thin wrapper around Google's OAuth 2.0 endpoints. Used by every
// Google-backed connector (GA4 today; Google Ads, GMB, Search Console
// later). Connector-specific concerns (which scopes, which API to call
// after auth) live in lib/connectors/<id>/, not here.

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

function getEnv(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing Google OAuth env vars (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI)",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export type GoogleTokenSet = {
  accessToken: string;
  refreshToken: string;
  /** Wall-clock time when the access token expires. */
  accessTokenExpiresAt: Date;
  /** Space-separated list of scopes granted by the user. */
  scope: string;
};

export function buildAuthorizationUrl(args: {
  scopes: readonly string[];
  state: string;
}): string {
  const { clientId, redirectUri } = getEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: args.scopes.join(" "),
    state: args.state,
    // `offline` returns a refresh token; `consent` forces the consent
    // screen so we reliably get one even if the user previously authorized.
    access_type: "offline",
    prompt: "consent",
    // Lets future connectors compose scopes onto the same Google account.
    include_granted_scopes: "true",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
};

export async function exchangeCodeForTokens(
  code: string,
): Promise<GoogleTokenSet> {
  const { clientId, clientSecret, redirectUri } = getEnv();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Google token exchange failed (${response.status}): ${detail}`,
    );
  }

  const json = (await response.json()) as TokenResponse;
  if (!json.refresh_token) {
    // Should not happen with prompt=consent + access_type=offline, but
    // guard against it — without a refresh token the connection is useless.
    throw new Error(
      "Google did not return a refresh token. Revoke the app at https://myaccount.google.com/permissions and retry.",
    );
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    accessTokenExpiresAt: new Date(Date.now() + json.expires_in * 1000),
    scope: json.scope,
  };
}

/**
 * Refresh a previously-issued access token. Returns the new access token
 * and its expiry; the refresh token itself does not change.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  accessTokenExpiresAt: Date;
  scope: string;
}> {
  const { clientId, clientSecret } = getEnv();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Google token refresh failed (${response.status}): ${detail}`,
    );
  }

  const json = (await response.json()) as TokenResponse;
  return {
    accessToken: json.access_token,
    accessTokenExpiresAt: new Date(Date.now() + json.expires_in * 1000),
    scope: json.scope,
  };
}
