import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { insights, insightFeedback, type InsightFeedback } from "@/lib/db/schema";

export type FeedbackKind = "observation" | "recommendation";
export type FeedbackRating = -1 | 0 | 1;

/**
 * Lightweight summary of all feedback the user has left on a single
 * insight. Returned by `getFeedbackForInsight` so the UI can render
 * the thumb state of every observation/recommendation in one query.
 *
 * Shape: a Map keyed by `${kind}:${itemIndex}` → rating. Missing keys
 * = no feedback yet (neutral). 0 = explicit "cleared" state.
 */
export type InsightFeedbackMap = Map<string, FeedbackRating>;

export function feedbackKey(args: {
  kind: FeedbackKind;
  itemIndex: number;
}): string {
  return `${args.kind}:${args.itemIndex}`;
}

export async function getFeedbackForInsight(args: {
  userId: string;
  insightId: string;
}): Promise<InsightFeedbackMap> {
  const rows = await db
    .select()
    .from(insightFeedback)
    .where(
      and(
        eq(insightFeedback.userId, args.userId),
        eq(insightFeedback.insightId, args.insightId),
      ),
    );

  const map: InsightFeedbackMap = new Map();
  for (const r of rows) {
    map.set(feedbackKey({ kind: r.kind, itemIndex: r.itemIndex }), normalizeRating(r.rating));
  }
  return map;
}

/**
 * Batch variant: pull feedback for multiple insights in one query and
 * return a Map keyed by insightId. Used by the /insights list page to
 * avoid N+1 queries when rendering 20 cards.
 */
export async function getFeedbackForInsights(args: {
  userId: string;
  insightIds: string[];
}): Promise<Map<string, InsightFeedbackMap>> {
  const result = new Map<string, InsightFeedbackMap>();
  if (args.insightIds.length === 0) return result;

  const rows = await db
    .select()
    .from(insightFeedback)
    .where(
      and(
        eq(insightFeedback.userId, args.userId),
        inArray(insightFeedback.insightId, args.insightIds),
      ),
    );

  for (const r of rows) {
    const inner = result.get(r.insightId) ?? new Map();
    inner.set(
      feedbackKey({ kind: r.kind, itemIndex: r.itemIndex }),
      normalizeRating(r.rating),
    );
    result.set(r.insightId, inner);
  }
  // Make sure every requested id appears in the result, even when no
  // feedback rows exist — keeps the caller's `.get(id)` simple.
  for (const id of args.insightIds) {
    if (!result.has(id)) result.set(id, new Map());
  }
  return result;
}

function normalizeRating(n: number): FeedbackRating {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

/**
 * Aggregated feedback signal fed back into the AI prompt. Lists the
 * top liked and disliked observations/recommendations with their full
 * title + description so the model can pattern-match the style and
 * angle the user prefers (and avoid the angles they've explicitly
 * down-rated).
 *
 * "Top" = most recent, capped at MAX_PER_BUCKET. We resolve each
 * (insightId, kind, itemIndex) tuple back to the original text by
 * joining against the insight rows so the prompt has substance, not
 * just numeric ids.
 */
export type FeedbackSummary = {
  liked: Array<{ kind: FeedbackKind; title: string; description: string }>;
  disliked: Array<{ kind: FeedbackKind; title: string; description: string }>;
};

const MAX_PER_BUCKET = 5;

export async function getUserFeedbackSummary(
  userId: string,
): Promise<FeedbackSummary> {
  const rows = await db
    .select({
      kind: insightFeedback.kind,
      itemIndex: insightFeedback.itemIndex,
      rating: insightFeedback.rating,
      observations: insights.observations,
      recommendations: insights.recommendations,
      updatedAt: insightFeedback.updatedAt,
    })
    .from(insightFeedback)
    .innerJoin(insights, eq(insightFeedback.insightId, insights.id))
    .where(eq(insightFeedback.userId, userId))
    .orderBy(desc(insightFeedback.updatedAt))
    .limit(50);

  const liked: FeedbackSummary["liked"] = [];
  const disliked: FeedbackSummary["disliked"] = [];

  for (const row of rows) {
    const list =
      row.kind === "observation" ? row.observations : row.recommendations;
    const item = list?.[row.itemIndex];
    if (!item) continue;

    const entry = {
      kind: row.kind as FeedbackKind,
      title: item.title,
      description: item.description,
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

/**
 * Set or update a feedback row. Pass rating=0 to clear. Toggling is
 * upstream — the caller decides whether clicking 👍 again should clear
 * (rating=0) or stay (rating=1).
 */
export async function upsertFeedback(args: {
  userId: string;
  insightId: string;
  kind: FeedbackKind;
  itemIndex: number;
  rating: FeedbackRating;
}): Promise<InsightFeedback> {
  const now = new Date();
  const [row] = await db
    .insert(insightFeedback)
    .values({
      userId: args.userId,
      insightId: args.insightId,
      kind: args.kind,
      itemIndex: args.itemIndex,
      rating: args.rating,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        insightFeedback.userId,
        insightFeedback.insightId,
        insightFeedback.kind,
        insightFeedback.itemIndex,
      ],
      set: {
        rating: args.rating,
        updatedAt: now,
      },
    })
    .returning();
  return row;
}
