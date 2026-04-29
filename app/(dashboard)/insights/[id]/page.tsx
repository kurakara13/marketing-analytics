import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { findInsightByIdForUser } from "@/lib/ai/insights";
import { getFeedbackForInsight } from "@/lib/insight-feedback";
import { getFeedbackForDrilldown } from "@/lib/drilldown-feedback";
import { findDrilldown } from "@/lib/ai/drilldown";
import { db } from "@/lib/db";
import { insightDrilldowns, type InsightDrilldown } from "@/lib/db/schema";
import { and, eq, lt } from "drizzle-orm";
import { insights as insightsTable } from "@/lib/db/schema";
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

  // Sibling lookups in parallel: feedback for this insight, the
  // immediately-previous insight (for the Bandingkan link), and
  // cached drilldowns for all observations.
  const [feedback, drilldownRows, previousInsight] = await Promise.all([
    getFeedbackForInsight({
      userId: session.user.id,
      insightId: insight.id,
    }),
    db
      .select()
      .from(insightDrilldowns)
      .where(eq(insightDrilldowns.insightId, insight.id)),
    db.query.insights.findFirst({
      where: and(
        eq(insightsTable.userId, session.user.id),
        lt(insightsTable.createdAt, insight.createdAt),
      ),
      orderBy: (i, { desc }) => [desc(i.createdAt)],
    }),
  ]);

  const drilldownsByIndex = new Map<number, InsightDrilldown>();
  for (const d of drilldownRows) {
    drilldownsByIndex.set(d.observationIndex, d);
  }

  // Drilldown feedback per drilldown id, fetched in parallel.
  const drilldownFeedbackEntries = await Promise.all(
    drilldownRows.map(async (row) => {
      const map = await getFeedbackForDrilldown({
        userId: session.user.id!,
        drilldownId: row.id,
      });
      return [row.id, map] as const;
    }),
  );
  const drilldownFeedbackById = new Map(drilldownFeedbackEntries);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/insights"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "self-start -ml-3",
        )}
      >
        <ArrowLeft className="size-4" />
        Semua insights
      </Link>

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
