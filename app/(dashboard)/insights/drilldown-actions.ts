"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { generateDrilldown } from "@/lib/ai/drilldown";
import type { InsightDrilldown } from "@/lib/db/schema";

const drilldownInput = z.object({
  insightId: z.string().min(1),
  observationIndex: z.number().int().min(0).max(50),
});

export type DrilldownResult =
  | { error: string }
  | { success: true; drilldown: InsightDrilldown };

export async function generateDrilldownAction(
  input: z.infer<typeof drilldownInput>,
): Promise<DrilldownResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Tidak ada session aktif" };

  const parsed = drilldownInput.safeParse(input);
  if (!parsed.success) return { error: "Input tidak valid" };

  try {
    const drilldown = await generateDrilldown({
      userId: session.user.id,
      insightId: parsed.data.insightId,
      observationIndex: parsed.data.observationIndex,
    });
    revalidatePath("/insights");
    return { success: true, drilldown };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Drilldown gagal",
    };
  }
}
