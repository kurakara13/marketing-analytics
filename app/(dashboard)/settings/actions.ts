"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { monthlyTargets } from "@/lib/db/schema";

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
