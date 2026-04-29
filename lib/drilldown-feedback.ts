import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { drilldownFeedback } from "@/lib/db/schema";
import type { FeedbackRating } from "./insight-feedback";

export type DrilldownFeedbackKind = "hypothesis" | "fix";
export type DrilldownFeedbackMap = Map<string, FeedbackRating>;

export function drilldownFeedbackKey(args: {
  kind: DrilldownFeedbackKind;
  itemIndex: number;
}): string {
  return `${args.kind}:${args.itemIndex}`;
}

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

function normalize(n: number): FeedbackRating {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
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
