import {
  aiNarrativeWidgetConfigSchema,
  barChartWidgetConfigSchema,
  coverBlockWidgetConfigSchema,
  dividerWidgetConfigSchema,
  imageWidgetConfigSchema,
  kpiCardWidgetConfigSchema,
  lineChartWidgetConfigSchema,
  shapeWidgetConfigSchema,
  spacerWidgetConfigSchema,
  tableWidgetConfigSchema,
  textWidgetConfigSchema,
  type Widget,
  type WidgetType,
} from "@/lib/reports/templates/types";

// Client-side widget metadata: palette label/description, default
// position/config when adding to a fresh slide. Mirrors the server-side
// registry but stays in the client bundle (no pptxgenjs imports).
//
// `enabled: false` shows the item in the palette but disables click —
// used for widget types we've defined in the schema but haven't
// implemented end-to-end yet (still need a renderer / config form).

export type WidgetCategory = "layout" | "data" | "ai";

type PaletteItem = {
  type: WidgetType;
  label: string;
  description: string;
  category: WidgetCategory;
  enabled?: boolean;
};

export const WIDGET_PALETTE_ITEMS: PaletteItem[] = [
  // Layout
  {
    type: "text",
    label: "Text",
    description: "Heading, paragraph, atau label statis.",
    category: "layout",
    enabled: true,
  },
  {
    type: "cover_block",
    label: "Cover Block",
    description: "Title + subtitle + tanggal untuk slide cover.",
    category: "layout",
    enabled: true,
  },
  {
    type: "image",
    label: "Image",
    description: "Logo atau gambar yang di-upload.",
    category: "layout",
    enabled: true,
  },
  {
    type: "shape",
    label: "Shape",
    description: "Kotak, segitiga, parallelogram untuk decorative atau mask.",
    category: "layout",
    enabled: true,
  },
  {
    type: "divider",
    label: "Divider",
    description: "Garis horizontal/vertikal untuk pemisah.",
    category: "layout",
    enabled: true,
  },
  {
    type: "spacer",
    label: "Spacer",
    description: "Spacing kosong untuk layout (tidak terlihat di PPT).",
    category: "layout",
    enabled: true,
  },
  // Data
  {
    type: "kpi_card",
    label: "KPI Card",
    description: "Single metric value + delta vs periode sebelumnya.",
    category: "data",
    enabled: true,
  },
  {
    type: "line_chart",
    label: "Line Chart",
    description: "Trend 6 minggu / 6 bulan dari satu metric.",
    category: "data",
    enabled: true,
  },
  {
    type: "bar_chart",
    label: "Bar Chart",
    description: "Bar grouped — actual vs target / vs previous.",
    category: "data",
    enabled: true,
  },
  {
    type: "table",
    label: "Table",
    description: "Top N rows by metric (campaigns, pages, dst).",
    category: "data",
    enabled: true,
  },
  // AI
  {
    type: "ai_narrative",
    label: "AI Insight",
    description: "Commentary auto-generate oleh AI (GPT-5).",
    category: "ai",
    enabled: true,
  },
];

export const WIDGET_CATEGORY_LABELS: Record<WidgetCategory, string> = {
  layout: "Layout",
  data: "Data",
  ai: "AI",
};

const DEFAULT_POSITIONS: Record<WidgetType, Widget["position"]> = {
  text: { x: 1, y: 1, w: 6, h: 0.6 },
  image: { x: 4, y: 2, w: 4, h: 3 },
  shape: { x: 1, y: 1, w: 3, h: 2 },
  divider: { x: 1, y: 3.5, w: 11, h: 0.05 },
  spacer: { x: 1, y: 1, w: 1, h: 1 },
  cover_block: { x: 1, y: 2, w: 11, h: 3 },
  kpi_card: { x: 0.5, y: 1.2, w: 2.95, h: 1.4 },
  line_chart: { x: 0.5, y: 2.85, w: 6.1, h: 4.3 },
  bar_chart: { x: 0.5, y: 2.85, w: 6.1, h: 4.3 },
  table: { x: 0.5, y: 1, w: 12.3, h: 5 },
  ai_narrative: { x: 0.5, y: 1, w: 6, h: 5 },
};

/**
 * Build a fresh widget instance of the given type with sensible defaults.
 * The widget is dropped onto the slide at a default position; user can
 * drag/resize from there.
 */
export function buildDefaultWidget(type: WidgetType): Widget {
  const id = crypto.randomUUID();
  const position = { ...DEFAULT_POSITIONS[type] };

  switch (type) {
    case "text":
      return {
        id,
        type,
        position,
        config: textWidgetConfigSchema.parse({ text: "Text baru" }),
      };
    case "image":
      return {
        id,
        type,
        position,
        config: imageWidgetConfigSchema.parse({}),
      };
    case "divider":
      return {
        id,
        type,
        position,
        config: dividerWidgetConfigSchema.parse({}),
      };
    case "spacer":
      return {
        id,
        type,
        position,
        config: spacerWidgetConfigSchema.parse({}),
      };
    case "shape":
      return {
        id,
        type,
        position,
        config: shapeWidgetConfigSchema.parse({}),
      };
    case "cover_block":
      return {
        id,
        type,
        position,
        config: coverBlockWidgetConfigSchema.parse({
          title: "Report Title",
          subtitle: "",
        }),
      };
    case "kpi_card":
      return {
        id,
        type,
        position,
        config: kpiCardWidgetConfigSchema.parse({
          label: "Total Sessions",
          dataSource: "ga4",
          metric: "sessions",
        }),
      };
    case "line_chart":
      return {
        id,
        type,
        position,
        config: lineChartWidgetConfigSchema.parse({
          dataSource: "ga4",
          metric: "sessions",
          title: "Trend Sessions",
        }),
      };
    case "bar_chart":
      return {
        id,
        type,
        position,
        config: barChartWidgetConfigSchema.parse({
          dataSource: "ga4",
          metric: "sessions",
        }),
      };
    case "table":
      return {
        id,
        type,
        position,
        config: tableWidgetConfigSchema.parse({
          dataSource: "google_ads",
          dimensions: ["campaignName"],
          metrics: ["clicks", "conversions"],
        }),
      };
    case "ai_narrative":
      return {
        id,
        type,
        position,
        config: aiNarrativeWidgetConfigSchema.parse({}),
      };
  }
}
