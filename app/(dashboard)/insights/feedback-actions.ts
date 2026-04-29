"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { insightDrilldowns } from "@/lib/db/schema";
import { upsertFeedback } from "@/lib/insight-feedback";
import { upsertDrilldownFeedback } from "@/lib/drilldown-feedback";
import { findInsightByIdForUser } from "@/lib/ai/insights";

const feedbackInput = z.object({
  insightId: z.string().min(1),
  kind: z.enum(["observation", "recommendation"]),
  itemIndex: z.number().int().min(0).max(50),
  /** -1 thumbs down, 1 thumbs up, 0 cleared (toggle off). */
  rating: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
});

export type SetFeedbackResult = { error: string } | { success: true };

/**
 * Toggle / set feedback on a single observation or recommendation. The
 * caller owns toggle behaviour (sending 0 to clear); this action just
 * persists whatever rating it gets.
 */
export async function setInsightFeedbackAction(
  input: z.infer<typeof feedbackInput>,
): Promise<SetFeedbackResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Tidak ada session aktif" };
  }

  const parsed = feedbackInput.safeParse(input);
  if (!parsed.success) {
    return { error: "Input tidak valid" };
  }

  // Verify ownership of the insight before recording feedback. The DB
  // FK doesn't prevent feedback against another user's insight if the
  // insight id is leaked — this check does.
  const insight = await findInsightByIdForUser({
    userId: session.user.id,
    insightId: parsed.data.insightId,
  });
  if (!insight) {
    return { error: "Insight tidak ditemukan" };
  }

  // Bounds-check the index against the actual array length so a stale
  // UI can't write feedback past the array.
  const limit =
    parsed.data.kind === "observation"
      ? insight.observations.length
      : insight.recommendations.length;
  if (parsed.data.itemIndex >= limit) {
    return { error: "Index di luar range" };
  }

  await upsertFeedback({
    userId: session.user.id,
    insightId: parsed.data.insightId,
    kind: parsed.data.kind,
    itemIndex: parsed.data.itemIndex,
    rating: parsed.data.rating,
  });

  revalidatePath("/insights");
  return { success: true };
}

// ─── Drilldown feedback ─────────────────────────────────────────────
const drilldownFeedbackInput = z.object({
  drilldownId: z.string().min(1),
  kind: z.enum(["hypothesis", "fix"]),
  itemIndex: z.number().int().min(0).max(20),
  rating: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
});

export async function setDrilldownFeedbackAction(
  input: z.infer<typeof drilldownFeedbackInput>,
): Promise<SetFeedbackResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Tidak ada session aktif" };

  const parsed = drilldownFeedbackInput.safeParse(input);
  if (!parsed.success) return { error: "Input tidak valid" };

  // Ownership check: confirm the drilldown belongs to this user
  // before persisting feedback. The FK alone isn't enough to prevent
  // cross-user writes if a drilldown id leaks.
  const [drilldown] = await db
    .select({
      userId: insightDrilldowns.userId,
      content: insightDrilldowns.content,
    })
    .from(insightDrilldowns)
    .where(eq(insightDrilldowns.id, parsed.data.drilldownId))
    .limit(1);
  if (!drilldown || drilldown.userId !== session.user.id) {
    return { error: "Drilldown tidak ditemukan" };
  }

  // Range-check itemIndex against the actual array length.
  const limit =
    parsed.data.kind === "hypothesis"
      ? drilldown.content.hypotheses.length
      : drilldown.content.fixes.length;
  if (parsed.data.itemIndex >= limit) {
    return { error: "Index di luar range" };
  }

  await upsertDrilldownFeedback({
    userId: session.user.id,
    drilldownId: parsed.data.drilldownId,
    kind: parsed.data.kind,
    itemIndex: parsed.data.itemIndex,
    rating: parsed.data.rating,
  });

  revalidatePath("/insights");
  return { success: true };
}
