"use client";

import { useMemo } from "react";
import {
  BarChart3,
  Heading,
  Image as ImageIcon,
  LayoutTemplate,
  LineChart,
  Minus,
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
import { WidgetConfigForm } from "./widget-forms";

type Props = {
  slide: Slide | null;
  selectedWidget: Widget | null;
  onAddWidget: (widget: Widget) => void;
  onUpdateWidget: (id: string, updater: (w: Widget) => Widget) => void;
  onDeleteWidget: (id: string) => void;
  onClearSelection: () => void;
};

const ICONS: Record<WidgetType, typeof Type> = {
  text: Type,
  image: ImageIcon,
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

export function WidgetSidePanel({
  slide,
  selectedWidget,
  onAddWidget,
  onUpdateWidget,
  onDeleteWidget,
  onClearSelection,
}: Props) {
  // No slide selected — empty state
  if (!slide) {
    return (
      <div className="bg-muted/30 flex items-center justify-center rounded-lg border p-4">
        <p className="text-muted-foreground text-sm">Pilih slide dulu.</p>
      </div>
    );
  }

  // Widget selected — show config form
  if (selectedWidget) {
    return (
      <WidgetConfigPanel
        widget={selectedWidget}
        onUpdate={(updater) => onUpdateWidget(selectedWidget.id, updater)}
        onDelete={() => onDeleteWidget(selectedWidget.id)}
        onClose={onClearSelection}
      />
    );
  }

  // Nothing selected — show palette
  return <WidgetPalette onAdd={onAddWidget} />;
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
    <div className="bg-muted/30 flex min-h-0 flex-col overflow-hidden rounded-lg border">
      <div className="flex flex-col gap-0.5 border-b bg-background/40 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Add widget
        </span>
        <span className="text-muted-foreground text-[11px]">
          Klik untuk tambah ke slide aktif.
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2">
        {grouped.map(({ category, items }) => (
          <section key={category} className="flex flex-col gap-1">
            <h4 className="text-muted-foreground/70 px-1 text-[10px] font-semibold uppercase tracking-wider">
              {WIDGET_CATEGORY_LABELS[category]}
            </h4>
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => {
                const Icon = ICONS[item.type];
                const enabled = item.enabled !== false;
                return (
                  <li key={item.type}>
                    <button
                      type="button"
                      disabled={!enabled}
                      onClick={() => {
                        if (!enabled) return;
                        onAdd(buildDefaultWidget(item.type));
                      }}
                      className={cn(
                        "group flex w-full items-start gap-2.5 rounded-md p-2 text-left transition-colors",
                        enabled
                          ? "hover:bg-background"
                          : "cursor-not-allowed opacity-40",
                      )}
                    >
                      <div
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
                          enabled
                            ? "bg-background text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          {item.label}
                          {!enabled ? (
                            <span className="text-muted-foreground rounded bg-muted px-1 py-0.5 text-[9px] font-normal uppercase tracking-wide">
                              soon
                            </span>
                          ) : null}
                        </div>
                        <div className="text-muted-foreground text-[11px] leading-tight">
                          {item.description}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

// ─── Config Panel ───────────────────────────────────────────────────────
function WidgetConfigPanel({
  widget,
  onUpdate,
  onDelete,
  onClose,
}: {
  widget: Widget;
  onUpdate: (updater: (w: Widget) => Widget) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const Icon = ICONS[widget.type];
  const labelMap: Record<WidgetType, string> = {
    text: "Text",
    image: "Image",
    divider: "Divider",
    spacer: "Spacer",
    cover_block: "Cover Block",
    kpi_card: "KPI Card",
    line_chart: "Line Chart",
    bar_chart: "Bar Chart",
    table: "Table",
    ai_narrative: "AI Insight",
  };

  return (
    <div className="bg-muted/30 flex min-h-0 flex-col overflow-hidden rounded-lg border">
      <div className="flex items-center gap-2 border-b bg-background/40 px-3 py-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-3.5" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Widget
          </span>
          <span className="text-sm font-medium leading-tight">
            {labelMap[widget.type]}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup config"
          className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-7 items-center justify-center rounded-md transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
        <WidgetConfigForm widget={widget} onUpdate={onUpdate} />
      </div>

      <div className="border-t bg-background/40 p-2">
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
    </div>
  );
}
