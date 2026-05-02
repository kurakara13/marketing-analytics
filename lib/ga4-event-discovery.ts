import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { connections } from "@/lib/db/schema";
import { runReport } from "@/lib/connectors/ga4/data-api";
import { getValidTokens } from "@/lib/google/tokens";

// Live-discover the GA4 events available across all of a user's
// connected GA4 properties. Returns a deduped list with the typical
// daily count over the last 30 days so the UI can show "form_submit
// ~58/minggu" alongside each event.
//
// Used by /settings business-context form to populate the multi-
// select picker for "lead events". NOT cached at the DB level —
// each call hits GA4 once per connected property. Lightweight (single
// runReport with `eventName` dimension), but the page-level Next
// cache (1-2 min) is plenty.

export type DiscoveredEvent = {
  /** The GA4 event_name as configured in the property. */
  eventName: string;
  /** Sum of eventCount across all the user's GA4 properties for the
   *  discovery window (default last 30 days). */
  eventCount: number;
  /** Properties where this event appears (for context when user has
   *  multiple GA4 properties connected). */
  sources: string[];
};

const DISCOVERY_WINDOW_DAYS = 30;

function isoDateNDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function asNumber(value: string | undefined | null): number {
  if (!value) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function discoverGa4Events(
  userId: string,
): Promise<DiscoveredEvent[]> {
  const userConnections = await db
    .select()
    .from(connections)
    .where(eq(connections.userId, userId));
  const ga4Conns = userConnections.filter(
    (c) =>
      c.connectorId === "ga4" &&
      !c.externalAccountId.startsWith("_pending_") &&
      c.status === "active",
  );
  if (ga4Conns.length === 0) return [];

  const startDate = isoDateNDaysAgo(DISCOVERY_WINDOW_DAYS);
  const endDate = isoDateNDaysAgo(1); // yesterday — today not complete yet

  // Aggregate across all connected GA4 properties. If a user has 3
  // properties, "form_submit" sums counts from all 3.
  const merged = new Map<
    string,
    { count: number; sources: Set<string> }
  >();

  await Promise.all(
    ga4Conns.map(async (conn) => {
      let tokens;
      try {
        tokens = await getValidTokens(conn);
      } catch {
        // Bad/expired token — skip silently; user will see this
        // surfaced elsewhere via sync health.
        return;
      }
      let response;
      try {
        response = await runReport({
          accessToken: tokens.accessToken,
          propertyId: conn.externalAccountId,
          startDate,
          endDate,
          dimensions: ["eventName"],
          metrics: ["eventCount"],
          limit: 200, // GA4 properties rarely have >50 events
        });
      } catch {
        return;
      }

      const dimNames = response.dimensionHeaders?.map((h) => h.name) ?? [];
      const metNames = response.metricHeaders?.map((h) => h.name) ?? [];
      const eIdx = dimNames.indexOf("eventName");
      const cIdx = metNames.indexOf("eventCount");
      const accountLabel =
        conn.externalAccountName ?? conn.externalAccountId;

      for (const row of response.rows ?? []) {
        const eventName = row.dimensionValues?.[eIdx]?.value;
        const count = asNumber(row.metricValues?.[cIdx]?.value);
        if (!eventName) continue;
        const entry = merged.get(eventName) ?? {
          count: 0,
          sources: new Set<string>(),
        };
        entry.count += count;
        entry.sources.add(accountLabel);
        merged.set(eventName, entry);
      }
    }),
  );

  // Sort: highest count first, alpha as tiebreak.
  return Array.from(merged.entries())
    .map(
      ([eventName, { count, sources }]): DiscoveredEvent => ({
        eventName,
        eventCount: count,
        sources: Array.from(sources),
      }),
    )
    .sort((a, b) => {
      if (b.eventCount !== a.eventCount) return b.eventCount - a.eventCount;
      return a.eventName.localeCompare(b.eventName);
    });
}
