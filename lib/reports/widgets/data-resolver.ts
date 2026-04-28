import type {
  ReportData,
  ReportTotals,
  TrendPoint,
} from "@/lib/reports/fetch-report-data";
import type {
  DataSource,
  DateRangeRef,
  WidgetFilter,
} from "@/lib/reports/templates/types";

// ─── Metric resolution ──────────────────────────────────────────────────
//
// Maps (dataSource, metric) → field on ReportTotals. The current schema
// of ReportTotals is source-aware (paid clicks vs organic clicks, etc),
// so we route by dataSource here.
//
// FUTURE: when we add event filter support (e.g. filter GA4 conversions
// to "generate_lead" only), we'll need per-widget aggregation that
// can't be answered from ReportTotals alone — either an extra GA4 query
// at render time, or storing per-event totals in the warehouse.
// For the POC widgets, filters.eventName is accepted but ignored.
type TotalsField = keyof ReportTotals;

type MetricMapping = Record<DataSource, Record<string, TotalsField>>;

const METRIC_MAP: MetricMapping = {
  ga4: {
    sessions: "sessions",
    pageviews: "pageviews",
    conversions: "conversions",
    revenue: "revenue",
  },
  google_ads: {
    impressions: "impressions",
    clicks: "clicks",
    spend: "spend",
    // Ads conversions live in the campaigns array, not in totals — accept
    // here for completeness but resolve to 0 from totals (future: route
    // through campaigns aggregate).
    conversions: "conversions",
  },
  search_console: {
    impressions: "organicImpressions",
    clicks: "organicClicks",
  },
  google_business_profile: {
    // Placeholder — GBP connector not built yet.
  },
  // Computed metrics combine fields across sources. Listed here so the
  // form's metric picker can show them; the actual formulas live in
  // resolveComputedMetric() below. The TotalsField on the right side
  // is a placeholder — never read for computed metrics.
  computed: {
    cpl: "spend",
    cpc: "spend",
    cpm: "spend",
    ctr: "clicks",
    conv_rate: "conversions",
    roas: "revenue",
    aov: "revenue",
  },
};

// Display labels for computed metrics — used in dropdowns + tooltips.
export const COMPUTED_METRIC_LABELS: Record<string, string> = {
  cpl: "CPL (Cost / Lead)",
  cpc: "CPC (Cost / Click)",
  cpm: "CPM (Cost / 1000 Impressions)",
  ctr: "CTR (Click-through Rate)",
  conv_rate: "Conversion Rate",
  roas: "ROAS (Return on Ad Spend)",
  aov: "AOV (Avg Order Value)",
};

// Sensible default format per computed metric — what the user almost
// always wants. The form can still be overridden.
export const COMPUTED_METRIC_DEFAULT_FORMAT: Record<
  string,
  "number" | "currency_idr" | "percent" | "duration_seconds"
> = {
  cpl: "currency_idr",
  cpc: "currency_idr",
  cpm: "currency_idr",
  ctr: "percent",
  conv_rate: "percent",
  roas: "number",
  aov: "currency_idr",
};

export function getAvailableMetrics(source: DataSource): string[] {
  return Object.keys(METRIC_MAP[source] ?? {});
}

// Compute a derived metric from raw totals. Returns 0 when the
// denominator is 0 to avoid divide-by-zero / Infinity propagating
// through formatters.
function resolveComputedMetric(
  totals: ReportTotals,
  metric: string,
): number {
  switch (metric) {
    case "cpl":
      // Cost per lead. We don't yet have a "leads" filter so this
      // falls back to total conversions — accurate when the user's
      // GA4 only has lead-shaped conversion events configured.
      return totals.conversions > 0 ? totals.spend / totals.conversions : 0;
    case "cpc":
      return totals.clicks > 0 ? totals.spend / totals.clicks : 0;
    case "cpm":
      return totals.impressions > 0
        ? (totals.spend / totals.impressions) * 1000
        : 0;
    case "ctr":
      // Returns as a fraction (0.05 = 5%). formatMetricValue("percent")
      // multiplies by 100 for display.
      return totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
    case "conv_rate":
      return totals.sessions > 0 ? totals.conversions / totals.sessions : 0;
    case "roas":
      return totals.spend > 0 ? totals.revenue / totals.spend : 0;
    case "aov":
      return totals.conversions > 0 ? totals.revenue / totals.conversions : 0;
    default:
      return 0;
  }
}

/**
 * Pull a single metric value from ReportTotals based on the widget's
 * data binding. Returns 0 when the (source, metric) pair isn't mapped
 * (e.g., metric not yet supported, or source not connected).
 */
export function resolveMetricFromTotals(args: {
  totals: ReportTotals;
  dataSource: DataSource;
  metric: string;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  filters?: WidgetFilter;
}): number {
  if (args.dataSource === "computed") {
    return resolveComputedMetric(args.totals, args.metric);
  }
  const field = METRIC_MAP[args.dataSource]?.[args.metric];
  if (!field) return 0;
  const value = args.totals[field];
  return typeof value === "number" ? value : 0;
}

/**
 * Resolve a date-range ref into a totals snapshot for KPI-style widgets,
 * pulled from the prebaked aggregations in ReportData.
 *
 * For ranges that don't have a precomputed totals (e.g. a custom range
 * outside the report window), returns null — caller should render an
 * empty state.
 */
export function resolveTotalsFor(
  reportData: ReportData,
  ref: DateRangeRef,
): ReportTotals | null {
  switch (ref.kind) {
    case "current_window":
      return reportData.totals;
    case "previous_window":
      return reportData.previousTotals;
    case "trend_6":
      // Trend isn't a single totals snapshot — caller wants the array.
      return null;
    default:
      // month_to_date / last_n_days / custom not yet supported in POC.
      return null;
  }
}

/**
 * Resolve a date-range ref into the bucketed trend array. Only the
 * `trend_6` kind returns an array; other kinds return null.
 */
export function resolveTrendFor(
  reportData: ReportData,
  ref: DateRangeRef,
): TrendPoint[] | null {
  if (ref.kind === "trend_6") return reportData.trend;
  return null;
}

// ─── Number formatting helpers ──────────────────────────────────────────
const numberFmt = new Intl.NumberFormat("id-ID");

export function formatMetricValue(
  value: number,
  format: "number" | "currency_idr" | "percent" | "duration_seconds",
): string {
  switch (format) {
    case "currency_idr": {
      if (value === 0) return "Rp 0";
      if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `Rp ${(value / 1_000).toFixed(0)}K`;
      return `Rp ${numberFmt.format(Math.round(value))}`;
    }
    case "percent": {
      // Convention: caller passes the raw fraction (0.123) → "12.3%".
      return `${(value * 100).toFixed(1)}%`;
    }
    case "duration_seconds": {
      const m = Math.floor(value / 60);
      const s = Math.round(value % 60);
      return `${m}m ${s}s`;
    }
    case "number":
    default:
      return numberFmt.format(Math.round(value));
  }
}

export function deltaText(current: number, previous: number): string {
  if (previous === 0 && current === 0) return "—";
  if (previous === 0) return "(baru)";
  const pct = ((current - previous) / previous) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(pct > 100 ? 0 : 1)}% vs sebelumnya`;
}
