import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { auth } from "@/lib/auth";
import { getConnector } from "@/lib/connectors/registry";
import { exchangeCodeForTokens } from "@/lib/google/oauth";
import {
  deletePlaceholderConnection,
  persistConnections,
} from "@/lib/connections";
import type { ExternalAccount } from "@/lib/connectors/types";
import { OAUTH_SESSION_COOKIE } from "../connect/route";

type OAuthSession = {
  state: string;
  connectorId: string;
  userId: string;
};

function redirectTo(
  request: NextRequest,
  path: string,
  params: Record<string, string>,
): NextResponse {
  const url = new URL(path, request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

// GET /api/connectors/google/callback?code=...&state=...
//
// Receives Google's OAuth redirect, validates state, exchanges the code
// for tokens, asks the connector which external accounts the user just
// granted access to, and upserts one connection row per account with
// encrypted tokens. Always redirects back to /data-sources with a status
// query string so the UI can show a toast.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const params = request.nextUrl.searchParams;
  const error = params.get("error");
  const code = params.get("code");
  const stateFromQuery = params.get("state");

  // Always clear the oauth session cookie on the way out, regardless of
  // outcome — it has served its purpose.
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(OAUTH_SESSION_COOKIE);
  cookieStore.delete(OAUTH_SESSION_COOKIE);

  if (error) {
    return redirectTo(request, "/data-sources", {
      status: "error",
      reason: error,
    });
  }
  if (!code || !stateFromQuery) {
    return redirectTo(request, "/data-sources", {
      status: "error",
      reason: "missing_code_or_state",
    });
  }
  if (!sessionCookie?.value) {
    return redirectTo(request, "/data-sources", {
      status: "error",
      reason: "missing_oauth_session",
    });
  }

  let oauthSession: OAuthSession;
  try {
    oauthSession = JSON.parse(sessionCookie.value) as OAuthSession;
  } catch {
    return redirectTo(request, "/data-sources", {
      status: "error",
      reason: "invalid_oauth_session",
    });
  }

  if (oauthSession.state !== stateFromQuery) {
    return redirectTo(request, "/data-sources", {
      status: "error",
      reason: "state_mismatch",
    });
  }
  if (oauthSession.userId !== session.user.id) {
    return redirectTo(request, "/data-sources", {
      status: "error",
      reason: "user_mismatch",
    });
  }

  const connector = getConnector(oauthSession.connectorId);
  if (!connector) {
    return redirectTo(request, "/data-sources", {
      status: "error",
      reason: "unknown_connector",
    });
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch (err) {
    console.error("[oauth callback] token exchange failed:", err);
    return redirectTo(request, "/data-sources", {
      status: "error",
      reason: "token_exchange_failed",
    });
  }

  let accounts: ExternalAccount[];
  try {
    accounts = await connector.listAccounts({
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      scope: tokens.scope,
    });
  } catch (err) {
    console.error(`[oauth callback] ${connector.id}.listAccounts failed:`, err);
    const message = err instanceof Error ? err.message : "list_accounts_failed";
    return redirectTo(request, "/data-sources", {
      status: "error",
      reason: "list_accounts_failed",
      detail: message.slice(0, 200),
    });
  }

  if (accounts.length === 0) {
    return redirectTo(request, "/data-sources", {
      status: "error",
      reason: "no_accounts_granted",
      connector: connector.id,
    });
  }

  try {
    await persistConnections({
      userId: session.user.id,
      connectorId: connector.id,
      tokens,
      accounts,
    });
  } catch (err) {
    console.error("[oauth callback] persistConnections failed:", err);
    return redirectTo(request, "/data-sources", {
      status: "error",
      reason: "persist_failed",
    });
  }

  // Sweep up any leftover Phase-1.1-era placeholder row for the same
  // user+connector. No-op in normal cases.
  try {
    await deletePlaceholderConnection({
      userId: session.user.id,
      connectorId: connector.id,
    });
  } catch (err) {
    console.warn(
      "[oauth callback] failed to delete placeholder (non-fatal):",
      err,
    );
  }

  return redirectTo(request, "/data-sources", {
    status: "connected",
    connector: connector.id,
    count: String(accounts.length),
  });
}
