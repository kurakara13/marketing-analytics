"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { signOutAction } from "./sign-out-action";

type Props = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

function initialsFor(name?: string | null, email?: string | null): string {
  const source = (name ?? email ?? "?").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  const letters =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`
      : source.slice(0, 2);
  return letters.toUpperCase();
}

// Sidebar bottom-anchored user card. Shows avatar + name + email
// inline (not behind a dropdown), plus a small ⋯ menu for sign-out.
// Replaces the floating UserMenu avatar in the top header — that
// pattern works for app shells with crowded headers, but our header
// has no other content so the avatar floats awkwardly. Sidebar
// bottom is the more typical SaaS pattern for "account" affordance.
export function SidebarUserCard({ name, email, image }: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Buka menu akun"
        className={cn(
          "hover:bg-sidebar-accent/60 group flex w-full items-center gap-2.5 rounded-md p-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <Avatar className="size-8 shrink-0">
          {image ? <AvatarImage src={image} alt={name ?? email ?? ""} /> : null}
          <AvatarFallback className="text-[10px]">
            {initialsFor(name, email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 flex flex-col">
          <span className="text-sidebar-foreground truncate text-sm font-medium leading-tight">
            {name ?? "Pengguna"}
          </span>
          {email ? (
            <span className="text-sidebar-foreground/60 truncate text-[11px] leading-tight">
              {email}
            </span>
          ) : null}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-foreground text-sm font-medium">
              {name ?? "Pengguna"}
            </span>
            {email ? (
              <span className="text-muted-foreground text-xs font-normal">
                {email}
              </span>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            startTransition(async () => {
              await signOutAction();
            });
          }}
          disabled={isPending}
        >
          <LogOut className="size-4" />
          {isPending ? "Keluar..." : "Keluar"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
