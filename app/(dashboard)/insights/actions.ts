"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { generateInsight } from "@/lib/ai/insights";

export type GenerateResult =
  | { error: string }
  | { success: true; insightId: string };

export async function generateInsightAction(): Promise<GenerateResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Tidak ada session aktif" };
  }

  try {
    const insight = await generateInsight({ userId: session.user.id });
    revalidatePath("/insights");
    return { success: true, insightId: insight.id };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Generate gagal (unknown error)";
    return { error: message };
  }
}
