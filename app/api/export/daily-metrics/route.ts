import { type NextRequest, NextResponse } from "next/server";
import { and, eq, gte, inArray } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { connections, dailyMetrics } from "@/lib/db/schema";
import { rowsToCsv, type CsvCell } from "@/lib/csv";

const MAX_DAYS = 365;
const DEFAULT_DAYS = 30;

function isoDateNDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function asNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

const HEADERS = [
  "date",
  "source",
  "account_id",
  "account_name",
  "campaign_id",
  "campaign_name",
  "impressions",
  "clicks",
  "spend",
  "conversions",
  "revenue",
  "sessions",
  "pageviews",
] as const;

// GET /api/export/daily-metrics?days=N
//
// Streams a CSV of every daily_metric row for the authenticated user
// inside the window. Filename includes the date so repeated downloads
// don't clobber each other in the user's Downloads folder.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const requested = Number(request.nextUrl.searchParams.get("days"));
  const days =
    Number.isFinite(requested) && requested > 0 && requested <= MAX_DAYS
      ? Math.floor(requested)
      : DEFAULT_DAYS;
  const sinceDate = isoDateNDaysAgo(days);

  const userConnections = await db
    .select()
    .from(connections)
    .where(eq(connections.userId, session.user.id));

  const realConnections = userConnections.filter(
    (c) => !c.externalAccountId.startsWith("_pending_"),
  );

  if (realConnections.length === 0) {
    return new NextResponse(rowsToCsv({ headers: HEADERS, rows: [] }), {
      status: 200,
      headers: csvHeaders(`daily-metrics-empty-${sinceDate}.csv`),
    });
  }

  const connectionsById = new Map(realConnections.map((c) => [c.id, c]));

  const rows = await db
    .select()
    .from(dailyMetrics)
    .where(
      and(
        inArray(
          dailyMetrics.connectionId,
          realConnections.map((c) => c.id),
        ),
        gte(dailyMetrics.date, sinceDate),
      ),
    );

  const csvRows: Array<Record<(typeof HEADERS)[number], CsvCell>> = rows.map(
    (row) => {
      const conn = connectionsById.get(row.connectionId);
      const raw = row.rawData as Record<string, unknown> | null;
      return {
        date: row.date,
        source: row.source,
        account_id: conn?.externalAccountId ?? "",
        account_name: conn?.externalAccountName ?? "",
        campaign_id: row.campaignId ?? "",
        campaign_name: row.campaignName ?? "",
        impressions: row.impressions ?? 0,
        clicks: row.clicks ?? 0,
        spend: row.spend ?? "",
        conversions: row.conversions ?? "",
        revenue: row.revenue ?? "",
        sessions: raw ? asNumber(raw.sessions) : 0,
        pageviews: raw ? asNumber(raw.screenPageViews) : 0,
      };
    },
  );

  // Stable sort: date asc, then source asc — readable in Excel.
  csvRows.sort((a, b) => {
    const dateCmp = String(a.date).localeCompare(String(b.date));
    if (dateCmp !== 0) return dateCmp;
    return String(a.source).localeCompare(String(b.source));
  });

  const today = new Date().toISOString().slice(0, 10);
  const filename = `marketing-analytics-${sinceDate}-to-${today}.csv`;

  // Prepend BOM so Excel auto-detects UTF-8 (otherwise non-ASCII campaign
  // names render as gibberish on Windows Excel).
  const csv = "﻿" + rowsToCsv({ headers: HEADERS, rows: csvRows });

  return new NextResponse(csv, {
    status: 200,
    headers: csvHeaders(filename),
  });
}

function csvHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };
}
