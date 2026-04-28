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
} from "@/lib/insight-feedback";
import { FeedbackButtons } from "./feedback-buttons";
import { ShareButton } from "./share-button";
import { DrilldownButton } from "./drilldown-button";

const SEVERITY_STYLES: Record<
  InsightObservation["severity"],
  { icon: typeof Info; className: string; label: string }
> = {
  info: {
    icon: Info,
    className:
      "text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950 border-sky-200 dark:border-sky-900",
    label: "Info",
  },
  warning: {
    icon: AlertTriangle,
    className:
      "text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 border-amber-200 dark:border-amber-900",
    label: "Warning",
  },
  alert: {
    icon: AlertCircle,
    className:
      "text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950 border-rose-200 dark:border-rose-900",
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
  drilldownsByIndex,
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
  /** Pre-fetched drilldowns keyed by observationIndex. When omitted,
   *  the drilldown button still works but starts in "no cache" state.
   *  Public share view should pass an empty Map to disable. */
  drilldownsByIndex?: Map<number, InsightDrilldown>;
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
              <Sparkles className="size-4" />
              Insight {insight.windowStart} → {insight.windowEnd}
            </CardTitle>
            <CardDescription>
              Dibuat {ago} · {insight.windowDays} hari · {insight.modelUsed}
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
                        "rounded-md border p-3 text-sm",
                        style.className,
                      )}
                    >
                      <div className="mb-1 flex items-center gap-2 font-medium">
                        <Icon className="size-4 shrink-0" />
                        <span className="min-w-0 flex-1">{o.title}</span>
                        {feedback ? (
                          <FeedbackButtons
                            insightId={insight.id}
                            kind="observation"
                            itemIndex={i}
                            initialRating={rating}
                          />
                        ) : null}
                      </div>
                      <p className="text-foreground/90 text-sm leading-relaxed">
                        {o.description}
                      </p>
                      {isInvestigable ? (
                        <div className="mt-2 flex justify-end">
                          <DrilldownButton
                            insightId={insight.id}
                            observationIndex={i}
                            initial={drilldownsByIndex.get(i) ?? null}
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
                      className="bg-muted/30 rounded-md border p-3 text-sm"
                    >
                      <div className="mb-1 flex items-center gap-2 font-medium">
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-xs font-medium",
                            style.className,
                          )}
                        >
                          {style.label}
                        </span>
                        <span className="min-w-0 flex-1">{r.title}</span>
                        {feedback ? (
                          <FeedbackButtons
                            insightId={insight.id}
                            kind="recommendation"
                            itemIndex={i}
                            initialRating={rating}
                          />
                        ) : null}
                      </div>
                      <p className="text-foreground/90 text-sm leading-relaxed">
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
