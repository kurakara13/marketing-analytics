"use client";

import { useState, useTransition } from "react";
import { History, MoreVertical, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  disconnectConnectionAction,
  syncConnectionAction,
} from "@/app/(dashboard)/data-sources/actions";
import { BackfillDialog } from "./backfill-dialog";

type Props = {
  connectionId: string;
  accountName: string;
};

const RANGE_OPTIONS = [
  { label: "Sync kemarin", days: 1 as number | undefined },
  { label: "Sync 7 hari terakhir", days: 7 },
  { label: "Sync 30 hari terakhir", days: 30 },
] as const;

export function ConnectionMenu({ connectionId, accountName }: Props) {
  const [isPending, startTransition] = useTransition();
  const [backfillOpen, setBackfillOpen] = useState(false);

  function handleSync(days: number | undefined) {
    startTransition(async () => {
      const result = await syncConnectionAction({ connectionId, days });
      if ("error" in result) {
        toast.error(`Sync ${accountName} gagal: ${result.error}`);
        return;
      }
      toast.success(
        `Sync ${accountName}: ${result.recordsCount} baris tersimpan.`,
      );
    });
  }

  function handleDisconnect() {
    const ok = window.confirm(
      `Putuskan koneksi "${accountName}"? Semua metric tersinkron untuk akun ini akan ikut terhapus.`,
    );
    if (!ok) return;

    startTransition(async () => {
      const result = await disconnectConnectionAction({ connectionId });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Koneksi ${accountName} diputus.`);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Menu untuk ${accountName}`}
          disabled={isPending}
          className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring inline-flex size-8 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50"
        >
          <MoreVertical
            className={cn("size-4", isPending && "animate-pulse")}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Sync</DropdownMenuLabel>
            {RANGE_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.label}
                onClick={() => handleSync(option.days)}
                disabled={isPending}
              >
                <RefreshCw
                  className={cn("size-4", isPending && "animate-spin")}
                />
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setBackfillOpen(true)}
            disabled={isPending}
          >
            <History className="size-4" />
            Backfill range…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleDisconnect}
            disabled={isPending}
            variant="destructive"
          >
            <Trash2 className="size-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <BackfillDialog
        open={backfillOpen}
        onOpenChange={setBackfillOpen}
        connectionId={connectionId}
        accountName={accountName}
      />
    </>
  );
}
