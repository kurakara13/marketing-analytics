"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import {
  deleteInsightForUser,
  renameInsightForUser,
} from "@/lib/ai/insights";

// CRUD-style management actions on existing insights — separate file
// from the generation/share/feedback actions to keep each module
// focused. All actions are owner-scoped at the lib/ai/insights level.

const idInput = z.object({ insightId: z.string().min(1) });
const renameInput = idInput.extend({
  // Empty string clears the user override; UI sends "" to mean "revert
  // to AI-generated title" / fallback.
  title: z.string().max(200),
});

export type DeleteResult = { error: string } | { success: true };

export async function deleteInsightAction(
  input: z.infer<typeof idInput>,
): Promise<DeleteResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Tidak ada session aktif" };

  const parsed = idInput.safeParse(input);
  if (!parsed.success) return { error: "Input tidak valid" };

  const ok = await deleteInsightForUser({
    userId: session.user.id,
    insightId: parsed.data.insightId,
  });
  if (!ok) return { error: "Insight tidak ditemukan" };

  revalidatePath("/insights");
  return { success: true };
}

export type RenameResult = { error: string } | { success: true };

export async function renameInsightAction(
  input: z.infer<typeof renameInput>,
): Promise<RenameResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Tidak ada session aktif" };

  const parsed = renameInput.safeParse(input);
  if (!parsed.success) return { error: "Input tidak valid" };

  const trimmed = parsed.data.title.trim();
  await renameInsightForUser({
    userId: session.user.id,
    insightId: parsed.data.insightId,
    title: trimmed.length > 0 ? trimmed : null,
  });

  revalidatePath("/insights");
  return { success: true };
}
