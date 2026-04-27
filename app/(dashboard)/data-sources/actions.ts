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
