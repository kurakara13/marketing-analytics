import OpenAI from "openai";
import { z } from "zod";

import { db } from "@/lib/db";
import { insights, type Insight } from "@/lib/db/schema";
import type { ReportData } from "@/lib/reports/fetch-report-data";
import { getBusinessContext } from "@/lib/business-context";
import type { UserBusinessContext } from "@/lib/db/schema";
import {
  getUserFeedbackSummary,
  type FeedbackSummary,
} from "@/lib/insight-feedback";
import {
  detectAttributionFlags,
  type AttributionFlag,
} from "./attribution-flags";
import { INSIGHTS_SYSTEM_PROMPT } from "./prompts";

// Provider: OpenAI. We picked GPT-5 over Claude / Gemini for the
// marketing insight engine because the user prioritised quality over
// cost — GPT-5's structured-output reliability and analytical
// reasoning are best in class for the price point.
//
// Swap to a different OpenAI model (gpt-5-mini, gpt-4.1, o-series)
// by changing the MODEL string below — all parameters are model-
// compatible. To switch provider entirely, replace this whole file
// (Zod schemas, prompt, DB persistence stay).
const MODEL = "gpt-5";

// Per-user rolling 24h cap on insight generations. Each generate hits
// GPT-5 and costs real money — this protects against accidental loops
// (a buggy regenerate retry) and obvious abuse. 30/day = ~1 per
// 48 minutes, far above any legitimate manual-review pattern.
//
// Surfaced to the UI via getUsageStatus() so users see how close they
// are to the cap before the action fires.
export const DAILY_INSIGHT_QUOTA = 30;

// Structured output schema enforced by OpenAI's `json_schema` strict
// mode. Same shape as the prior Claude implementation; OpenAI strict
// mode is also stricter on schema validation (no `default`, all
// properties in `required`, `additionalProperties: false` everywhere)
// — this schema satisfies that.
const InsightContentSchema = z.object({
  executiveSummary: z.string().min(20, "Executive summary must be substantive"),
  observations: z
    .array(
      z.object({
        title: z.string().min(3),
        description: z.string().min(20),
        severity: z.enum(["info", "warning", "alert"]),
      }),
    )
    .min(1)
    .max(8),
  recommendations: z
    .array(
      z.object({
        title: z.string().min(3),
        description: z.string().min(20),
        priority: z.enum(["low", "medium", "high"]),
      }),
    )
    .min(1)
    .max(8),
});

type InsightContent = z.infer<typeof InsightContentSchema>;

const INSIGHT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["executiveSummary", "observations", "recommendations"],
  properties: {
    executiveSummary: { type: "string" },
    observations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "severity"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          severity: { type: "string", enum: ["info", "warning", "alert"] },
        },
      },
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "priority"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
  },
} as const;

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env.local — get one at https://platform.openai.com/api-keys",
    );
  }
  return new OpenAI();
}

// ─── Number formatting for prompt readability ───────────────────────────
const numberFmt = new Intl.NumberFormat("id-ID");
function fmtRupiah(n: number): string {
  if (n === 0) return "Rp 0";
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}K`;
  return `Rp ${numberFmt.format(Math.round(n))}`;
}
function fmtNum(n: number): string {
  return numberFmt.format(Math.round(n));
}
function fmtPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}
function fmtDelta(current: number, previous: number): string {
  if (previous === 0 && current === 0) return "—";
  if (previous === 0) return "(baru)";
  const pct = ((current - previous) / previous) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

// ─── Prompt builder ─────────────────────────────────────────────────────
//
// Surfaces the rich shape of ReportData: totals + delta vs previous
// period + 6-bucket trend + per-campaign breakdown + monthly target
// progress + top converting pages + AI-referrer traffic.
//
// Sections are conditional — we only include data the user has
// connected. Skipped sections are tagged "(belum tersedia)" so the
// model doesn't hallucinate numbers for missing sources.
function buildAttributionFlagsBlock(flags: AttributionFlag[]): string {
  if (flags.length === 0) return "";

  const lines = flags.map(
    (f) => `- **[${f.severity.toUpperCase()}] ${f.label}** — ${f.description}`,
  );

  return `## Data quality / attribution flags (auto-detected)
${lines.join("\n")}

PENTING: Flag di atas adalah hasil deteksi heuristik dari data yang
tersedia, BUKAN observation Anda sendiri. Tugas Anda:
1. Untuk setiap flag, JIKA validasi data Anda sependapat, masukkan
   sebagai observation di output dengan severity yang sesuai dan tambah
   konteks/angka yang lebih dalam dari analisis Anda.
2. Hubungkan flag ini ke recommendations konkret (mis. "tambahkan
   gtm_debug ke unwanted query parameters di GA4 Admin").
3. Jangan duplikasi — kalau sudah jadi observation, tidak perlu
   diulang lagi di section lain.

`;
}

function buildFeedbackBlock(summary: FeedbackSummary): string {
  if (summary.liked.length === 0 && summary.disliked.length === 0) return "";

  const fmt = (e: { kind: string; title: string; description: string }) =>
    `- [${e.kind === "observation" ? "obs" : "rec"}] **${e.title}** — ${e.description.slice(0, 220)}${e.description.length > 220 ? "…" : ""}`;

  const blocks: string[] = ["## Feedback dari user pada insight sebelumnya"];

  if (summary.liked.length > 0) {
    blocks.push(
      `\n### Yang user anggap berguna (👍, ${summary.liked.length}):`,
      summary.liked.map(fmt).join("\n"),
    );
  }
  if (summary.disliked.length > 0) {
    blocks.push(
      `\n### Yang user tandai kurang relevan / generic (👎, ${summary.disliked.length}):`,
      summary.disliked.map(fmt).join("\n"),
    );
  }

  blocks.push(
    "\nGunakan sinyal ini: condongkan observation/rekomendasi ke angle, granularitas, dan tone seperti yang berguna; hindari pattern yang ditandai kurang relevan. Jangan duplikasi kata-katanya — angle dan kedalaman analisisnya yang dicontoh.",
  );

  return blocks.join("\n") + "\n\n";
}

function buildBusinessContextBlock(
  ctx: UserBusinessContext | null,
): string {
  if (!ctx) return "";
  const lines: string[] = [];
  if (ctx.industry) lines.push(`- Industri / model bisnis: ${ctx.industry}`);
  if (ctx.targetAudience) lines.push(`- Target audience: ${ctx.targetAudience}`);
  if (ctx.businessGoals) lines.push(`- Business goals: ${ctx.businessGoals}`);
  if (ctx.brandVoice) {
    const voiceLabel =
      ctx.brandVoice === "professional"
        ? "profesional & formal"
        : ctx.brandVoice === "casual"
          ? "casual & friendly"
          : "teknis & data-heavy";
    lines.push(`- Tone narrative yang diharapkan: ${voiceLabel}`);
  }
  if (ctx.leadEventName) {
    lines.push(
      `- Definisi "lead" untuk bisnis ini: GA4 event "${ctx.leadEventName}". Pakai istilah "lead" konsisten ketika merujuk ke event ini di observation/recommendation.`,
    );
  }
  if (lines.length === 0) return "";
  return `## Konteks bisnis user\n${lines.join("\n")}\n\nGunakan konteks di atas untuk merangkai observation & recommendation yang relevan dengan industri & target audience ini. Jangan generic.\n\n`;
}

function buildUserPrompt(
  reportData: ReportData,
  businessContext: UserBusinessContext | null,
  feedbackSummary: FeedbackSummary,
  attributionFlags: AttributionFlag[],
): string {
  const { totals, previousTotals, trend, campaigns, connectedSources } =
    reportData;

  const sources = connectedSources.join(", ") || "(belum ada)";
  const periodLabel =
    reportData.period === "weekly" ? "minggu" : "bulan";

  const has = (m: keyof typeof totals) =>
    totals[m] !== 0 || previousTotals[m] !== 0;

  const totalsLines: string[] = [];
  if (has("sessions")) {
    totalsLines.push(
      `- Sessions: ${fmtNum(totals.sessions)} (delta ${periodLabel} lalu: ${fmtDelta(totals.sessions, previousTotals.sessions)})`,
    );
  }
  if (has("pageviews")) {
    totalsLines.push(
      `- Pageviews: ${fmtNum(totals.pageviews)} (delta: ${fmtDelta(totals.pageviews, previousTotals.pageviews)})`,
    );
  }
  if (has("conversions")) {
    totalsLines.push(
      `- Conversions (GA4): ${fmtNum(totals.conversions)} (delta: ${fmtDelta(totals.conversions, previousTotals.conversions)})`,
    );
  }
  if (has("revenue")) {
    totalsLines.push(
      `- Revenue: ${fmtRupiah(totals.revenue)} (delta: ${fmtDelta(totals.revenue, previousTotals.revenue)})`,
    );
  }
  if (has("impressions")) {
    totalsLines.push(
      `- Paid impressions (Google Ads): ${fmtNum(totals.impressions)} (delta: ${fmtDelta(totals.impressions, previousTotals.impressions)})`,
    );
  }
  if (has("clicks")) {
    totalsLines.push(
      `- Paid clicks: ${fmtNum(totals.clicks)} (delta: ${fmtDelta(totals.clicks, previousTotals.clicks)})`,
    );
  }
  if (has("spend")) {
    totalsLines.push(
      `- Spend: ${fmtRupiah(totals.spend)} (delta: ${fmtDelta(totals.spend, previousTotals.spend)})`,
    );
    if (totals.conversions > 0) {
      const cpl = totals.spend / totals.conversions;
      const prevCpl =
        previousTotals.conversions > 0
          ? previousTotals.spend / previousTotals.conversions
          : 0;
      totalsLines.push(
        `- CPL (computed): ${fmtRupiah(cpl)}${prevCpl > 0 ? ` (delta vs lalu: ${fmtDelta(cpl, prevCpl)})` : ""}`,
      );
    }
    if (totals.clicks > 0) {
      const ctr = totals.clicks / Math.max(1, totals.impressions);
      totalsLines.push(`- CTR (computed): ${fmtPercent(ctr)}`);
    }
  }
  if (has("organicClicks") || has("organicImpressions")) {
    totalsLines.push(
      `- Organic clicks (Search Console): ${fmtNum(totals.organicClicks)} (delta: ${fmtDelta(totals.organicClicks, previousTotals.organicClicks)})`,
    );
    totalsLines.push(
      `- Organic impressions: ${fmtNum(totals.organicImpressions)} (delta: ${fmtDelta(totals.organicImpressions, previousTotals.organicImpressions)})`,
    );
    if (totals.organicImpressions > 0) {
      const avgPos =
        totals.organicPositionWeightedSum / totals.organicImpressions;
      totalsLines.push(`- Average organic position: ${avgPos.toFixed(1)}`);
    }
  }

  const totalsBlock = totalsLines.length
    ? totalsLines.join("\n")
    : "(belum ada metrik tersedia)";

  const trendBlock = trend.length
    ? trend
        .map(
          (b) =>
            `${b.label}: sessions=${fmtNum(b.sessions)}, conversions=${fmtNum(b.conversions)}, spend=${fmtRupiah(b.spend)}, organicClicks=${fmtNum(b.organicClicks)}`,
        )
        .join("\n")
    : "(belum ada trend data)";

  const adCampaigns = campaigns.filter((c) => c.source === "google_ads").slice(0, 6);
  const campaignBlock = adCampaigns.length
    ? adCampaigns
        .map((c) => {
          const cpl = c.conversions > 0 ? c.spend / c.conversions : 0;
          return `- ${c.campaignName ?? c.campaignId ?? "(rollup)"}: spend=${fmtRupiah(c.spend)}, clicks=${fmtNum(c.clicks)}, conv=${fmtNum(c.conversions)}, CPL=${cpl > 0 ? fmtRupiah(cpl) : "—"}`;
        })
        .join("\n")
    : "(Google Ads campaigns belum ada)";

  const topPagesBlock = reportData.topPages.length
    ? reportData.topPages
        .slice(0, 5)
        .map(
          (p, i) =>
            `${i + 1}. ${p.page} — ${fmtNum(p.conversions)} conv, ${fmtNum(p.sessions)} sessions`,
        )
        .join("\n")
    : "(Top pages belum tersedia)";

  const aiBlock =
    reportData.aiTraffic.totalSessions > 0
      ? `${fmtNum(reportData.aiTraffic.totalSessions)} sessions dari ${reportData.aiTraffic.bySource
          .slice(0, 5)
          .map((s) => `${s.source} (${fmtNum(s.sessions)})`)
          .join(", ")}`
      : "(AI assistant traffic belum terdeteksi di window ini)";

  const targetBlock = reportData.monthlyTargetVsActual.length
    ? reportData.monthlyTargetVsActual
        .map(
          (m) =>
            `${m.label} ${m.isPartial ? `(${m.daysElapsed}/${m.daysInMonth} hari)` : ""}: actual ${fmtNum(m.actual)}${m.target ? ` / target ${fmtNum(m.target)} (${fmtPercent(m.actual / m.target)})` : " (no target set)"}${m.isPartial ? `, projected ${fmtNum(m.projected)}` : ""}`,
        )
        .join("\n")
    : "";

  return `Analisis data marketing berikut dan kembalikan insight dalam JSON terstruktur.

${buildBusinessContextBlock(businessContext)}${buildFeedbackBlock(feedbackSummary)}${buildAttributionFlagsBlock(attributionFlags)}## Periode laporan
${reportData.windowLabel} (${reportData.windowStart} → ${reportData.windowEnd})
Type: ${reportData.period}

## Data sources terkoneksi
${sources}

## Totals (current vs previous ${periodLabel})
${totalsBlock}

## Trend (6 ${reportData.period === "weekly" ? "minggu" : "bulan"} terakhir)
${trendBlock}

## Google Ads campaigns (top 6 by spend)
${campaignBlock}

## Top converting pages
${topPagesBlock}

## Traffic dari AI assistant (ChatGPT, Gemini, Perplexity, dll)
${aiBlock}

${targetBlock ? `## Sessions vs target bulanan (4 bulan terakhir)\n${targetBlock}\n` : ""}
Lakukan analisis sekarang. Cite angka spesifik dari data di atas, hindari generic statements.`;
}

// ─── Main entry ─────────────────────────────────────────────────────────
/**
 * Returns how many insights the user has generated in the last 24h
 * and how many remain. Used by the /insights page header to render a
 * "12/30 today" hint, and by generateInsight as the actual gate.
 */
export async function getUsageStatus(userId: string): Promise<{
  used: number;
  remaining: number;
  limit: number;
  resetsAt: Date | null;
}> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db.query.insights.findMany({
    where: (insight, { and, eq, gte }) =>
      and(eq(insight.userId, userId), gte(insight.createdAt, since)),
    columns: { createdAt: true },
    orderBy: (insight, { asc }) => [asc(insight.createdAt)],
    limit: DAILY_INSIGHT_QUOTA + 1,
  });
  const used = rows.length;
  // The window is rolling, so the next slot frees up exactly 24h
  // after the OLDEST insight in the current window. When the user has
  // headroom we don't show a reset time at all.
  const oldest = rows[0]?.createdAt ?? null;
  const resetsAt =
    used >= DAILY_INSIGHT_QUOTA && oldest
      ? new Date(oldest.getTime() + 24 * 60 * 60 * 1000)
      : null;
  return {
    used,
    remaining: Math.max(0, DAILY_INSIGHT_QUOTA - used),
    limit: DAILY_INSIGHT_QUOTA,
    resetsAt,
  };
}

/**
 * Generate an insight from a pre-fetched ReportData. Persisted to the
 * `insight` table for future retrieval (the ai_narrative widget reads
 * the latest cached row for a given window).
 */
export async function generateInsight(args: {
  userId: string;
  reportData: ReportData;
}): Promise<Insight> {
  const { userId, reportData } = args;

  if (reportData.connectedSources.length === 0) {
    throw new Error(
      "Belum ada koneksi data source. Connect dulu di /data-sources.",
    );
  }
  if (!reportData.hasData) {
    throw new Error(
      `Belum ada data tersinkron untuk ${reportData.windowLabel}. Backfill dulu di /data-sources.`,
    );
  }

  const quotaStatus = await getUsageStatus(userId);
  if (quotaStatus.remaining === 0) {
    const resetsHint = quotaStatus.resetsAt
      ? ` Quota berikutnya tersedia ${quotaStatus.resetsAt.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}.`
      : "";
    throw new Error(
      `Quota generate insight harian habis (${quotaStatus.limit}/24 jam).${resetsHint}`,
    );
  }

  const [businessContext, feedbackSummary] = await Promise.all([
    getBusinessContext(userId),
    getUserFeedbackSummary(userId),
  ]);
  const attributionFlags = detectAttributionFlags(reportData);
  const userPrompt = buildUserPrompt(
    reportData,
    businessContext,
    feedbackSummary,
    attributionFlags,
  );

  const client = getClient();
  const response = await client.chat.completions.create({
    model: MODEL,
    // GPT-5 uses `max_completion_tokens` (the older `max_tokens` is
    // deprecated for newer models). 16K is generous — typical
    // structured insight runs ~3-5K tokens.
    max_completion_tokens: 16000,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "marketing_insight",
        strict: true,
        schema: INSIGHT_JSON_SCHEMA,
      },
    },
    messages: [
      { role: "system", content: INSIGHTS_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    // OpenAI prompt caching is automatic for prompts ≥ 1024 tokens —
    // no special opt-in needed. The system prompt + start of user
    // prompt are stable across calls so they hit the cache after the
    // first request.
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    const refusal = response.choices[0]?.message?.refusal;
    throw new Error(
      refusal
        ? `OpenAI menolak request: ${refusal}`
        : "OpenAI response missing content",
    );
  }

  let parsed: InsightContent;
  try {
    const json = JSON.parse(content);
    parsed = InsightContentSchema.parse(json);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse OpenAI response: ${detail}`);
  }

  // Compute window-day count for legacy schema field.
  const windowDays =
    Math.floor(
      (new Date(reportData.windowEnd).getTime() -
        new Date(reportData.windowStart).getTime()) /
        86_400_000,
    ) + 1;

  const inputSnapshot = {
    windowDays,
    windowStart: reportData.windowStart,
    windowEnd: reportData.windowEnd,
    connectedSources: reportData.connectedSources.length,
    totals: {
      sessions: reportData.totals.sessions,
      pageviews: reportData.totals.pageviews,
      conversions: reportData.totals.conversions,
      revenue: reportData.totals.revenue,
      impressions: reportData.totals.impressions,
      clicks: reportData.totals.clicks,
      spend: reportData.totals.spend,
      organicClicks: reportData.totals.organicClicks,
      organicImpressions: reportData.totals.organicImpressions,
    },
    daily: reportData.trend.map((b) => ({
      date: b.end,
      sessions: b.sessions,
      conversions: b.conversions,
      spend: b.spend,
      organicClicks: b.organicClicks,
    })),
  };

  // OpenAI usage shape:
  //   prompt_tokens                 — total input
  //   completion_tokens             — output
  //   prompt_tokens_details.cached_tokens — input that hit the cache
  const usage = response.usage;
  const cachedInputTokens =
    usage?.prompt_tokens_details?.cached_tokens ?? null;

  const [row] = await db
    .insert(insights)
    .values({
      userId,
      windowDays,
      windowStart: reportData.windowStart,
      windowEnd: reportData.windowEnd,
      executiveSummary: parsed.executiveSummary,
      observations: parsed.observations,
      recommendations: parsed.recommendations,
      inputSnapshot,
      inputTokens: usage?.prompt_tokens ?? null,
      outputTokens: usage?.completion_tokens ?? null,
      cacheReadTokens: cachedInputTokens,
      modelUsed: MODEL,
    })
    .returning();

  return row;
}

/**
 * Look up the most recent insight for a (userId, window) tuple.
 * Returns null when none exists. Used by the ai_narrative widget to
 * avoid regenerating on every render — caller can decide whether to
 * fall back to fresh generation when null.
 */
export async function findLatestInsight(args: {
  userId: string;
  windowStart: string;
  windowEnd: string;
}): Promise<Insight | null> {
  const row = await db.query.insights.findFirst({
    where: (insight, { and, eq }) =>
      and(
        eq(insight.userId, args.userId),
        eq(insight.windowStart, args.windowStart),
        eq(insight.windowEnd, args.windowEnd),
      ),
    orderBy: (insight, { desc }) => [desc(insight.createdAt)],
  });
  return row ?? null;
}

export async function listInsightsForUser(userId: string): Promise<Insight[]> {
  const rows = await db.query.insights.findMany({
    where: (insight, { eq }) => eq(insight.userId, userId),
    orderBy: (insight, { desc }) => [desc(insight.createdAt)],
    limit: 20,
  });
  return rows;
}

/**
 * Look up an insight by id, scoped to a user. Used by the comparison
 * page to fetch both sides — we always check userId so a malicious
 * `?a=...&b=...` can't reach another user's rows.
 */
export async function findInsightByIdForUser(args: {
  userId: string;
  insightId: string;
}): Promise<Insight | null> {
  const row = await db.query.insights.findFirst({
    where: (insight, { and, eq }) =>
      and(eq(insight.userId, args.userId), eq(insight.id, args.insightId)),
  });
  return row ?? null;
}

/**
 * Find the next-older insight for the same user as `insightId`, useful
 * for "Compare with previous" links on the insights list. Matches by
 * createdAt < this insight's createdAt; returns the closest preceding
 * row regardless of period (weekly vs monthly) so the user can compare
 * any two adjacent generations.
 */
export async function findPreviousInsightFor(args: {
  userId: string;
  insightId: string;
}): Promise<Insight | null> {
  const current = await findInsightByIdForUser({
    userId: args.userId,
    insightId: args.insightId,
  });
  if (!current) return null;

  const row = await db.query.insights.findFirst({
    where: (insight, { and, eq, lt }) =>
      and(
        eq(insight.userId, args.userId),
        lt(insight.createdAt, current.createdAt),
      ),
    orderBy: (insight, { desc }) => [desc(insight.createdAt)],
  });
  return row ?? null;
}
