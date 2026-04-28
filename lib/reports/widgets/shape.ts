import {
  shapeWidgetConfigSchema,
  type ShapeKind,
  type ShapeWidgetConfig,
} from "@/lib/reports/templates/types";
import { registerWidget, type WidgetDefinition } from "./registry";

// Shape widget — fills a geometric primitive with a solid color and
// optional border. Maps directly onto pptxgenjs preset shapes; we use
// these names verbatim so what you pick in the editor lines up 1:1
// with the PPT output.
const SHAPE_PPT_NAME: Record<ShapeKind, string> = {
  rect: "rect",
  roundRect: "roundRect",
  ellipse: "ellipse",
  triangle: "triangle",
  rightTriangle: "rtTriangle",
  parallelogram: "parallelogram",
  trapezoid: "trapezoid",
  diamond: "diamond",
  line: "line",
};

const definition: WidgetDefinition<{
  id: string;
  type: "shape";
  position: { x: number; y: number; w: number; h: number };
  config: ShapeWidgetConfig;
}> = {
  type: "shape",
  configSchemaVersion: 1,
  defaultPosition: { x: 1, y: 1, w: 3, h: 2 },
  defaultConfig: shapeWidgetConfigSchema.parse({}),
  label: "Shape",
  description: "Geometric primitive — kotak, segitiga, parallelogram, dll.",

  render({ slide, widget }) {
    const { config, position } = widget;
    const pptShape = SHAPE_PPT_NAME[config.kind];

    // pptxgenjs FillProps:
    //   { type: "solid", color, transparency }  — transparency 0..100
    //   { type: "none" }
    // We map fillOpacity (0..1) → transparency (100..0).
    const fill =
      config.fillOpacity <= 0
        ? { type: "none" as const }
        : {
            type: "solid" as const,
            color: config.fillColor,
            transparency: Math.round((1 - config.fillOpacity) * 100),
          };

    slide.addShape(pptShape as Parameters<typeof slide.addShape>[0], {
      x: position.x,
      y: position.y,
      w: position.w,
      h: position.h,
      fill,
      line:
        config.borderWidth > 0
          ? {
              color: config.borderColor,
              width: config.borderWidth,
            }
          : { type: "none" },
      rotate: config.rotation || 0,
    });
  },
};

registerWidget(definition);
