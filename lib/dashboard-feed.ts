import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  connections,
  insightDrilldowns,
  insights,
  syncRuns,
} from "@/lib/db/schema";

// Unified "what's been happening in your workspace" feed for the
// dashboard. Merges three event streams in time order:
//
//   - insight  → AI insight was generated
//   - drilldown → drill-down on an observation was generated
//   - sync     → connector sync run completed (success / error)
//
// Each event normalized to a common shape so the feed component
// just renders, no type-switching at the leaf level.

export type ActivityEvent =
  | {
      kind: "insight";
      id: string;
      occurredAt: Date;
      title: string;
      meta: string;
    }
  | {
      kind: "drilldown";
      id: string;
      occurredAt: Date;
      title: string;
      meta: string;
    }
  | {
      kind: "sync";
      id: string;
      occurredAt: Date;
      title: string;
      meta: string;
      status: "success" | "error" | "running";
    };

const PER_KIND_LIMIT = 10;
const TOTAL_LIMIT = 12;

export async function getDashboardActivityFeed(
  userId: string,
): Promise<ActivityEvent[]> {
  const userConnections = await db
    .select()
    .from(connections)
    .where(eq(connections.userId, userId));
  const realConnIds = userConnections
    .filter((c) => !c.externalAccountId.startsWith("_pending_"))
    .map((c) => c.id);
  const connectionsById = new Map(userConnections.map((c) => [c.id, c]));

  const [recentInsights, recentDrilldowns, recentSyncs] = await Promise.all([
    db
      .select({
        id: insights.id,
        title: insights.title,
        windowStart: insights.windowStart,
        windowEnd: insights.windowEnd,
        createdAt: insights.createdAt,
      })
      .from(insights)
      .where(eq(insights.userId, userId))
      .orderBy(desc(insights.createdAt))
      .limit(PER_KIND_LIMIT),
    db
      .select({
        id: insightDrilldowns.id,
        insightId: insightDrilldowns.insightId,
        observationIndex: insightDrilldowns.observationIndex,
        content: insightDrilldowns.content,
        createdAt: insightDrilldowns.createdAt,
      })
      .from(insightDrilldowns)
      .where(eq(insightDrilldowns.userId, userId))
      .orderBy(desc(insightDrilldowns.createdAt))
      .limit(PER_KIND_LIMIT),
    realConnIds.length > 0
      ? db
          .select()
          .from(syncRuns)
          .where(inArray(syncRuns.connectionId, realConnIds))
          .orderBy(desc(syncRuns.startedAt))
          .limit(PER_KIND_LIMIT)
      : Promise.resolve([]),
  ]);

  const events: ActivityEvent[] = [];

  for (const i of recentInsights) {
    events.push({
      kind: "insight",
      id: i.id,
      occurredAt: i.createdAt,
      title: i.title ?? `Insight ${i.windowStart} → ${i.windowEnd}`,
      meta: `${i.windowStart} → ${i.windowEnd}`,
    });
  }

  for (const d of recentDrilldowns) {
    // The drilldown's content has a `summary` field — use first
    // ~50 chars as title-ish (or fallback).
    const summary =
      typeof d.content?.summary === "string"
        ? d.content.summary
        : "Drill-down analysis";
    const short = summary.length > 60 ? `${summary.slice(0, 57)}…` : summary;
    events.push({
      kind: "drilldown",
      id: d.id,
      occurredAt: d.createdAt,
      title: short,
      meta: "Drill-down",
    });
  }

  for (const s of recentSyncs) {
    const conn = connectionsById.get(s.connectionId);
    const accountLabel =
      conn?.externalAccountName ?? conn?.externalAccountId ?? "—";
    const records = s.recordsCount;
    const meta =
      s.status === "success" && records !== null
        ? `${conn?.connectorId ?? "?"} · ${records} record`
        : s.status === "error"
          ? `${conn?.connectorId ?? "?"} · gagal`
          : `${conn?.connectorId ?? "?"} · ${s.status}`;
    events.push({
      kind: "sync",
      id: s.id,
      occurredAt: s.startedAt,
      title: accountLabel,
      meta,
      status: s.status,
    });
  }

  // Sort all events by occurredAt desc, take top N.
  events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  return events.slice(0, TOTAL_LIMIT);
}
