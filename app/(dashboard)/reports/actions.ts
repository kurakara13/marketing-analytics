"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reportTemplates } from "@/lib/db/schema";
import {
  createBlankTemplateDefinition,
  parseTemplateDefinition,
  type TemplateDefinition,
} from "@/lib/reports/templates/types";
import { saveImage } from "@/lib/storage";

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
