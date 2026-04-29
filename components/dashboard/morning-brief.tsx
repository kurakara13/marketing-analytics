import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/db/schema";

// Compact preview of the most recent AI insight, rendered at the top
// of /dashboard. Shows the executive summary plus the top observation
// titles (most-severe first) — enough for at-a-glance "what should I
// pay attention to today" without forcing the user into /insights
// for every check-in.
//
// Scope note: dashboard KPI cards reflect the user's selected window
// (default 30 days), but this insight is always for its own pinned
// window (typically 7 days, the period the AI was generated for). To
// avoid the apparent mismatch ("Sessions +28%" in KPI vs "+3%" in
// summary), we surface the insight window prominently in the header
// + the meta line — no hidden assumption of "same period as KPIs".
//
// Hidden when there's no insight yet (the dashboard's onboarding
// banner already covers that step).

const SEVERITY_ORDER: Record<string, number> = {
  alert: 0,
  warning: 1,
  info: 2,
};

const SEVERITY_PILL_STYLES: Record<string, string> = {
  alert: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  warning:
    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
};
const SEVERITY_LABELS: Record<string, string> = {
  alert: "Alert",
  warning: "Watch",
  info: "Info",
};

export function MorningBrief({ insight }: { insight: Insight }) {
  const ago = formatDistanceToNow(insight.createdAt, {
    addSuffix: true,
    locale: idLocale,
  });

  // Pick top 3 observations by severity desc, falling back to original
  // order for ties. Caps at 3 even if all alerts to keep the brief
  // small — full list lives at /insights.
  const topObservations = [...insight.observations]
    .sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
    )
    .slice(0, 3);

  return (
    <Card className="border-primary/20 from-primary/5 bg-gradient-to-br to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 shrink-0 text-primary" />
              <Link
                href={`/insights/${insight.id}`}
                className="min-w-0 hover:underline underline-offset-4"
              >
                {insight.title ?? `AI brief — ${insight.windowStart} → ${insight.windowEnd}`}
              </Link>
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                {insight.windowDays} hari · {insight.windowStart} →{" "}
                {insight.windowEnd}
              </span>
              <span>· dibuat {ago} · {insight.modelUsed}</span>
            </CardDescription>
          </div>
          <Link
            href={`/insights/${insight.id}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "shrink-0",
            )}
          >
            Buka full insight
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-foreground/90 text-sm leading-relaxed">
          {insight.executiveSummary}
        </p>
        {topObservations.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {topObservations.map((o, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                    SEVERITY_PILL_STYLES[o.severity],
                  )}
                >
                  {SEVERITY_LABELS[o.severity]}
                </span>
                <span className="min-w-0 flex-1 leading-snug">
                  <span className="font-medium">{o.title}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
