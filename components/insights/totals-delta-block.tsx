import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/db/schema";

// Displays totals deltas between two insights' input snapshots. Each
// row shows: metric label, newer value, older value, delta % with
// directional arrow (up=green for "more is better" metrics, red for
// "more is worse" — currently we treat all metrics as "more is better"
// since we don't track CPL/CPA totals here).

const numberFmt = new Intl.NumberFormat("id-ID");
function fmtRupiah(n: number): string {
  if (n === 0) return "Rp 0";
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}K`;
  return `Rp ${numberFmt.format(Math.round(n))}`;
}
function fmtNum(n: number): string {
  return numberFmt.format(Math.round(n));
}
function pctDelta(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return null; // can't compute pct from 0 base
  return ((current - previous) / previous) * 100;
}

const METRIC_DEFS: Array<{
  key: string;
  label: string;
  fmt: (n: number) => string;
}> = [
  { key: "sessions", label: "Sessions", fmt: fmtNum },
  { key: "pageviews", label: "Pageviews", fmt: fmtNum },
  { key: "conversions", label: "Conversions", fmt: fmtNum },
  { key: "revenue", label: "Revenue", fmt: fmtRupiah },
  { key: "impressions", label: "Impressions", fmt: fmtNum },
  { key: "clicks", label: "Clicks", fmt: fmtNum },
  { key: "spend", label: "Spend", fmt: fmtRupiah },
  { key: "organicClicks", label: "Organic clicks", fmt: fmtNum },
  { key: "organicImpressions", label: "Organic impressions", fmt: fmtNum },
];

export function TotalsDeltaBlock({
  newer,
  older,
}: {
  newer: Insight;
  older: Insight;
}) {
  const newerTotals = newer.inputSnapshot.totals as Record<string, number>;
  const olderTotals = older.inputSnapshot.totals as Record<string, number>;

  // Filter out metrics that are zero in BOTH snapshots — they're noise
  // (e.g. organic_* when Search Console isn't connected).
  const visible = METRIC_DEFS.filter(
    (m) => (newerTotals[m.key] ?? 0) !== 0 || (olderTotals[m.key] ?? 0) !== 0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pergeseran metrik</CardTitle>
        <CardDescription>
          Total per metrik di window masing-masing insight. Delta dihitung
          dari ({newer.windowStart} → {newer.windowEnd}) terhadap ({older.windowStart} → {older.windowEnd}).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="text-muted-foreground text-sm italic">
            Tidak ada metrik yang punya nilai di kedua window.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((m) => {
              const newerVal = newerTotals[m.key] ?? 0;
              const olderVal = olderTotals[m.key] ?? 0;
              const delta = pctDelta(newerVal, olderVal);

              return (
                <div
                  key={m.key}
                  className="border-border/60 flex flex-col gap-0.5 rounded-md border bg-muted/20 p-3"
                >
                  <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                    {m.label}
                  </span>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-foreground text-base font-semibold tabular-nums">
                      {m.fmt(newerVal)}
                    </span>
                    <DeltaPill delta={delta} />
                  </div>
                  <span className="text-muted-foreground/80 text-[11px] tabular-nums">
                    sebelumnya {m.fmt(olderVal)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DeltaPill({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <span className="text-muted-foreground text-[11px] italic">baru</span>
    );
  }
  if (delta === 0) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-0.5 text-[11px] tabular-nums">
        <Minus className="size-3" />
        0%
      </span>
    );
  }
  const isUp = delta > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
        isUp
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
      )}
    >
      {isUp ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {isUp ? "+" : ""}
      {delta.toFixed(1)}%
    </span>
  );
}
