import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reportTemplates } from "@/lib/db/schema";
import { fetchReportData } from "@/lib/reports/fetch-report-data";
import { renderTemplate } from "@/lib/reports/templates/render";
import { parseTemplateDefinition } from "@/lib/reports/templates/types";

// GET /api/reports/templates/{id}/generate
//
// Resolve the template's anchor settings to a (period, anchorDate)
// pair, fetch ReportData for that window, and render the template
// through the widget pipeline. Returns the resulting .pptx as a
// download.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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

  if (!template) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let definition;
  try {
    definition = parseTemplateDefinition(template.definition);
  } catch (err) {
    return NextResponse.json(
      {
        error: "invalid_template",
        detail:
          err instanceof Error ? err.message : "Definisi template tidak valid",
      },
      { status: 422 },
    );
  }

  // Resolve anchor → (period, anchorDate) for fetchReportData.
  // For "auto_weekly" we let fetchReportData default (last completed Sunday).
  const anchor = definition.settings.anchor;
  const period = anchor.kind === "auto_monthly" ? "monthly" : "weekly";
  const anchorDate = anchor.kind === "specific" ? anchor.date : undefined;

  let buffer: Buffer;
  try {
    const reportData = await fetchReportData({
      userId: session.user.id,
      period,
      anchorDate,
    });
    buffer = await renderTemplate({
      template: { id: template.id, name: template.name, definition },
      userId: session.user.id,
      reportData,
    });
  } catch (err) {
    console.error("[reports.templates.generate] failed:", err);
    return NextResponse.json(
      {
        error: "generation_failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const safeName = template.name.replace(/[^a-zA-Z0-9_-]+/g, "_");
  const filename = `${safeName}_${today}.pptx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
