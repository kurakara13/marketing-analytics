import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Info,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/db/schema";

// Top 3 most urgent observations across the user's recent insights,
// surfaced on the dashboard so the morning view answers
// "apa yang harus saya tangani hari ini?".
//
// Sorting:
//   1. Severity desc (alert → warning → info)
//   2. Within same severity: most recent insight first
//
// Each item links to the parent insight permalink so the user can
// drill in for full context + open the drilldown dialog.

type Props = {
  insights: Insight[];
};

const SEVERITY_ORDER: Record<string, number> = {
  alert: 0,
  warning: 1,
  info: 2,
};

const TONE_STYLES: Record<
  "alert" | "warning" | "info",
  {
    icon: typeof AlertCircle;
    pill: string;
    label: string;
    dot: string;
  }
> = {
  alert: {
    icon: AlertCircle,
    pill: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    label: "ALERT",
    dot: "bg-rose-500",
  },
  warning: {
    icon: AlertTriangle,
    pill: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    label: "WATCH",
    dot: "bg-amber-500",
  },
  info: {
    icon: Info,
    pill: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    label: "INFO",
    dot: "bg-sky-500",
  },
};

export function UrgentObservations({ insights }: Props) {
  // Flatten + sort. We attach the source insight to each so the
  // link can target /insights/<id> directly.
  type Flat = {
    insightId: string;
    insightTitle: string;
    title: string;
    description: string;
    severity: "alert" | "warning" | "info";
    createdAt: Date;
  };
  const flat: Flat[] = [];
  for (const i of insights) {
    for (const o of i.observations) {
      flat.push({
        insightId: i.id,
        insightTitle: i.title ?? `Insight ${i.windowStart} → ${i.windowEnd}`,
        title: o.title,
        description: o.description,
        severity: o.severity,
        createdAt: i.createdAt,
      });
    }
  }
  flat.sort((a, b) => {
    const sevA = SEVERITY_ORDER[a.severity] ?? 9;
    const sevB = SEVERITY_ORDER[b.severity] ?? 9;
    if (sevA !== sevB) return sevA - sevB;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  const top = flat.slice(0, 3);

  if (top.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <SectionEyebrow>3 hal paling urgen</SectionEyebrow>
      <ul className="flex flex-col gap-1.5">
        {top.map((item, i) => {
          const style = TONE_STYLES[item.severity];
          const Icon = style.icon;
          return (
            <li key={i}>
              <Link
                href={`/insights/${item.insightId}`}
                className={cn(
                  "group bg-card hover:border-border border-border/60 flex items-start gap-3 rounded-lg border p-4 transition-colors",
                )}
              >
                <Icon
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    item.severity === "alert" && "text-rose-600",
                    item.severity === "warning" && "text-amber-600",
                    item.severity === "info" && "text-sky-600",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wider",
                        style.pill,
                      )}
                    >
                      {style.label}
                    </span>
                    <h3 className="text-foreground text-[14px] font-medium leading-tight">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-muted-foreground line-clamp-2 text-[13px] leading-relaxed">
                    {item.description}
                  </p>
                </div>
                <ArrowRight className="text-muted-foreground/40 group-hover:text-foreground mt-1 size-4 shrink-0 transition-all group-hover:translate-x-0.5" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-muted-foreground/70 font-display text-[10.5px] font-medium uppercase tracking-[0.16em]">
        {children}
      </span>
      <span className="bg-border/70 h-px flex-1" />
    </div>
  );
}
