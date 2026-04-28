"use client";

import { Image as ImageIcon, Table } from "lucide-react";
import {
  Bar,
  BarChart,
  Line,
  LineChart as RcLineChart,
  ResponsiveContainer,
} from "recharts";

import type { ReportTotals } from "@/lib/reports/fetch-report-data";
import type {
  BarChartWidgetConfig,
  KpiCardWidgetConfig,
  LineChartWidgetConfig,
  ShapeWidgetConfig,
  Widget,
} from "@/lib/reports/templates/types";
import {
  deltaText,
  formatMetricValue,
  resolveMetricFromTotals,
  resolveTotalsFor,
  resolveTrendFor,
} from "@/lib/reports/widgets/data-resolver";
import { useEditorContext } from "./editor-context";

// Lightweight HTML/CSS preview of how a widget will look in PPT.
// Not pixel-perfect — pptxgenjs renders the actual PPT, this is just
// a visual hint while editing. Real preview = "Generate .pptx".
export function CanvasWidgetPreview({ widget }: { widget: Widget }) {
  switch (widget.type) {
    case "text":
      return (
        <div
          className="flex h-full w-full p-1"
          style={{
            fontSize: `${widget.config.fontSize * 0.6}px`,
            fontWeight: widget.config.bold ? 700 : 400,
            fontStyle: widget.config.italic ? "italic" : "normal",
            color: `#${widget.config.color}`,
            textAlign: widget.config.align,
            justifyContent:
              widget.config.align === "center"
                ? "center"
                : widget.config.align === "right"
                  ? "flex-end"
                  : "flex-start",
            alignItems: "flex-start",
          }}
        >
          {widget.config.text || (
            <span className="text-muted-foreground italic">(empty text)</span>
          )}
        </div>
      );

    case "image":
      return widget.config.imagePath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/uploads/${widget.config.imagePath}`}
          alt={widget.config.altText || ""}
          className="block h-full w-full"
          style={{
            objectFit: widget.config.fit === "cover" ? "cover" : "contain",
          }}
        />
      ) : (
        <div className="bg-muted/60 text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-1 border border-dashed">
          <ImageIcon className="size-5" />
          <span className="text-xs">No image</span>
        </div>
      );

    case "divider":
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div
            style={{
              backgroundColor: `#${widget.config.color}`,
              width:
                widget.config.orientation === "horizontal"
                  ? "100%"
                  : `${widget.config.thickness}px`,
              height:
                widget.config.orientation === "horizontal"
                  ? `${widget.config.thickness}px`
                  : "100%",
            }}
          />
        </div>
      );

    case "spacer":
      return (
        <div className="text-muted-foreground/40 flex h-full w-full items-center justify-center text-[10px]">
          (spacer)
        </div>
      );

    case "shape":
      return <ShapePreview config={widget.config} />;

    case "cover_block":
      return (
        <div
          className="flex h-full w-full flex-col items-center justify-center p-2"
          style={{ backgroundColor: `#${widget.config.bgColor}` }}
        >
          <div
            className="text-center text-base font-bold"
            style={{ color: `#${widget.config.titleColor}` }}
          >
            {widget.config.title || "Title"}
          </div>
          {widget.config.subtitle ? (
            <div
              className="mt-1 text-center text-xs"
              style={{ color: `#${widget.config.titleColor}` }}
            >
              {widget.config.subtitle}
            </div>
          ) : null}
        </div>
      );

    case "kpi_card":
      return <KpiCardPreview config={widget.config} />;

    case "line_chart":
      return <LineChartPreview config={widget.config} />;

    case "bar_chart":
      return <BarChartPreview config={widget.config} />;

    case "table":
      return (
        <div className="bg-card text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-1 border">
          <Table className="size-5" />
          <span className="text-[10px] font-medium">
            {widget.config.title || "Table"}
          </span>
          <span className="text-[9px]">
            top {widget.config.limit} {widget.config.dimensions.join("/")}
          </span>
        </div>
      );

    case "ai_narrative":
      return (
        <div className="bg-card flex h-full w-full flex-col gap-1 border p-1.5">
          <div className="text-[10px] font-bold">
            {widget.config.title || "AI Insight"}
          </div>
          <div className="text-muted-foreground text-[9px]">
            {widget.config.sections.join(" · ")}
          </div>
        </div>
      );
  }
}

// ─── Shape preview (SVG) ────────────────────────────────────────────────
//
// Each shape is drawn as an SVG `<path>` (or `<polygon>`) inside a
// preserveAspectRatio="none" viewBox so the shape stretches to fill
// whatever bounding box the user resizes the widget to. Stroke widths
// are converted from PPT pt to SVG units; the visual approximation is
// close enough for layout decisions without trying to match PPT
// pixel-perfect.
function ShapePreview({ config }: { config: ShapeWidgetConfig }) {
  const fillVal =
    config.fillOpacity <= 0 ? "transparent" : `#${config.fillColor}`;
  const strokeVal =
    config.borderWidth > 0 ? `#${config.borderColor}` : "transparent";
  const strokeW = config.borderWidth;

  const commonProps = {
    fill: fillVal,
    fillOpacity: config.fillOpacity,
    stroke: strokeVal,
    strokeWidth: strokeW,
    vectorEffect: "non-scaling-stroke" as const,
  };

  // viewBox 0..100 with shapes filling. preserveAspectRatio="none"
  // lets the SVG stretch to widget aspect ratio.
  const inner = (() => {
    switch (config.kind) {
      case "rect":
        return <rect x={0} y={0} width={100} height={100} {...commonProps} />;
      case "roundRect":
        return (
          <rect
            x={0}
            y={0}
            width={100}
            height={100}
            rx={6}
            ry={6}
            {...commonProps}
          />
        );
      case "ellipse":
        return (
          <ellipse cx={50} cy={50} rx={50} ry={50} {...commonProps} />
        );
      case "triangle":
        return <polygon points="50,0 100,100 0,100" {...commonProps} />;
      case "rightTriangle":
        return <polygon points="0,0 0,100 100,100" {...commonProps} />;
      case "parallelogram":
        // Slants right by ~25% of width; matches pptxgenjs default.
        return <polygon points="25,0 100,0 75,100 0,100" {...commonProps} />;
      case "trapezoid":
        return <polygon points="20,0 80,0 100,100 0,100" {...commonProps} />;
      case "diamond":
        return (
          <polygon points="50,0 100,50 50,100 0,50" {...commonProps} />
        );
      case "line":
        return (
          <line
            x1={0}
            y1={50}
            x2={100}
            y2={50}
            stroke={fillVal}
            strokeWidth={Math.max(strokeW, 2)}
            vectorEffect="non-scaling-stroke"
          />
        );
    }
  })();

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="block size-full"
      style={{
        transform: config.rotation ? `rotate(${config.rotation}deg)` : undefined,
      }}
    >
      {inner}
    </svg>
  );
}

// ─── Data-aware previews (KPI / line / bar) ─────────────────────────────
//
// These read live ReportData from the editor context (fetched once at
// editor mount) and render real values + mini charts so the canvas
// matches what the .pptx will show. Falls back to placeholder text
// when reportData is null (no connections yet, or fetch failed).

function KpiCardPreview({ config }: { config: KpiCardWidgetConfig }) {
  const { reportData } = useEditorContext();

  let displayValue: string;
  let deltaLabel: string | null = null;

  if (!reportData) {
    displayValue = `${config.dataSource}.${config.metric}`;
    deltaLabel = config.showDelta ? "vs previous" : null;
  } else {
    const totals = resolveTotalsFor(reportData, config.dateRange);
    if (!totals) {
      displayValue = "—";
    } else {
      const value = resolveMetricFromTotals({
        totals,
        dataSource: config.dataSource,
        metric: config.metric,
        filters: config.filters,
      });
      displayValue = formatMetricValue(value, config.format);

      if (config.showDelta) {
        const compareTotals = resolveTotalsFor(
          reportData,
          config.deltaCompareTo,
        );
        if (compareTotals) {
          const compareValue = resolveMetricFromTotals({
            totals: compareTotals,
            dataSource: config.dataSource,
            metric: config.metric,
            filters: config.filters,
          });
          deltaLabel = deltaText(value, compareValue);
        }
      }
    }
  }

  // CSS container queries handle the responsive type:
  //
  //   container-type: inline-size      → makes this card the container
  //   font-size: clamp(min, X cqi, max) → font scales with card width
  //
  // Layout is intentionally `justify-start` (not space-between): label /
  // value / delta stack snugly from the top with a small gap. When the
  // card is taller than its content (the default 1.4" position is fairly
  // generous), the bottom is empty whitespace instead of three lines
  // floating apart. `overflow-hidden` clips anything that doesn't fit
  // — a clear visual signal that the user should resize the card
  // bigger, rather than letting text spill outside the widget bounds.
  return (
    <div
      className="bg-card flex h-full w-full flex-col items-start justify-start gap-[2.5cqi] overflow-hidden border p-[5cqi]"
      style={{ containerType: "inline-size" }}
    >
      <div
        className="text-muted-foreground w-full font-bold uppercase leading-tight"
        style={{
          fontSize: "clamp(0.55rem, 4.5cqi, 0.75rem)",
          letterSpacing: "0.04em",
        }}
      >
        {config.label}
      </div>
      <div
        className="text-foreground w-full truncate font-bold leading-tight"
        style={{ fontSize: "clamp(0.95rem, 11cqi, 2rem)" }}
      >
        {displayValue}
      </div>
      {deltaLabel ? (
        <div
          className="text-muted-foreground w-full leading-tight"
          style={{ fontSize: "clamp(0.5rem, 3.8cqi, 0.7rem)" }}
        >
          {deltaLabel}
        </div>
      ) : null}
    </div>
  );
}

function LineChartPreview({ config }: { config: LineChartWidgetConfig }) {
  const { reportData } = useEditorContext();

  const chartData = (() => {
    if (!reportData) return null;
    const trend = resolveTrendFor(reportData, config.dateRange);
    if (!trend || trend.length === 0) return null;
    return trend.map((b) => ({
      label: b.label,
      value: resolveMetricFromTotals({
        totals: b as ReportTotals,
        dataSource: config.dataSource,
        metric: config.metric,
        filters: config.filters,
      }),
    }));
  })();

  return (
    <div className="bg-card flex h-full w-full flex-col gap-1 border p-2">
      {config.title ? (
        <div className="text-foreground text-[11px] font-semibold leading-tight">
          {config.title}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        {chartData ? (
          <ResponsiveContainer width="100%" height="100%">
            <RcLineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={`#${config.color}`}
                strokeWidth={2}
                dot={{ r: 2, fill: `#${config.color}` }}
              />
            </RcLineChart>
          </ResponsiveContainer>
        ) : (
          <PlaceholderChartArea label={`${config.dataSource}.${config.metric}`} />
        )}
      </div>
    </div>
  );
}

function BarChartPreview({ config }: { config: BarChartWidgetConfig }) {
  const { reportData } = useEditorContext();

  const chartData = (() => {
    if (!reportData) return null;

    if (config.groupBy === "time") {
      const trend = resolveTrendFor(reportData, config.dateRange);
      if (!trend || trend.length === 0) return null;
      return trend.map((b) => ({
        label: b.label,
        value: resolveMetricFromTotals({
          totals: b as ReportTotals,
          dataSource: config.dataSource,
          metric: config.metric,
          filters: config.filters,
        }),
      }));
    }
    if (config.groupBy === "campaign") {
      return reportData.campaigns
        .filter((c) => c.source === config.dataSource)
        .slice(0, 8)
        .map((c) => ({
          label: c.campaignName ?? c.campaignId ?? "(rollup)",
          value: resolveMetricFromTotals({
            totals: c as ReportTotals,
            dataSource: config.dataSource,
            metric: config.metric,
            filters: config.filters,
          }),
        }));
    }
    return reportData.connectedSources.map((src) => ({
      label: src,
      value: resolveMetricFromTotals({
        totals: reportData.totals,
        dataSource: src as BarChartWidgetConfig["dataSource"],
        metric: config.metric,
        filters: config.filters,
      }),
    }));
  })();

  return (
    <div className="bg-card flex h-full w-full flex-col gap-1 border p-2">
      {config.title ? (
        <div className="text-foreground text-[11px] font-semibold leading-tight">
          {config.title}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        {chartData && chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <Bar dataKey="value" fill={`#${config.color}`} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <PlaceholderChartArea label={`${config.dataSource}.${config.metric}`} />
        )}
      </div>
    </div>
  );
}

function PlaceholderChartArea({ label }: { label: string }) {
  return (
    <div className="text-muted-foreground/70 flex h-full w-full items-center justify-center text-[10px] italic">
      {label}
    </div>
  );
}
