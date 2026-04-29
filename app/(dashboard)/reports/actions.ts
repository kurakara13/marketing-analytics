"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reportTemplates, type Insight } from "@/lib/db/schema";
import {
  createBlankTemplateDefinition,
  parseTemplateDefinition,
  type TemplateDefinition,
} from "@/lib/reports/templates/types";
import { saveImage } from "@/lib/storage";
import { generateInsight } from "@/lib/ai/insights";
import { fetchReportData } from "@/lib/reports/fetch-report-data";

// ─── Create blank template ──────────────────────────────────────────────
export async function createTemplateAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Tidak ada session aktif");
  }

  const name = String(formData.get("name") ?? "").trim() || "Untitled report";
  const description = String(formData.get("description") ?? "").trim() || null;

  const [created] = await db
    .insert(reportTemplates)
    .values({
      userId: session.user.id,
      name,
      description,
      schemaVersion: 1,
      definition: createBlankTemplateDefinition(),
    })
    .returning({ id: reportTemplates.id });

  revalidatePath("/reports");
  redirect(`/reports/${created.id}/edit`);
}

// ─── Save template definition (full overwrite) ──────────────────────────
const saveInput = z.object({
  templateId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().nullable(),
  // Definition is parsed/validated by parseTemplateDefinition below.
  definition: z.unknown(),
});

export type SaveTemplateResult = { error: string } | { success: true };

export async function saveTemplateAction(
  input: z.infer<typeof saveInput>,
): Promise<SaveTemplateResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Tidak ada session aktif" };
  }

  const parsed = saveInput.safeParse(input);
  if (!parsed.success) {
    return { error: "Input tidak valid" };
  }

  let definition: TemplateDefinition;
  try {
    definition = parseTemplateDefinition(parsed.data.definition);
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Definisi report tidak valid: ${err.message.slice(0, 200)}`
          : "Definisi report tidak valid",
    };
  }

  const result = await db
    .update(reportTemplates)
    .set({
      name: parsed.data.name,
      description: parsed.data.description,
      definition,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(reportTemplates.id, parsed.data.templateId),
        eq(reportTemplates.userId, session.user.id),
      ),
    )
    .returning({ id: reportTemplates.id });

  if (result.length === 0) {
    return { error: "Report tidak ditemukan" };
  }

  revalidatePath("/reports");
  revalidatePath(`/reports/${parsed.data.templateId}/edit`);
  return { success: true };
}

// ─── Delete template ────────────────────────────────────────────────────
const deleteInput = z.object({ templateId: z.string().min(1) });

export type DeleteTemplateResult = { error: string } | { success: true };

export async function deleteTemplateAction(
  input: z.infer<typeof deleteInput>,
): Promise<DeleteTemplateResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Tidak ada session aktif" };
  }

  await db
    .delete(reportTemplates)
    .where(
      and(
        eq(reportTemplates.id, input.templateId),
        eq(reportTemplates.userId, session.user.id),
      ),
    );

  revalidatePath("/reports");
  return { success: true };
}

// ─── Rename template ────────────────────────────────────────────────────
const renameInput = z.object({
  templateId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional(),
});

export type RenameTemplateResult = { error: string } | { success: true };

export async function renameTemplateAction(
  input: z.infer<typeof renameInput>,
): Promise<RenameTemplateResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Tidak ada session aktif" };
  }
  const parsed = renameInput.safeParse(input);
  if (!parsed.success) {
    return { error: "Input tidak valid" };
  }
  const trimmedDesc =
    typeof parsed.data.description === "string"
      ? parsed.data.description.trim()
      : null;
  const result = await db
    .update(reportTemplates)
    .set({
      name: parsed.data.name,
      description: trimmedDesc && trimmedDesc.length > 0 ? trimmedDesc : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(reportTemplates.id, parsed.data.templateId),
        eq(reportTemplates.userId, session.user.id),
      ),
    )
    .returning({ id: reportTemplates.id });
  if (result.length === 0) {
    return { error: "Report tidak ditemukan" };
  }
  revalidatePath("/reports");
  return { success: true };
}

// ─── Duplicate template ─────────────────────────────────────────────────
const duplicateInput = z.object({ templateId: z.string().min(1) });

export type DuplicateTemplateResult =
  | { error: string }
  | { success: true; templateId: string };

export async function duplicateTemplateAction(
  input: z.infer<typeof duplicateInput>,
): Promise<DuplicateTemplateResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Tidak ada session aktif" };
  }
  const parsed = duplicateInput.safeParse(input);
  if (!parsed.success) {
    return { error: "Input tidak valid" };
  }

  // Read the source template (ownership-checked).
  const [source] = await db
    .select()
    .from(reportTemplates)
    .where(
      and(
        eq(reportTemplates.id, parsed.data.templateId),
        eq(reportTemplates.userId, session.user.id),
      ),
    )
    .limit(1);
  if (!source) {
    return { error: "Report tidak ditemukan" };
  }

  // Re-id every slide + every widget so the duplicate is fully
  // independent — no shared id risks from cross-template editing.
  let definition: TemplateDefinition;
  try {
    definition = parseTemplateDefinition(source.definition);
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Definisi report tidak valid: ${err.message.slice(0, 200)}`
          : "Definisi report tidak valid",
    };
  }
  const reIdedDefinition: TemplateDefinition = {
    ...definition,
    slides: definition.slides.map((slide) => ({
      ...slide,
      id: crypto.randomUUID(),
      widgets: slide.widgets.map((w) => ({ ...w, id: crypto.randomUUID() })),
    })),
  };

  const [created] = await db
    .insert(reportTemplates)
    .values({
      userId: session.user.id,
      name: `${source.name} (copy)`,
      description: source.description,
      schemaVersion: source.schemaVersion,
      definition: reIdedDefinition,
    })
    .returning({ id: reportTemplates.id });

  revalidatePath("/reports");
  return { success: true, templateId: created.id };
}

// ─── Upload image (for image widgets) ───────────────────────────────────
export type UploadImageResult =
  | { error: string }
  | {
      success: true;
      imagePath: string;
      contentType: string;
      size: number;
    };

export async function uploadImageAction(
  formData: FormData,
): Promise<UploadImageResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Tidak ada session aktif" };
  }

  const templateIdRaw = formData.get("templateId");
  const file = formData.get("file");

  if (typeof templateIdRaw !== "string" || templateIdRaw.length === 0) {
    return { error: "templateId tidak ada" };
  }
  if (!(file instanceof File)) {
    return { error: "File tidak valid" };
  }

  // Verify the user owns the template — prevents cross-user uploads
  // (which would land in another user's directory and be inaccessible
  // to them anyway, but better to fail explicitly).
  const [template] = await db
    .select({ id: reportTemplates.id })
    .from(reportTemplates)
    .where(
      and(
        eq(reportTemplates.id, templateIdRaw),
        eq(reportTemplates.userId, session.user.id),
      ),
    )
    .limit(1);
  if (!template) {
    return { error: "Template tidak ditemukan" };
  }

  try {
    const stored = await saveImage({
      userId: session.user.id,
      templateId: templateIdRaw,
      file,
    });
    return {
      success: true,
      imagePath: stored.relativePath,
      contentType: stored.contentType,
      size: stored.size,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Upload gagal",
    };
  }
}

// ─── Regenerate AI insight for a template's current period ──────────────
//
// Forces a fresh insight (always creates a new row, even if a cached
// one exists for the window). Used by the "Regenerate" button on the
// ai_narrative widget side panel — when the user wants to re-run after
// editing business context, after a fresh data sync, or just to get a
// different angle.
const regenerateInput = z.object({ templateId: z.string().min(1) });

export type RegenerateInsightResult =
  | { error: string }
  | { success: true; insight: Insight };

export async function regenerateInsightForReportAction(
  input: z.infer<typeof regenerateInput>,
): Promise<RegenerateInsightResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Tidak ada session aktif" };
  }

  const parsed = regenerateInput.safeParse(input);
  if (!parsed.success) {
    return { error: "Input tidak valid" };
  }

  // Resolve the report's anchor settings → period + anchorDate, mirroring
  // the editor page so the regenerated insight covers exactly the window
  // the canvas previews.
  const [template] = await db
    .select()
    .from(reportTemplates)
    .where(
      and(
        eq(reportTemplates.id, parsed.data.templateId),
        eq(reportTemplates.userId, session.user.id),
      ),
    )
    .limit(1);
  if (!template) {
    return { error: "Report tidak ditemukan" };
  }

  let definition: TemplateDefinition;
  try {
    definition = parseTemplateDefinition(template.definition);
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Definisi report tidak valid: ${err.message.slice(0, 200)}`
          : "Definisi report tidak valid",
    };
  }

  const period =
    definition.settings.anchor.kind === "auto_monthly" ? "monthly" : "weekly";
  const anchorDate =
    definition.settings.anchor.kind === "specific"
      ? definition.settings.anchor.date
      : undefined;

  try {
    const reportData = await fetchReportData({
      userId: session.user.id,
      period,
      anchorDate,
    });
    const insight = await generateInsight({
      userId: session.user.id,
      reportData,
    });
    return { success: true, insight };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Generate gagal (unknown error)",
    };
  }
}
