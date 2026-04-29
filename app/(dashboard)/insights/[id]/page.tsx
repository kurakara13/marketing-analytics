import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

import { auth } from "@/lib/auth";
import {
  findInsightByIdForUser,
  findNextInsightFor,
  findPreviousInsightFor,
} from "@/lib/ai/insights";
import { getFeedbackForInsight } from "@/lib/insight-feedback";
import { getFeedbackForDrilldowns } from "@/lib/drilldown-feedback";
import { findDrilldown } from "@/lib/ai/drilldown";
import { db } from "@/lib/db";
import { insightDrilldowns, type InsightDrilldown } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buttonVariants } from "@/components/ui/button";
import { InsightCard } from "@/components/insights/insight-card";
import { cn } from "@/lib/utils";

// Bookmarkable single-insight permalink. Mirror of one card from the
// /insights list — same actions (share, rename, delete, drilldown,
// feedback) — but standalone for linking, in-app navigation, and
// browser history. NOT a public share view (that's /share/insight/...);
// this is owner-only and uses the regular dashboard shell.
type Params = Promise<{ id: string }>;

export default async function InsightDetailPage({
  params,
}: {
  params: Params;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const insight = await findInsightByIdForUser({
    userId: session.user.id,
    insightId: id,
  });
  if (!insight) notFound();

  // Sibling lookups in parallel: feedback for this insight, prev +
  // next insight (for nav + Bandingkan link), and cached drilldowns
  // for all observations.
  const [feedback, drilldownRows, previousInsight, nextInsight] =
    await Promise.all([
      getFeedbackForInsight({
        userId: session.user.id,
        insightId: insight.id,
      }),
      db
        .select()
        .from(insightDrilldowns)
        .where(eq(insightDrilldowns.insightId, insight.id)),
      findPreviousInsightFor({
        userId: session.user.id,
        insightId: insight.id,
      }),
      findNextInsightFor({
        userId: session.user.id,
        insightId: insight.id,
      }),
    ]);

  const drilldownsByIndex = new Map<number, InsightDrilldown>();
  for (const d of drilldownRows) {
    drilldownsByIndex.set(d.observationIndex, d);
  }

  // One IN-list batch for all drilldown feedback.
  const drilldownFeedbackById = await getFeedbackForDrilldowns({
    userId: session.user.id,
    drilldownIds: drilldownRows.map((d: InsightDrilldown) => d.id),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/insights"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-3",
          )}
        >
          <ArrowLeft className="size-4" />
          Semua insights
        </Link>
        <div className="flex items-center gap-1">
          {previousInsight ? (
            <Link
              href={`/insights/${previousInsight.id}`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
              )}
              title={
                previousInsight.title ??
                `${previousInsight.windowStart} → ${previousInsight.windowEnd}`
              }
            >
              <ChevronLeft className="size-3.5" />
              <span className="hidden sm:inline">Lebih lama</span>
            </Link>
          ) : null}
          {nextInsight ? (
            <Link
              href={`/insights/${nextInsight.id}`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
              )}
              title={
                nextInsight.title ??
                `${nextInsight.windowStart} → ${nextInsight.windowEnd}`
              }
            >
              <span className="hidden sm:inline">Lebih baru</span>
              <ChevronRight className="size-3.5" />
            </Link>
          ) : null}
        </div>
      </div>

      <InsightCard
        insight={insight}
        previousInsightId={previousInsight?.id ?? null}
        feedback={feedback}
        drilldownsByIndex={drilldownsByIndex}
        drilldownFeedbackById={drilldownFeedbackById}
      />
    </div>
  );
}

// Suppress findDrilldown unused-warning if it ever becomes the path
// we take for single lookups; currently we batch with a single
// select to keep latency identical to /insights.
void findDrilldown;
