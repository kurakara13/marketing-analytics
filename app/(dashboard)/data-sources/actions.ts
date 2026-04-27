"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { deleteConnection, listConnectionsForUser } from "@/lib/connections";
import { syncConnection } from "@/lib/sync";

const connectionIdInput = z.object({
  connectionId: z.string().min(1),
});

const syncInput = connectionIdInput.extend({
  /** Sync the last N days. Default 1 = just yesterday. */
  days: z.number().int().min(1).max(90).optional(),
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const backfillInput = connectionIdInput.extend({
  startDate: z.string().regex(ISO_DATE, "Format tanggal harus YYYY-MM-DD"),
  endDate: z.string().regex(ISO_DATE, "Format tanggal harus YYYY-MM-DD"),
});

export type DisconnectResult = { error: string } | { success: true };

export async function disconnectConnectionAction(
  input: z.infer<typeof connectionIdInput>,
): Promise<DisconnectResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Tidak ada session aktif" };
  }

  const parsed = connectionIdInput.safeParse(input);
  if (!parsed.success) {
    return { error: "Input tidak valid" };
  }

  await deleteConnection({
    userId: session.user.id,
    connectionId: parsed.data.connectionId,
  });

  revalidatePath("/data-sources");
  return { success: true };
}

export type SyncResult =
  | { error: string }
  | { success: true; recordsCount: number };

export async function syncConnectionAction(
  input: z.infer<typeof syncInput>,
): Promise<SyncResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Tidak ada session aktif" };
  }

  const parsed = syncInput.safeParse(input);
  if (!parsed.success) {
    return { error: "Input tidak valid" };
  }

  const result = await syncConnection({
    connectionId: parsed.data.connectionId,
    userId: session.user.id,
    days: parsed.data.days,
  });

  revalidatePath("/data-sources");

  if (!result.success) {
    return { error: result.error ?? "Sync gagal" };
  }
  return { success: true, recordsCount: result.recordsCount ?? 0 };
}

export type BackfillResult =
  | { error: string }
  | { success: true; recordsCount: number; rangeStart: string; rangeEnd: string };

/**
 * Pull historical data for one connection over an arbitrary date range.
 * Uses the same upsert path as the daily sync, so re-running for the
 * same window simply overwrites existing rows.
 *
 * Bounds: end >= start, end < today (yesterday is the latest complete
 * day for GA4), and the window is capped at ~3 years to keep upstream
 * API quota and request time reasonable.
 */
export async function backfillConnectionAction(
  input: z.infer<typeof backfillInput>,
): Promise<BackfillResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Tidak ada session aktif" };
  }

  const parsed = backfillInput.safeParse(input);
  if (!parsed.success) {
    return { error: "Tanggal tidak valid" };
  }

  const { startDate, endDate, connectionId } = parsed.data;

  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
    return { error: "Tanggal tidak valid" };
  }
  if (end < start) {
    return { error: "Tanggal akhir harus setelah tanggal mulai" };
  }
  const today = new Date();
  const yesterdayUTC = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() - 1,
    ),
  );
  if (end > yesterdayUTC) {
    return {
      error: "Tanggal akhir maksimal kemarin (data hari ini belum lengkap)",
    };
  }
  const maxDays = 365 * 3;
  const diffDays =
    Math.floor((end.valueOf() - start.valueOf()) / (24 * 60 * 60 * 1000)) + 1;
  if (diffDays > maxDays) {
    return { error: `Range maksimum ${maxDays} hari (3 tahun)` };
  }

  const result = await syncConnection({
    connectionId,
    userId: session.user.id,
    range: { start: startDate, end: endDate },
  });

  revalidatePath("/data-sources");

  if (!result.success) {
    return { error: result.error ?? "Backfill gagal" };
  }
  return {
    success: true,
    recordsCount: result.recordsCount ?? 0,
    rangeStart: startDate,
    rangeEnd: endDate,
  };
}

export type SyncAllResult =
  | { error: string }
  | {
      success: true;
      total: number;
      succeeded: number;
      failed: number;
      results: Array<{
        accountName: string;
        success: boolean;
        recordsCount?: number;
        error?: string;
      }>;
    };

/**
 * Iterate every active, non-placeholder connection for the user and run
 * syncConnection on each. Sequential to be polite to upstream APIs and
 * keep error attribution simple.
 */
export async function syncAllAction(): Promise<SyncAllResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Tidak ada session aktif" };
  }

  const all = await listConnectionsForUser(session.user.id);
  const active = all.filter(
    (c) =>
      c.status === "active" && !c.externalAccountId.startsWith("_pending_"),
  );

  const results: Array<{
    accountName: string;
    success: boolean;
    recordsCount?: number;
    error?: string;
  }> = [];

  for (const conn of active) {
    const accountName = conn.externalAccountName ?? conn.externalAccountId;
    const result = await syncConnection({
      connectionId: conn.id,
      userId: session.user.id,
    });
    results.push({
      accountName,
      success: result.success,
      recordsCount: result.recordsCount,
      error: result.error,
    });
  }

  revalidatePath("/data-sources");

  return {
    success: true,
    total: results.length,
    succeeded: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}
