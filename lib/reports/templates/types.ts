import { z } from "zod";

// ─── Template / Slide / Widget shape ────────────────────────────────────
//
// Stored as JSONB in `report_template.definition`. The runtime shape
// here is the source of truth; schema migrations bump
// `report_template.schemaVersion` when this layout changes in a
// backward-incompatible way.
//
// Append-only design: new widget types add to the registry; new config
// fields are optional with defaults. Renaming or removing existing
// fields = breaking change requiring a migration.

// ─── Position (in PowerPoint inches; slide canvas is 13.333 × 7.5) ──────
export const positionSchema = z.object({
  x: z.number().min(0).max(13.333),
  y: z.number().min(0).max(7.5),
  w: z.number().min(0.1).max(13.333),
  h: z.number().min(0.1).max(7.5),
});
export type WidgetPosition = z.infer<typeof positionSchema>;

// ─── Date range binding ─────────────────────────────────────────────────
// Widgets can opt in to one of these named ranges (resolved at render
// time against the report's anchor date) or supply a custom range.
export const dateRangeRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("current_window") }),
  z.object({ kind: z.literal("previous_window") }),
  z.object({ kind: z.literal("trend_6") }),
  z.object({ kind: z.literal("month_to_date") }),
  z.object({ kind: z.literal("last_n_days"), days: z.number().int().min(1).max(730) }),
  z.object({
    kind: z.literal("custom"),
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
]);
export type DateRangeRef = z.infer<typeof dateRangeRefSchema>;

// ─── Data binding shared across data-driven widgets ─────────────────────
export const dataSourceSchema = z.enum([
  "ga4",
  "google_ads",
  "search_console",
  "google_business_profile",
]);
export type DataSource = z.infer<typeof dataSourceSchema>;

// Widget-level filter — currently just GA4 event filter (replaces the
// "lead conversion event" feature). Future filters add fields here.
export const widgetFilterSchema = z
  .object({
    eventName: z.string().optional(),    // GA4 event filter (e.g. "generate_lead")
    campaignId: z.string().optional(),   // Google Ads campaign restriction
    sourceFilter: z.string().optional(), // GA4 sessionSource filter
  })
  .partial();
export type WidgetFilter = z.infer<typeof widgetFilterSchema>;

// ─── Widget config schemas (one per widget type) ────────────────────────
// Each widget type has its own config schema. The discriminator is
// `widget.type`; the renderer + builder UI dispatch on it.

// 1) Text widget (no data)
export const textWidgetConfigSchema = z.object({
  text: z.string().default(""),
  fontSize: z.number().min(8).max(72).default(14),
  bold: z.boolean().default(false),
  italic: z.boolean().default(false),
  color: z.string().regex(/^[0-9A-Fa-f]{6}$/).default("0F172A"),
  align: z.enum(["left", "center", "right"]).default("left"),
});
export type TextWidgetConfig = z.infer<typeof textWidgetConfigSchema>;

// 2) Image widget (no data; static image)
export const imageWidgetConfigSchema = z.object({
  // Path relative to ./uploads/ root; nullable until user picks an image.
  imagePath: z.string().nullable().default(null),
  altText: z.string().default(""),
  fit: z.enum(["contain", "cover"]).default("contain"),
});
export type ImageWidgetConfig = z.infer<typeof imageWidgetConfigSchema>;

// 3) Divider (decorative, no data)
export const dividerWidgetConfigSchema = z.object({
  orientation: z.enum(["horizontal", "vertical"]).default("horizontal"),
  color: z.string().regex(/^[0-9A-Fa-f]{6}$/).default("E2E8F0"),
  thickness: z.number().min(0.5).max(5).default(1),
});
export type DividerWidgetConfig = z.infer<typeof dividerWidgetConfigSchema>;

// 4) Spacer (invisible spacing element)
export const spacerWidgetConfigSchema = z.object({});
export type SpacerWidgetConfig = z.infer<typeof spacerWidgetConfigSchema>;

// 5) Cover block (title + subtitle + date)
export const coverBlockWidgetConfigSchema = z.object({
  title: z.string().default(""),
  subtitle: z.string().default(""),
  showDate: z.boolean().default(true),
  showWeekNumber: z.boolean().default(false),
  titleColor: z.string().regex(/^[0-9A-Fa-f]{6}$/).default("FFFFFF"),
  bgColor: z.string().regex(/^[0-9A-Fa-f]{6}$/).default("0F172A"),
});
export type CoverBlockWidgetConfig = z.infer<typeof coverBlockWidgetConfigSchema>;

// 6) KPI card (single metric, optional delta)
export const kpiCardWidgetConfigSchema = z.object({
  label: z.string().default("KPI"),
  dataSource: dataSourceSchema,
  metric: z.string(), // "sessions", "clicks", "conversions", etc — validated per-source at render time
  filters: widgetFilterSchema.default({}),
  dateRange: dateRangeRefSchema.default({ kind: "current_window" }),
  format: z.enum(["number", "currency_idr", "percent", "duration_seconds"]).default("number"),
  showDelta: z.boolean().default(true),
  /** Compare against this date range to compute delta when showDelta is true. */
  deltaCompareTo: dateRangeRefSchema.default({ kind: "previous_window" }),
});
export type KpiCardWidgetConfig = z.infer<typeof kpiCardWidgetConfigSchema>;

// 7) Line chart (time series)
export const lineChartWidgetConfigSchema = z.object({
  title: z.string().default(""),
  dataSource: dataSourceSchema,
  metric: z.string(),
  filters: widgetFilterSchema.default({}),
  dateRange: dateRangeRefSchema.default({ kind: "trend_6" }),
  /** "auto" follows the dateRange granularity (weekly/monthly buckets); "daily" forces daily. */
  granularity: z.enum(["auto", "daily", "weekly", "monthly"]).default("auto"),
  color: z.string().regex(/^[0-9A-Fa-f]{6}$/).default("3B82F6"),
  showLegend: z.boolean().default(false),
  showValues: z.boolean().default(false),
});
export type LineChartWidgetConfig = z.infer<typeof lineChartWidgetConfigSchema>;

// 8) Bar chart (categorical / grouped)
export const barChartWidgetConfigSchema = z.object({
  title: z.string().default(""),
  dataSource: dataSourceSchema,
  metric: z.string(),
  filters: widgetFilterSchema.default({}),
  dateRange: dateRangeRefSchema.default({ kind: "trend_6" }),
  /** "time" → bars over time periods; "categorical" → bars by dimension (campaign, etc). */
  groupBy: z.enum(["time", "campaign", "source"]).default("time"),
  /** Optional second series for clustered bars (e.g. target line vs actual). */
  compareSeries: z
    .object({
      label: z.string(),
      kind: z.enum(["monthly_target", "previous_period"]),
    })
    .nullable()
    .default(null),
  color: z.string().regex(/^[0-9A-Fa-f]{6}$/).default("10B981"),
  showLegend: z.boolean().default(true),
  showValues: z.boolean().default(true),
});
export type BarChartWidgetConfig = z.infer<typeof barChartWidgetConfigSchema>;

// 9) Table (rows × columns from a query)
export const tableWidgetConfigSchema = z.object({
  title: z.string().default(""),
  dataSource: dataSourceSchema,
  /** Dimensions for grouping rows (e.g. ["campaignName"], ["page"]). */
  dimensions: z.array(z.string()).min(1).default(["campaignName"]),
  /** Metrics rendered as columns (e.g. ["clicks", "conversions", "spend"]). */
  metrics: z.array(z.string()).min(1).default(["clicks", "conversions"]),
  filters: widgetFilterSchema.default({}),
  dateRange: dateRangeRefSchema.default({ kind: "current_window" }),
  /** Sort by metric desc, taking top N rows. */
  sortBy: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(10),
});
export type TableWidgetConfig = z.infer<typeof tableWidgetConfigSchema>;

// 10) AI narrative (Claude-generated commentary)
export const aiNarrativeWidgetConfigSchema = z.object({
  title: z.string().default(""),
  /** Which sections the AI should generate. */
  sections: z
    .array(z.enum(["wins", "concerns", "anomalies", "recommendations"]))
    .min(1)
    .default(["wins", "concerns", "recommendations"]),
  /** Free-text business context appended to the prompt. */
  contextHints: z.string().default(""),
  /** Render as bulleted list (default) vs flowing paragraphs. */
  style: z.enum(["bullets", "paragraphs"]).default("bullets"),
  fontSize: z.number().min(8).max(24).default(11),
});
export type AiNarrativeWidgetConfig = z.infer<typeof aiNarrativeWidgetConfigSchema>;

// ─── Widget union ───────────────────────────────────────────────────────
// Discriminated union over `type` — gives us full type narrowing in
// renderers and builder UI. Adding a new widget type:
//   1. Add a config schema above
//   2. Add a variant to the union below
//   3. Register a WidgetDefinition (lib/reports/widgets/registry.ts)
export const widgetSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("text"),
    position: positionSchema,
    config: textWidgetConfigSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("image"),
    position: positionSchema,
    config: imageWidgetConfigSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("divider"),
    position: positionSchema,
    config: dividerWidgetConfigSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("spacer"),
    position: positionSchema,
    config: spacerWidgetConfigSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("cover_block"),
    position: positionSchema,
    config: coverBlockWidgetConfigSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("kpi_card"),
    position: positionSchema,
    config: kpiCardWidgetConfigSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("line_chart"),
    position: positionSchema,
    config: lineChartWidgetConfigSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("bar_chart"),
    position: positionSchema,
    config: barChartWidgetConfigSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("table"),
    position: positionSchema,
    config: tableWidgetConfigSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("ai_narrative"),
    position: positionSchema,
    config: aiNarrativeWidgetConfigSchema,
  }),
]);
export type Widget = z.infer<typeof widgetSchema>;
export type WidgetType = Widget["type"];

// ─── Slide + Template ───────────────────────────────────────────────────
export const slideSchema = z.object({
  id: z.string(),
  name: z.string().default("Untitled slide"),
  /** Hex without leading #. */
  background: z.string().regex(/^[0-9A-Fa-f]{6}$/).default("F8FAFC"),
  widgets: z.array(widgetSchema).default([]),
});
export type Slide = z.infer<typeof slideSchema>;

export const templateSettingsSchema = z.object({
  /** Default anchor for date-range refs. "auto" = last completed period at
   *  generate time; "specific" = pinned date. */
  anchor: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("auto_weekly") }),
      z.object({ kind: z.literal("auto_monthly") }),
      z.object({
        kind: z.literal("specific"),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    ])
    .default({ kind: "auto_weekly" }),
});
export type TemplateSettings = z.infer<typeof templateSettingsSchema>;

export const templateDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  settings: templateSettingsSchema.default({ anchor: { kind: "auto_weekly" } }),
  slides: z.array(slideSchema).default([]),
});
export type TemplateDefinition = z.infer<typeof templateDefinitionSchema>;

/**
 * Parse a raw `report_template.definition` JSONB blob and return a fully
 * typed, validated TemplateDefinition. Throws if the payload doesn't
 * match the current schema.
 *
 * When schemaVersion bumps in the future, this is the migration entry
 * point: branch on the stored version, upgrade old payloads to the
 * latest shape, then validate.
 */
export function parseTemplateDefinition(raw: unknown): TemplateDefinition {
  return templateDefinitionSchema.parse(raw);
}

// ─── Empty / blank starter ──────────────────────────────────────────────
/** Build a brand-new blank template definition with one empty slide. */
export function createBlankTemplateDefinition(): TemplateDefinition {
  return {
    schemaVersion: 1,
    settings: { anchor: { kind: "auto_weekly" } },
    slides: [
      {
        id: crypto.randomUUID(),
        name: "Slide 1",
        background: "F8FAFC",
        widgets: [],
      },
    ],
  };
}
