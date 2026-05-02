import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/db/schema";

// Editorial "feature story" treatment of the latest insight.
// Reads like the cover of a daily briefing — display serif title,
// quiet eyebrow with metadata, two-line summary preview, single
// strong CTA. Designed to be the first thing the user sees on
// /dashboard so the dashboard answers "what's the headline today".
//
// Shows severity counts as inline chips (3 alert · 2 watch) so a
// scan tells the user how serious the latest insight is before
// they click in.

type Props = {
  insight: Insight;
};

export function LatestInsightHero({ insight }: Props) {
  const ago = formatDistanceToNow(insight.createdAt, {
    addSuffix: true,
    locale: idLocale,
  });

  // Bucket severity counts.
  const counts = { alert: 0, warning: 0, info: 0 };
  for (const o of insight.observations) {
    counts[o.severity] = (counts[o.severity] ?? 0) + 1;
  }
  const recCount = insight.recommendations.length;

  return (
    <article className="bg-card border-border/60 relative flex flex-col gap-4 overflow-hidden rounded-xl border p-6 sm:p-8">
      {/* Subtle paper-grain decorative band on the right edge —
       *  small editorial flourish that whispers "feature article". */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-primary/40 via-primary/15 to-transparent"
      />

      <header className="flex flex-col gap-2">
        <div className="text-muted-foreground/80 inline-flex items-center gap-2 text-[11px]">
          <Sparkles className="text-primary size-3" />
          <span className="font-display italic tracking-wide">
            Insight terbaru
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span>{insight.windowStart} → {insight.windowEnd}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>dibuat {ago}</span>
        </div>

        <h2 className="text-foreground font-display text-[26px] font-medium leading-[1.18] tracking-tight sm:text-[32px]">
          {insight.title ??
            `Insight ${insight.windowStart} → ${insight.windowEnd}`}
        </h2>
      </header>

      {/* 2-line preview of the executive summary — clamped + faded
       *  edge so it whispers "more on the inside". */}
      <p className="text-foreground/75 line-clamp-2 max-w-2xl text-[14px] leading-relaxed">
        {insight.executiveSummary}
      </p>

      <footer className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums">
          {counts.alert > 0 ? (
            <Pill tone="alert" label={`${counts.alert} alert`} />
          ) : null}
          {counts.warning > 0 ? (
            <Pill tone="warning" label={`${counts.warning} watch`} />
          ) : null}
          {counts.info > 0 ? (
            <Pill tone="info" label={`${counts.info} info`} />
          ) : null}
          {recCount > 0 ? (
            <Pill tone="rec" label={`${recCount} rekomendasi`} />
          ) : null}
        </div>
        <Link
          href={`/insights/${insight.id}`}
          className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
        >
          Buka full insight
          <ArrowRight className="size-3.5" />
        </Link>
      </footer>
    </article>
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

function Pill({
  tone,
  label,
}: {
  tone: "alert" | "warning" | "info" | "rec";
  label: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
        TONE_STYLES[tone],
      )}
    >
      {label}
    </span>
  );
}
