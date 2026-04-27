import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { db } from "@/lib/db";
import { insights, type Insight } from "@/lib/db/schema";
import { getMetricsSummary } from "@/lib/metrics-queries";
import { INSIGHTS_SYSTEM_PROMPT } from "./prompts";

const MODEL = "claude-opus-4-7";
const WINDOW_DAYS = 30;

// Structured output schema enforced via Anthropic's JSON-mode. We declare
// the shape with Zod for runtime validation + JSON Schema serialization.
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

// Anthropic's structured outputs accept a JSON Schema directly. We hand-roll
// it (rather than reach for an extra zod-to-json-schema dep) since the shape
// is short and stable. Keep in sync with InsightContentSchema above.
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

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local — get one at https://console.anthropic.com",
    );
  }
  return new Anthropic();
}

function buildUserPrompt(args: {
  windowDays: number;
  windowStart: string;
  windowEnd: string;
  connectedSources: number;
  totals: Record<string, number>;
  daily: Array<Record<string, string | number>>;
}): string {
  const {
    windowDays,
    windowStart,
    windowEnd,
    connectedSources,
    totals,
    daily,
  } = args;

  const totalsBlock = Object.entries(totals)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const dailyBlock = daily
    .map((row) => {
      const date = row.date;
      const others = Object.entries(row)
        .filter(([k]) => k !== "date")
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      return `${date}: ${others}`;
    })
    .join("\n");

  return `Analisis data marketing berikut dan berikan insight dalam format JSON yang sudah ditentukan.

## Window
${windowDays} hari terakhir (${windowStart} → ${windowEnd}), data dari ${connectedSources} koneksi aktif.

## Total selama window
${totalsBlock}

## Daily breakdown
${dailyBlock || "(tidak ada baris data — kemungkinan belum sync atau koneksi placeholder)"}

Berikan analisis sekarang.`;
}

export async function generateInsight(args: {
  userId: string;
}): Promise<Insight> {
  const summary = await getMetricsSummary({
    userId: args.userId,
    days: WINDOW_DAYS,
  });

  if (summary.connectedSources === 0) {
    throw new Error(
      "Belum ada koneksi data source. Connect dulu di /data-sources.",
    );
  }
  if (!summary.hasData) {
    throw new Error(
      `Belum ada data tersinkron untuk ${WINDOW_DAYS} hari terakhir. Jalankan Sync di /data-sources dulu.`,
    );
  }

  const windowEnd = summary.daily[summary.daily.length - 1]?.date ?? "";
  const windowStart = summary.daily[0]?.date ?? "";

  const userPrompt = buildUserPrompt({
    windowDays: WINDOW_DAYS,
    windowStart,
    windowEnd,
    connectedSources: summary.connectedSources,
    totals: summary.totals as unknown as Record<string, number>,
    daily: summary.daily as unknown as Array<Record<string, string | number>>,
  });

  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: {
        type: "json_schema",
        schema: INSIGHT_JSON_SCHEMA,
      },
    },
    // Top-level cache_control auto-marks the last cacheable block. The
    // system prompt is by far the largest stable prefix, so this caches it
    // (assuming we ever cross the ~4096 token minimum — for now it's a
    // no-op, but harmless).
    cache_control: { type: "ephemeral" },
    system: INSIGHTS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  // Extract the JSON content. With structured outputs the response is a
  // single text block whose body is parseable JSON.
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude response missing text block");
  }

  let parsed: InsightContent;
  try {
    const json = JSON.parse(textBlock.text);
    parsed = InsightContentSchema.parse(json);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse Claude response: ${detail}`);
  }

  const [row] = await db
    .insert(insights)
    .values({
      userId: args.userId,
      windowDays: WINDOW_DAYS,
      windowStart,
      windowEnd,
      executiveSummary: parsed.executiveSummary,
      observations: parsed.observations,
      recommendations: parsed.recommendations,
      inputSnapshot: {
        windowDays: WINDOW_DAYS,
        windowStart,
        windowEnd,
        connectedSources: summary.connectedSources,
        totals: summary.totals as unknown as Record<string, number>,
        daily: summary.daily as unknown as Array<
          Record<string, string | number>
        >,
      },
      inputTokens: response.usage.input_tokens ?? null,
      outputTokens: response.usage.output_tokens ?? null,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? null,
      modelUsed: MODEL,
    })
    .returning();

  return row;
}

export async function listInsightsForUser(userId: string): Promise<Insight[]> {
  const rows = await db.query.insights.findMany({
    where: (insight, { eq }) => eq(insight.userId, userId),
    orderBy: (insight, { desc }) => [desc(insight.createdAt)],
    limit: 20,
  });
  return rows;
}
