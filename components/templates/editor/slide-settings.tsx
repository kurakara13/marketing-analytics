"use client";

import { motion } from "motion/react";
import { CalendarRange, Palette } from "lucide-react";

import type { Slide } from "@/lib/reports/templates/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUploadField } from "./image-upload-field";

type Props = {
  slide: Slide;
  onUpdate: (patch: Partial<Slide>) => void;
};

const FADE = { duration: 0.18, ease: "easeOut" } as const;

// Slide-level settings card — sits at the top of the right panel
// when no widget is selected. Background color + optional background
// image. The image, when set, overrides the flat color in both the
// canvas preview and the rendered PPT.
export function SlideSettings({ slide, onUpdate }: Props) {
  const hasImage = Boolean(slide.backgroundImage);

  return (
    <motion.section
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={FADE}
      className="flex flex-col gap-3 border-b border-border/60 bg-muted/30 px-4 py-3"
    >
      <div className="flex items-center gap-1.5">
        <Palette className="text-muted-foreground size-3.5" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Slide
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium">Background color</label>
        <ColorRow
          value={slide.background}
          onChange={(v) => onUpdate({ background: v })}
          dimmed={hasImage}
        />
        {hasImage ? (
          <p className="text-muted-foreground text-[10px]">
            Background image aktif — color jadi fallback kalau image
            failed load.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium">Background image</label>
        <ImageUploadField
          imagePath={slide.backgroundImage}
          onChange={(path) => onUpdate({ backgroundImage: path })}
        />
        <p className="text-muted-foreground text-[10px]">
          Optional — kalau di-upload, akan jadi background full-bleed
          slide ini saja (cover fit, ter-crop kalau aspect ratio beda).
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <CalendarRange className="text-muted-foreground size-3.5" />
          <label className="text-xs font-medium">Period override</label>
        </div>
        <Select
          value={slide.periodOverride ?? "_inherit"}
          onValueChange={(v) =>
            onUpdate({
              periodOverride:
                v === "_inherit" ? null : (v as "weekly" | "monthly"),
            })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_inherit">Inherit dari template</SelectItem>
            <SelectItem value="weekly">Weekly (7 hari)</SelectItem>
            <SelectItem value="monthly">Monthly (calendar bulan)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-[10px]">
          Override periode untuk slide ini saja — bikin laporan satu PPT
          yang campur slide weekly + monthly. Default = ikut template.
        </p>
      </div>
    </motion.section>
  );
}

function ColorRow({
  value,
  onChange,
  dimmed,
}: {
  value: string;
  onChange: (v: string) => void;
  dimmed?: boolean;
}) {
  function setHex(raw: string) {
    onChange(raw.replace(/^#/, "").slice(0, 6).toUpperCase());
  }
  const isValid = /^[0-9A-Fa-f]{6}$/.test(value);

  return (
    <div
      className={[
        "border-input bg-background flex h-8 items-center gap-1.5 rounded-md border pl-1.5 pr-2 transition-colors",
        "focus-within:ring-1 focus-within:ring-ring",
        dimmed ? "opacity-60" : "",
      ].join(" ")}
    >
      <label
        className={[
          "size-5 shrink-0 cursor-pointer overflow-hidden rounded border",
          isValid ? "" : "border-destructive",
        ].join(" ")}
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
  );
}
