import type { ReportData } from "@/lib/reports/fetch-report-data";

// ─── RenderContext ──────────────────────────────────────────────────────
//
// Shared context handed to every widget renderer when generating a
// PPT. Bundles the underlying data sources widgets may query —
// pre-aggregated ReportData (totals, previous, trend, campaigns, etc),
// plus the user/template metadata.
//
// Eventually widgets will be able to fetch their own data ad-hoc
// (e.g. arbitrary GA4 dimensions). For now, ReportData covers the 80%
// case and keeps render lookups synchronous + cached.
export type RenderContext = {
  userId: string;
  templateId: string;
  /** Pre-aggregated data for the report's anchor period. Drives most
   *  data-driven widgets via the typed totals/trend fields. */
  reportData: ReportData;
  /** Resolved generation timestamp (ISO string), used in cover slides. */
  generatedAt: string;
};
