import Link from "next/link";
import {
  AlertCircle,
  ArrowLeftRight,
  Info,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type {
  Insight,
  InsightObservation,
  InsightRecommendation,
} from "@/lib/db/schema";
import type { InsightDrilldown } from "@/lib/db/schema";
import {
  feedbackKey,
  type InsightFeedbackMap,
  type DrilldownFeedbackMap,
} from "@/lib/feedback-keys";
import { FeedbackButtons } from "./feedback-buttons";
import { ShareButton } from "./share-button";
import { DrilldownButton } from "./drilldown-button";
import { InsightActions } from "./insight-actions";

// Per-severity styling for observation cards. We use a left-edge
// accent bar (border-l-4) + subtle tinted background instead of a
// fully-saturated bg block — quieter visual, still strong scannable
// signal at the edge.
const SEVERITY_STYLES: Record<
  InsightObservation["severity"],
  {
    icon: typeof Info;
    /** Outer card wrapper (border-l + bg). */
    card: string;
    /** Severity pill (icon + label). */
    pill: string;
    /** Pill label. */
    label: string;
  }
> = {
  info: {
    icon: Info,
    card: "border-l-sky-400 bg-sky-50/40 dark:border-l-sky-700 dark:bg-sky-950/30",
    pill: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    label: "Info",
  },
  warning: {
    icon: AlertTriangle,
    card: "border-l-amber-400 bg-amber-50/40 dark:border-l-amber-700 dark:bg-amber-950/30",
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    label: "Watch",
  },
  alert: {
    icon: AlertCircle,
    card: "border-l-rose-500 bg-rose-50/40 dark:border-l-rose-700 dark:bg-rose-950/30",
    pill: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    label: "Alert",
  },
};

const PRIORITY_STYLES: Record<
  InsightRecommendation["priority"],
  { className: string; label: string }
> = {
  low: {
    className: "bg-muted text-muted-foreground border-muted-foreground/20",
    label: "Low",
  },
  medium: {
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-amber-200 dark:border-amber-900",
    label: "Medium",
  },
  high: {
    className:
      "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border-rose-200 dark:border-rose-900",
    label: "High",
  },
};

export function InsightCard({
  insight,
  previousInsightId,
  feedback,
  showShare = true,
  linkTitle = false,
  drilldownsByIndex,
  drilldownFeedbackById,
}: {
  insight: Insight;
  /** When set, renders a "Bandingkan" button that links to the
   *  comparison view with this insight as `a` (newer) and the previous
   *  one as `b` (older). Pass null to hide — typically used when there's
   *  no previous insight to compare against. */
  previousInsightId?: string | null;
  /** Initial feedback ratings the user has already left on this
   *  insight's observations / recommendations. Lookup by
   *  `feedbackKey({kind, itemIndex})`. When omitted, all items render
   *  in neutral state — useful for read-only contexts (e.g. compare
   *  page) where we don't want feedback widgets. */
  feedback?: InsightFeedbackMap;
  /** Hide the share button — used by the public share page itself
   *  (recipients can't share further) and any other read-only context. */
  showShare?: boolean;
  /** When true, render the card title as a link to /insights/<id>.
   *  Used by the list page so each card is navigable to its
   *  permalink. Detail page itself passes false (no self-link). */
  linkTitle?: boolean;
  /** Pre-fetched drilldowns keyed by observationIndex. When omitted,
   *  the drilldown button still works but starts in "no cache" state.
   *  Public share view should pass an empty Map to disable. */
  drilldownsByIndex?: Map<number, InsightDrilldown>;
  /** Optional pre-fetched feedback ratings keyed by drilldownId. The
   *  card looks up by id when rendering each DrilldownButton; absent
   *  entries render the button in neutral state. */
  drilldownFeedbackById?: Map<string, DrilldownFeedbackMap>;
}) {
  const ago = formatDistanceToNow(insight.createdAt, {
    addSuffix: true,
    locale: idLocale,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 shrink-0" />
              {linkTitle ? (
                <Link
                  href={`/insights/${insight.id}`}
                  className="min-w-0 hover:underline underline-offset-4"
                >
                  {insight.title ?? `Insight ${insight.windowStart} → ${insight.windowEnd}`}
                </Link>
              ) : (
                <span className="min-w-0">
                  {insight.title ?? `Insight ${insight.windowStart} → ${insight.windowEnd}`}
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {insight.windowStart} → {insight.windowEnd} · dibuat {ago} ·{" "}
              {insight.windowDays} hari · {insight.modelUsed}
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {showShare ? (
              <ShareButton
                insightId={insight.id}
                initialToken={insight.shareToken}
              />
            ) : null}
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
            {showShare ? (
              <InsightActions
                insightId={insight.id}
                currentTitle={insight.title}
              />
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <p className="text-sm leading-relaxed">{insight.executiveSummary}</p>

        {insight.observations.length > 0 ? (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Observations
              </h3>
              <ul className="space-y-2">
                {insight.observations.map((o, i) => {
                  const style = SEVERITY_STYLES[o.severity];
                  const Icon = style.icon;
                  const rating = feedback?.get(
                    feedbackKey({ kind: "observation", itemIndex: i }),
                  ) ?? 0;
                  // Drilldown is only meaningful for severity that
                  // suggests a problem worth investigating. Plain
                  // info observations don't get a button to keep the
                  // UI un-cluttered.
                  const isInvestigable =
                    drilldownsByIndex !== undefined &&
                    (o.severity === "warning" || o.severity === "alert");
                  return (
                    <li
                      key={i}
                      className={cn(
                        "rounded-md border border-border/60 border-l-4 p-3 text-sm",
                        style.card,
                      )}
                    >
                      <div className="mb-1.5 flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            style.pill,
                          )}
                        >
                          <Icon className="size-3" />
                          {style.label}
                        </span>
                        <span className="text-foreground min-w-0 flex-1 font-medium">
                          {o.title}
                        </span>
                        {feedback ? (
                          <FeedbackButtons
                            insightId={insight.id}
                            kind="observation"
                            itemIndex={i}
                            initialRating={rating}
                          />
                        ) : null}
                      </div>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {o.description}
                      </p>
                      {isInvestigable ? (
                        <div className="mt-2 flex justify-end">
                          <DrilldownButton
                            insightId={insight.id}
                            observationIndex={i}
                            initial={drilldownsByIndex.get(i) ?? null}
                            initialFeedback={(() => {
                              const d = drilldownsByIndex.get(i);
                              return d
                                ? drilldownFeedbackById?.get(d.id)
                                : undefined;
                            })()}
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        ) : null}

        {insight.recommendations.length > 0 ? (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Rekomendasi
              </h3>
              <ul className="space-y-2">
                {insight.recommendations.map((r, i) => {
                  const style = PRIORITY_STYLES[r.priority];
                  const rating = feedback?.get(
                    feedbackKey({ kind: "recommendation", itemIndex: i }),
                  ) ?? 0;
                  return (
                    <li
                      key={i}
                      className="bg-muted/30 rounded-md border border-border/60 p-3 text-sm"
                    >
                      <div className="mb-1.5 flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            style.className,
                          )}
                        >
                          {style.label}
                        </span>
                        <span className="text-foreground min-w-0 flex-1 font-medium">
                          {r.title}
                        </span>
                        {feedback ? (
                          <FeedbackButtons
                            insightId={insight.id}
                            kind="recommendation"
                            itemIndex={i}
                            initialRating={rating}
                          />
                        ) : null}
                      </div>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {r.description}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
