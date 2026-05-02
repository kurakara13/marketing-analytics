import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  userBusinessContext,
  type UserBusinessContext,
} from "@/lib/db/schema";

export async function getBusinessContext(
  userId: string,
): Promise<UserBusinessContext | null> {
  const [row] = await db
    .select()
    .from(userBusinessContext)
    .where(eq(userBusinessContext.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function upsertBusinessContext(args: {
  userId: string;
  industry: string | null;
  targetAudience: string | null;
  brandVoice: "professional" | "casual" | "technical" | null;
  businessGoals: string | null;
  /** Multi-event lead definition. Empty array or null = no
   *  user-defined lead events (fallback to GA4 conversions total). */
  leadEvents: string[] | null;
  /** Custom term the user uses for "lead" (defaults to "lead" when
   *  null, surfaced in AI narrative output). */
  leadLabel: string | null;
}): Promise<void> {
  const now = new Date();
  // Normalize empty array → null so DB queries can use IS NULL
  // checks consistently.
  const leadEvents =
    args.leadEvents && args.leadEvents.length > 0 ? args.leadEvents : null;
  const leadLabel =
    args.leadLabel && args.leadLabel.trim().length > 0
      ? args.leadLabel.trim()
      : null;

  await db
    .insert(userBusinessContext)
    .values({
      userId: args.userId,
      industry: args.industry,
      targetAudience: args.targetAudience,
      brandVoice: args.brandVoice,
      businessGoals: args.businessGoals,
      leadEvents,
      leadLabel,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userBusinessContext.userId,
      set: {
        industry: args.industry,
        targetAudience: args.targetAudience,
        brandVoice: args.brandVoice,
        businessGoals: args.businessGoals,
        leadEvents,
        leadLabel,
        updatedAt: now,
      },
    });
}
