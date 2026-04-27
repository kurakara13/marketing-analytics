// Background worker. Runs syncConnection for every active, non-placeholder
// connection on a cron schedule. Run via:
//   pnpm worker          (long-running, daily schedule)
//   pnpm worker:once     (run once and exit; useful for testing or ad-hoc runs)
//
// Override the schedule with WORKER_CRON env var (e.g. "*/30 * * * *" for
// every 30 minutes). Defaults to daily at 02:00 server local time.

import { schedule } from "node-cron";
import { eq } from "drizzle-orm";

import { db, postgresClient } from "@/lib/db";
import { connections } from "@/lib/db/schema";
import { syncConnection } from "@/lib/sync";

const RUN_ONCE = process.argv.includes("--once");
const CRON_SCHEDULE = process.env.WORKER_CRON ?? "0 2 * * *";

async function syncAllActive(): Promise<void> {
  const startedAt = Date.now();
  console.log(`[worker] sync started at ${new Date().toISOString()}`);

  const active = await db
    .select()
    .from(connections)
    .where(eq(connections.status, "active"));

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const conn of active) {
    if (conn.externalAccountId.startsWith("_pending_")) {
      skipped++;
      continue;
    }

    const label = `${conn.connectorId}/${conn.externalAccountName ?? conn.externalAccountId}`;
    try {
      const result = await syncConnection({ connectionId: conn.id });
      if (result.success) {
        console.log(`[worker]   ✓ ${label}: ${result.recordsCount} rows`);
        succeeded++;
      } else {
        console.warn(`[worker]   ✗ ${label}: ${result.error}`);
        failed++;
      }
    } catch (err) {
      console.error(`[worker]   ✗ ${label}: uncaught:`, err);
      failed++;
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[worker] done in ${elapsed}s — ${succeeded} ok · ${failed} fail · ${skipped} skipped (placeholder)`,
  );
}

async function main(): Promise<void> {
  if (RUN_ONCE) {
    await syncAllActive();
    // Close the postgres pool so the process exits cleanly. Without this,
    // open sockets keep the event loop alive and force-killing them via
    // process.exit triggers a libuv assertion on Windows.
    await postgresClient.end({ timeout: 5 });
    return;
  }

  console.log(`[worker] cron schedule: "${CRON_SCHEDULE}"`);
  schedule(CRON_SCHEDULE, () => {
    syncAllActive().catch((err) => {
      console.error("[worker] scheduled run threw:", err);
    });
  });

  // Run once immediately on startup so a freshly-deployed worker doesn't
  // wait until the next scheduled tick to fetch data.
  syncAllActive().catch((err) => {
    console.error("[worker] startup run threw:", err);
  });

  console.log("[worker] running. Press Ctrl+C to stop.");
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
