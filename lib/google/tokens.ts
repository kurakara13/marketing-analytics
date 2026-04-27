import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { connections, type Connection } from "@/lib/db/schema";
import { encrypt, decrypt } from "@/lib/crypto";
import type { OAuthTokens } from "@/lib/connectors/types";
import { refreshAccessToken } from "./oauth";

// Refresh the access token if less than this much time remains, to avoid
// the token expiring mid-request.
const REFRESH_BEFORE_MS = 5 * 60 * 1000;

/**
 * Decrypt and return the connection's OAuth tokens, refreshing the access
 * token via Google if the cached one is missing or about to expire. The
 * refreshed access token is re-encrypted and persisted, so subsequent
 * callers see the same cached value.
 *
 * Throws if the connection has no refresh token, or if the refresh fails
 * (and marks the connection as `error` so the UI can surface it).
 */
export async function getValidTokens(
  connection: Connection,
): Promise<OAuthTokens> {
  if (!connection.encryptedRefreshToken) {
    throw new Error(`Connection ${connection.id} has no refresh token stored`);
  }

  const refreshToken = decrypt(connection.encryptedRefreshToken);

  const cachedAccessToken = connection.encryptedAccessToken
    ? decrypt(connection.encryptedAccessToken)
    : null;
  const cachedExpiresAt = connection.accessTokenExpiresAt;

  const cachedStillValid =
    cachedAccessToken &&
    cachedExpiresAt &&
    cachedExpiresAt.getTime() - Date.now() > REFRESH_BEFORE_MS;

  if (cachedStillValid) {
    return {
      refreshToken,
      accessToken: cachedAccessToken,
      accessTokenExpiresAt: cachedExpiresAt,
      scope: connection.scope ?? "",
    };
  }

  // Cached token missing or near expiry — refresh.
  let fresh;
  try {
    fresh = await refreshAccessToken(refreshToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(connections)
      .set({
        status: "error",
        lastError: `Token refresh failed: ${message}`,
        updatedAt: new Date(),
      })
      .where(eq(connections.id, connection.id));
    throw error;
  }

  await db
    .update(connections)
    .set({
      encryptedAccessToken: encrypt(fresh.accessToken),
      accessTokenExpiresAt: fresh.accessTokenExpiresAt,
      scope: fresh.scope,
      status: "active",
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(connections.id, connection.id));

  return {
    refreshToken,
    accessToken: fresh.accessToken,
    accessTokenExpiresAt: fresh.accessTokenExpiresAt,
    scope: fresh.scope,
  };
}
