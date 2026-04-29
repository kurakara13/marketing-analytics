import { redirect } from "next/navigation";
import Link from "next/link";
import { Database, Sparkles } from "lucide-react";

import { auth } from "@/lib/auth";
import { getUsageStatus, listInsightsForUser } from "@/lib/ai/insights";
import { getDrilldownUsage } from "@/lib/ai/drilldown";
import { getFeedbackForInsights } from "@/lib/insight-feedback";
import { getFeedbackForDrilldowns } from "@/lib/drilldown-feedback";
import { listConnectionsForUser } from "@/lib/connections";
import { detectInterestingPeriods } from "@/lib/period-detection";
import { db } from "@/lib/db";
import { insightDrilldowns, type InsightDrilldown } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { SuggestedPeriods } from "@/components/insights/suggested-periods";
import { InsightsFilter } from "@/components/insights/insights-filter";
import { buildInsightSearchText } from "@/lib/insight-search";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { GenerateInsightsButton } from "@/components/insights/generate-insights-button";
import { InsightCard } from "@/components/insights/insight-card";
import { InsightCardCompact } from "@/components/insights/insight-card-compact";
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

  // One IN-list query for ALL insights' feedback (no N+1).
  const feedbackByInsight = await getFeedbackForInsights({
    userId,
    insightIds: insights.map((i) => i.id),
  });

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

  // One IN-list query for all drilldown feedback (no N+1).
  const drilldownFeedbackById = await getFeedbackForDrilldowns({
    userId,
    drilldownIds: drilldownRows.map((d) => d.id),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Sparkles}
        title="Insights"
        subtitle="Analisis data marketing Anda dengan AI. Setiap generate menghasilkan ringkasan, observasi, dan rekomendasi yang actionable."
        meta={
          <p
            className={cn(
              "text-xs",
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
        }
        actions={<GenerateInsightsButton />}
      />

      <SuggestedPeriods suggestions={suggestedPeriods} />

      {insights.length === 0 ? (
        <InsightsEmptyState userId={userId} />
      ) : (
        <InsightsFilter
          items={insights.map((i) => ({
            id: i.id,
            searchText: buildInsightSearchText(i),
          }))}
        >
          {insights.map((insight, idx) => {
            // The list is sorted by createdAt desc, so the next item in
            // the array is the immediately-previous insight in time.
            // Pass its id so the card can link straight to /compare.
            const previousInsightId = insights[idx + 1]?.id ?? null;

            // Latest insight (idx=0) renders as the full hero card —
            // it's what the user usually wants to read right now.
            // Older insights collapse to a compact summary so the
            // page stays scannable when 20+ insights accumulate.
            if (idx === 0) {
              return (
                <div key={insight.id} className="flex flex-col gap-2">
                  <SectionLabel
                    eyebrow="Insight terbaru"
                    helper="Hasil generate paling baru — buka detail untuk drill-down per observation"
                  />
                  <InsightCard
                    insight={insight}
                    previousInsightId={previousInsightId}
                    feedback={feedbackByInsight.get(insight.id) ?? new Map()}
                    drilldownsByIndex={
                      drilldownsByInsight.get(insight.id) ?? new Map()
                    }
                    drilldownFeedbackById={drilldownFeedbackById}
                    linkTitle
                  />
                </div>
              );
            }

            // Subsequent items: compact card. The first compact item
            // gets the "Riwayat" eyebrow above it.
            const isFirstHistorical = idx === 1;
            return (
              <div key={insight.id} className="flex flex-col gap-2">
                {isFirstHistorical ? (
                  <SectionLabel
                    eyebrow="Riwayat"
                    helper={`${insights.length - 1} insight lebih lama — klik untuk buka detail`}
                  />
                ) : null}
                <InsightCardCompact
                  insight={insight}
                  previousInsightId={previousInsightId}
                />
              </div>
            );
          })}
        </InsightsFilter>
      )}
    </div>
  );
}

function SectionLabel({
  eyebrow,
  helper,
}: {
  eyebrow: string;
  helper?: string;
}) {
  return (
    <div className="flex items-baseline gap-2 mt-2">
      <span className="text-foreground text-xs font-semibold uppercase tracking-[0.08em]">
        {eyebrow}
      </span>
      {helper ? (
        <span className="text-muted-foreground text-[11px]">· {helper}</span>
      ) : null}
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
      <EmptyState
        icon={Database}
        title="Belum ada koneksi data source"
        description={
          <>
            Hubungkan Google Analytics 4 atau Google Ads dulu — AI butuh
            data untuk menganalisis. Setelah connect & sync, kembali ke
            sini dan klik <strong>Generate insight</strong>.
          </>
        }
        action={
          <Link
            href="/data-sources"
            className={cn(buttonVariants({ variant: "default" }))}
          >
            Connect data source
          </Link>
        }
      />
    );
  }

  return (
    <EmptyState
      icon={Sparkles}
      tone="primary"
      title="Yuk generate insight pertama"
      description={
        <>
          Anda sudah punya {realConnections.length} koneksi aktif. Klik
          tombol <strong>Generate insight</strong> di kanan atas — AI
          analyze data 7 hari terakhir, keluarkan ringkasan + observation
          + rekomendasi. Butuh ~10–30 detik.
        </>
      }
      footer={
        <>
          Tip: set{" "}
          <Link href="/settings" className="underline underline-offset-4">
            konteks bisnis
          </Link>{" "}
          dulu agar insight lebih relevan.
        </>
      }
    />
  );
}
