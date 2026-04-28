import type PptxGenJS from "pptxgenjs";

import type { Widget, WidgetType } from "@/lib/reports/templates/types";
import type { RenderContext } from "./render-context";

// ─── WidgetDefinition contract ──────────────────────────────────────────
//
// Every widget type plugs into this shape. The registry below is the
// single dispatch point used by the template renderer; adding a new
// widget type is purely additive (no changes to existing widgets).
//
// `TConfig` is the widget's config shape (validated by the Zod schemas
// in lib/reports/templates/types.ts). The renderer receives an already-
// parsed widget, so type narrowing flows naturally to the right
// definition.
//
// Note: builder UI components (config form) are deliberately separate
// from this server-side registry — server should never import React /
// client-only modules. The builder UI imports its own `formRegistry`
// keyed by widget type.
export type WidgetDefinition<W extends Widget = Widget> = {
  type: W["type"];
  /** Bumped when the config shape for THIS widget changes incompatibly. */
  configSchemaVersion: number;
  /** Default `position` used when adding the widget to a fresh slide. */
  defaultPosition: { x: number; y: number; w: number; h: number };
  /** Default `config` used when adding the widget to a fresh slide. */
  defaultConfig: W["config"];
  /** Human-readable label shown in the "Add widget" menu. */
  label: string;
  /** One-line description used as a tooltip / subtitle in the picker. */
  description: string;
  /**
   * Render this widget into the given pptxgenjs slide. May call any of
   * the slide's add* methods. Position/size from `widget.position`
   * (already in PPT inches).
   */
  render(args: {
    pres: PptxGenJS;
    slide: PptxGenJS.Slide;
    widget: W;
    context: RenderContext;
  }): void | Promise<void>;
};

// ─── Registry ───────────────────────────────────────────────────────────
//
// Filled at module-load time by side-effect imports below. Renderer
// dispatches via `getWidgetDefinition(widget.type)`.
//
// Adding a new widget type:
//   1. Implement WidgetDefinition in lib/reports/widgets/<type>.ts
//   2. Import + register here
//   3. Add config schema + union variant in lib/reports/templates/types.ts
const registry = new Map<WidgetType, WidgetDefinition>();

export function registerWidget<W extends Widget>(
  definition: WidgetDefinition<W>,
): void {
  if (registry.has(definition.type)) {
    throw new Error(
      `Widget type "${definition.type}" is already registered. ` +
        `Each type must be registered exactly once.`,
    );
  }
  // The cast is safe: WidgetDefinition<W> is structurally compatible
  // with WidgetDefinition<Widget> for any union member W.
  registry.set(definition.type, definition as unknown as WidgetDefinition);
}

export function getWidgetDefinition(
  type: WidgetType,
): WidgetDefinition | undefined {
  return registry.get(type);
}

export function getRegisteredWidgetTypes(): WidgetType[] {
  return Array.from(registry.keys());
}

// ─── Side-effect registrations ──────────────────────────────────────────
// Importing these files registers their definitions. Every widget type
// that can render must be listed here.
import "./text";
import "./kpi-card";
import "./line-chart";
