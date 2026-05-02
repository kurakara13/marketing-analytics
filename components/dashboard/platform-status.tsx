import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";

import { cn } from "@/lib/utils";
import type { Connection } from "@/lib/db/schema";

import { SectionEyebrow } from "./urgent-observations";

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
  insightUsage: { used: number; limit: number };
  drilldownUsage: { used: number; limit: number };
};

// Compact horizontal status strip — replaces the heavier full-width
// sync banner. One row, two metrics:
//
//   ✓ N koneksi sehat · sync terbaru X menit lalu
//   ⚡ Quota hari ini: U/L insight · U/L drill-down
//
// Click connection chip → /data-sources/history. Click quota chip
// → /insights. Each chip is its own subtle link.

export function PlatformStatus({
  connections,
  insightUsage,
  drilldownUsage,
}: Props) {
  const real = connections.filter(
    (c) => !c.externalAccountId.startsWith("_pending_"),
  );

  // Compute sync status (mirrors SyncHealthSummary logic).
  let connStatus: "ok" | "stale" | "error" | "empty" = "empty";
  let oldestSync: Date | null = null;
  let erroredCount = 0;
  let staleCount = 0;
  if (real.length > 0) {
    const now = Date.now();
    const staleThreshold = now - STALE_THRESHOLD_HOURS * 60 * 60 * 1000;
    for (const c of real) {
      if (c.status === "error" || c.lastSync?.status === "error") {
        erroredCount += 1;
        continue;
      }
      const lastTime =
        c.lastSync?.finishedAt ?? c.lastSync?.startedAt ?? null;
      if (!lastTime || lastTime.getTime() < staleThreshold) {
        staleCount += 1;
      }
      if (lastTime && (!oldestSync || lastTime < oldestSync)) {
        oldestSync = lastTime;
      }
    }
    connStatus =
      erroredCount > 0 ? "error" : staleCount > 0 ? "stale" : "ok";
  }

  const insightTone =
    insightUsage.used >= insightUsage.limit
      ? "rose"
      : insightUsage.limit - insightUsage.used <= 3
        ? "amber"
        : "muted";
  const drilldownTone =
    drilldownUsage.used >= drilldownUsage.limit
      ? "rose"
      : drilldownUsage.limit - drilldownUsage.used <= 5
        ? "amber"
        : "muted";

  return (
    <section className="flex flex-col gap-3">
      <SectionEyebrow>Platform status</SectionEyebrow>
      <div className="bg-card border-border/60 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border px-4 py-3 text-[12.5px]">
        {/* Connections health */}
        <Link
          href={
            connStatus === "error" ? "/data-sources/history" : "/data-sources"
          }
          className="hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
        >
          {connStatus === "ok" ? (
            <CheckCircle2 className="size-3.5 text-emerald-600" />
          ) : connStatus === "stale" ? (
            <Clock className="size-3.5 text-amber-600" />
          ) : connStatus === "error" ? (
            <AlertTriangle className="size-3.5 text-rose-600" />
          ) : (
            <Clock className="text-muted-foreground/50 size-3.5" />
          )}
          <span className="text-muted-foreground">
            {connStatus === "empty" ? (
              "Belum ada koneksi"
            ) : connStatus === "error" ? (
              <>
                <strong className="text-foreground">{erroredCount}</strong> dari{" "}
                {real.length} koneksi gagal sync
              </>
            ) : connStatus === "stale" ? (
              <>
                <strong className="text-foreground">{staleCount}</strong> dari{" "}
                {real.length} koneksi belum sync &gt;36h
              </>
            ) : oldestSync ? (
              <>
                <strong className="text-foreground">{real.length}</strong>{" "}
                koneksi sehat · sync terbaru{" "}
                {formatDistanceToNow(oldestSync, {
                  addSuffix: true,
                  locale: idLocale,
                })}
              </>
            ) : (
              <>
                <strong className="text-foreground">{real.length}</strong>{" "}
                koneksi aktif
              </>
            )}
          </span>
        </Link>

        <span className="bg-border/70 h-3 w-px" aria-hidden />

        {/* Insight quota */}
        <Link
          href="/insights"
          className="hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
        >
          <Sparkles className="text-primary size-3.5" />
          <span className="text-muted-foreground">
            <strong
              className={cn(
                "tabular-nums",
                insightTone === "rose" && "text-rose-700",
                insightTone === "amber" && "text-amber-700",
                insightTone === "muted" && "text-foreground",
              )}
            >
              {insightUsage.used} / {insightUsage.limit}
            </strong>{" "}
            insight hari ini
          </span>
        </Link>

        <span className="bg-border/70 h-3 w-px" aria-hidden />

        {/* Drilldown quota */}
        <span className="inline-flex items-center gap-1.5">
          <Zap className="text-primary size-3.5" />
          <span className="text-muted-foreground">
            <strong
              className={cn(
                "tabular-nums",
                drilldownTone === "rose" && "text-rose-700",
                drilldownTone === "amber" && "text-amber-700",
                drilldownTone === "muted" && "text-foreground",
              )}
            >
              {drilldownUsage.used} / {drilldownUsage.limit}
            </strong>{" "}
            drill-down
          </span>
        </span>
      </div>
    </section>
  );
}
