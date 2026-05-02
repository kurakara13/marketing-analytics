"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { monthlyTargets } from "@/lib/db/schema";
import { upsertBusinessContext } from "@/lib/business-context";

const targetInput = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  metric: z.string().min(1).max(50),
  value: z.number().int().min(0),
});

export type SetTargetResult = { error: string } | { success: true };

export async function setMonthlyTargetAction(
  input: z.infer<typeof targetInput>,
): Promise<SetTargetResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Tidak ada session aktif" };
  }

  const parsed = targetInput.safeParse(input);
  if (!parsed.success) {
    return { error: "Input tidak valid" };
  }

  const { year, month, metric, value } = parsed.data;
  const now = new Date();

  await db
    .insert(monthlyTargets)
    .values({
      userId: session.user.id,
      year,
      month,
      metric,
      value,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        monthlyTargets.userId,
        monthlyTargets.year,
        monthlyTargets.month,
        monthlyTargets.metric,
      ],
      set: { value, updatedAt: now },
    });

  revalidatePath("/settings");
  return { success: true };
}

const deleteInput = z.object({
  year: z.number().int(),
  month: z.number().int(),
  metric: z.string(),
});

export async function deleteMonthlyTargetAction(
  input: z.infer<typeof deleteInput>,
): Promise<SetTargetResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Tidak ada session aktif" };
  }

  const parsed = deleteInput.safeParse(input);
  if (!parsed.success) {
    return { error: "Input tidak valid" };
  }

  await db
    .delete(monthlyTargets)
    .where(
      and(
        eq(monthlyTargets.userId, session.user.id),
        eq(monthlyTargets.year, parsed.data.year),
        eq(monthlyTargets.month, parsed.data.month),
        eq(monthlyTargets.metric, parsed.data.metric),
      ),
    );

  revalidatePath("/settings");
  return { success: true };
}

// ─── Business context ───────────────────────────────────────────────────
const businessContextInput = z.object({
  industry: z.string().trim().max(500).optional().nullable(),
  targetAudience: z.string().trim().max(500).optional().nullable(),
  brandVoice: z.enum(["professional", "casual", "technical"]).nullable(),
  businessGoals: z.string().trim().max(1000).optional().nullable(),
  /** GA4 event names that the user counts as "lead". Multi-select
   *  from discovered events; empty array = no user-defined leads. */
  leadEvents: z.array(z.string().min(1).max(100)).max(20).optional().nullable(),
  /** Custom term for "lead" (mis. "MQL", "Qualified Action"). */
  leadLabel: z.string().trim().max(50).optional().nullable(),
});

export type SaveBusinessContextResult =
  | { error: string }
  | { success: true };

export async function saveBusinessContextAction(
  input: z.infer<typeof businessContextInput>,
): Promise<SaveBusinessContextResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Tidak ada session aktif" };
  }

  const parsed = businessContextInput.safeParse(input);
  if (!parsed.success) {
    return { error: "Input tidak valid" };
  }

  // Empty strings → null so we don't clutter the prompt with empty lines.
  const blank = (s: string | null | undefined) =>
    s && s.trim().length > 0 ? s.trim() : null;

  await upsertBusinessContext({
    userId: session.user.id,
    industry: blank(parsed.data.industry),
    targetAudience: blank(parsed.data.targetAudience),
    brandVoice: parsed.data.brandVoice ?? null,
    businessGoals: blank(parsed.data.businessGoals),
    leadEvents: parsed.data.leadEvents ?? null,
    leadLabel: blank(parsed.data.leadLabel),
  });

  revalidatePath("/settings");
  return { success: true };
}
