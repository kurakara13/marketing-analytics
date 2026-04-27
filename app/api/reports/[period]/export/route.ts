import { type NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { buildReportPptx } from "@/lib/reports/build-pptx";
import {
  fetchReportData,
  type PeriodKey,
} from "@/lib/reports/fetch-report-data";

const VALID_PERIODS: PeriodKey[] = ["weekly", "monthly"];

// GET /api/reports/{weekly|monthly}/export[?date=YYYY-MM-DD]
//
// Returns a .pptx download for the authenticated user. Auto-fills KPIs,
// trend charts, and Google Ads campaign tables from synced data; manual
// narrative slides ship with editable placeholders.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ period: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { period } = await params;
  if (!VALID_PERIODS.includes(period as PeriodKey)) {
    return NextResponse.json(
      { error: `invalid period — must be one of ${VALID_PERIODS.join(", ")}` },
      { status: 400 },
    );
  }

  const anchorDate = request.nextUrl.searchParams.get("date") ?? undefined;

  let buffer: Buffer;
  try {
    const data = await fetchReportData({
      userId: session.user.id,
      period: period as PeriodKey,
      anchorDate,
    });
    buffer = await buildReportPptx(data);
  } catch (err) {
    console.error("[reports.export] failed:", err);
    return NextResponse.json(
      {
        error: "report generation failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const filename = `marketing-analytics-${period}-${today}.pptx`;

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
