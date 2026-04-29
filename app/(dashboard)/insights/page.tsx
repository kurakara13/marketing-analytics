import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { getUsageStatus, listInsightsForUser } from "@/lib/ai/insights";
import { getDrilldownUsage } from "@/lib/ai/drilldown";
import { getFeedbackForInsight } from "@/lib/insight-feedback";
import { getFeedbackForDrilldown } from "@/lib/drilldown-feedback";
import { listConnectionsForUser } from "@/lib/connections";
import { detectInterestingPeriods } from "@/lib/period-detection";
import { db } from "@/lib/db";
import { insightDrilldowns, type InsightDrilldown } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { SuggestedPeriods } from "@/components/insights/suggested-periods";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GenerateInsightsButton } from "@/components/insights/generate-insights-button";
import { InsightCard } from "@/components/insights/insight-card";
import { cn } from "@/lib/utils";

export default async function InsightsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const [insights, usage, drilldownUsage, suggestedPeriods] = await Promise.all([
    listInsightsForUser(userId),
    getUsageStatus(userId),
    getDrilldownUsage(userId),
    detectInterestingPeriods(userId),
  ]);

  // Pull all feedback rows in parallel — one query per insight is fine
  // for the 20-row limit. Switch to a batched IN-list query if list
  // grows beyond ~50.
  const feedbackPerInsight = await Promise.all(
    insights.map((i) =>
      getFeedbackForInsight({ userId, insightId: i.id }),
    ),
  );

  // Single batched query for all cached drilldowns across the
  // displayed insights, then group by insightId for per-card lookup.
  const drilldownRows: InsightDrilldown[] = insights.length
    ? await db
        .select()
        .from(insightDrilldowns)
        .where(
          inArray(
            insightDrilldowns.insightId,
            insights.map((i) => i.id),
          ),
        )
    : [];
  const drilldownsByInsight = new Map<string, Map<number, InsightDrilldown>>();
  for (const row of drilldownRows) {
    const inner =
      drilldownsByInsight.get(row.insightId) ?? new Map<number, InsightDrilldown>();
    inner.set(row.observationIndex, row);
    drilldownsByInsight.set(row.insightId, inner);
  }

  // Drilldown feedback per drilldown id — fetched in parallel and
  // looked up by InsightCard when rendering each DrilldownButton.
  const drilldownFeedbackEntries = await Promise.all(
    drilldownRows.map(async (row) => {
      const map = await getFeedbackForDrilldown({
        userId,
        drilldownId: row.id,
      });
      return [row.id, map] as const;
    }),
  );
  const drilldownFeedbackById = new Map(drilldownFeedbackEntries);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
          <p className="text-muted-foreground text-sm">
            Analisis data marketing Anda dengan AI. Setiap generate
            menghasilkan ringkasan, observasi, dan rekomendasi yang actionable.
          </p>
          <p
            className={cn(
              "mt-1 text-xs",
              usage.remaining === 0
                ? "text-rose-600"
                : usage.remaining <= 3
                  ? "text-amber-600"
                  : "text-muted-foreground/70",
            )}
          >
            Quota hari ini: {usage.used} / {usage.limit} insight ·{" "}
            {drilldownUsage.used} / {drilldownUsage.limit} drill-down
            (rolling 24 jam)
            {usage.resetsAt
              ? ` · slot insight berikutnya ${usage.resetsAt.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}`
              : null}
          </p>
        </div>
        <GenerateInsightsButton />
      </div>

      <SuggestedPeriods suggestions={suggestedPeriods} />

      {insights.length === 0 ? (
        <InsightsEmptyState userId={userId} />
      ) : (
        <div className="grid gap-4">
          {insights.map((insight, idx) => {
            // The list is sorted by createdAt desc, so the next item in
            // the array is the immediately-previous insight in time.
            // Pass its id so the card can link straight to /compare.
            const previousInsightId = insights[idx + 1]?.id ?? null;
            return (
              <InsightCard
                key={insight.id}
                insight={insight}
                previousInsightId={previousInsightId}
                feedback={feedbackPerInsight[idx]}
                drilldownsByIndex={
                  drilldownsByInsight.get(insight.id) ?? new Map()
                }
                drilldownFeedbackById={drilldownFeedbackById}
                linkTitle
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Empty state ────────────────────────────────────────────────────
//
// Branches on whether the user has connections yet:
// - No connections → "Connect data first" with link to /data-sources.
// - Has connections → "Generate first insight" with the actual generate
//   button so they can fire it without leaving the page.
async function InsightsEmptyState({ userId }: { userId: string }) {
  const connections = await listConnectionsForUser(userId);
  const realConnections = connections.filter(
    (c) => !c.externalAccountId.startsWith("_pending_"),
  );
  const hasConnection = realConnections.length > 0;

  if (!hasConnection) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Belum ada koneksi data source</CardTitle>
          <CardDescription>
            Hubungkan Google Analytics 4 atau Google Ads dulu — AI butuh data
            untuk menganalisis. Setelah connect & sync, kembali ke sini dan
            klik <strong>Generate insight</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/data-sources"
            className={cn(buttonVariants({ variant: "default" }))}
          >
            Connect data source
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Belum ada insight — yuk generate yang pertama</CardTitle>
        <CardDescription>
          Anda sudah punya {realConnections.length} koneksi aktif. Klik tombol{" "}
          <strong>Generate insight</strong> di kanan atas — AI akan analyze
          data 7 hari terakhir Anda dan keluarkan ringkasan, observation, dan
          rekomendasi. Butuh ~10–30 detik. Pertimbangkan setting{" "}
          <Link href="/settings" className="underline underline-offset-4">
            konteks bisnis
          </Link>{" "}
          dulu agar insight lebih relevan.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
