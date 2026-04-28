import {
  spacerWidgetConfigSchema,
  type SpacerWidgetConfig,
} from "@/lib/reports/templates/types";
import { registerWidget, type WidgetDefinition } from "./registry";

// Spacer — purely a layout reservation. Doesn't draw anything in the
// final PPT output; its only purpose is to claim a region of the slide
// in the editor canvas so other widgets snap around it. PPT itself
// has no native spacer — we just no-op the render.
const definition: WidgetDefinition<{
  id: string;
  type: "spacer";
  position: { x: number; y: number; w: number; h: number };
  config: SpacerWidgetConfig;
}> = {
  type: "spacer",
  configSchemaVersion: 1,
  defaultPosition: { x: 1, y: 1, w: 1, h: 1 },
  defaultConfig: spacerWidgetConfigSchema.parse({}),
  label: "Spacer",
  description: "Spacing kosong untuk layout — tidak terlihat di PPT.",

  render() {
    // Intentionally empty. The editor canvas shows a placeholder; the
    // exported .pptx has no element here.
  },
};

registerWidget(definition);
