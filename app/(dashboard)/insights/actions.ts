"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { generateInsight } from "@/lib/ai/insights";
import { fetchReportData } from "@/lib/reports/fetch-report-data";

export type GenerateResult =
  | { error: string }
  | { success: true; insightId: string };

export async function generateInsightAction(): Promise<GenerateResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Tidak ada session aktif" };
  }

  try {
    // Default the legacy /insights page to the weekly window — same
    // shape the report builder uses. Users with monthly preference
    // should generate from their report template instead.
    const reportData = await fetchReportData({
      userId: session.user.id,
      period: "weekly",
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
