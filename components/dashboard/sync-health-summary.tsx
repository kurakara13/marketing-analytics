import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";

import { cn } from "@/lib/utils";
import type { Connection } from "@/lib/db/schema";

// Compact single-line health summary that sits at the top of the
// dashboard. Surfaces three states:
//   - All green: every active non-placeholder connection synced
//     within the last 36h with no error
//   - Stale: at least one connection's last sync is older than 36h
//   - Errored: at least one connection's status is "error" OR its
//     last sync run failed
//
// Click anywhere on the row → /data-sources for full detail. Hidden
// when there are no connections at all (the onboarding flow handles
// that case).

const STALE_THRESHOLD_HOURS = 36;

type ConnectionWithLastSync = Connection & {
  lastSync: {
    status: "success" | "error" | "running";
    finishedAt: Date | null;
    startedAt: Date;
    errorMessage: string | null;
  } | null;
};

type Props = {
  connections: ConnectionWithLastSync[];
};

export function SyncHealthSummary({ connections }: Props) {
  const real = connections.filter(
    (c) => !c.externalAccountId.startsWith("_pending_"),
  );
  if (real.length === 0) return null;

  const now = Date.now();
  const staleThreshold = now - STALE_THRESHOLD_HOURS * 60 * 60 * 1000;

  let errored = 0;
  let stale = 0;
  let oldestSync: Date | null = null;

  for (const c of real) {
    if (c.status === "error") {
      errored += 1;
      continue;
    }
    if (c.lastSync?.status === "error") {
      errored += 1;
      continue;
    }
    const lastTime =
      c.lastSync?.finishedAt ?? c.lastSync?.startedAt ?? null;
    if (!lastTime || lastTime.getTime() < staleThreshold) {
      stale += 1;
    }
    if (lastTime && (!oldestSync || lastTime < oldestSync)) {
      oldestSync = lastTime;
    }
  }

  // Pick most-severe state to drive the visual.
  const tone: "ok" | "stale" | "error" =
    errored > 0 ? "error" : stale > 0 ? "stale" : "ok";

  const Icon =
    tone === "error" ? AlertTriangle : tone === "stale" ? Clock : CheckCircle2;
  const styles =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
      : tone === "stale"
        ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
        : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300";

  const message =
    tone === "error"
      ? `${errored} dari ${real.length} koneksi gagal sync — buka untuk inspect error log`
      : tone === "stale"
        ? `${stale} dari ${real.length} koneksi belum sync >${STALE_THRESHOLD_HOURS}h — data mungkin tertinggal`
        : oldestSync
          ? `${real.length} koneksi sehat · sync terbaru ${formatDistanceToNow(oldestSync, { addSuffix: true, locale: idLocale })}`
          : `${real.length} koneksi aktif`;

  return (
    <Link
      href="/data-sources"
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
        "hover:opacity-90",
        styles,
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{message}</span>
    </Link>
  );
}
