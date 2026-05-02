import Link from "next/link";
import {
  Database,
  FileText,
  Plus,
  Settings as SettingsIcon,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";

// Quick-action chips at the bottom of the dashboard. Repeats the
// most-common starting points for each role in one row, so a user
// who scrolled past the morning brief can still bounce to wherever
// they need to go without scrolling back to the sidebar.
//
// Single primary action emphasized (Generate insight) — the rest
// are secondary outline-style chips.

const SECONDARY_SHORTCUTS = [
  { href: "/reports", label: "Susun Report", icon: FileText },
  { href: "/data-sources", label: "Data Sources", icon: Database },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

void Sparkles;

export function DashboardShortcuts() {
  return (
    <section className="flex flex-wrap items-center gap-2">
      <Link
        href="/insights"
        className={cn(
          "bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-[13px] font-medium shadow-sm transition-colors",
        )}
      >
        <Plus className="size-3.5" />
        Generate insight baru
      </Link>
      {SECONDARY_SHORTCUTS.map((s) => {
        const Icon = s.icon;
        return (
          <Link
            key={s.href}
            href={s.href}
            className={cn(
              "border-border/70 bg-card text-foreground hover:bg-muted/60 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-[13px] font-medium transition-colors",
            )}
          >
            <Icon className="text-muted-foreground/80 size-3.5" />
            {s.label}
          </Link>
        );
      })}
    </section>
  );
}
