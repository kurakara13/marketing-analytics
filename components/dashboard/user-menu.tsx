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
import { signOutAction } from "./sign-out-action";

type UserMenuProps = {
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

export function UserMenu({ name, email, image }: UserMenuProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Buka menu pengguna"
        className="focus-visible:ring-ring inline-flex size-8 items-center justify-center rounded-full transition-opacity outline-none hover:opacity-80 focus-visible:ring-2"
      >
        <Avatar className="size-8">
          {image ? <AvatarImage src={image} alt={name ?? email ?? ""} /> : null}
          <AvatarFallback>{initialsFor(name, email)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
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
