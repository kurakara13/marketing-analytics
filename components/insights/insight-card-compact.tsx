"use client";

import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Info,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/db/schema";
import { ShareButton } from "./share-button";
import { InsightActions } from "./insight-actions";

// Compact "archive" view of an insight, used for older entries on
// /insights below the latest "hero" card. Shows just enough to scan
// quickly:
//   - title (linked to permalink)
//   - meta line (window + age + model)
//   - 1-line truncated executive summary
//   - severity counts as colored pills (e.g. "1 alert · 2 watch")
//   - actions: Share + Bandingkan + ⋯ menu
//
// Click anywhere on the card body navigates to the permalink for
// the full view. Buttons + menu use stopPropagation via being
// outside the linked region.

type Props = {
  insight: Insight;
  /** Older insight id to link the Bandingkan button. Null = no
   *  previous to compare against (oldest in list). */
  previousInsightId?: string | null;
};

export function InsightCardCompact({ insight, previousInsightId }: Props) {
  const ago = formatDistanceToNow(insight.createdAt, {
    addSuffix: true,
    locale: idLocale,
  });

  // Bucket observation severity counts.
  const counts = { alert: 0, warning: 0, info: 0 };
  for (const o of insight.observations) {
    counts[o.severity] = (counts[o.severity] ?? 0) + 1;
  }
  const recommendationCount = insight.recommendations.length;

  return (
    <div className="group bg-card hover:border-border/80 hover:shadow-sm relative flex flex-col gap-3 rounded-lg border border-border/60 p-4 transition-all">
      <Link
        href={`/insights/${insight.id}`}
        className="absolute inset-0 z-0 rounded-lg"
        aria-label={`Buka insight ${insight.title ?? insight.windowStart}`}
      />

      {/* Header row: title + meta + actions */}
      <div className="relative z-10 flex items-start gap-3">
        <div className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-md">
          <Sparkles className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-foreground text-sm font-semibold leading-tight group-hover:text-primary transition-colors">
            {insight.title ??
              `Insight ${insight.windowStart} → ${insight.windowEnd}`}
          </h3>
          <p className="text-muted-foreground mt-0.5 text-[11px]">
            {insight.windowStart} → {insight.windowEnd} · {ago}
          </p>
        </div>
        <div
          className="flex shrink-0 items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <ShareButton
            insightId={insight.id}
            initialToken={insight.shareToken}
          />
          {previousInsightId ? (
            <Link
              href={`/insights/compare?a=${insight.id}&b=${previousInsightId}`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
              )}
            >
              <ArrowLeftRight className="size-3.5" />
              Bandingkan
            </Link>
          ) : null}
          <InsightActions
            insightId={insight.id}
            currentTitle={insight.title}
          />
        </div>
      </div>

      {/* Executive summary preview — 1 line, fades to ellipsis */}
      <p className="text-muted-foreground relative z-0 line-clamp-1 text-xs leading-relaxed pointer-events-none">
        {insight.executiveSummary}
      </p>

      {/* Severity pills + recommendation count */}
      <div className="relative z-0 flex flex-wrap items-center gap-1.5 text-[10px] pointer-events-none">
        {counts.alert > 0 ? (
          <SeverityPill
            icon={AlertCircle}
            count={counts.alert}
            label="alert"
            tone="alert"
          />
        ) : null}
        {counts.warning > 0 ? (
          <SeverityPill
            icon={AlertTriangle}
            count={counts.warning}
            label="watch"
            tone="warning"
          />
        ) : null}
        {counts.info > 0 ? (
          <SeverityPill
            icon={Info}
            count={counts.info}
            label="info"
            tone="info"
          />
        ) : null}
        {recommendationCount > 0 ? (
          <SeverityPill
            icon={CheckCircle2}
            count={recommendationCount}
            label="rekomendasi"
            tone="rec"
          />
        ) : null}
      </div>
    </div>
  );
}

const TONE_STYLES: Record<string, string> = {
  alert:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900",
  warning:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900",
  info: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-900",
  rec: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900",
};

function SeverityPill({
  icon: Icon,
  count,
  label,
  tone,
}: {
  icon: typeof AlertCircle;
  count: number;
  label: string;
  tone: "alert" | "warning" | "info" | "rec";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-medium",
        TONE_STYLES[tone],
      )}
    >
      <Icon className="size-3" />
      {count} {label}
    </span>
  );
}
