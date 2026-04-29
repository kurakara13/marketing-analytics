import OpenAI from "openai";
import { and, eq, gte } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  insightDrilldowns,
  insights,
  type DrilldownContent,
  type Insight,
  type InsightDrilldown,
} from "@/lib/db/schema";
import { fetchReportData } from "@/lib/reports/fetch-report-data";
import { getUserDrilldownFeedbackSummary } from "@/lib/drilldown-feedback";
import type { DrilldownFeedbackSummary } from "@/lib/drilldown-feedback";
import { DAILY_DRILLDOWN_QUOTA, findInsightByIdForUser } from "./insights";
import { detectAttributionFlags } from "./attribution-flags";

// Drill-down: given ONE observation from a parent insight, run a
// focused GPT-5 pass that:
//   1. Cites supporting / refuting evidence from the underlying
//      ReportData (campaigns, top pages, trend buckets, attribution
//      flags) — concrete numbers, not generic restatement
//   2. Proposes 1–4 ranked root-cause hypotheses
//   3. Returns concrete fix steps with platform-specific paths
//
// Reuses the same ReportData snapshot the parent insight was generated
// from (no new GA4 fetches today) — the value is in narrowing the
// model's attention to one specific observation.

const MODEL = "gpt-5";

const DRILLDOWN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "evidence", "hypotheses", "fixes"],
  properties: {
    summary: { type: "string" },
    evidence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "description"],
        properties: {
          type: { type: "string", enum: ["data_point", "pattern", "absence"] },
          description: { type: "string" },
        },
      },
    },
    hypotheses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "likelihood", "reasoning"],
        properties: {
          title: { type: "string" },
          likelihood: { type: "string", enum: ["high", "medium", "low"] },
          reasoning: { type: "string" },
        },
      },
    },
    fixes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "steps", "where"],
        properties: {
          title: { type: "string" },
          steps: { type: "array", items: { type: "string" } },
          where: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

const DrilldownContentSchema = z.object({
  summary: z.string().min(20),
  evidence: z
    .array(
      z.object({
        type: z.enum(["data_point", "pattern", "absence"]),
        description: z.string().min(15),
      }),
    )
    .min(1)
    .max(8),
  hypotheses: z
    .array(
      z.object({
        title: z.string().min(3),
        likelihood: z.enum(["high", "medium", "low"]),
        reasoning: z.string().min(15),
      }),
    )
    .min(1)
    .max(4),
  fixes: z
    .array(
      z.object({
        title: z.string().min(3),
        steps: z.array(z.string()).min(1).max(8),
        where: z.string().nullable(),
      }),
    )
    .min(1)
    .max(5),
});

const SYSTEM_PROMPT = `Anda adalah seorang senior digital marketing analyst & technical SEO/martech consultant. Tugas Anda: drill-down satu observation dari laporan AI yang lebih besar — cari bukti spesifik, ranking hipotesis root cause, dan kasih fix yang konkret + actionable.

## Format output (WAJIB JSON sesuai schema)

- \`summary\` — 2 kalimat ringkas yang restate problem yang Anda investigasi.
- \`evidence\` — 2–6 bukti konkret dari data:
  - \`type\` = "data_point" (cite angka spesifik), "pattern" (tren atau pola), atau "absence" (sesuatu yang HARUSNYA ada tapi tidak ada — sinyal yang penting).
- \`hypotheses\` — 1–4 root cause hipotesis dengan likelihood (\`high\`/\`medium\`/\`low\`) dan reasoning. Urut dari paling likely.
- \`fixes\` — 1–4 concrete fix steps:
  - \`title\` — short imperative (mis. "Filter unwanted query parameters di GA4")
  - \`steps\` — bullet list step-by-step (mis. "GA4 Admin → Property → Data Streams → klik Web stream → Configure tag settings → Show all → Define internal traffic / Unwanted query params")
  - \`where\` — full navigation path di platform yang relevan (GA4 Admin, Google Ads UI, GTM container, dll). Null bila fix tidak butuh platform UI (mis. perlu fix di code/web team).

## Aturan

1. Cite angka SPESIFIK dari data — mis. "halaman /services/virtual-office-setup punya 24 lead dari 70 sessions (CVR 34,3%) — anomalously tinggi vs site average 15,2%".
2. Hipotesis ranking harus jujur — kalau Anda tidak yakin, tandai \`low\` likelihood. Lebih baik 2 hipotesis honest daripada 4 hipotesis fluff.
3. Fix steps harus eksekutif — operator (bukan dev) bisa langsung apply. Sebut path UI persis di mana setting bisa di-edit.
4. Kalau evidence yang Anda butuhkan TIDAK ada di data yang dikasih (mis. tidak ada per-event breakdown, tidak ada source/medium di top pages), katakan eksplisit di evidence sebagai type=\`absence\` — itu informative juga.`;

export async function getDrilldownUsage(userId: string): Promise<{
  used: number;
  remaining: number;
  limit: number;
}> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ id: insightDrilldowns.id })
    .from(insightDrilldowns)
    .where(
      and(
        eq(insightDrilldowns.userId, userId),
        gte(insightDrilldowns.createdAt, since),
      ),
    )
    .limit(DAILY_DRILLDOWN_QUOTA + 1);
  const used = rows.length;
  return {
    used,
    remaining: Math.max(0, DAILY_DRILLDOWN_QUOTA - used),
    limit: DAILY_DRILLDOWN_QUOTA,
  };
}

export async function generateDrilldown(args: {
  userId: string;
  insightId: string;
  observationIndex: number;
}): Promise<InsightDrilldown> {
  const { userId, insightId, observationIndex } = args;

  // Verify ownership of the parent insight + grab the focus observation.
  const insight = await findInsightByIdForUser({ userId, insightId });
  if (!insight) throw new Error("Insight tidak ditemukan");
  const observation = insight.observations[observationIndex];
  if (!observation) {
    throw new Error("Observation index di luar range");
  }

  // Quota check happens BEFORE the API call. Re-runs of the same
  // (insightId, observationIndex) still count — each re-run is a
  // fresh GPT-5 call.
  const usage = await getDrilldownUsage(userId);
  if (usage.remaining === 0) {
    throw new Error(
      `Quota drill-down harian habis (${usage.limit}/24 jam). Coba lagi besok.`,
    );
  }

  // Re-fetch ReportData with the SAME window the insight was generated
  // for. We don't trust the inputSnapshot for this — it only carries
  // totals + daily aggregates, but the drill-down wants campaigns +
  // topPages + trend buckets too.
  const period =
    insight.windowDays >= 28
      ? "monthly"
      : "weekly"; // close enough for the windowDays we have
  const reportData = await fetchReportData({
    userId,
    period,
    anchorDate: insight.windowEnd,
  });
  const flags = detectAttributionFlags(reportData);
  const feedbackSummary = await getUserDrilldownFeedbackSummary(userId);

  const userPrompt = buildDrilldownUserPrompt({
    insight,
    observation,
    reportData,
    flagsBlock: flags
      .map(
        (f) => `- [${f.severity.toUpperCase()}] ${f.label} — ${f.description}`,
      )
      .join("\n"),
    feedbackSummary,
  });

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  const client = new OpenAI();
  const response = await client.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 12000,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "marketing_drilldown",
        strict: true,
        schema: DRILLDOWN_SCHEMA,
      },
    },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    const refusal = response.choices[0]?.message?.refusal;
    throw new Error(
      refusal ? `OpenAI menolak: ${refusal}` : "Response missing content",
    );
  }
  const parsed = DrilldownContentSchema.parse(
    JSON.parse(raw),
  ) satisfies DrilldownContent;

  // Upsert: same (insightId, observationIndex) replaces the previous
  // drill-down. Useful for re-running after data refresh.
  const existing = await db
    .select()
    .from(insightDrilldowns)
    .where(
      and(
        eq(insightDrilldowns.insightId, insightId),
        eq(insightDrilldowns.observationIndex, observationIndex),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    const [row] = await db
      .update(insightDrilldowns)
      .set({
        content: parsed,
        modelUsed: MODEL,
        inputTokens: response.usage?.prompt_tokens ?? null,
        outputTokens: response.usage?.completion_tokens ?? null,
        createdAt: new Date(),
      })
      .where(eq(insightDrilldowns.id, existing[0].id))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(insightDrilldowns)
    .values({
      userId,
      insightId,
      observationIndex,
      content: parsed,
      modelUsed: MODEL,
      inputTokens: response.usage?.prompt_tokens ?? null,
      outputTokens: response.usage?.completion_tokens ?? null,
    })
    .returning();
  return row;
}

export async function findDrilldown(args: {
  insightId: string;
  observationIndex: number;
}): Promise<InsightDrilldown | null> {
  const [row] = await db
    .select()
    .from(insightDrilldowns)
    .where(
      and(
        eq(insightDrilldowns.insightId, args.insightId),
        eq(insightDrilldowns.observationIndex, args.observationIndex),
      ),
    )
    .limit(1);
  return row ?? null;
}

// ─── Prompt builder ───────────────────────────────────────────────────
function buildFeedbackBlock(summary: DrilldownFeedbackSummary): string {
  if (summary.liked.length === 0 && summary.disliked.length === 0) return "";

  const fmt = (e: { kind: string; title: string }) =>
    `- [${e.kind === "hypothesis" ? "hyp" : "fix"}] ${e.title}`;

  const blocks: string[] = ["## Feedback dari user pada drill-down sebelumnya"];

  if (summary.liked.length > 0) {
    blocks.push(
      `\n### Yang user anggap berguna (👍, ${summary.liked.length}):`,
      summary.liked.map(fmt).join("\n"),
    );
  }
  if (summary.disliked.length > 0) {
    blocks.push(
      `\n### Yang user tandai kurang relevan (👎, ${summary.disliked.length}):`,
      summary.disliked.map(fmt).join("\n"),
    );
  }
  blocks.push(
    "\nGunakan sinyal ini ketika menyusun hypotheses + fixes — condongkan ke angle yang dianggap berguna, hindari pattern yang ditandai kurang relevan. Jangan duplikasi kata-katanya — angle yang dicontoh.",
  );
  return blocks.join("\n") + "\n\n";
}

function buildDrilldownUserPrompt(args: {
  insight: Insight;
  observation: { title: string; description: string; severity: string };
  reportData: import("@/lib/reports/fetch-report-data").ReportData;
  flagsBlock: string;
  feedbackSummary: DrilldownFeedbackSummary;
}): string {
  const { insight, observation, reportData, flagsBlock, feedbackSummary } =
    args;

  const adsCampaigns = reportData.campaigns
    .filter((c) => c.source === "google_ads")
    .slice(0, 8)
    .map(
      (c) =>
        `- ${c.campaignName ?? c.campaignId ?? "(rollup)"}: spend=${c.spend}, clicks=${c.clicks}, conv=${c.conversions}`,
    )
    .join("\n");

  const topPages = reportData.topPages
    .map(
      (p, i) =>
        `${i + 1}. ${p.page} — ${p.conversions} conv / ${p.sessions} sessions (CVR ${p.sessions > 0 ? ((p.conversions / p.sessions) * 100).toFixed(1) : "—"}%)`,
    )
    .join("\n");

  const trend = reportData.trend
    .map(
      (b) =>
        `${b.label}: sessions=${b.sessions}, conv=${b.conversions}, spend=${b.spend}`,
    )
    .join("\n");

  return `${buildFeedbackBlock(feedbackSummary)}## Focus observation (drill down ke sini)

**Severity**: ${observation.severity}
**Title**: ${observation.title}
**Description**: ${observation.description}

## Konteks dari parent insight
- Window: ${insight.windowStart} → ${insight.windowEnd} (${insight.windowDays} hari)
- Executive summary: ${insight.executiveSummary}

## Auto-detected flags (boleh di-cite kalau relevan)
${flagsBlock || "(tidak ada flag yang ter-detect)"}

## Data underlying

### Totals window ini
- Sessions: ${reportData.totals.sessions}, Pageviews: ${reportData.totals.pageviews}, Conversions: ${reportData.totals.conversions}, Revenue: ${reportData.totals.revenue}
- Paid: impressions ${reportData.totals.impressions}, clicks ${reportData.totals.clicks}, spend ${reportData.totals.spend}
- Organic: clicks ${reportData.totals.organicClicks}, impressions ${reportData.totals.organicImpressions}

### Trend (6 bucket)
${trend}

### Top converting pages
${topPages || "(belum ada)"}

### Google Ads campaigns (top 8 by spend)
${adsCampaigns || "(belum ada Ads data)"}

### AI assistant traffic
${reportData.aiTraffic.totalSessions} total sessions dari ${reportData.aiTraffic.bySource.map((s) => `${s.source} (${s.sessions})`).join(", ") || "(none)"}.

---

Lakukan drill-down. Cite angka spesifik dari data di atas. Hindari paraphrase observation tanpa bukti baru.`;
}
