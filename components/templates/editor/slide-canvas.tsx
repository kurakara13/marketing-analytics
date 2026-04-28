"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Maximize2, Minus, Plus } from "lucide-react";
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
// Padding around the canvas inside its container, in pixels. Kept
// tight so the canvas takes most of the available cell — the breathing
// room is provided by the editor-level grid gap, not here.
const CONTAINER_PADDING = 16;
// Hard floor / ceiling so very narrow or very wide viewports still
// render something sane. The ceiling matters most: on a 4K monitor we
// don't want the canvas blown up beyond useful resolution.
const MIN_PX_PER_INCH = 50;
const MAX_PX_PER_INCH = 180;

// User-controlled zoom multiplier on top of the auto-fit pxPerInch.
// 1.0 = exactly auto-fit (canvas fills cell). 0.5 = half size, 2.0 =
// twice size. Bounded so the canvas can never collapse to nothing or
// grow into the GBs of pixels.
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.25; // multiplicative — each click = ×1.25 / ÷1.25

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
  // `fitPxPerInch` is the responsive auto-fit value (recomputed on
  // resize). `zoom` is a user-controlled multiplier on top of that.
  // Effective scale = fitPxPerInch × zoom.
  const [fitPxPerInch, setFitPxPerInch] = useState(70);
  const [zoom, setZoom] = useState(1);

  // Recompute fitPxPerInch whenever the container resizes. Picks the
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
      setFitPxPerInch(Math.round(clamped));
    }

    recompute();

    const observer = new ResizeObserver(recompute);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const pxPerInch = fitPxPerInch * zoom;
  const canvasW = SLIDE_W_INCHES * pxPerInch;
  const canvasH = SLIDE_H_INCHES * pxPerInch;

  // ─── Zoom controls ────────────────────────────────────────────────────
  const clampZoom = useCallback(
    (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)),
    [],
  );
  const zoomIn = useCallback(() => setZoom((z) => clampZoom(z * ZOOM_STEP)), [
    clampZoom,
  ]);
  const zoomOut = useCallback(
    () => setZoom((z) => clampZoom(z / ZOOM_STEP)),
    [clampZoom],
  );
  const resetZoom = useCallback(() => setZoom(1), []);

  // Cmd / Ctrl + wheel zoom. Captures the wheel event on the canvas
  // container (passive: false so we can preventDefault, otherwise the
  // browser's page-zoom kicks in). Pinch on a trackpad fires the same
  // ctrlKey-modified wheel event.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setZoom((z) => clampZoom(z * factor));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [clampZoom]);

  // Cmd/Ctrl + (= / - / 0) keyboard shortcuts. Mounted on window so
  // the editor's other shortcuts and these don't fight; we only
  // intercept when the user isn't typing in an input field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (typing) return;

      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        zoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        zoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        resetZoom();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomIn, zoomOut, resetZoom]);

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
        "relative flex min-h-0 overflow-auto rounded-xl border border-border/60 p-4",
        // `safe center` falls back to flex-start when the canvas is
        // larger than the container — so when zoomed in, the user can
        // scroll all the way to the top-left edge instead of getting
        // stuck at a centered position they can't escape. When the
        // canvas is smaller, regular center kicks in.
        "[align-items:safe_center] [justify-content:safe_center]",
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
          // Slide background image overrides the grid; we drop the
          // grid pattern when an image is set so the canvas matches
          // the rendered PPT.
          backgroundImage: slide.backgroundImage
            ? `url(/api/uploads/${slide.backgroundImage})`
            : "linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)",
          backgroundSize: slide.backgroundImage
            ? "cover"
            : `${pxPerInch}px ${pxPerInch}px`,
          backgroundPosition: slide.backgroundImage ? "center" : undefined,
          backgroundRepeat: slide.backgroundImage ? "no-repeat" : undefined,
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

        {slide.widgets.length === 0 && !slide.backgroundImage ? (
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

      {/* Scale info: bottom-left, doesn't scroll with canvas */}
      <div className="text-muted-foreground/70 pointer-events-none absolute bottom-2 left-3 select-none font-mono text-[10px]">
        {Math.round(pxPerInch)} px/inch · {Math.round(canvasW)}×
        {Math.round(canvasH)} px
      </div>

      {/* Zoom controls: bottom-right. Always visible regardless of
          how the user has scrolled the canvas. */}
      <div className="bg-background/95 absolute bottom-2 right-3 flex items-center overflow-hidden rounded-lg border border-border/60 shadow-sm backdrop-blur-sm">
        <ZoomBtn onClick={zoomOut} disabled={zoom <= ZOOM_MIN + 0.001}>
          <Minus className="size-3.5" />
        </ZoomBtn>
        <button
          type="button"
          onClick={resetZoom}
          title="Reset zoom (⌘0)"
          className="hover:bg-muted text-foreground inline-flex h-7 min-w-12 items-center justify-center px-1.5 font-mono text-[11px] tabular-nums transition-colors"
        >
          {Math.round(zoom * 100)}%
        </button>
        <ZoomBtn onClick={zoomIn} disabled={zoom >= ZOOM_MAX - 0.001}>
          <Plus className="size-3.5" />
        </ZoomBtn>
        <div className="bg-border h-5 w-px" aria-hidden />
        <ZoomBtn onClick={resetZoom} title="Fit to screen (⌘0)">
          <Maximize2 className="size-3.5" />
        </ZoomBtn>
      </div>
    </div>
  );
}

function ZoomBtn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-7 items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
    >
      {children}
    </button>
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
