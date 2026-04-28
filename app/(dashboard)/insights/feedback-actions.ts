"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { upsertFeedback } from "@/lib/insight-feedback";
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
