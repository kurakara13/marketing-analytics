import { cookies } from "next/headers";

import { encrypt, decrypt } from "@/lib/crypto";
import type { ExternalAccount } from "@/lib/connectors/types";
import type { GoogleTokenSet } from "@/lib/google/oauth";

// Short-lived encrypted cookie that carries OAuth tokens + the candidate
// account list between the OAuth callback and the user's account-selection
// step. Lives ≤ 5 minutes; cleared as soon as the user submits selections.

export const OAUTH_PENDING_COOKIE = "oauth_pending";
const TTL_SECONDS = 5 * 60;

export type PendingPayload = {
  connectorId: string;
  userId: string;
  tokens: GoogleTokenSet;
  accounts: ExternalAccount[];
  /** Wall-clock ms when the pending payload was created. Used to refuse
   *  stale cookies the browser may still hold past the cookie maxAge. */
  createdAt: number;
};

export async function setPending(payload: PendingPayload): Promise<void> {
  // accessTokenExpiresAt is a Date — JSON.stringify converts to ISO string,
  // we re-parse on read.
  const ciphertext = encrypt(JSON.stringify(payload));
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_PENDING_COOKIE, ciphertext, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: TTL_SECONDS,
    path: "/",
  });
}

export async function readPending(): Promise<PendingPayload | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(OAUTH_PENDING_COOKIE);
  if (!cookie?.value) return null;

  let raw: string;
  try {
    raw = decrypt(cookie.value);
  } catch {
    // Tampered, corrupted, or signed with an old ENCRYPTION_KEY.
    return null;
  }

  let parsed: Omit<PendingPayload, "tokens"> & {
    tokens: Omit<GoogleTokenSet, "accessTokenExpiresAt"> & {
      accessTokenExpiresAt: string;
    };
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  // Belt-and-suspenders TTL check (browser may keep the cookie longer than
  // the spec'd maxAge in rare edge cases).
  if (Date.now() - parsed.createdAt > TTL_SECONDS * 1000) return null;

  return {
    ...parsed,
    tokens: {
      ...parsed.tokens,
      accessTokenExpiresAt: new Date(parsed.tokens.accessTokenExpiresAt),
    },
  };
}

export async function clearPending(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(OAUTH_PENDING_COOKIE);
}
