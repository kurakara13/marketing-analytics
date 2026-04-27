import { randomBytes } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { auth } from "@/lib/auth";
import { getConnector } from "@/lib/connectors/registry";
import { buildAuthorizationUrl } from "@/lib/google/oauth";

export const OAUTH_SESSION_COOKIE = "oauth_session";
const COOKIE_MAX_AGE_SECONDS = 5 * 60;

// GET /api/connectors/google/connect?connector=ga4
//
// Initiates the OAuth dance for a Google-backed connector. Sets a short-
// lived httpOnly cookie tying together the random `state` (CSRF guard),
// the requesting user's id, and the connector being authorized — the
// callback route reads this to validate the request and decide which
// connector's `listAccounts` to call.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const connectorId = request.nextUrl.searchParams.get("connector");
  if (!connectorId) {
    return NextResponse.json(
      { error: "Missing ?connector query param" },
      { status: 400 },
    );
  }

  const connector = getConnector(connectorId);
  if (!connector) {
    return NextResponse.json(
      { error: `Unknown connector: ${connectorId}` },
      { status: 404 },
    );
  }
  if (connector.provider !== "google") {
    return NextResponse.json(
      { error: `Connector ${connectorId} is not Google-backed` },
      { status: 400 },
    );
  }

  const state = randomBytes(32).toString("hex");
  const cookieValue = JSON.stringify({
    state,
    connectorId,
    userId: session.user.id,
  });

  const cookieStore = await cookies();
  cookieStore.set(OAUTH_SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });

  const authUrl = buildAuthorizationUrl({
    scopes: connector.scopes,
    state,
  });

  return NextResponse.redirect(authUrl);
}
