import { unstable_cache } from "next/cache";
import { and, desc, eq, gte, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { connections, dailyMetrics } from "@/lib/db/schema";

// Surface "interesting" periods worth manually generating an insight
// for — beyond the default last-completed week. Approach: read 90 days
// of daily totals per metric, compute rolling baseline (mean over the
// preceding 30d window), and flag days where the current day deviates
// > 2σ. Consecutive flagged days collapse into a single period. We
// return top-N by magnitude so the suggestion list is short and worth
// reading.

const LOOKBACK_DAYS = 90;
const BASELINE_DAYS = 30;
const SIGMA_THRESHOLD = 2;
const MAX_SUGGESTIONS = 5;

export type InterestingPeriod = {
  /** Inclusive YYYY-MM-DD. */
  start: string;
  end: string;
  /** Which metric triggered the flag. */
  metric: "sessions" | "conversions" | "spend" | "clicks";
  /** spike = positive anomaly (mean + 2σ); dip = negative. */
  kind: "spike" | "dip";
  /** Multiplier of σ above/below the baseline mean. Higher = more
   *  significant. Used to rank suggestions. */
  magnitude: number;
  /** Pre-formatted human label like "Spike Sessions: 3,2× normal pada
   *  18 Apr (+540 vs avg 168)". */
  label: string;
};

const idFmt = new Intl.NumberFormat("id-ID");

function isoDateNDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function asNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const month = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][d.getUTCMonth()];
  return `${d.getUTCDate()} ${month}`;
}

// Detection is expensive (90 days × all metrics × all connections,
// loaded into memory then run through rolling stats per metric). We
// memoize per-user for a short TTL — daily anomaly windows don't
// change minute-to-minute, and the /insights page renders this on
// every load. Tagged so callers can revalidate after a fresh sync if
// needed (revalidateTag("period-detection") would force re-compute).
const PERIOD_DETECTION_TTL_SECONDS = 60 * 30; // 30 min

export const detectInterestingPeriods = unstable_cache(
  async (userId: string): Promise<InterestingPeriod[]> => {
    return await detectInterestingPeriodsImpl(userId);
  },
  ["period-detection-v1"],
  {
    revalidate: PERIOD_DETECTION_TTL_SECONDS,
    tags: ["period-detection"],
  },
);

async function detectInterestingPeriodsImpl(
  userId: string,
): Promise<InterestingPeriod[]> {
  const since = isoDateNDaysAgo(LOOKBACK_DAYS);

  const userConnections = await db
    .select()
    .from(connections)
    .where(eq(connections.userId, userId));
  const realConnections = userConnections.filter(
    (c) => !c.externalAccountId.startsWith("_pending_"),
  );
  if (realConnections.length === 0) return [];

  const rows = await db
    .select()
    .from(dailyMetrics)
    .where(
      and(
        inArray(
          dailyMetrics.connectionId,
          realConnections.map((c) => c.id),
        ),
        gte(dailyMetrics.date, since),
      ),
    )
    .orderBy(desc(dailyMetrics.date));

  // Aggregate to a single per-day series per metric. We're channel-
  // agnostic here — the goal is "is this day weird overall", not
  // attribution. Sessions come from GA4 raw; spend/clicks from any
  // ad source; conversions from GA4.
  type DailyAgg = {
    sessions: number;
    conversions: number;
    spend: number;
    clicks: number;
  };
  const byDate = new Map<string, DailyAgg>();
  for (const row of rows) {
    const d = byDate.get(row.date) ?? {
      sessions: 0,
      conversions: 0,
      spend: 0,
      clicks: 0,
    };
    if (row.source === "ga4") {
      const raw = row.rawData as Record<string, unknown> | null;
      d.sessions += raw ? asNumber(raw.sessions) : 0;
      d.conversions += asNumber(row.conversions);
    }
    if (row.source === "google_ads") {
      d.spend += asNumber(row.spend);
      d.clicks += asNumber(row.clicks);
    }
    byDate.set(row.date, d);
  }
  const dailySorted = Array.from(byDate.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  if (dailySorted.length < BASELINE_DAYS + 5) return []; // need history

  // Rolling stats per metric.
  const candidates: InterestingPeriod[] = [];
  const metrics: Array<keyof DailyAgg> = [
    "sessions",
    "conversions",
    "spend",
    "clicks",
  ];

  for (const metric of metrics) {
    for (let i = BASELINE_DAYS; i < dailySorted.length; i++) {
      const baseline = dailySorted
        .slice(i - BASELINE_DAYS, i)
        .map(([, v]) => v[metric]);
      const mean = baseline.reduce((s, n) => s + n, 0) / baseline.length;
      if (mean === 0) continue;
      const variance =
        baseline.reduce((s, n) => s + (n - mean) ** 2, 0) / baseline.length;
      const sigma = Math.sqrt(variance);
      if (sigma === 0) continue;

      const [date, value] = dailySorted[i];
      const dev = value[metric] - mean;
      const magnitude = Math.abs(dev) / sigma;
      if (magnitude < SIGMA_THRESHOLD) continue;

      const kind: "spike" | "dip" = dev > 0 ? "spike" : "dip";
      const meanFormatted = idFmt.format(Math.round(mean));
      const valueFormatted = idFmt.format(Math.round(value[metric]));
      const ratio = value[metric] / mean;

      candidates.push({
        start: date,
        end: date,
        metric,
        kind,
        magnitude,
        label: `${kind === "spike" ? "Spike" : "Dip"} ${metric}: ${ratio.toFixed(1)}× normal pada ${formatDate(date)} (${valueFormatted} vs avg ${meanFormatted})`,
      });
    }
  }

  // Group consecutive same-metric same-kind flags into one period.
  candidates.sort((a, b) =>
    a.metric === b.metric
      ? a.start.localeCompare(b.start)
      : a.metric.localeCompare(b.metric),
  );
  const merged: InterestingPeriod[] = [];
  for (const c of candidates) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.metric === c.metric &&
      last.kind === c.kind &&
      isAdjacentDay(last.end, c.start)
    ) {
      last.end = c.start;
      last.magnitude = Math.max(last.magnitude, c.magnitude);
      // Re-label to span the period.
      last.label = last.label.replace(
        /pada [^(]+\(/,
        `pada ${formatDate(last.start)}–${formatDate(last.end)} (`,
      );
    } else {
      merged.push({ ...c });
    }
  }

  // Top-N by magnitude.
  return merged
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, MAX_SUGGESTIONS);
}

function isAdjacentDay(iso1: string, iso2: string): boolean {
  const d1 = new Date(iso1 + "T00:00:00Z");
  const d2 = new Date(iso2 + "T00:00:00Z");
  const diff = (d2.getTime() - d1.getTime()) / (24 * 60 * 60 * 1000);
  return diff === 1;
}
