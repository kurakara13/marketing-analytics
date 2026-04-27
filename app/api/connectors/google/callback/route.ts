import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { auth } from "@/lib/auth";
import { getConnector } from "@/lib/connectors/registry";
import { exchangeCodeForTokens } from "@/lib/google/oauth";
import type { ExternalAccount } from "@/lib/connectors/types";
import { OAUTH_SESSION_COOKIE } from "../connect/route";
import { setPending } from "@/lib/oauth-pending-cookie";

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
// for tokens, and discovers which external accounts the user has access
// to. Instead of immediately persisting connections, we drop the tokens +
// candidate accounts into an encrypted short-lived cookie and redirect to
// /data-sources/select so the user can pick which accounts to connect.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const params = request.nextUrl.searchParams;
  const error = params.get("error");
  const code = params.get("code");
  const stateFromQuery = params.get("state");

  // Always clear the oauth_session cookie on the way out.
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

  // Stash tokens + accounts in an encrypted, httpOnly, short-lived cookie
  // and let the user pick which accounts to actually connect.
  await setPending({
    connectorId: connector.id,
    userId: session.user.id,
    tokens,
    accounts,
    createdAt: Date.now(),
  });

  return NextResponse.redirect(new URL("/data-sources/select", request.url));
}
