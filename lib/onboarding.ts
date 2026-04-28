import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  insights,
  reportTemplates,
  userBusinessContext,
} from "@/lib/db/schema";
import { listConnectionsForUser } from "@/lib/connections";
import type { OnboardingStep } from "@/components/onboarding/onboarding-checklist";

/**
 * Compute the onboarding checklist state for a single user, in one
 * server call. Each step is a small DB lookup — cheap enough to run
 * on every dashboard render, and we want fresh state every time so
 * the checklist visibly progresses as the user completes steps.
 */
export async function getOnboardingSteps(
  userId: string,
): Promise<OnboardingStep[]> {
  // Run the cheap lookups in parallel.
  const [connections, hasInsight, hasTemplate, businessCtxRows] =
    await Promise.all([
      listConnectionsForUser(userId),
      hasAtLeastOneInsight(userId),
      hasAtLeastOneTemplate(userId),
      db
        .select({ userId: userBusinessContext.userId })
        .from(userBusinessContext)
        .where(eq(userBusinessContext.userId, userId))
        .limit(1),
    ]);

  const realConnections = connections.filter(
    (c) => !c.externalAccountId.startsWith("_pending_"),
  );
  const hasConnection = realConnections.length > 0;
  const hasBusinessContext = businessCtxRows.length > 0;

  return [
    {
      id: "connect",
      title: "Connect data source",
      description:
        "Hubungkan Google Analytics 4, Google Ads, atau Search Console. Semua read-only.",
      href: "/data-sources",
      done: hasConnection,
      ctaLabel: hasConnection ? undefined : "Connect",
    },
    {
      id: "context",
      title: "Set konteks bisnis",
      description:
        "Industri, target audience, dan istilah lead — biar AI insight relevan ke bisnis Anda.",
      href: "/settings",
      done: hasBusinessContext,
      ctaLabel: hasBusinessContext ? undefined : "Buka Settings",
    },
    {
      id: "insight",
      title: "Generate AI insight pertama",
      description:
        "Klik Generate insight di /insights — AI menganalisis data Anda dan keluarkan observation + rekomendasi.",
      href: "/insights",
      done: hasInsight,
      ctaLabel: hasInsight ? undefined : "Buka Insights",
    },
    {
      id: "report",
      title: "Build laporan PPT pertama",
      description:
        "Susun template laporan dengan KPI, charts, dan AI Insight widget. Generate jadi .pptx.",
      href: "/reports",
      done: hasTemplate,
      ctaLabel: hasTemplate ? undefined : "Buka Reports",
    },
  ];
}

async function hasAtLeastOneInsight(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: insights.id })
    .from(insights)
    .where(eq(insights.userId, userId))
    .limit(1);
  return Boolean(row);
}

async function hasAtLeastOneTemplate(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: reportTemplates.id })
    .from(reportTemplates)
    .where(eq(reportTemplates.userId, userId))
    .limit(1);
  return Boolean(row);
}
