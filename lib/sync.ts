import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  connections,
  dailyMetrics,
  syncRuns,
  type Connection,
} from "@/lib/db/schema";
import { getConnector } from "@/lib/connectors/registry";
import { getValidTokens } from "@/lib/google/tokens";
import type { DateRange } from "@/lib/connectors/types";

export type SyncResult = {
  success: boolean;
  recordsCount?: number;
  error?: string;
  syncRunId?: string;
};

/**
 * Build a date range covering the last `days` complete days, ending
 * yesterday (UTC). `days = 1` returns just yesterday, the default sync
 * window. GA4 reports lag a few hours, so syncing yesterday avoids
 * partial data.
 */
export function lastNDays(days: number): DateRange {
  const safeDays = Math.max(1, Math.floor(days));
  const now = Date.now();
  const end = new Date(now - 24 * 60 * 60 * 1000);
  const start = new Date(end.getTime() - (safeDays - 1) * 24 * 60 * 60 * 1000);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

/**
 * Run one sync for one connection: fetch metrics, upsert into
 * `daily_metric`, log to `sync_run`. Updates `connection.lastError` on
 * failure. Idempotent: re-running for the same date range overwrites
 * existing rows via the dedup unique constraint.
 *
 * If `userId` is provided, the connection is scoped to that user (server
 * actions should always pass it). Cron worker omits it to sync all.
 */
export async function syncConnection(args: {
  connectionId: string;
  userId?: string;
  range?: DateRange;
  /** Convenience: build a range for the last N days ending yesterday. */
  days?: number;
}): Promise<SyncResult> {
  const range = args.range ?? lastNDays(args.days ?? 1);

  // Load connection (with user-scope guard if requested)
  const where = args.userId
    ? and(
        eq(connections.id, args.connectionId),
        eq(connections.userId, args.userId),
      )
    : eq(connections.id, args.connectionId);

  const [connection] = await db
    .select()
    .from(connections)
    .where(where)
    .limit(1);

  if (!connection) {
    return { success: false, error: "Connection not found" };
  }
  if (connection.externalAccountId.startsWith("_pending_")) {
    return {
      success: false,
      error: "Cannot sync placeholder connection — reconnect first",
    };
  }
  if (connection.status === "revoked") {
    return { success: false, error: "Connection has been revoked" };
  }

  const connector = getConnector(connection.connectorId);
  if (!connector) {
    return {
      success: false,
      error: `Unknown connector: ${connection.connectorId}`,
    };
  }

  // Open a sync_run audit row.
  const [run] = await db
    .insert(syncRuns)
    .values({
      connectionId: connection.id,
      status: "running",
      rangeStart: range.start,
      rangeEnd: range.end,
    })
    .returning();

  try {
    const tokens = await getValidTokens(connection);
    const rows = await connector.fetchMetrics({
      tokens,
      accountId: connection.externalAccountId,
      range,
      loginCustomerId: connection.loginCustomerId,
    });

    if (rows.length > 0) {
      await persistDailyMetrics({
        connection,
        rows,
      });
    }

    await db
      .update(syncRuns)
      .set({
        status: "success",
        recordsCount: rows.length,
        finishedAt: new Date(),
      })
      .where(eq(syncRuns.id, run.id));

    // Reset transient error state.
    if (connection.lastError) {
      await db
        .update(connections)
        .set({ lastError: null, updatedAt: new Date() })
        .where(eq(connections.id, connection.id));
    }

    return { success: true, recordsCount: rows.length, syncRunId: run.id };
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const friendlyMessage = humanizeSyncError(rawMessage);

    await db
      .update(syncRuns)
      .set({
        status: "error",
        // Store the friendly version — it surfaces directly in the
        // dashboard "last sync" line and in toast notifications.
        errorMessage: friendlyMessage,
        finishedAt: new Date(),
      })
      .where(eq(syncRuns.id, run.id));

    await db
      .update(connections)
      .set({ lastError: friendlyMessage, updatedAt: new Date() })
      .where(eq(connections.id, connection.id));

    return { success: false, error: friendlyMessage, syncRunId: run.id };
  }
}

// Map known upstream error fragments to user-readable Indonesian messages.
// Falls through to the raw message when we don't recognize the pattern.
function humanizeSyncError(raw: string): string {
  if (raw.includes("DEVELOPER_TOKEN_NOT_APPROVED")) {
    return "Dev token Google Ads masih Test access — fetch real production data baru bisa setelah Basic access disetujui Google. Status review: https://ads.google.com/aw/apicenter";
  }
  if (raw.includes("USER_PERMISSION_DENIED")) {
    return "Akses ditolak Google Ads. Kemungkinan login-customer-id (manager MCC) yang dipakai tidak benar atau OAuth user tidak punya permission ke akun ini.";
  }
  if (raw.includes("CUSTOMER_NOT_ENABLED")) {
    return "Akun Google Ads tidak aktif (mungkin di-suspend atau di-pause).";
  }
  if (raw.includes("AUTHENTICATION_ERROR") || raw.includes("invalid_grant")) {
    return "OAuth token tidak valid lagi. Disconnect dan reconnect akun ini.";
  }
  // GA4-specific
  if (raw.includes("PERMISSION_DENIED") && raw.includes("analytics")) {
    return "GA4 menolak permission. Disconnect dan reconnect dengan akun Google yang punya akses ke property ini.";
  }
  // Truncate raw error for readability if it's a multi-line API dump.
  if (raw.length > 500) {
    return raw.slice(0, 500) + "... (truncated; cek log dev server untuk full)";
  }
  return raw;
}

async function persistDailyMetrics(args: {
  connection: Connection;
  rows: Awaited<
    ReturnType<NonNullable<ReturnType<typeof getConnector>>["fetchMetrics"]>
  >;
}): Promise<void> {
  const { connection, rows } = args;
  const now = new Date();

  await db
    .insert(dailyMetrics)
    .values(
      rows.map((row) => ({
        connectionId: connection.id,
        source: connection.connectorId,
        date: row.date,
        campaignId: row.campaignId,
        campaignName: row.campaignName,
        impressions: row.impressions,
        clicks: row.clicks,
        // numeric columns expect strings to preserve precision
        spend: row.spend !== null ? String(row.spend) : null,
        conversions: row.conversions !== null ? String(row.conversions) : null,
        revenue: row.revenue !== null ? String(row.revenue) : null,
        rawData: row.raw,
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [
        dailyMetrics.connectionId,
        dailyMetrics.date,
        dailyMetrics.campaignId,
      ],
      set: {
        impressions: sql`EXCLUDED.impressions`,
        clicks: sql`EXCLUDED.clicks`,
        spend: sql`EXCLUDED.spend`,
        conversions: sql`EXCLUDED.conversions`,
        revenue: sql`EXCLUDED.revenue`,
        campaignName: sql`EXCLUDED.campaign_name`,
        rawData: sql`EXCLUDED.raw_data`,
        updatedAt: now,
      },
    });
}
