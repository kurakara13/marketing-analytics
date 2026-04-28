"use client";

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
  Type,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  type Slide,
  type Widget,
  type WidgetType,
} from "@/lib/reports/templates/types";
import {
  buildDefaultWidget,
  WIDGET_PALETTE_ITEMS,
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
      <div className="bg-muted/30 flex items-center justify-center rounded-md border p-4">
        <p className="text-muted-foreground text-sm">Pilih slide dulu.</p>
      </div>
    );
  }

  // Widget selected — show config form
  if (selectedWidget) {
    return (
      <div className="bg-muted/30 flex min-h-0 flex-col gap-3 rounded-md border p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Widget Config
            </div>
            <div className="text-sm font-semibold">
              {selectedWidget.type.replace(/_/g, " ")}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClearSelection}
            aria-label="Close config"
          >
            <X className="size-4" />
          </Button>
        </div>

        <Separator />

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
          <WidgetConfigForm
            widget={selectedWidget}
            onUpdate={(updater) => onUpdateWidget(selectedWidget.id, updater)}
          />
        </div>

        <Separator />

        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => onDeleteWidget(selectedWidget.id)}
        >
          Hapus widget
        </Button>
      </div>
    );
  }

  // Nothing selected — show palette
  return (
    <div className="bg-muted/30 flex min-h-0 flex-col gap-3 rounded-md border p-3">
      <div>
        <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Add Widget
        </div>
        <p className="text-muted-foreground text-xs">
          Klik untuk tambah ke slide aktif.
        </p>
      </div>

      <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {WIDGET_PALETTE_ITEMS.map((item) => {
          const Icon = ICONS[item.type];
          const enabled = item.enabled !== false;
          return (
            <li key={item.type}>
              <button
                type="button"
                disabled={!enabled}
                onClick={() => {
                  if (!enabled) return;
                  onAddWidget(buildDefaultWidget(item.type));
                }}
                className="hover:bg-background disabled:hover:bg-transparent flex w-full items-start gap-3 rounded-md p-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {item.label}
                    {!enabled ? (
                      <span className="text-muted-foreground ml-1 text-xs">
                        (segera)
                      </span>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {item.description}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
