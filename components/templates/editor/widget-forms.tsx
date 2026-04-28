"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  DataSource,
  ImageWidgetConfig,
  KpiCardWidgetConfig,
  LineChartWidgetConfig,
  TextWidgetConfig,
  Widget,
} from "@/lib/reports/templates/types";
import { getAvailableMetrics } from "@/lib/reports/widgets/data-resolver";
import { ImageUploadField } from "./image-upload-field";

// ─── Form dispatcher ────────────────────────────────────────────────────
type Props = {
  widget: Widget;
  onUpdate: (updater: (w: Widget) => Widget) => void;
};

export function WidgetConfigForm({ widget, onUpdate }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <ConfigBody widget={widget} onUpdate={onUpdate} />
      <PositionFields widget={widget} onUpdate={onUpdate} />
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
    case "image":
      return (
        <ImageForm
          config={widget.config}
          onChange={(next) =>
            onUpdate((w) => (w.type === "image" ? { ...w, config: next } : w))
          }
        />
      );
    default:
      return (
        <Section title="Config">
          <p className="text-muted-foreground text-xs italic">
            Config form untuk widget &quot;{widget.type}&quot; belum di-build.
            Position bisa di-edit, config pakai default-nya.
          </p>
        </Section>
      );
  }
}

// ─── Section primitive ──────────────────────────────────────────────────
function Section({
  title,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = collapsible ? open : true;

  return (
    <div className="flex flex-col gap-2">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-muted-foreground hover:text-foreground -mx-1 flex items-center gap-1 rounded px-1 text-[10px] font-semibold uppercase tracking-wider transition-colors"
        >
          {isOpen ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
          {title}
        </button>
      ) : (
        <h4 className="text-muted-foreground/80 px-1 text-[10px] font-semibold uppercase tracking-wider">
          {title}
        </h4>
      )}
      {isOpen ? <div className="flex flex-col gap-2.5">{children}</div> : null}
    </div>
  );
}

// ─── Position fields (collapsible, defaults closed) ─────────────────────
function PositionFields({ widget, onUpdate }: Props) {
  return (
    <Section title="Position (inches)" collapsible defaultOpen={false}>
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
      <p className="text-muted-foreground text-[10px]">
        Tip: drag widget di canvas untuk reposition lebih cepat.
      </p>
    </Section>
  );
}

// ─── Field primitives ───────────────────────────────────────────────────
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {hint ? (
        <p className="text-muted-foreground text-[10px]">{hint}</p>
      ) : null}
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
      <Label className="text-[10px] font-medium uppercase text-muted-foreground">
        {label}
      </Label>
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
        className="h-8 text-sm tabular-nums"
      />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string; // hex without leading #
  onChange: (v: string) => void;
}) {
  function setHex(raw: string) {
    const cleaned = raw.replace(/^#/, "").slice(0, 6).toUpperCase();
    onChange(cleaned);
  }

  const isValid = /^[0-9A-F]{6}$/i.test(value);

  return (
    <Field label={label}>
      <div
        className={cn(
          "border-input bg-background flex h-8 items-center gap-1.5 rounded-md border pl-1.5 pr-2 transition-colors",
          "focus-within:ring-1 focus-within:ring-ring",
        )}
      >
        <label
          className={cn(
            "size-5 shrink-0 cursor-pointer overflow-hidden rounded border",
            !isValid && "border-destructive",
          )}
          style={{ backgroundColor: isValid ? `#${value}` : undefined }}
        >
          <input
            type="color"
            value={isValid ? `#${value}` : "#000000"}
            onChange={(e) => setHex(e.target.value)}
            className="invisible block size-0"
          />
        </label>
        <input
          value={value}
          onChange={(e) => setHex(e.target.value)}
          spellCheck={false}
          className="flex-1 bg-transparent font-mono text-xs uppercase outline-none"
          maxLength={6}
        />
      </div>
    </Field>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="hover:bg-muted/60 flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 cursor-pointer"
      />
      <span>{label}</span>
    </label>
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
    <Section title="Text">
      <Field label="Content">
        <textarea
          value={config.text}
          onChange={(e) => onChange({ ...config, text: e.target.value })}
          rows={3}
          placeholder="Tulis teks di sini…"
          className="border-input bg-background focus-visible:ring-ring rounded-md border px-2 py-1.5 text-sm outline-none transition-colors focus-visible:ring-1"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <NumField
          label="Size"
          value={config.fontSize}
          step={1}
          min={8}
          max={72}
          onChange={(v) => onChange({ ...config, fontSize: v })}
        />
        <ColorField
          label="Color"
          value={config.color}
          onChange={(v) => onChange({ ...config, color: v })}
        />
      </div>
      <Field label="Align">
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
      </Field>
      <div className="flex flex-col gap-0.5">
        <CheckboxField
          label="Bold"
          checked={config.bold}
          onChange={(v) => onChange({ ...config, bold: v })}
        />
        <CheckboxField
          label="Italic"
          checked={config.italic}
          onChange={(v) => onChange({ ...config, italic: v })}
        />
      </div>
    </Section>
  );
}

// ─── KPI card form ──────────────────────────────────────────────────────
const DATA_SOURCE_OPTIONS: { value: DataSource; label: string }[] = [
  { value: "ga4", label: "Google Analytics 4" },
  { value: "google_ads", label: "Google Ads" },
  { value: "search_console", label: "Search Console" },
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
    <>
      <Section title="Card">
        <Field label="Label">
          <Input
            value={config.label}
            onChange={(e) => onChange({ ...config, label: e.target.value })}
            placeholder="Total Sessions"
            className="h-8 text-sm"
          />
        </Field>
        <Field label="Format">
          <Select
            value={config.format}
            onValueChange={(v) =>
              v &&
              onChange({
                ...config,
                format: v as KpiCardWidgetConfig["format"],
              })
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
        </Field>
      </Section>

      <Section title="Data">
        <Field label="Source">
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
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Metric">
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
        </Field>
        <Field label="Date range">
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
        </Field>
        <CheckboxField
          label="Tampilkan delta vs previous"
          checked={config.showDelta}
          onChange={(v) => onChange({ ...config, showDelta: v })}
        />
      </Section>
    </>
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
    <>
      <Section title="Chart">
        <Field label="Title" hint="Kosongin untuk hide title.">
          <Input
            value={config.title}
            onChange={(e) => onChange({ ...config, title: e.target.value })}
            placeholder="Trend Sessions"
            className="h-8 text-sm"
          />
        </Field>
        <ColorField
          label="Line color"
          value={config.color}
          onChange={(v) => onChange({ ...config, color: v })}
        />
      </Section>

      <Section title="Data">
        <Field label="Source">
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
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Metric">
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
        </Field>
      </Section>

      <Section title="Display">
        <CheckboxField
          label="Show legend"
          checked={config.showLegend}
          onChange={(v) => onChange({ ...config, showLegend: v })}
        />
        <CheckboxField
          label="Show values di setiap titik"
          checked={config.showValues}
          onChange={(v) => onChange({ ...config, showValues: v })}
        />
      </Section>
    </>
  );
}

// ─── Image widget form ──────────────────────────────────────────────────
function ImageForm({
  config,
  onChange,
}: {
  config: ImageWidgetConfig;
  onChange: (next: ImageWidgetConfig) => void;
}) {
  return (
    <Section title="Image">
      <ImageUploadField
        imagePath={config.imagePath}
        onChange={(path) => onChange({ ...config, imagePath: path })}
      />
      <Field
        label="Alt text"
        hint="Untuk accessibility — dibaca screen reader saat orang lihat slide-nya."
      >
        <Input
          value={config.altText}
          onChange={(e) => onChange({ ...config, altText: e.target.value })}
          placeholder="contoh: Logo perusahaan"
          className="h-8 text-sm"
        />
      </Field>
      <Field
        label="Fit"
        hint="Contain: pertahankan rasio (mungkin ada area kosong). Cover: isi penuh box (mungkin terpotong)."
      >
        <Select
          value={config.fit}
          onValueChange={(v) =>
            v && onChange({ ...config, fit: v as ImageWidgetConfig["fit"] })
          }
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contain">Contain</SelectItem>
            <SelectItem value="cover">Cover</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </Section>
  );
}
