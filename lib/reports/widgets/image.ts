import {
  imageWidgetConfigSchema,
  type ImageWidgetConfig,
} from "@/lib/reports/templates/types";
import { readStoredImage } from "@/lib/storage";
import { registerWidget, type WidgetDefinition } from "./registry";

const FONT_FACE = "Calibri";

const definition: WidgetDefinition<{
  id: string;
  type: "image";
  position: { x: number; y: number; w: number; h: number };
  config: ImageWidgetConfig;
}> = {
  type: "image",
  configSchemaVersion: 1,
  defaultPosition: { x: 4, y: 2, w: 4, h: 3 },
  defaultConfig: imageWidgetConfigSchema.parse({}),
  label: "Image",
  description: "Logo atau gambar yang di-upload.",

  async render({ slide, widget }) {
    const { config, position } = widget;

    if (!config.imagePath) {
      // No image picked — render a faint placeholder rectangle so
      // empty image widgets don't disappear silently.
      slide.addShape("rect", {
        x: position.x,
        y: position.y,
        w: position.w,
        h: position.h,
        fill: { color: "F1F5F9" },
        line: { color: "CBD5E1", dashType: "dash", width: 0.75 },
      });
      slide.addText("(no image)", {
        x: position.x,
        y: position.y + position.h / 2 - 0.15,
        w: position.w,
        h: 0.3,
        fontFace: FONT_FACE,
        fontSize: 11,
        italic: true,
        color: "94A3B8",
        align: "center",
      });
      return;
    }

    const file = await readStoredImage(config.imagePath);
    if (!file) {
      // Path was set but file missing (deleted, moved). Render the
      // same placeholder + a brief diagnostic.
      slide.addShape("rect", {
        x: position.x,
        y: position.y,
        w: position.w,
        h: position.h,
        fill: { color: "FEF2F2" },
        line: { color: "FCA5A5", width: 0.75 },
      });
      slide.addText("(image missing)", {
        x: position.x,
        y: position.y + position.h / 2 - 0.15,
        w: position.w,
        h: 0.3,
        fontFace: FONT_FACE,
        fontSize: 11,
        italic: true,
        color: "DC2626",
        align: "center",
      });
      return;
    }

    // Convert to a base64 data URI so pptxgenjs can embed the image
    // directly into the .pptx archive (no external fetch at open time).
    const base64 = file.buffer.toString("base64");
    const dataUri = `data:${file.contentType};base64,${base64}`;

    slide.addImage({
      data: dataUri,
      x: position.x,
      y: position.y,
      w: position.w,
      h: position.h,
      // pptxgenjs sizing: "contain" preserves aspect ratio inside the
      // box, "cover" fills the box and crops. Mirrors CSS object-fit.
      sizing: {
        type: config.fit === "cover" ? "cover" : "contain",
        w: position.w,
        h: position.h,
      },
      altText: config.altText || undefined,
    });
  },
};

registerWidget(definition);
