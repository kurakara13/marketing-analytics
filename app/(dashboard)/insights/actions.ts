"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { generateInsight } from "@/lib/ai/insights";
import { fetchReportData } from "@/lib/reports/fetch-report-data";

export type GenerateResult =
  | { error: string }
  | { success: true; insightId: string };

const generateInput = z
  .object({
    period: z.enum(["weekly", "monthly"]).default("weekly"),
    /** Anchor date inside the target period. When omitted, the
     *  fetcher defaults to the last completed period. */
    anchorDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
      .optional(),
  })
  .default({ period: "weekly" });

export async function generateInsightAction(
  input?: z.infer<typeof generateInput>,
): Promise<GenerateResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Tidak ada session aktif" };
  }

  const parsed = generateInput.safeParse(input ?? {});
  if (!parsed.success) {
    return { error: "Input tidak valid" };
  }

  try {
    const reportData = await fetchReportData({
      userId: session.user.id,
      period: parsed.data.period,
      anchorDate: parsed.data.anchorDate,
    });
    const insight = await generateInsight({
      userId: session.user.id,
      reportData,
    });
    revalidatePath("/insights");
    return { success: true, insightId: insight.id };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Generate gagal (unknown error)";
    return { error: message };
  }
}
