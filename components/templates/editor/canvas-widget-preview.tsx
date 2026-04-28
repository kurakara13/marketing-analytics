"use client";

import { BarChart3, Image as ImageIcon, LineChart, Table } from "lucide-react";

import type { Widget } from "@/lib/reports/templates/types";

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
      return (
        <div className="bg-muted/60 text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-1 border border-dashed">
          <ImageIcon className="size-5" />
          <span className="text-xs">
            {widget.config.imagePath ? "Image" : "No image"}
          </span>
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
      return (
        <div className="bg-card flex h-full w-full flex-col justify-between gap-1 border p-1.5">
          <div className="text-muted-foreground text-[9px] font-bold uppercase tracking-wide">
            {widget.config.label}
          </div>
          <div className="text-base font-bold leading-tight">
            {widget.config.dataSource}.{widget.config.metric}
          </div>
          {widget.config.showDelta ? (
            <div className="text-muted-foreground text-[9px]">vs previous</div>
          ) : null}
        </div>
      );

    case "line_chart":
      return (
        <div className="bg-card text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-1 border">
          <LineChart className="size-5" />
          <span className="text-[10px] font-medium">
            {widget.config.title || `Trend ${widget.config.metric}`}
          </span>
          <span className="text-[9px]">
            {widget.config.dataSource}.{widget.config.metric}
          </span>
        </div>
      );

    case "bar_chart":
      return (
        <div className="bg-card text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-1 border">
          <BarChart3 className="size-5" />
          <span className="text-[10px] font-medium">
            {widget.config.title || `Bar ${widget.config.metric}`}
          </span>
        </div>
      );

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
