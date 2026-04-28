"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  DataSource,
  KpiCardWidgetConfig,
  LineChartWidgetConfig,
  TextWidgetConfig,
  Widget,
} from "@/lib/reports/templates/types";
import { getAvailableMetrics } from "@/lib/reports/widgets/data-resolver";

// ─── Form dispatcher ────────────────────────────────────────────────────
//
// Renders the right config form for the given widget type. Per-widget
// forms are colocated below — small enough to stay in one file.
//
// The forms always have two sections: position (x/y/w/h) and config.
// Position is shared across all types; config is type-specific.
type Props = {
  widget: Widget;
  onUpdate: (updater: (w: Widget) => Widget) => void;
};

export function WidgetConfigForm({ widget, onUpdate }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <PositionFields widget={widget} onUpdate={onUpdate} />

      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Config
        </h4>
        <ConfigBody widget={widget} onUpdate={onUpdate} />
      </div>
    </div>
  );
}

function ConfigBody({ widget, onUpdate }: Props) {
  switch (widget.type) {
    case "text":
      return (
        <TextForm
          config={widget.config}
          onChange={(next) =>
            onUpdate((w) => (w.type === "text" ? { ...w, config: next } : w))
          }
        />
      );
    case "kpi_card":
      return (
        <KpiCardForm
          config={widget.config}
          onChange={(next) =>
            onUpdate((w) =>
              w.type === "kpi_card" ? { ...w, config: next } : w,
            )
          }
        />
      );
    case "line_chart":
      return (
        <LineChartForm
          config={widget.config}
          onChange={(next) =>
            onUpdate((w) =>
              w.type === "line_chart" ? { ...w, config: next } : w,
            )
          }
        />
      );
    default:
      return (
        <p className="text-muted-foreground text-xs italic">
          Config form untuk widget &quot;{widget.type}&quot; belum di-build.
          Position bisa di-edit, config pakai default-nya untuk sekarang.
        </p>
      );
  }
}

// ─── Position fields (shared) ───────────────────────────────────────────
function PositionFields({ widget, onUpdate }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
        Position (inches)
      </h4>
      <div className="grid grid-cols-2 gap-2">
        <NumField
          label="X"
          value={widget.position.x}
          step={0.05}
          min={0}
          max={13.333}
          onChange={(v) =>
            onUpdate((w) => ({ ...w, position: { ...w.position, x: v } }))
          }
        />
        <NumField
          label="Y"
          value={widget.position.y}
          step={0.05}
          min={0}
          max={7.5}
          onChange={(v) =>
            onUpdate((w) => ({ ...w, position: { ...w.position, y: v } }))
          }
        />
        <NumField
          label="W"
          value={widget.position.w}
          step={0.05}
          min={0.1}
          max={13.333}
          onChange={(v) =>
            onUpdate((w) => ({ ...w, position: { ...w.position, w: v } }))
          }
        />
        <NumField
          label="H"
          value={widget.position.h}
          step={0.05}
          min={0.1}
          max={7.5}
          onChange={(v) =>
            onUpdate((w) => ({ ...w, position: { ...w.position, h: v } }))
          }
        />
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  step,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="h-8 text-sm"
      />
    </div>
  );
}

// ─── Text widget form ───────────────────────────────────────────────────
function TextForm({
  config,
  onChange,
}: {
  config: TextWidgetConfig;
  onChange: (next: TextWidgetConfig) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Text</Label>
        <textarea
          value={config.text}
          onChange={(e) => onChange({ ...config, text: e.target.value })}
          rows={3}
          className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumField
          label="Font size"
          value={config.fontSize}
          step={1}
          min={8}
          max={72}
          onChange={(v) => onChange({ ...config, fontSize: v })}
        />
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Color (hex)</Label>
          <Input
            value={config.color}
            onChange={(e) =>
              onChange({
                ...config,
                color: e.target.value.replace(/^#/, "").slice(0, 6),
              })
            }
            className="h-8 font-mono text-sm"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Align</Label>
        <Select
          value={config.align}
          onValueChange={(v) =>
            v && onChange({ ...config, align: v as TextWidgetConfig["align"] })
          }
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-3 text-sm">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={config.bold}
            onChange={(e) => onChange({ ...config, bold: e.target.checked })}
          />
          Bold
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={config.italic}
            onChange={(e) => onChange({ ...config, italic: e.target.checked })}
          />
          Italic
        </label>
      </div>
    </div>
  );
}

// ─── KPI card form ──────────────────────────────────────────────────────
const DATA_SOURCE_OPTIONS: DataSource[] = [
  "ga4",
  "google_ads",
  "search_console",
];

function KpiCardForm({
  config,
  onChange,
}: {
  config: KpiCardWidgetConfig;
  onChange: (next: KpiCardWidgetConfig) => void;
}) {
  const metrics = getAvailableMetrics(config.dataSource);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Label</Label>
        <Input
          value={config.label}
          onChange={(e) => onChange({ ...config, label: e.target.value })}
          className="h-8 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Data source</Label>
        <Select
          value={config.dataSource}
          onValueChange={(v) => {
            if (!v) return;
            const next = v as DataSource;
            const newMetrics = getAvailableMetrics(next);
            onChange({
              ...config,
              dataSource: next,
              metric: newMetrics[0] ?? config.metric,
            });
          }}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATA_SOURCE_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Metric</Label>
        <Select
          value={config.metric}
          onValueChange={(v) => v && onChange({ ...config, metric: v })}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {metrics.length === 0 ? (
              <SelectItem value="__none__" disabled>
                (no metrics)
              </SelectItem>
            ) : (
              metrics.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Format</Label>
        <Select
          value={config.format}
          onValueChange={(v) =>
            v && onChange({ ...config, format: v as KpiCardWidgetConfig["format"] })
          }
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="number">Number</SelectItem>
            <SelectItem value="currency_idr">Rupiah (Rp)</SelectItem>
            <SelectItem value="percent">Percent</SelectItem>
            <SelectItem value="duration_seconds">Duration (s)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Date range</Label>
        <Select
          value={config.dateRange.kind}
          onValueChange={(v) => {
            if (!v) return;
            onChange({
              ...config,
              dateRange:
                v === "current_window"
                  ? { kind: "current_window" }
                  : { kind: "previous_window" },
            });
          }}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current_window">Current window</SelectItem>
            <SelectItem value="previous_window">Previous window</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <label className="flex items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          checked={config.showDelta}
          onChange={(e) => onChange({ ...config, showDelta: e.target.checked })}
        />
        Show delta
      </label>
    </div>
  );
}

// ─── Line chart form ────────────────────────────────────────────────────
function LineChartForm({
  config,
  onChange,
}: {
  config: LineChartWidgetConfig;
  onChange: (next: LineChartWidgetConfig) => void;
}) {
  const metrics = getAvailableMetrics(config.dataSource);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Title</Label>
        <Input
          value={config.title}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
          placeholder="(opsional)"
          className="h-8 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Data source</Label>
        <Select
          value={config.dataSource}
          onValueChange={(v) => {
            if (!v) return;
            const next = v as DataSource;
            const newMetrics = getAvailableMetrics(next);
            onChange({
              ...config,
              dataSource: next,
              metric: newMetrics[0] ?? config.metric,
            });
          }}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATA_SOURCE_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Metric</Label>
        <Select
          value={config.metric}
          onValueChange={(v) => v && onChange({ ...config, metric: v })}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {metrics.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Color (hex)</Label>
        <Input
          value={config.color}
          onChange={(e) =>
            onChange({
              ...config,
              color: e.target.value.replace(/^#/, "").slice(0, 6),
            })
          }
          className="h-8 font-mono text-sm"
        />
      </div>
      <div className="flex gap-3 text-sm">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={config.showLegend}
            onChange={(e) =>
              onChange({ ...config, showLegend: e.target.checked })
            }
          />
          Legend
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={config.showValues}
            onChange={(e) =>
              onChange({ ...config, showValues: e.target.checked })
            }
          />
          Values
        </label>
      </div>
    </div>
  );
}
