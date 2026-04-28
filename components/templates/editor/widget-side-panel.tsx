"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BarChart3,
  BringToFront,
  ChevronsDown,
  ChevronsUp,
  Heading,
  Image as ImageIcon,
  LayoutTemplate,
  LineChart,
  Minus,
  SendToBack,
  Shapes,
  Sparkles,
  Square,
  Table,
  Trash2,
  Type,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type Slide,
  type Widget,
  type WidgetType,
} from "@/lib/reports/templates/types";
import {
  buildDefaultWidget,
  WIDGET_CATEGORY_LABELS,
  WIDGET_PALETTE_ITEMS,
  type WidgetCategory,
} from "./widget-defaults";
import { SlideSettings } from "./slide-settings";
import { WidgetConfigForm } from "./widget-forms";

type ZOrderAction = "forward" | "backward" | "front" | "back";

type Props = {
  slide: Slide | null;
  selectedWidget: Widget | null;
  onAddWidget: (widget: Widget) => void;
  onUpdateWidget: (id: string, updater: (w: Widget) => Widget) => void;
  onDeleteWidget: (id: string) => void;
  onMoveWidget: (id: string, action: ZOrderAction) => void;
  onUpdateSlide: (id: string, patch: Partial<Slide>) => void;
  onClearSelection: () => void;
};

const ICONS: Record<WidgetType, typeof Type> = {
  text: Type,
  image: ImageIcon,
  shape: Shapes,
  divider: Minus,
  spacer: Square,
  cover_block: LayoutTemplate,
  kpi_card: Heading,
  line_chart: LineChart,
  bar_chart: BarChart3,
  table: Table,
  ai_narrative: Sparkles,
};

const CATEGORY_ORDER: WidgetCategory[] = ["layout", "data", "ai"];

// Shared transitions: keep all panel/list motion in the same easing
// family so multiple animations look like one orchestrated piece.
const SPRING = { type: "spring", stiffness: 380, damping: 32 } as const;
const FADE = { duration: 0.18, ease: "easeOut" } as const;

export function WidgetSidePanel({
  slide,
  selectedWidget,
  onAddWidget,
  onUpdateWidget,
  onDeleteWidget,
  onMoveWidget,
  onUpdateSlide,
  onClearSelection,
}: Props) {
  // No slide selected — empty state
  if (!slide) {
    return (
      <PanelShell>
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-muted-foreground text-sm">Pilih slide dulu.</p>
        </div>
      </PanelShell>
    );
  }

  // Index of the selected widget within its slide. Used to disable the
  // forward/back buttons when already at the top/bottom of the stack.
  const selectedIndex = selectedWidget
    ? slide.widgets.findIndex((w) => w.id === selectedWidget.id)
    : -1;
  const widgetCount = slide.widgets.length;

  return (
    <PanelShell>
      <AnimatePresence mode="wait" initial={false}>
        {selectedWidget ? (
          <motion.div
            key="config"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={FADE}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <WidgetConfigPanel
              widget={selectedWidget}
              selectedIndex={selectedIndex}
              widgetCount={widgetCount}
              onUpdate={(updater) => onUpdateWidget(selectedWidget.id, updater)}
              onDelete={() => onDeleteWidget(selectedWidget.id)}
              onMove={(action) => onMoveWidget(selectedWidget.id, action)}
              onClose={onClearSelection}
            />
          </motion.div>
        ) : (
          <motion.div
            key="palette"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={FADE}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {/* Single scroll container for slide settings + widget
                palette — avoids nested scroll bars. SlideSettings
                sits on top, palette flows underneath. */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <SlideSettings
                slide={slide}
                onUpdate={(patch) => onUpdateSlide(slide.id, patch)}
              />
              <WidgetPalette onAdd={onAddWidget} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PanelShell>
  );
}

// ─── Shared shell ───────────────────────────────────────────────────────
function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card flex min-h-0 flex-col overflow-hidden rounded-xl border border-border/60 shadow-sm">
      {children}
    </div>
  );
}

function PanelHeader({
  title,
  hint,
  trailing,
}: {
  title: React.ReactNode;
  hint?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="bg-muted/30 flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {title}
        </span>
        {hint ? (
          <span className="text-muted-foreground/80 text-[11px]">{hint}</span>
        ) : null}
      </div>
      {trailing ?? null}
    </div>
  );
}

// ─── Palette ────────────────────────────────────────────────────────────
function WidgetPalette({ onAdd }: { onAdd: (widget: Widget) => void }) {
  const grouped = useMemo(() => {
    const map = new Map<WidgetCategory, typeof WIDGET_PALETTE_ITEMS>();
    for (const item of WIDGET_PALETTE_ITEMS) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return CATEGORY_ORDER.map((cat) => ({
      category: cat,
      items: map.get(cat) ?? [],
    })).filter((g) => g.items.length > 0);
  }, []);

  return (
    <>
      <PanelHeader title="Add widget" hint="Klik untuk tambah ke slide aktif." />
      <div className="flex flex-col gap-4 p-3">
        {grouped.map(({ category, items }, gi) => (
          <motion.section
            key={category}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...FADE, delay: gi * 0.04 }}
            className="flex flex-col gap-1.5"
          >
            <h4 className="text-muted-foreground/70 px-1 text-[10px] font-semibold uppercase tracking-[0.08em]">
              {WIDGET_CATEGORY_LABELS[category]}
            </h4>
            <ul className="flex flex-col gap-0.5">
              {items.map((item, i) => {
                const Icon = ICONS[item.type];
                const enabled = item.enabled !== false;
                return (
                  <motion.li
                    key={item.type}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.18,
                      ease: "easeOut",
                      delay: gi * 0.04 + i * 0.02,
                    }}
                  >
                    <motion.button
                      type="button"
                      disabled={!enabled}
                      whileHover={enabled ? { x: 2 } : undefined}
                      whileTap={enabled ? { scale: 0.98 } : undefined}
                      transition={SPRING}
                      onClick={() => {
                        if (!enabled) return;
                        onAdd(buildDefaultWidget(item.type));
                      }}
                      className={cn(
                        "group flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition-colors",
                        enabled
                          ? "hover:bg-accent"
                          : "cursor-not-allowed opacity-40",
                      )}
                    >
                      <div
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                          enabled
                            ? "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                            : "bg-muted/60 text-muted-foreground",
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-sm font-medium leading-snug">
                          {item.label}
                          {!enabled ? (
                            <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide">
                              soon
                            </span>
                          ) : null}
                        </div>
                        <div className="text-muted-foreground text-[11px] leading-snug">
                          {item.description}
                        </div>
                      </div>
                    </motion.button>
                  </motion.li>
                );
              })}
            </ul>
          </motion.section>
        ))}
      </div>
    </>
  );
}

// ─── Config Panel ───────────────────────────────────────────────────────
function WidgetConfigPanel({
  widget,
  selectedIndex,
  widgetCount,
  onUpdate,
  onDelete,
  onMove,
  onClose,
}: {
  widget: Widget;
  selectedIndex: number;
  widgetCount: number;
  onUpdate: (updater: (w: Widget) => Widget) => void;
  onDelete: () => void;
  onMove: (action: ZOrderAction) => void;
  onClose: () => void;
}) {
  const Icon = ICONS[widget.type];
  const labelMap: Record<WidgetType, string> = {
    text: "Text",
    image: "Image",
    shape: "Shape",
    divider: "Divider",
    spacer: "Spacer",
    cover_block: "Cover Block",
    kpi_card: "KPI Card",
    line_chart: "Line Chart",
    bar_chart: "Bar Chart",
    table: "Table",
    ai_narrative: "AI Insight",
  };

  const isFirst = selectedIndex <= 0;
  const isLast = selectedIndex >= widgetCount - 1;

  return (
    <>
      <div className="bg-muted/30 flex items-center gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Widget
          </span>
          <span className="text-sm font-medium leading-tight">
            {labelMap[widget.type]}
          </span>
        </div>
        <motion.button
          type="button"
          onClick={onClose}
          aria-label="Tutup config"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          transition={SPRING}
          className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-8 items-center justify-center rounded-lg transition-colors"
        >
          <X className="size-4" />
        </motion.button>
      </div>

      {/* Layer order toolbar */}
      <div className="bg-muted/20 flex items-center gap-1 border-b border-border/60 px-3 py-2">
        <span className="text-muted-foreground mr-1 text-[10px] font-semibold uppercase tracking-[0.08em]">
          Layer
        </span>
        <ZOrderButton
          label="Send to back"
          shortcut="⌘⇧["
          icon={SendToBack}
          disabled={isFirst}
          onClick={() => onMove("back")}
        />
        <ZOrderButton
          label="Send backward"
          shortcut="⌘["
          icon={ChevronsDown}
          disabled={isFirst}
          onClick={() => onMove("backward")}
        />
        <ZOrderButton
          label="Bring forward"
          shortcut="⌘]"
          icon={ChevronsUp}
          disabled={isLast}
          onClick={() => onMove("forward")}
        />
        <ZOrderButton
          label="Bring to front"
          shortcut="⌘⇧]"
          icon={BringToFront}
          disabled={isLast}
          onClick={() => onMove("front")}
        />
        <span className="text-muted-foreground/70 ml-auto text-[10px] tabular-nums">
          {selectedIndex + 1} / {widgetCount}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <WidgetConfigForm widget={widget} onUpdate={onUpdate} />
      </div>

      <div className="bg-muted/30 border-t border-border/60 p-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full justify-start"
        >
          <Trash2 className="size-4" />
          Hapus widget
        </Button>
      </div>
    </>
  );
}

function ZOrderButton({
  label,
  shortcut,
  icon: Icon,
  disabled,
  onClick,
}: {
  label: string;
  shortcut: string;
  icon: typeof Type;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.05 }}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      transition={SPRING}
      title={`${label} (${shortcut})`}
      aria-label={label}
      className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-7 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
    >
      <Icon className="size-3.5" />
    </motion.button>
  );
}
