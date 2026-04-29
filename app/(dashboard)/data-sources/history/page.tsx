import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";

import { auth } from "@/lib/auth";
import { listRecentSyncRunsForUser } from "@/lib/connections";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Sync run audit log: lists the most-recent 100 sync attempts across
// all the user's connections, with status, duration, records count,
// and full error message for failed runs. Linked from the dashboard
// sync-health banner when there are errors.
//
// Read-only — no retry button here (retry happens via "Sync now"
// on the connection card in /data-sources). This page exists purely
// for diagnosis / audit.

const idFmt = new Intl.NumberFormat("id-ID");

export default async function SyncHistoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const runs = await listRecentSyncRunsForUser({
    userId: session.user.id,
    limit: 100,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/data-sources"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "self-start -ml-3",
          )}
        >
          <ArrowLeft className="size-4" />
          Data Sources
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Sync history
        </h1>
        <p className="text-muted-foreground text-sm">
          Audit log dari {runs.length} sync run terakhir di semua koneksi.
          Berguna untuk diagnosa kalau data terlihat aneh atau koneksi
          gagal — error message penuh ditampilkan inline pada run yang
          gagal.
        </p>
      </div>

      {runs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Belum ada sync run</CardTitle>
            <CardDescription>
              Belum ada koneksi yang pernah di-sync. Buka{" "}
              <Link href="/data-sources" className="underline">
                Data Sources
              </Link>{" "}
              untuk connect data dan run sync pertama.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {runs.map((run) => (
            <SyncRunRow key={run.id} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}

function SyncRunRow({
  run,
}: {
  run: Awaited<ReturnType<typeof listRecentSyncRunsForUser>>[number];
}) {
  const isError = run.status === "error";
  const isRunning = run.status === "running";
  const Icon = isRunning
    ? Loader2
    : isError
      ? AlertCircle
      : run.status === "success"
        ? CheckCircle2
        : Clock;
  const tone = isRunning
    ? "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950"
    : isError
      ? "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950"
      : "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950";
  const iconTone = isRunning
    ? "text-sky-600 animate-spin"
    : isError
      ? "text-rose-600"
      : "text-emerald-600";

  const durationMs =
    run.finishedAt && run.startedAt
      ? run.finishedAt.getTime() - run.startedAt.getTime()
      : null;
  const durationText =
    durationMs !== null
      ? durationMs < 1000
        ? `${durationMs} ms`
        : `${(durationMs / 1000).toFixed(1)} dtk`
      : isRunning
        ? "berjalan…"
        : "—";

  const accountLabel =
    run.connection.externalAccountName ?? run.connection.externalAccountId;

  return (
    <div className={cn("flex flex-col gap-2 rounded-md border p-3", tone)}>
      <div className="flex items-start gap-3">
        <Icon className={cn("size-4 shrink-0 mt-0.5", iconTone)} />
        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="text-foreground text-sm font-medium">
              {run.connection.connectorId}
            </span>
            <span className="text-muted-foreground text-xs">
              {accountLabel}
            </span>
            <span className="bg-background text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
              {run.status}
            </span>
          </div>
          <div className="text-muted-foreground text-xs flex flex-wrap gap-x-3 gap-y-0.5 tabular-nums">
            <span>
              {formatDistanceToNow(run.startedAt, {
                addSuffix: true,
                locale: idLocale,
              })}
            </span>
            <span>· {durationText}</span>
            {run.rangeStart && run.rangeEnd ? (
              <span>
                · range {run.rangeStart} → {run.rangeEnd}
              </span>
            ) : null}
            {run.recordsCount !== null ? (
              <span>· {idFmt.format(run.recordsCount)} record</span>
            ) : null}
          </div>
        </div>
      </div>
      {isError && run.errorMessage ? (
        <pre className="bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100 ml-7 max-h-40 overflow-auto rounded border border-rose-200 dark:border-rose-900 p-2 text-[11px] leading-relaxed whitespace-pre-wrap">
          {run.errorMessage}
        </pre>
      ) : null}
    </div>
  );
}
