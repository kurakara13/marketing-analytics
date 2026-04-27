"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { syncAllAction } from "@/app/(dashboard)/data-sources/actions";

export function SyncAllButton() {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await syncAllAction();
      if ("error" in result) {
        toast.error(`Sync all gagal: ${result.error}`);
        return;
      }
      if (result.total === 0) {
        toast.info("Tidak ada koneksi aktif untuk di-sync.");
        return;
      }
      if (result.failed === 0) {
        toast.success(
          `Sync selesai: ${result.succeeded}/${result.total} koneksi sukses.`,
        );
        return;
      }
      if (result.succeeded === 0) {
        const firstError = result.results.find((r) => !r.success)?.error;
        toast.error(
          `Sync gagal untuk semua ${result.total} koneksi${firstError ? ` (${firstError})` : "."}`,
        );
        return;
      }
      toast.warning(
        `Sync sebagian: ${result.succeeded} sukses, ${result.failed} gagal dari ${result.total}.`,
      );
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={isPending}
    >
      <RefreshCw className={cn("size-4", isPending && "animate-spin")} />
      {isPending ? "Syncing semua..." : "Sync all"}
    </Button>
  );
}
