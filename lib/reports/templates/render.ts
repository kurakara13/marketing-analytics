import PptxGenJS from "pptxgenjs";

import type { ReportData } from "@/lib/reports/fetch-report-data";
import { getWidgetDefinition } from "@/lib/reports/widgets/registry";
import type { RenderContext } from "@/lib/reports/widgets/render-context";

import type { TemplateDefinition } from "./types";

// ─── Master template renderer ───────────────────────────────────────────
//
// Iterates the template's slides in order, dispatches each widget to
// its registered renderer, and returns a Node Buffer ready to send to
// the client. Widgets render into pptxgenjs slide via the registered
// definition.
//
// Unknown widget types are skipped with a console warning rather than
// throwing — keeps the report usable when an old template references
// a widget type that's been removed in a newer build.
export async function renderTemplate(args: {
  template: { id: string; name: string; definition: TemplateDefinition };
  userId: string;
  reportData: ReportData;
}): Promise<Buffer> {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE"; // 13.333 × 7.5 inches (16:9)
  pres.title = args.template.name;
  pres.author = "Marketing Analytics Platform";
  pres.company = "Marketing Analytics";

  const context: RenderContext = {
    userId: args.userId,
    templateId: args.template.id,
    reportData: args.reportData,
    generatedAt: new Date().toISOString(),
  };

  for (const slideDef of args.template.definition.slides) {
    const slide = pres.addSlide();
    slide.background = { color: slideDef.background };

    for (const widget of slideDef.widgets) {
      const def = getWidgetDefinition(widget.type);
      if (!def) {
        console.warn(
          `[renderTemplate] Skipping unknown widget type "${widget.type}"`,
        );
        continue;
      }
      try {
        await def.render({ pres, slide, widget, context });
      } catch (err) {
        // Don't let one widget take down the whole render — log and
        // continue. The slide will be missing this widget; user can
        // diagnose from server logs.
        console.error(
          `[renderTemplate] Widget "${widget.type}" (id=${widget.id}) failed to render:`,
          err,
        );
      }
    }
  }

  // pptxgenjs returns Promise<Buffer | Blob | Uint8Array> depending on
  // outputType. "nodebuffer" gives us a Node Buffer for the API route.
  return (await pres.write({ outputType: "nodebuffer" })) as Buffer;
}
