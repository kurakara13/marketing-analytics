import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  connections,
  syncRuns,
  type Connection,
  type SyncRun,
} from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import type { ExternalAccount } from "@/lib/connectors/types";
import type { GoogleTokenSet } from "@/lib/google/oauth";

export type ConnectionWithLastSync = Connection & {
  lastSync: SyncRun | null;
};

/**
 * Upsert one row per (userId, connectorId, externalAccountId). Tokens are
 * encrypted at rest. Re-running this for the same triple updates the
 * tokens + scope + status.
 *
 * Returns the persisted connections.
 */
export async function persistConnections(args: {
  userId: string;
  connectorId: string;
  tokens: GoogleTokenSet;
  accounts: ExternalAccount[];
}): Promise<Connection[]> {
  const { userId, connectorId, tokens, accounts } = args;
  if (accounts.length === 0) return [];

  const encryptedRefreshToken = encrypt(tokens.refreshToken);
  const encryptedAccessToken = encrypt(tokens.accessToken);
  const now = new Date();

  // Drizzle's onConflictDoUpdate handles the upsert against the unique
  // index (user_id, connector_id, external_account_id).
  const rows = await db
    .insert(connections)
    .values(
      accounts.map((account) => ({
        userId,
        connectorId,
        externalAccountId: account.id,
        externalAccountName: account.name,
        loginCustomerId: account.loginCustomerId ?? null,
        encryptedRefreshToken,
        encryptedAccessToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        scope: tokens.scope,
        status: "active" as const,
        lastError: null,
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [
        connections.userId,
        connections.connectorId,
        connections.externalAccountId,
      ],
      // EXCLUDED references the would-be-inserted row, so each conflicting
      // row keeps its own externalAccountName + loginCustomerId. Token
      // columns + status are identical for every row in this insert (same
      // OAuth grant), so we pass them as plain values.
      set: {
        externalAccountName: sql`EXCLUDED.external_account_name`,
        loginCustomerId: sql`EXCLUDED.login_customer_id`,
        encryptedRefreshToken,
        encryptedAccessToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        scope: tokens.scope,
        status: "active",
        lastError: null,
        updatedAt: now,
      },
    })
    .returning();

  return rows;
}

export async function listConnectionsForUser(
  userId: string,
): Promise<Connection[]> {
  return db.select().from(connections).where(eq(connections.userId, userId));
}

/**
 * Same as listConnectionsForUser but enriches each row with its most
 * recent sync_run (or null if never synced).
 */
export async function listConnectionsWithSyncForUser(
  userId: string,
): Promise<ConnectionWithLastSync[]> {
  const conns = await listConnectionsForUser(userId);
  if (conns.length === 0) return [];

  const runs = await db
    .select()
    .from(syncRuns)
    .where(
      inArray(
        syncRuns.connectionId,
        conns.map((c) => c.id),
      ),
    )
    .orderBy(desc(syncRuns.startedAt));

  // Take the first (most-recent) run per connection.
  const latestByConn = new Map<string, SyncRun>();
  for (const run of runs) {
    if (!latestByConn.has(run.connectionId)) {
      latestByConn.set(run.connectionId, run);
    }
  }

  return conns.map((c) => ({ ...c, lastSync: latestByConn.get(c.id) ?? null }));
}

/**
 * Returns the most-recent N sync runs for a user, joined with their
 * source connection's display fields. Used by the /data-sources/history
 * audit log page.
 */
export type SyncRunWithConnection = SyncRun & {
  connection: {
    connectorId: string;
    externalAccountId: string;
    externalAccountName: string | null;
  };
};

export async function listRecentSyncRunsForUser(args: {
  userId: string;
  limit?: number;
}): Promise<SyncRunWithConnection[]> {
  const limit = args.limit ?? 100;
  const conns = await listConnectionsForUser(args.userId);
  if (conns.length === 0) return [];

  const connectionsById = new Map(conns.map((c) => [c.id, c]));
  const runs = await db
    .select()
    .from(syncRuns)
    .where(
      inArray(
        syncRuns.connectionId,
        conns.map((c) => c.id),
      ),
    )
    .orderBy(desc(syncRuns.startedAt))
    .limit(limit);

  return runs.map((r) => {
    const c = connectionsById.get(r.connectionId);
    return {
      ...r,
      connection: {
        connectorId: c?.connectorId ?? "?",
        externalAccountId: c?.externalAccountId ?? "?",
        externalAccountName: c?.externalAccountName ?? null,
      },
    };
  });
}

export async function getConnection(args: {
  userId: string;
  connectionId: string;
}): Promise<Connection | undefined> {
  const [row] = await db
    .select()
    .from(connections)
    .where(
      and(
        eq(connections.id, args.connectionId),
        eq(connections.userId, args.userId),
      ),
    )
    .limit(1);
  return row;
}

export async function deleteConnection(args: {
  userId: string;
  connectionId: string;
}): Promise<void> {
  await db
    .delete(connections)
    .where(
      and(
        eq(connections.id, args.connectionId),
        eq(connections.userId, args.userId),
      ),
    );
}

/**
 * Remove the placeholder row created when listAccounts wasn't yet
 * implemented (Phase 1.1 fallback). Called after a successful real
 * connect to clean up the leftover.
 */
export async function deletePlaceholderConnection(args: {
  userId: string;
  connectorId: string;
}): Promise<void> {
  const placeholderId = `_pending_${args.connectorId}`;
  await db
    .delete(connections)
    .where(
      and(
        eq(connections.userId, args.userId),
        eq(connections.connectorId, args.connectorId),
        eq(connections.externalAccountId, placeholderId),
      ),
    );
}
