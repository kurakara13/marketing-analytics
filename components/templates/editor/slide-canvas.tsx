"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Rnd } from "react-rnd";

import { cn } from "@/lib/utils";
import type { Slide, Widget } from "@/lib/reports/templates/types";
import { CanvasWidgetPreview } from "./canvas-widget-preview";

// PPT slide is 13.333" × 7.5" (16:9 widescreen). The canvas mirrors
// these proportions exactly; pxPerInch is computed at runtime to fit
// the available viewport.
const SLIDE_W_INCHES = 13.333;
const SLIDE_H_INCHES = 7.5;
const SNAP_INCHES = 0.05; // 0.05" snap step
// Padding around the canvas inside its container, in pixels.
const CONTAINER_PADDING = 32;
// Hard floor / ceiling so very narrow or very wide viewports still
// render something sane.
const MIN_PX_PER_INCH = 50;
const MAX_PX_PER_INCH = 130;

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pxPerInch, setPxPerInch] = useState(70);

  // Recompute pxPerInch whenever the container resizes. Picks the
  // largest scale that fits the canvas (with padding) in both width
  // and height, clamped to MIN/MAX so the canvas doesn't get absurdly
  // small on a side panel or absurdly large on a 4K monitor.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function recompute() {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const availableW = Math.max(0, rect.width - CONTAINER_PADDING * 2);
      const availableH = Math.max(0, rect.height - CONTAINER_PADDING * 2);
      const byWidth = availableW / SLIDE_W_INCHES;
      const byHeight = availableH / SLIDE_H_INCHES;
      const fit = Math.min(byWidth, byHeight);
      const clamped = Math.max(MIN_PX_PER_INCH, Math.min(MAX_PX_PER_INCH, fit));
      setPxPerInch(Math.round(clamped));
    }

    recompute();

    const observer = new ResizeObserver(recompute);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const canvasW = SLIDE_W_INCHES * pxPerInch;
  const canvasH = SLIDE_H_INCHES * pxPerInch;

  if (!slide) {
    return (
      <div className="flex items-center justify-center rounded-md border">
        <p className="text-muted-foreground text-sm">Pilih slide untuk edit.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex min-h-0 items-center justify-center overflow-auto rounded-xl border border-border/60 p-10",
        // Subtle radial backdrop so the canvas pops slightly off the page.
        "bg-[radial-gradient(circle_at_50%_30%,rgba(15,23,42,0.04),transparent_70%)]",
      )}
    >
      <motion.div
        layout
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative ring-1 ring-black/5 shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18)]"
        style={{
          width: canvasW,
          height: canvasH,
          backgroundColor: `#${slide.background}`,
          backgroundImage:
            "linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)",
          backgroundSize: `${pxPerInch}px ${pxPerInch}px`,
        }}
        onClick={(e) => {
          // Clicking empty canvas = deselect.
          if (e.target === e.currentTarget) {
            onSelectWidget(null);
          }
        }}
      >
        <AnimatePresence>
          {slide.widgets.map((widget) => (
            <CanvasWidget
              key={widget.id}
              widget={widget}
              isSelected={widget.id === selectedWidgetId}
              onSelect={() => onSelectWidget(widget.id)}
              onUpdate={(updater) => onUpdateWidget(widget.id, updater)}
              pxPerInch={pxPerInch}
            />
          ))}
        </AnimatePresence>

        {slide.widgets.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center"
          >
            <div className="text-muted-foreground text-base font-medium">
              Slide kosong
            </div>
            <p className="text-muted-foreground/80 max-w-sm text-xs">
              Tambah widget dari panel kanan — text, KPI card, atau line
              chart. Drag di canvas untuk reposition.
            </p>
          </motion.div>
        ) : null}
      </motion.div>

      {/* Scale indicator pinned to the canvas container, doesn't scroll */}
      <div className="text-muted-foreground/70 pointer-events-none absolute bottom-2 right-3 select-none font-mono text-[10px]">
        {Math.round(pxPerInch)} px/inch · {Math.round(canvasW)}×
        {Math.round(canvasH)} px
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
  const snapPx = SNAP_INCHES * pxPerInch;

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
            x: clamp(
              roundTo(d.x / pxPerInch, SNAP_INCHES),
              0,
              SLIDE_W_INCHES - w.position.w,
            ),
            y: clamp(
              roundTo(d.y / pxPerInch, SNAP_INCHES),
              0,
              SLIDE_H_INCHES - w.position.h,
            ),
          },
        }));
      }}
      onResizeStop={(_, __, ref, ___, pos) => {
        const newW = roundTo(
          parseFloat(ref.style.width) / pxPerInch,
          SNAP_INCHES,
        );
        const newH = roundTo(
          parseFloat(ref.style.height) / pxPerInch,
          SNAP_INCHES,
        );
        onUpdate((w) => ({
          ...w,
          position: {
            x: clamp(
              roundTo(pos.x / pxPerInch, SNAP_INCHES),
              0,
              SLIDE_W_INCHES - newW,
            ),
            y: clamp(
              roundTo(pos.y / pxPerInch, SNAP_INCHES),
              0,
              SLIDE_H_INCHES - newH,
            ),
            w: clamp(newW, 0.1, SLIDE_W_INCHES),
            h: clamp(newH, 0.1, SLIDE_H_INCHES),
          },
        }));
      }}
      dragGrid={[snapPx, snapPx]}
      resizeGrid={[snapPx, snapPx]}
      className={cn(
        "outline outline-2 outline-offset-2 transition-[outline-color] duration-150",
        isSelected
          ? "outline-primary"
          : "outline-transparent hover:outline-primary/30",
      )}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="size-full"
      >
        <CanvasWidgetPreview widget={widget} />
      </motion.div>
    </Rnd>
  );
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
