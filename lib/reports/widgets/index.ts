// Side-effect registrations for every widget type. Importing this
// module loads + registers all widgets. Renderers (server-side) and
// any module that needs widgets to be discoverable should import from
// here instead of from `./registry` directly.
import "./text";
import "./kpi-card";
import "./line-chart";
import "./bar-chart";
import "./image";
import "./shape";
import "./divider";
import "./spacer";
import "./cover-block";
import "./table";
import "./ai-narrative";

// Re-export the lookup API so callers can `import { getWidgetDefinition }
// from "@/lib/reports/widgets"` and trust that all types are loaded.
export {
  getWidgetDefinition,
  getRegisteredWidgetTypes,
  type WidgetDefinition,
} from "./registry";
