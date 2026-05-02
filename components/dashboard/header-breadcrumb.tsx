"use client";

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

// Pathname → display label mapping for the breadcrumb. The nav
// sidebar already shows where you are; the breadcrumb in the top
// header is more about anchoring the page title in editorial
// context (small italic eyebrow + plain section name).

const SECTION_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  "data-sources": "Data Sources",
  insights: "Insights",
  reports: "Reports",
  settings: "Settings",
  share: "Public Share",
};

const SECTION_EYEBROWS: Record<string, string> = {
  dashboard: "Today",
  "data-sources": "Connect",
  insights: "Analyze",
  reports: "Compose",
  settings: "Configure",
};

function pickRouteKey(pathname: string): string | null {
  // Strip leading slash, take first segment.
  const seg = pathname.replace(/^\//, "").split("/")[0];
  return seg && SECTION_LABELS[seg] ? seg : null;
}

export function HeaderBreadcrumb() {
  const pathname = usePathname();
  const key = pickRouteKey(pathname);
  if (!key) return null;

  const label = SECTION_LABELS[key];
  const eyebrow = SECTION_EYEBROWS[key];

  return (
    <div className="flex min-w-0 items-baseline gap-2.5">
      <span className={cn(
        "text-muted-foreground/70 font-display text-[11px] italic",
      )}>
        {eyebrow}
      </span>
      <ChevronRight className="text-muted-foreground/40 size-3 shrink-0 self-center" />
      <span className="text-foreground text-sm font-medium tracking-tight">
        {label}
      </span>
    </div>
  );
}
