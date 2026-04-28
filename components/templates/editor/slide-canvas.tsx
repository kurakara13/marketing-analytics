"use client";

import { useMemo } from "react";
import { Rnd } from "react-rnd";

import { cn } from "@/lib/utils";
import type { Slide, Widget } from "@/lib/reports/templates/types";
import { CanvasWidgetPreview } from "./canvas-widget-preview";

// PPT slide is 13.333" × 7.5" (16:9). We pick a CSS pixel ratio that
// lets the canvas fit inside most laptop viewports comfortably.
const PX_PER_INCH = 70; // 933 × 525 px canvas
const SNAP = 0.05; // inches — translates to a snap-to-grid step

type Props = {
  slide: Slide | null;
  selectedWidgetId: string | null;
  onSelectWidget: (id: string | null) => void;
  onUpdateWidget: (
    widgetId: string,
    updater: (w: Widget) => Widget,
  ) => void;
};

export function SlideCanvas({
  slide,
  selectedWidgetId,
  onSelectWidget,
  onUpdateWidget,
}: Props) {
  const canvasW = 13.333 * PX_PER_INCH;
  const canvasH = 7.5 * PX_PER_INCH;

  if (!slide) {
    return (
      <div className="flex items-center justify-center rounded-md border">
        <p className="text-muted-foreground text-sm">Pilih slide untuk edit.</p>
      </div>
    );
  }

  return (
    <div className="bg-muted/40 relative flex min-h-0 items-center justify-center overflow-auto rounded-md border p-6">
      <div
        className="relative shadow-md"
        style={{
          width: canvasW,
          height: canvasH,
          backgroundColor: `#${slide.background}`,
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)",
          backgroundSize: `${PX_PER_INCH}px ${PX_PER_INCH}px`,
        }}
        onClick={(e) => {
          // Clicking empty canvas = deselect.
          if (e.target === e.currentTarget) {
            onSelectWidget(null);
          }
        }}
      >
        {slide.widgets.map((widget) => (
          <CanvasWidget
            key={widget.id}
            widget={widget}
            isSelected={widget.id === selectedWidgetId}
            onSelect={() => onSelectWidget(widget.id)}
            onUpdate={(updater) => onUpdateWidget(widget.id, updater)}
            pxPerInch={PX_PER_INCH}
          />
        ))}

        {slide.widgets.length === 0 ? (
          <div className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center text-sm">
            Slide kosong — tambah widget dari panel kanan.
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Single widget on canvas ────────────────────────────────────────────
function CanvasWidget({
  widget,
  isSelected,
  onSelect,
  onUpdate,
  pxPerInch,
}: {
  widget: Widget;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updater: (w: Widget) => Widget) => void;
  pxPerInch: number;
}) {
  const snapPx = SNAP * pxPerInch;

  // Convert position from inches to pixels for Rnd, and back on save.
  const positionPx = useMemo(
    () => ({
      x: widget.position.x * pxPerInch,
      y: widget.position.y * pxPerInch,
      width: widget.position.w * pxPerInch,
      height: widget.position.h * pxPerInch,
    }),
    [widget.position, pxPerInch],
  );

  return (
    <Rnd
      size={{ width: positionPx.width, height: positionPx.height }}
      position={{ x: positionPx.x, y: positionPx.y }}
      bounds="parent"
      onDragStart={onSelect}
      onResizeStart={onSelect}
      onDragStop={(_, d) => {
        onUpdate((w) => ({
          ...w,
          position: {
            ...w.position,
            x: clamp(roundTo(d.x / pxPerInch, SNAP), 0, 13.333 - w.position.w),
            y: clamp(roundTo(d.y / pxPerInch, SNAP), 0, 7.5 - w.position.h),
          },
        }));
      }}
      onResizeStop={(_, __, ref, ___, pos) => {
        const newW = roundTo(parseFloat(ref.style.width) / pxPerInch, SNAP);
        const newH = roundTo(parseFloat(ref.style.height) / pxPerInch, SNAP);
        onUpdate((w) => ({
          ...w,
          position: {
            x: clamp(roundTo(pos.x / pxPerInch, SNAP), 0, 13.333 - newW),
            y: clamp(roundTo(pos.y / pxPerInch, SNAP), 0, 7.5 - newH),
            w: clamp(newW, 0.1, 13.333),
            h: clamp(newH, 0.1, 7.5),
          },
        }));
      }}
      dragGrid={[snapPx, snapPx]}
      resizeGrid={[snapPx, snapPx]}
      className={cn(
        "outline-2 outline-offset-2",
        isSelected ? "outline-primary" : "outline-transparent",
        "[&:hover]:outline-primary/40",
      )}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <CanvasWidgetPreview widget={widget} />
    </Rnd>
  );
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
