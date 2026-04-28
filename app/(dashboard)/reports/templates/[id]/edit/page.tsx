import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reportTemplates } from "@/lib/db/schema";
import { parseTemplateDefinition } from "@/lib/reports/templates/types";
import { TemplateEditor } from "@/components/templates/editor/template-editor";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const [template] = await db
    .select()
    .from(reportTemplates)
    .where(
      and(
        eq(reportTemplates.id, id),
        eq(reportTemplates.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!template) notFound();

  // Parse + validate definition. If it fails (older schema, corruption)
  // we surface a friendly message rather than crashing the editor —
  // user can re-create from scratch.
  let definition;
  try {
    definition = parseTemplateDefinition(template.definition);
  } catch (err) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Template tidak bisa dibuka
        </h1>
        <p className="text-muted-foreground text-sm">
          Definisi template ini tidak match schema saat ini. Mungkin dibuat di
          versi lama yang belum di-migrate.
        </p>
        <pre className="bg-muted rounded p-3 text-xs">
          {err instanceof Error ? err.message : String(err)}
        </pre>
      </div>
    );
  }

  return (
    <TemplateEditor
      templateId={template.id}
      initialName={template.name}
      initialDescription={template.description}
      initialDefinition={definition}
    />
  );
}
