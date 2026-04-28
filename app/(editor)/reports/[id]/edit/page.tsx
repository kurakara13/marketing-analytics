import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reportTemplates } from "@/lib/db/schema";
import { findLatestInsight } from "@/lib/ai/insights";
import { fetchReportData } from "@/lib/reports/fetch-report-data";
import { parseTemplateDefinition } from "@/lib/reports/templates/types";
import { TemplateEditor } from "@/components/templates/editor/template-editor";

export default async function EditReportPage({
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
          Report tidak bisa dibuka
        </h1>
        <p className="text-muted-foreground text-sm">
          Definisi report ini tidak match schema saat ini. Mungkin dibuat di
          versi lama yang belum di-migrate.
        </p>
        <pre className="bg-muted rounded p-3 text-xs">
          {err instanceof Error ? err.message : String(err)}
        </pre>
      </div>
    );
  }

  // Fetch ReportData once at editor mount so the canvas preview can
  // render real KPI values and chart data (instead of placeholder
  // "ga4.sessions" labels). Period maps from the template's anchor
  // setting; anchorDate left undefined for last-completed-period
  // default. Errors here are non-fatal — we fall back to an empty
  // shell so the editor still loads.
  const period =
    definition.settings.anchor.kind === "auto_monthly" ? "monthly" : "weekly";
  const anchorDate =
    definition.settings.anchor.kind === "specific"
      ? definition.settings.anchor.date
      : undefined;

  let reportData;
  try {
    reportData = await fetchReportData({
      userId: session.user.id,
      period,
      anchorDate,
    });
  } catch (err) {
    console.error("[editor] fetchReportData failed:", err);
    reportData = null;
  }

  // Best-effort lookup of the latest cached AI insight for this period.
  // If one exists, the canvas preview can render real AI content into
  // ai_narrative widgets. Otherwise, those widgets fall back to a
  // placeholder ("Generate .pptx to populate") and only get filled at
  // export time.
  let latestInsight = null;
  if (reportData) {
    try {
      latestInsight = await findLatestInsight({
        userId: session.user.id,
        windowStart: reportData.windowStart,
        windowEnd: reportData.windowEnd,
      });
    } catch (err) {
      console.error("[editor] findLatestInsight failed:", err);
    }
  }

  return (
    <TemplateEditor
      templateId={template.id}
      initialName={template.name}
      initialDescription={template.description}
      initialDefinition={definition}
      reportData={reportData}
      latestInsight={latestInsight}
    />
  );
}
