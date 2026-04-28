import {
  dividerWidgetConfigSchema,
  type DividerWidgetConfig,
} from "@/lib/reports/templates/types";
import { registerWidget, type WidgetDefinition } from "./registry";

// Divider — single straight line drawn as a pptxgenjs `line` shape.
// Honors `orientation`: horizontal lines extend across `position.w`,
// vertical lines down `position.h`. Thickness maps directly to PPT
// line width (in points).
const definition: WidgetDefinition<{
  id: string;
  type: "divider";
  position: { x: number; y: number; w: number; h: number };
  config: DividerWidgetConfig;
}> = {
  type: "divider",
  configSchemaVersion: 1,
  defaultPosition: { x: 1, y: 3.5, w: 11, h: 0.05 },
  defaultConfig: dividerWidgetConfigSchema.parse({}),
  label: "Divider",
  description: "Garis horizontal/vertikal untuk pemisah.",

  render({ slide, widget }) {
    const { config, position } = widget;

    // pptxgenjs has a "line" preset shape. We collapse one axis to
    // make it a true line: horizontal → h=0, vertical → w=0. The
    // width property of the line (in pt) draws the visible stroke
    // regardless of the bounding box dimension on the collapsed axis.
    const isHorizontal = config.orientation === "horizontal";

    slide.addShape("line", {
      x: position.x,
      y: position.y,
      w: isHorizontal ? position.w : 0,
      h: isHorizontal ? 0 : position.h,
      line: {
        color: config.color,
        width: config.thickness,
      },
    });
  },
};

registerWidget(definition);
