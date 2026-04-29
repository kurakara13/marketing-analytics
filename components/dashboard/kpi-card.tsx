import { ArrowDown, ArrowUp, Minus, type LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  current: number;
  previous?: number;
  icon: LucideIcon;
  format?: (n: number) => string;
  hint?: string;
};

const defaultFormat = (n: number) => new Intl.NumberFormat("id-ID").format(n);
const FLAT_THRESHOLD_PERCENT = 0.1;

function deltaText(
  current: number,
  previous: number,
): {
  text: string;
  direction: "up" | "down" | "flat";
} {
  if (previous === 0 && current === 0) {
    return { text: "0%", direction: "flat" };
  }
  if (previous === 0) {
    // No baseline — current is "new" compared to the previous window.
    return { text: "baru", direction: "up" };
  }
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < FLAT_THRESHOLD_PERCENT) {
    return { text: "≈ 0%", direction: "flat" };
  }
  const sign = pct > 0 ? "+" : "";
  return {
    text: `${sign}${pct.toFixed(pct > 100 ? 0 : 1)}%`,
    direction: pct > 0 ? "up" : "down",
  };
}

// Refreshed KPI card — bigger primary number, clearer hierarchy:
//   icon-circle (label-color)   LABEL
//                                BIG NUMBER
//                                ↑ +28% (delta as colored chip)  hint
//
// Goal: the primary number dominates the card visually. Delta as a
// pill (rounded chip with bg) is more scannable than inline text.
// Hover slight elevation for grouped feel with siblings.
export function KpiCard({
  label,
  current,
  previous,
  icon: Icon,
  format = defaultFormat,
  hint,
}: Props) {
  const showDelta = previous !== undefined;
  const delta = showDelta ? deltaText(current, previous) : null;

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <div className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
            <Icon className="size-3.5" />
          </div>
          <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
            {label}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="text-foreground text-[28px] font-semibold leading-none tracking-tight tabular-nums">
            {format(current)}
          </div>
          <div className="flex items-center gap-2 min-h-5">
            {delta ? (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                  delta.direction === "up" &&
                    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
                  delta.direction === "down" &&
                    "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
                  delta.direction === "flat" &&
                    "bg-muted text-muted-foreground",
                )}
                title={`Sebelumnya: ${format(previous!)}`}
              >
                {delta.direction === "up" ? (
                  <ArrowUp className="size-3" />
                ) : delta.direction === "down" ? (
                  <ArrowDown className="size-3" />
                ) : (
                  <Minus className="size-3" />
                )}
                {delta.text}
              </span>
            ) : null}
            {hint ? (
              <span className="text-muted-foreground text-[11px]">{hint}</span>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
