import {
  coverBlockWidgetConfigSchema,
  type CoverBlockWidgetConfig,
} from "@/lib/reports/templates/types";
import { registerWidget, type WidgetDefinition } from "./registry";

const FONT_FACE = "Calibri";

// Cover block — full-bleed title + subtitle (+ optional date / week
// number) for slide 1. Renders as a colored rectangle with stacked
// text. Useful when the user doesn't want to bother with separate
// shape + text widgets for a simple cover.
const definition: WidgetDefinition<{
  id: string;
  type: "cover_block";
  position: { x: number; y: number; w: number; h: number };
  config: CoverBlockWidgetConfig;
}> = {
  type: "cover_block",
  configSchemaVersion: 1,
  defaultPosition: { x: 1, y: 2, w: 11, h: 3 },
  defaultConfig: coverBlockWidgetConfigSchema.parse({
    title: "Report Title",
    subtitle: "",
  }),
  label: "Cover Block",
  description: "Title + subtitle + tanggal untuk slide cover.",

  render({ slide, widget, context }) {
    const { config, position } = widget;

    // Background rectangle.
    slide.addShape("rect", {
      x: position.x,
      y: position.y,
      w: position.w,
      h: position.h,
      fill: { type: "solid", color: config.bgColor },
      line: { type: "none" },
    });

    // Vertical layout inside the box: title at ~40% from top, subtitle
    // beneath, date pinned bottom-left if shown.
    const padX = 0.5;
    const innerX = position.x + padX;
    const innerW = position.w - 2 * padX;

    // Title ─────────────────────────────────────────────────────────
    if (config.title) {
      slide.addText(config.title, {
        x: innerX,
        y: position.y + position.h * 0.32,
        w: innerW,
        h: position.h * 0.25,
        fontFace: FONT_FACE,
        fontSize: 32,
        bold: true,
        color: config.titleColor,
        align: "left",
        valign: "middle",
      });
    }

    // Subtitle ──────────────────────────────────────────────────────
    if (config.subtitle) {
      slide.addText(config.subtitle, {
        x: innerX,
        y: position.y + position.h * 0.58,
        w: innerW,
        h: position.h * 0.18,
        fontFace: FONT_FACE,
        fontSize: 16,
        color: config.titleColor,
        align: "left",
        valign: "middle",
      });
    }

    // Date / week footer ────────────────────────────────────────────
    if (config.showDate || config.showWeekNumber) {
      const parts: string[] = [];
      if (config.showWeekNumber && context.reportData.weekNumber) {
        parts.push(`W${context.reportData.weekNumber}`);
      }
      if (config.showDate) {
        parts.push(context.reportData.windowLabel);
      }
      const footer = parts.join(" — ");
      if (footer) {
        slide.addText(footer, {
          x: innerX,
          y: position.y + position.h - 0.6,
          w: innerW,
          h: 0.4,
          fontFace: FONT_FACE,
          fontSize: 12,
          italic: true,
          color: config.titleColor,
          align: "left",
        });
      }
    }
  },
};

registerWidget(definition);
