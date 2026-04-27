import { ArrowDown, ArrowUp, Minus, type LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {label}
        </CardTitle>
        <Icon className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-semibold tracking-tight">
            {format(current)}
          </div>
          {delta ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium",
                delta.direction === "up" &&
                  "text-emerald-700 dark:text-emerald-400",
                delta.direction === "down" &&
                  "text-rose-700 dark:text-rose-400",
                delta.direction === "flat" && "text-muted-foreground",
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
        </div>
        {hint ? (
          <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
