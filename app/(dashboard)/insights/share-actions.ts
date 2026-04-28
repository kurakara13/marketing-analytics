"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import {
  enableInsightSharing,
  revokeInsightSharing,
} from "@/lib/ai/insights";

const idInput = z.object({ insightId: z.string().min(1) });

export type EnableShareResult =
  | { error: string }
  | { success: true; token: string };

export async function enableShareAction(
  input: z.infer<typeof idInput>,
): Promise<EnableShareResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Tidak ada session aktif" };

  const parsed = idInput.safeParse(input);
  if (!parsed.success) return { error: "Input tidak valid" };

  try {
    const token = await enableInsightSharing({
      userId: session.user.id,
      insightId: parsed.data.insightId,
    });
    revalidatePath("/insights");
    return { success: true, token };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal aktifkan share",
    };
  }
}

export type RevokeShareResult = { error: string } | { success: true };

export async function revokeShareAction(
  input: z.infer<typeof idInput>,
): Promise<RevokeShareResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Tidak ada session aktif" };

  const parsed = idInput.safeParse(input);
  if (!parsed.success) return { error: "Input tidak valid" };

  await revokeInsightSharing({
    userId: session.user.id,
    insightId: parsed.data.insightId,
  });
  revalidatePath("/insights");
  return { success: true };
}
