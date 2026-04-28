import {
  kpiCardWidgetConfigSchema,
  type KpiCardWidgetConfig,
} from "@/lib/reports/templates/types";
import {
  deltaText,
  formatMetricValue,
  resolveMetricFromTotals,
  resolveTotalsFor,
} from "./data-resolver";
import { registerWidget, type WidgetDefinition } from "./registry";

const FONT_FACE = "Calibri";
const COLORS = {
  cardBg: "FFFFFF",
  border: "E2E8F0",
  text: "0F172A",
  textMuted: "64748B",
};

const definition: WidgetDefinition<{
  id: string;
  type: "kpi_card";
  position: { x: number; y: number; w: number; h: number };
  config: KpiCardWidgetConfig;
}> = {
  type: "kpi_card",
  configSchemaVersion: 1,
  defaultPosition: { x: 0.5, y: 1.2, w: 2.95, h: 1.4 },
  defaultConfig: kpiCardWidgetConfigSchema.parse({
    label: "Metric",
    dataSource: "ga4",
    metric: "sessions",
  }),
  label: "KPI Card",
  description: "Single metric value with optional delta vs previous period.",

  render({ slide, widget, context }) {
    const { config, position } = widget;
    const { reportData } = context;

    // Card background
    slide.addShape("roundRect", {
      x: position.x,
      y: position.y,
      w: position.w,
      h: position.h,
      fill: { color: COLORS.cardBg },
      line: { color: COLORS.border, width: 0.75 },
      rectRadius: 0.08,
    });

    // Label
    slide.addText(config.label, {
      x: position.x + 0.15,
      y: position.y + 0.1,
      w: position.w - 0.3,
      h: 0.3,
      fontFace: FONT_FACE,
      fontSize: 10,
      color: COLORS.textMuted,
      bold: true,
    });

    // Resolve the current value.
    const totals = resolveTotalsFor(reportData, config.dateRange);
    if (!totals) {
      slide.addText("—", {
        x: position.x + 0.15,
        y: position.y + 0.42,
        w: position.w - 0.3,
        h: 0.6,
        fontFace: FONT_FACE,
        fontSize: 22,
        bold: true,
        color: COLORS.text,
      });
      slide.addText("Date range tidak didukung", {
        x: position.x + 0.15,
        y: position.y + position.h - 0.4,
        w: position.w - 0.3,
        h: 0.3,
        fontFace: FONT_FACE,
        fontSize: 9,
        italic: true,
        color: COLORS.textMuted,
      });
      return;
    }

    const value = resolveMetricFromTotals({
      totals,
      dataSource: config.dataSource,
      metric: config.metric,
      filters: config.filters,
    });

    slide.addText(formatMetricValue(value, config.format), {
      x: position.x + 0.15,
      y: position.y + 0.42,
      w: position.w - 0.3,
      h: 0.6,
      fontFace: FONT_FACE,
      fontSize: 22,
      bold: true,
      color: COLORS.text,
    });

    // Delta
    if (config.showDelta) {
      const compareTotals = resolveTotalsFor(reportData, config.deltaCompareTo);
      if (compareTotals) {
        const compareValue = resolveMetricFromTotals({
          totals: compareTotals,
          dataSource: config.dataSource,
          metric: config.metric,
          filters: config.filters,
        });
        slide.addText(deltaText(value, compareValue), {
          x: position.x + 0.15,
          y: position.y + position.h - 0.4,
          w: position.w - 0.3,
          h: 0.3,
          fontFace: FONT_FACE,
          fontSize: 9,
          color: COLORS.textMuted,
        });
      }
    }
  },
};

registerWidget(definition);
