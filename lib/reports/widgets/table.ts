import {
  tableWidgetConfigSchema,
  type TableWidgetConfig,
} from "@/lib/reports/templates/types";
import type {
  CampaignBreakdownRow,
  ReportData,
} from "@/lib/reports/fetch-report-data";
import { registerWidget, type WidgetDefinition } from "./registry";

const FONT_FACE = "Calibri";

// Table widget — top-N rows × user-picked columns, sourced from the
// dataSource. Three concrete data sources supported:
//
//   - google_ads → campaign breakdown rows for source="google_ads"
//   - ga4 → topPages (page × conversions × sessions)
//   - search_console → not supported here (no per-query rows in
//     ReportData yet); we render a friendly placeholder.
//
// Dimensions / metrics from the config map to the row shape; unknown
// fields render as "—" rather than failing the entire render so the
// PPT still produces.

type Row = Record<string, string | number>;

const idFmt = new Intl.NumberFormat("id-ID");
function fmtRupiah(n: number): string {
  if (n === 0) return "Rp 0";
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}K`;
  return `Rp ${idFmt.format(Math.round(n))}`;
}
function fmtNum(n: number): string {
  return idFmt.format(Math.round(n));
}

const CURRENCY_METRICS = new Set(["spend", "revenue"]);

function rowsForGoogleAds(reportData: ReportData): Row[] {
  return reportData.campaigns
    .filter((c) => c.source === "google_ads")
    .map(
      (c: CampaignBreakdownRow): Row => ({
        campaignName: c.campaignName ?? c.campaignId ?? "(rollup)",
        accountName: c.accountName ?? "",
        clicks: c.clicks,
        impressions: c.impressions,
        spend: c.spend,
        conversions: c.conversions,
        revenue: c.revenue,
        ctr:
          c.impressions > 0 ? `${((c.clicks / c.impressions) * 100).toFixed(2)}%` : "—",
        cpl: c.conversions > 0 ? c.spend / c.conversions : 0,
      }),
    );
}

function rowsForGa4(reportData: ReportData): Row[] {
  return reportData.topPages.map(
    (p): Row => ({
      page: p.page,
      conversions: p.conversions,
      sessions: p.sessions,
      conversionRate:
        p.sessions > 0
          ? `${((p.conversions / p.sessions) * 100).toFixed(2)}%`
          : "—",
    }),
  );
}

function pickRows(
  config: TableWidgetConfig,
  reportData: ReportData,
): Row[] {
  if (config.dataSource === "google_ads") return rowsForGoogleAds(reportData);
  if (config.dataSource === "ga4") return rowsForGa4(reportData);
  // computed / search_console / google_business_profile — no row source
  // yet. Empty array triggers the placeholder branch in render().
  return [];
}

function sortAndLimit(
  rows: Row[],
  config: TableWidgetConfig,
): Row[] {
  const sortKey = config.sortBy ?? config.metrics[0];
  const sorted = [...rows].sort((a, b) => {
    const av = typeof a[sortKey] === "number" ? (a[sortKey] as number) : -1;
    const bv = typeof b[sortKey] === "number" ? (b[sortKey] as number) : -1;
    return bv - av;
  });
  return sorted.slice(0, config.limit);
}

function formatCell(value: unknown, columnKey: string): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    if (CURRENCY_METRICS.has(columnKey)) return fmtRupiah(value);
    if (columnKey === "cpl") return value > 0 ? fmtRupiah(value) : "—";
    return fmtNum(value);
  }
  return String(value);
}

const COLUMN_LABELS: Record<string, string> = {
  campaignName: "Campaign",
  accountName: "Account",
  page: "Page",
  clicks: "Clicks",
  impressions: "Impressions",
  spend: "Spend",
  conversions: "Conv",
  revenue: "Revenue",
  ctr: "CTR",
  cpl: "CPL",
  sessions: "Sessions",
  conversionRate: "CVR",
};

const definition: WidgetDefinition<{
  id: string;
  type: "table";
  position: { x: number; y: number; w: number; h: number };
  config: TableWidgetConfig;
}> = {
  type: "table",
  configSchemaVersion: 1,
  defaultPosition: { x: 0.5, y: 1, w: 12.3, h: 5 },
  defaultConfig: tableWidgetConfigSchema.parse({
    dataSource: "google_ads",
    dimensions: ["campaignName"],
    metrics: ["clicks", "conversions", "spend"],
  }),
  label: "Table",
  description: "Top N rows × picked columns dari data source pilihan.",

  render({ slide, widget, context }) {
    const { config, position } = widget;

    const titleH = config.title ? 0.4 : 0;
    if (config.title) {
      slide.addText(config.title, {
        x: position.x,
        y: position.y,
        w: position.w,
        h: titleH,
        fontFace: FONT_FACE,
        fontSize: 13,
        bold: true,
        color: "0F172A",
      });
    }

    const tableY = position.y + titleH;
    const tableH = position.h - titleH;

    const rawRows = pickRows(config, context.reportData);
    if (rawRows.length === 0) {
      slide.addText(
        `Belum ada data untuk source "${config.dataSource}" pada window ini.`,
        {
          x: position.x,
          y: tableY,
          w: position.w,
          h: tableH,
          fontFace: FONT_FACE,
          fontSize: 11,
          italic: true,
          color: "64748B",
          align: "center",
          valign: "middle",
        },
      );
      return;
    }

    const rows = sortAndLimit(rawRows, config);
    const columns = [...config.dimensions, ...config.metrics];

    // Header row — bold, dark fill.
    const headerCells = columns.map((col) => ({
      text: COLUMN_LABELS[col] ?? col,
      options: {
        bold: true,
        color: "FFFFFF",
        fill: { color: "0F172A" },
        fontSize: 10,
        align: "left" as const,
      },
    }));

    // Body rows — alternating row striping for readability.
    const bodyRows = rows.map((row, i) =>
      columns.map((col) => ({
        text: formatCell(row[col], col),
        options: {
          color: "0F172A",
          fill: { color: i % 2 === 0 ? "F8FAFC" : "FFFFFF" },
          fontSize: 9,
          align:
            typeof row[col] === "number" || col === "ctr" || col === "cpl"
              ? ("right" as const)
              : ("left" as const),
        },
      })),
    );

    slide.addTable([headerCells, ...bodyRows], {
      x: position.x,
      y: tableY,
      w: position.w,
      h: tableH,
      colW: columns.map(() => position.w / columns.length),
      fontFace: FONT_FACE,
      border: { type: "solid", color: "E2E8F0", pt: 0.5 },
      autoPage: false,
    });
  },
};

registerWidget(definition);
