import {
  barChartWidgetConfigSchema,
  type BarChartWidgetConfig,
} from "@/lib/reports/templates/types";
import type { ReportTotals } from "@/lib/reports/fetch-report-data";
import {
  resolveMetricFromTotals,
  resolveTrendFor,
} from "./data-resolver";
import { registerWidget, type WidgetDefinition } from "./registry";

const FONT_FACE = "Calibri";

// Bar chart — supports two layouts:
//   groupBy "time"        → one bar per trend bucket (W11, W12, …)
//   groupBy "campaign"    → one bar per campaign (top N, by metric)
//   groupBy "source"      → one bar per source (paid / organic / GA4)
// `compareSeries` adds a second series next to the main bars for
// target-vs-actual or current-vs-previous-period comparisons.
const definition: WidgetDefinition<{
  id: string;
  type: "bar_chart";
  position: { x: number; y: number; w: number; h: number };
  config: BarChartWidgetConfig;
}> = {
  type: "bar_chart",
  configSchemaVersion: 1,
  defaultPosition: { x: 0.5, y: 2.85, w: 6.1, h: 4.3 },
  defaultConfig: barChartWidgetConfigSchema.parse({
    dataSource: "ga4",
    metric: "sessions",
  }),
  label: "Bar Chart",
  description: "Bar chart — over time or by campaign / source, optional compare series.",

  render({ pres, slide, widget, context }) {
    const { config, position } = widget;
    const { reportData } = context;

    // Build data series based on groupBy.
    let labels: string[] = [];
    let values: number[] = [];
    let compareValues: number[] | null = null;

    if (config.groupBy === "time") {
      const trend = resolveTrendFor(reportData, config.dateRange);
      if (trend) {
        labels = trend.map((b) => b.label);
        values = trend.map((b) =>
          resolveMetricFromTotals({
            totals: b as ReportTotals,
            dataSource: config.dataSource,
            metric: config.metric,
            filters: config.filters,
          }),
        );
      }
    } else if (config.groupBy === "campaign") {
      // Top campaigns from the campaign breakdown for the selected source.
      const top = reportData.campaigns
        .filter((c) => c.source === config.dataSource)
        .slice(0, 8);
      labels = top.map((c) => c.campaignName ?? c.campaignId ?? "(rollup)");
      values = top.map((c) =>
        resolveMetricFromTotals({
          totals: c as ReportTotals,
          dataSource: config.dataSource,
          metric: config.metric,
          filters: config.filters,
        }),
      );
    } else {
      // groupBy === "source" — bars across the three connected channels.
      const sources = reportData.connectedSources;
      labels = sources;
      values = sources.map((src) =>
        resolveMetricFromTotals({
          totals: reportData.totals,
          dataSource: src as BarChartWidgetConfig["dataSource"],
          metric: config.metric,
          filters: config.filters,
        }),
      );
    }

    // Compare series (only for time-grouped bars; campaign/source
    // comparisons would need their own logic).
    if (config.compareSeries && config.groupBy === "time") {
      if (config.compareSeries.kind === "monthly_target") {
        // Pull from monthlyTargetVsActual if available — only meaningful
        // when the metric matches sessions and granularity is months.
        const m = reportData.monthlyTargetVsActual;
        if (m.length > 0 && config.metric === "sessions") {
          // Replace labels with month labels and use target/projected.
          labels = m.map((row) => row.label + (row.isPartial ? "*" : ""));
          values = m.map((row) => Math.round(row.actual));
          compareValues = m.map((row) => row.target ?? 0);
        }
      } else if (config.compareSeries.kind === "previous_period") {
        // Use previousTotals as a single comparison value spread across
        // each bucket — usually rendered as a flat reference line.
        const prev = resolveMetricFromTotals({
          totals: reportData.previousTotals,
          dataSource: config.dataSource,
          metric: config.metric,
          filters: config.filters,
        });
        compareValues = labels.map(() => prev);
      }
    }

    if (labels.length === 0) {
      // Empty state.
      slide.addShape("rect", {
        x: position.x,
        y: position.y,
        w: position.w,
        h: position.h,
        fill: { color: "FFFFFF" },
        line: { color: "E2E8F0", width: 0.75 },
      });
      slide.addText("Belum ada data untuk periode ini.", {
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

    const series: Array<{ name: string; labels: string[]; values: number[] }> =
      [{ name: config.metric, labels, values }];
    if (compareValues) {
      series.unshift({
        name: config.compareSeries?.label ?? "Compare",
        labels,
        values: compareValues,
      });
    }

    const chartColors = compareValues
      ? ["CBD5E1", config.color] // grey target behind, vivid actual front
      : [config.color];

    slide.addChart(pres.ChartType.bar, series, {
      x: position.x,
      y: position.y,
      w: position.w,
      h: position.h,
      barDir: "col", // vertical bars
      barGrouping: compareValues ? "clustered" : "standard",
      chartColors,
      showTitle: Boolean(config.title),
      title: config.title,
      titleFontSize: 12,
      titleFontFace: FONT_FACE,
      showLegend: config.showLegend,
      legendPos: "b",
      legendFontSize: 10,
      legendFontFace: FONT_FACE,
      showValue: config.showValues,
      dataLabelFontSize: 10,
      dataLabelFontFace: FONT_FACE,
      dataLabelFormatCode: "#,##0",
      catAxisLabelFontSize: 10,
      valAxisLabelFontSize: 10,
      catAxisLabelFontFace: FONT_FACE,
      valAxisLabelFontFace: FONT_FACE,
    });
  },
};

registerWidget(definition);
