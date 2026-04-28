import {
  textWidgetConfigSchema,
  type TextWidgetConfig,
} from "@/lib/reports/templates/types";
import { registerWidget, type WidgetDefinition } from "./registry";

const FONT_FACE = "Calibri";

const definition: WidgetDefinition<{
  id: string;
  type: "text";
  position: { x: number; y: number; w: number; h: number };
  config: TextWidgetConfig;
}> = {
  type: "text",
  configSchemaVersion: 1,
  defaultPosition: { x: 1, y: 1, w: 6, h: 0.6 },
  defaultConfig: textWidgetConfigSchema.parse({}),
  label: "Text",
  description: "Static text — heading, paragraph, or label.",

  render({ slide, widget }) {
    const { config, position } = widget;
    if (!config.text) return; // empty widget; render nothing.

    slide.addText(config.text, {
      x: position.x,
      y: position.y,
      w: position.w,
      h: position.h,
      fontFace: FONT_FACE,
      fontSize: config.fontSize,
      bold: config.bold,
      italic: config.italic,
      color: config.color,
      align: config.align,
      valign: "top",
    });
  },
};

registerWidget(definition);
