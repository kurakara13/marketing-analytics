"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Database,
  FileText,
  LayoutDashboard,
  Settings,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { SidebarUserCard } from "./sidebar-user-card";

// ─── Nav config ────────────────────────────────────────────────────
//
// Direction A — "Quiet Refinement". Nav items are grouped under
// editorial micro-caps section labels (OVERVIEW, ANALYZE, ACCOUNT)
// rather than rendered as one flat list. The three groups separate
// "viewing data" from "interpreting data" from "managing the
// account" — visual chunking helps when there are 5+ items.
//
// Each item can carry an optional `count` chip (rendered to the
// right of the label). Today these are static; they'd be wired to
// real counts (unread insights, sync errors) when we have time.

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  count?: number;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/data-sources", label: "Data Sources", icon: Database },
    ],
  },
  {
    label: "Analyze",
    items: [
      { href: "/insights", label: "Insights", icon: Sparkles },
      { href: "/reports", label: "Reports", icon: FileText },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

// ─── SidebarNav ────────────────────────────────────────────────────
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-6 px-3 py-4">
      {navGroups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          {/* Editorial section label — Fraunces serif at small size,
              tracked-out caps. Sets the editorial tone. */}
          <div className="text-sidebar-foreground/45 mb-1 px-3 font-display text-[10px] font-medium uppercase tracking-[0.18em]">
            {group.label}
          </div>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] font-medium transition-all duration-150 ease-out",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "size-[15px] shrink-0 transition-all",
                    active
                      ? "text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/55 group-hover:text-sidebar-foreground/85",
                  )}
                  strokeWidth={active ? 2.25 : 1.75}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {item.count ? (
                  <span
                    className={cn(
                      "tabular-nums shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      active
                        ? "bg-sidebar-primary-foreground/15 text-sidebar-primary-foreground"
                        : "bg-sidebar-accent text-sidebar-foreground/70",
                    )}
                  >
                    {item.count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

// ─── SidebarBrand ──────────────────────────────────────────────────
//
// Editorial wordmark: Fraunces display serif, paired with a single
// dot mark in primary (emerald). The wordmark is split across two
// lines ("Marketing" / "Analytics") so it reads with a bit of
// rhythm rather than fitting into one cramped row. The dot — small
// but present — anchors the identity without a heavy logo block.
export function SidebarBrand() {
  return (
    <Link
      href="/dashboard"
      className="text-sidebar-foreground group flex h-16 items-center gap-3 border-b border-sidebar-border/70 px-5"
    >
      <span
        aria-hidden
        className="bg-primary block size-2 shrink-0 rounded-full transition-transform duration-300 group-hover:scale-125"
      />
      <div className="flex min-w-0 flex-col leading-[1.05]">
        <span className="font-display text-[15px] font-medium tracking-tight">
          Marketing
        </span>
        <span className="font-display text-sidebar-foreground/55 text-[15px] font-normal italic tracking-tight">
          Analytics
        </span>
      </div>
    </Link>
  );
}

// ─── DesktopSidebar ────────────────────────────────────────────────
export function DesktopSidebar({
  user,
}: {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}) {
  return (
    <aside className="bg-sidebar text-sidebar-foreground hidden w-[264px] shrink-0 flex-col border-r border-sidebar-border md:flex">
      <SidebarBrand />
      <SidebarNav />
      <div className="border-t border-sidebar-border/70 p-2">
        <SidebarUserCard
          name={user.name}
          email={user.email}
          image={user.image}
        />
      </div>
    </aside>
  );
}
