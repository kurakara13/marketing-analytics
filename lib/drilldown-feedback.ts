import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  drilldownFeedback,
  insightDrilldowns,
} from "@/lib/db/schema";
// Re-export client-safe types/keys for backward compat with existing
// server-side imports. Client components MUST import directly from
// "@/lib/feedback-keys" to avoid pulling postgres into the browser
// bundle.
export {
  drilldownFeedbackKey,
  type DrilldownFeedbackKind,
  type DrilldownFeedbackMap,
  type FeedbackRating,
} from "./feedback-keys";
import {
  drilldownFeedbackKey,
  type DrilldownFeedbackKind,
  type DrilldownFeedbackMap,
  type FeedbackRating,
} from "./feedback-keys";

export async function getFeedbackForDrilldown(args: {
  userId: string;
  drilldownId: string;
}): Promise<DrilldownFeedbackMap> {
  const rows = await db
    .select()
    .from(drilldownFeedback)
    .where(
      and(
        eq(drilldownFeedback.userId, args.userId),
        eq(drilldownFeedback.drilldownId, args.drilldownId),
      ),
    );

  const map: DrilldownFeedbackMap = new Map();
  for (const r of rows) {
    map.set(
      drilldownFeedbackKey({ kind: r.kind, itemIndex: r.itemIndex }),
      normalize(r.rating),
    );
  }
  return map;
}

/**
 * Batch variant: pull feedback for many drilldowns in one query and
 * return a Map keyed by drilldownId. Used by /insights list page to
 * avoid N+1 queries.
 */
export async function getFeedbackForDrilldowns(args: {
  userId: string;
  drilldownIds: string[];
}): Promise<Map<string, DrilldownFeedbackMap>> {
  const result = new Map<string, DrilldownFeedbackMap>();
  if (args.drilldownIds.length === 0) return result;

  const rows = await db
    .select()
    .from(drilldownFeedback)
    .where(
      and(
        eq(drilldownFeedback.userId, args.userId),
        inArray(drilldownFeedback.drilldownId, args.drilldownIds),
      ),
    );

  for (const r of rows) {
    const inner = result.get(r.drilldownId) ?? new Map();
    inner.set(
      drilldownFeedbackKey({ kind: r.kind, itemIndex: r.itemIndex }),
      normalize(r.rating),
    );
    result.set(r.drilldownId, inner);
  }
  for (const id of args.drilldownIds) {
    if (!result.has(id)) result.set(id, new Map());
  }
  return result;
}

function normalize(n: number): FeedbackRating {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

/**
 * Aggregated drill-down feedback signal fed back into the drill-down
 * prompt. Lists the top-rated hypothesis/fix items from past drill-downs
 * with their original text so the model can pattern-match the angle
 * the user finds useful (and avoid the angles they've down-rated).
 *
 * Returns top-5 liked + top-5 disliked, sorted by feedback recency.
 */
export type DrilldownFeedbackSummary = {
  liked: Array<{
    kind: DrilldownFeedbackKind;
    title: string;
  }>;
  disliked: Array<{
    kind: DrilldownFeedbackKind;
    title: string;
  }>;
};

const MAX_PER_BUCKET = 5;

export async function getUserDrilldownFeedbackSummary(
  userId: string,
): Promise<DrilldownFeedbackSummary> {
  const rows = await db
    .select({
      kind: drilldownFeedback.kind,
      itemIndex: drilldownFeedback.itemIndex,
      rating: drilldownFeedback.rating,
      content: insightDrilldowns.content,
      updatedAt: drilldownFeedback.updatedAt,
    })
    .from(drilldownFeedback)
    .innerJoin(
      insightDrilldowns,
      eq(drilldownFeedback.drilldownId, insightDrilldowns.id),
    )
    .where(eq(drilldownFeedback.userId, userId))
    .orderBy(desc(drilldownFeedback.updatedAt))
    .limit(50);

  const liked: DrilldownFeedbackSummary["liked"] = [];
  const disliked: DrilldownFeedbackSummary["disliked"] = [];

  for (const row of rows) {
    const list =
      row.kind === "hypothesis"
        ? row.content?.hypotheses
        : row.content?.fixes;
    const item = list?.[row.itemIndex];
    if (!item) continue;

    const entry = {
      kind: row.kind as DrilldownFeedbackKind,
      title: item.title,
    };

    if (row.rating > 0 && liked.length < MAX_PER_BUCKET) {
      liked.push(entry);
    } else if (row.rating < 0 && disliked.length < MAX_PER_BUCKET) {
      disliked.push(entry);
    }
    if (liked.length >= MAX_PER_BUCKET && disliked.length >= MAX_PER_BUCKET) {
      break;
    }
  }

  return { liked, disliked };
}

export async function upsertDrilldownFeedback(args: {
  userId: string;
  drilldownId: string;
  kind: DrilldownFeedbackKind;
  itemIndex: number;
  rating: FeedbackRating;
}): Promise<void> {
  const now = new Date();
  await db
    .insert(drilldownFeedback)
    .values({
      userId: args.userId,
      drilldownId: args.drilldownId,
      kind: args.kind,
      itemIndex: args.itemIndex,
      rating: args.rating,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        drilldownFeedback.userId,
        drilldownFeedback.drilldownId,
        drilldownFeedback.kind,
        drilldownFeedback.itemIndex,
      ],
      set: { rating: args.rating, updatedAt: now },
    });
}
