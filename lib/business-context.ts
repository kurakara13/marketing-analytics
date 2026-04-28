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
  leadEventName: string | null;
}): Promise<void> {
  const now = new Date();
  await db
    .insert(userBusinessContext)
    .values({
      userId: args.userId,
      industry: args.industry,
      targetAudience: args.targetAudience,
      brandVoice: args.brandVoice,
      businessGoals: args.businessGoals,
      leadEventName: args.leadEventName,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userBusinessContext.userId,
      set: {
        industry: args.industry,
        targetAudience: args.targetAudience,
        brandVoice: args.brandVoice,
        businessGoals: args.businessGoals,
        leadEventName: args.leadEventName,
        updatedAt: now,
      },
    });
}
