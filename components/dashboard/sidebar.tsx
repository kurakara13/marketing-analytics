"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Database,
  FileText,
  LayoutDashboard,
  Settings,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { SidebarUserCard } from "./sidebar-user-card";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/data-sources", label: "Data Sources", icon: Database },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/insights", label: "Insights", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-0.5 p-3">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground",
            )}
          >
            {/* Active indicator bar — subtle vertical accent that
             *  shifts in via group transitions. */}
            {active ? (
              <span
                aria-hidden
                className="bg-primary absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full"
              />
            ) : null}
            <Icon
              className={cn(
                "size-4 transition-colors",
                active
                  ? "text-primary"
                  : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground",
              )}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SidebarBrand() {
  return (
    <Link
      href="/dashboard"
      className="text-sidebar-foreground flex h-14 items-center gap-2.5 border-b px-4"
    >
      <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md shadow-sm">
        <BarChart3 className="size-4" />
      </div>
      <span className="text-sm font-semibold tracking-tight">
        Marketing Analytics
      </span>
    </Link>
  );
}

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
    <aside className="bg-sidebar text-sidebar-foreground hidden w-60 shrink-0 flex-col border-r md:flex">
      <SidebarBrand />
      <SidebarNav />
      <div className="border-t p-2">
        <SidebarUserCard
          name={user.name}
          email={user.email}
          image={user.image}
        />
      </div>
    </aside>
  );
}
