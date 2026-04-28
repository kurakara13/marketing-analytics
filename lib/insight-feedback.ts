import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { insightFeedback, type InsightFeedback } from "@/lib/db/schema";

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

function normalizeRating(n: number): FeedbackRating {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
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
