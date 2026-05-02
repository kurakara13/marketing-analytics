import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { listInsightsForUser, getUsageStatus } from "@/lib/ai/insights";
import { getDrilldownUsage } from "@/lib/ai/drilldown";
import { listConnectionsWithSyncForUser } from "@/lib/connections";
import { getOnboardingSteps } from "@/lib/onboarding";
import { getDashboardActivityFeed } from "@/lib/dashboard-feed";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting";
import { LatestInsightHero } from "@/components/dashboard/latest-insight-hero";
import { UrgentObservations } from "@/components/dashboard/urgent-observations";
import { PlatformStatus } from "@/components/dashboard/platform-status";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { DashboardShortcuts } from "@/components/dashboard/dashboard-shortcuts";

// /dashboard — "Editorial Daily Briefing".
//
// Replaces the earlier scoreboard layout (KPI grid + trend chart +
// campaign table). Reasoning: with multiple data sources the
// aggregate KPIs become misleading, and the chart/table belong on
// per-source detail pages anyway. The dashboard's job is to be the
// daily orientation surface — what AI is telling you, what's urgent,
// platform health, and recent workspace activity.
//
// Sections (top → bottom):
//   1. Greeting + date eyebrow
//   2. Latest insight hero (feature card)
//   3. 3 urgent observations across recent insights
//   4. Platform status strip (connections + AI quota)
//   5. Activity feed (insights + drilldowns + sync runs interleaved)
//   6. Quick shortcuts row
//
// Empty state: when no connections at all, we fall through to the
// onboarding hero (same as before).

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const greetingName = session.user.name ?? null;

  const [
    onboardingSteps,
    insights,
    connectionsWithSync,
    insightUsage,
    drilldownUsage,
    activity,
  ] = await Promise.all([
    getOnboardingSteps(userId),
    listInsightsForUser(userId),
    listConnectionsWithSyncForUser(userId),
    getUsageStatus(userId),
    getDrilldownUsage(userId),
    getDashboardActivityFeed(userId),
  ]);

  const onboardingComplete = onboardingSteps.every((s) => s.done);
  const realConnections = connectionsWithSync.filter(
    (c) => !c.externalAccountId.startsWith("_pending_"),
  );

  // Brand-new user — show onboarding hero instead of empty briefing.
  if (realConnections.length === 0) {
    return <OnboardingChecklist steps={onboardingSteps} variant="full" />;
  }

  const latestInsight = insights[0] ?? null;
  // Top urgent observations come from the 5 most recent insights so
  // we get fresh signal but don't dilute with months of history.
  const recentForObservations = insights.slice(0, 5);

  return (
    <div className="flex flex-col gap-10 pb-12">
      {/* 1. Greeting */}
      <DashboardGreeting name={greetingName} />

      {/* Onboarding banner — shows only when not all steps complete.
       *  Sits above the briefing as a soft nudge. */}
      {!onboardingComplete ? (
        <OnboardingChecklist steps={onboardingSteps} variant="compact" />
      ) : null}

      {/* 2. Latest insight feature */}
      {latestInsight ? (
        <LatestInsightHero insight={latestInsight} />
      ) : (
        <NoInsightYet />
      )}

      {/* 3. 3 urgent observations */}
      <UrgentObservations insights={recentForObservations} />

      {/* 4. Platform status strip */}
      <PlatformStatus
        connections={connectionsWithSync}
        insightUsage={insightUsage}
        drilldownUsage={drilldownUsage}
      />

      {/* 5. Activity feed */}
      <ActivityFeed events={activity} />

      {/* 6. Shortcuts */}
      <DashboardShortcuts />
    </div>
  );
}

// ─── Sub-component: empty insight state ─────────────────────────────
function NoInsightYet() {
  return (
    <div className="bg-card border-border/60 flex flex-col items-start gap-3 rounded-xl border border-dashed p-6 sm:p-8">
      <div className="text-muted-foreground/80 inline-flex items-center gap-2 text-[11px]">
        <span className="font-display italic tracking-wide">
          Insight terbaru
        </span>
      </div>
      <h2 className="text-foreground font-display text-[24px] font-medium leading-[1.18] tracking-tight">
        Belum ada briefing pagi
      </h2>
      <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
        Generate insight pertama Anda untuk memulai briefing harian. AI
        akan menganalisis data minggu lalu dan menghasilkan ringkasan,
        observasi, dan rekomendasi yang actionable.
      </p>
    </div>
  );
}
