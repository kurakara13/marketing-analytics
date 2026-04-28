// GA4 ad-hoc queries used by the Website Performance slide. These are
// distinct from the daily sync (which only stores per-date rollups) and
// run at report-build time against the live GA4 Data API. Three calls
// per report — cheap relative to GA4's quota.

import { runReport } from "@/lib/connectors/ga4/data-api";

export type MonthlySessionsRow = {
  /** "YYYY-MM" — calendar month. */
  yearMonth: string;
  sessions: number;
};

/**
 * Sessions per calendar month in the requested window. GA4 returns
 * unsorted rows; we sort ascending here.
 */
export async function fetchMonthlySessions(args: {
  accessToken: string;
  propertyId: string;
  startDate: string;
  endDate: string;
}): Promise<MonthlySessionsRow[]> {
  const response = await runReport({
    accessToken: args.accessToken,
    propertyId: args.propertyId,
    startDate: args.startDate,
    endDate: args.endDate,
    dimensions: ["yearMonth"],
    metrics: ["sessions"],
  });

  const rows: MonthlySessionsRow[] = [];
  for (const row of response.rows ?? []) {
    const ymRaw = row.dimensionValues?.[0]?.value ?? "";
    if (!/^\d{6}$/.test(ymRaw)) continue;
    // GA4 returns "YYYYMM" (e.g. "202604"); normalize to "YYYY-MM".
    const yearMonth = `${ymRaw.slice(0, 4)}-${ymRaw.slice(4)}`;
    const sessions = Number(row.metricValues?.[0]?.value ?? "0");
    if (Number.isFinite(sessions)) {
      rows.push({ yearMonth, sessions });
    }
  }
  rows.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  return rows;
}

export type TopPageRow = {
  page: string;
  conversions: number;
  sessions: number;
};

/**
 * Top landing pages ordered by conversions desc, with ties broken by
 * sessions. We use `landingPagePlusQueryString` so paths with different
 * UTM params show separately — easier to spot which campaign URL
 * converts.
 */
export async function fetchTopConvertingPages(args: {
  accessToken: string;
  propertyId: string;
  startDate: string;
  endDate: string;
  limit?: number;
}): Promise<TopPageRow[]> {
  const response = await runReport({
    accessToken: args.accessToken,
    propertyId: args.propertyId,
    startDate: args.startDate,
    endDate: args.endDate,
    dimensions: ["landingPagePlusQueryString"],
    metrics: ["conversions", "sessions"],
    orderBys: [{ metric: { metricName: "conversions" }, desc: true }],
    limit: args.limit ?? 10,
  });

  const rows: TopPageRow[] = [];
  for (const row of response.rows ?? []) {
    const page = row.dimensionValues?.[0]?.value ?? "";
    if (!page || page === "(not set)") continue;
    const conversions = Number(row.metricValues?.[0]?.value ?? "0");
    const sessions = Number(row.metricValues?.[1]?.value ?? "0");
    rows.push({
      page,
      conversions: Number.isFinite(conversions) ? conversions : 0,
      sessions: Number.isFinite(sessions) ? sessions : 0,
    });
  }
  return rows;
}

// Hosts known to be AI assistants / answer engines that drive referral
// traffic. GA4 reports referrers as the bare host (no protocol). Add to
// this list as new AI products surface — the report just sums sessions
// across whatever matches.
export const AI_REFERRER_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "gemini.google.com",
  "bard.google.com",
  "perplexity.ai",
  "www.perplexity.ai",
  "claude.ai",
  "copilot.microsoft.com",
  "notebooklm.google.com",
  "you.com",
  "phind.com",
  "kagi.com",
] as const;

export type AITrafficSource = {
  source: string;
  sessions: number;
};

export type AITrafficResult = {
  totalSessions: number;
  bySource: AITrafficSource[];
};

/**
 * Sessions whose `sessionSource` is one of the known AI assistant
 * hosts. We sum across all matching sources for the headline number,
 * but also keep the per-source breakdown so the slide can list which
 * AI tools drove traffic.
 */
export async function fetchAITraffic(args: {
  accessToken: string;
  propertyId: string;
  startDate: string;
  endDate: string;
}): Promise<AITrafficResult> {
  const response = await runReport({
    accessToken: args.accessToken,
    propertyId: args.propertyId,
    startDate: args.startDate,
    endDate: args.endDate,
    dimensions: ["sessionSource"],
    metrics: ["sessions"],
    dimensionFilter: {
      filter: {
        fieldName: "sessionSource",
        inListFilter: {
          values: [...AI_REFERRER_HOSTS],
          caseSensitive: false,
        },
      },
    },
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
  });

  const bySource: AITrafficSource[] = [];
  let total = 0;
  for (const row of response.rows ?? []) {
    const source = row.dimensionValues?.[0]?.value ?? "";
    if (!source) continue;
    const sessions = Number(row.metricValues?.[0]?.value ?? "0");
    if (!Number.isFinite(sessions) || sessions <= 0) continue;
    bySource.push({ source, sessions });
    total += sessions;
  }
  return { totalSessions: total, bySource };
}
