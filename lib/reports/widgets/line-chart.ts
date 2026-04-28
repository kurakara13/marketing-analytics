import {
  lineChartWidgetConfigSchema,
  type LineChartWidgetConfig,
} from "@/lib/reports/templates/types";
import type { ReportTotals } from "@/lib/reports/fetch-report-data";
import {
  resolveMetricFromTotals,
  resolveTrendFor,
} from "./data-resolver";
import { registerWidget, type WidgetDefinition } from "./registry";

const FONT_FACE = "Calibri";

const definition: WidgetDefinition<{
  id: string;
  type: "line_chart";
  position: { x: number; y: number; w: number; h: number };
  config: LineChartWidgetConfig;
}> = {
  type: "line_chart",
  configSchemaVersion: 1,
  defaultPosition: { x: 0.5, y: 2.85, w: 6.1, h: 4.3 },
  defaultConfig: lineChartWidgetConfigSchema.parse({
    dataSource: "ga4",
    metric: "sessions",
  }),
  label: "Line Chart",
  description: "Time-series chart over the last 6 buckets (weekly / monthly).",

  render({ pres, slide, widget, context }) {
    const { config, position } = widget;
    const { reportData } = context;

    const trend = resolveTrendFor(reportData, config.dateRange);
    if (!trend || trend.length === 0) {
      // Empty state — placeholder rectangle with message.
      slide.addShape("rect", {
        x: position.x,
        y: position.y,
        w: position.w,
        h: position.h,
        fill: { color: "FFFFFF" },
        line: { color: "E2E8F0", width: 0.75 },
      });
      slide.addText("Belum ada data trend untuk periode ini.", {
        x: position.x,
        y: position.y + position.h / 2 - 0.2,
        w: position.w,
        h: 0.4,
        fontFace: FONT_FACE,
        fontSize: 12,
        italic: true,
        color: "64748B",
        align: "center",
      });
      return;
    }

    const labels = trend.map((b) => b.label);
    // The trend buckets carry per-source totals that mirror the
    // ReportTotals shape — same resolver works on each bucket.
    const values = trend.map((b) =>
      resolveMetricFromTotals({
        totals: b as ReportTotals,
        dataSource: config.dataSource,
        metric: config.metric,
        filters: config.filters,
      }),
    );

    const title = config.title || `${config.metric}`;

    slide.addChart(
      pres.ChartType.line,
      [{ name: title, labels, values }],
      {
        x: position.x,
        y: position.y,
        w: position.w,
        h: position.h,
        chartColors: [config.color],
        showTitle: Boolean(config.title),
        title,
        titleFontSize: 12,
        titleFontFace: FONT_FACE,
        showLegend: config.showLegend,
        showValue: config.showValues,
        catAxisLabelFontSize: 10,
        valAxisLabelFontSize: 10,
        catAxisLabelFontFace: FONT_FACE,
        valAxisLabelFontFace: FONT_FACE,
        lineDataSymbol: "circle",
        lineDataSymbolSize: 6,
      },
    );
  },
};

registerWidget(definition);
