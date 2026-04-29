"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  deleteInsightAction,
  renameInsightAction,
} from "@/app/(dashboard)/insights/manage-actions";

type Props = {
  insightId: string;
  /** Current title — used to seed the rename input. Pass null when
   *  the insight uses the auto-generated fallback. */
  currentTitle: string | null;
};

// Compact "more actions" button on each insight card. Two-dialog
// pattern: rename = inline form in dialog, delete = confirm dialog
// with explicit warning about cascading data loss (feedback +
// drilldowns dropped along with the row).
export function InsightActions({ insightId, currentTitle }: Props) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "size-8 shrink-0 p-0",
          )}
          aria-label="More actions"
        >
          <MoreHorizontal className="size-3.5" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-44 gap-0 p-1">
          <button
            type="button"
            onClick={() => {
              setPopoverOpen(false);
              setRenameOpen(true);
            }}
            className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors"
          >
            <Pencil className="size-3.5" />
            Rename
          </button>
          <button
            type="button"
            onClick={() => {
              setPopoverOpen(false);
              setDeleteOpen(true);
            }}
            className="hover:bg-destructive/10 hover:text-destructive flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-rose-600 transition-colors"
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
        </PopoverContent>
      </Popover>

      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        insightId={insightId}
        currentTitle={currentTitle}
      />
      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        insightId={insightId}
      />
    </>
  );
}

function RenameDialog({
  open,
  onOpenChange,
  insightId,
  currentTitle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  insightId: string;
  currentTitle: string | null;
}) {
  const [value, setValue] = useState(currentTitle ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await renameInsightAction({
        insightId,
        title: value,
      });
      if ("error" in result) {
        toast.error(`Rename gagal: ${result.error}`);
        return;
      }
      toast.success(
        value.trim().length > 0
          ? "Title diperbarui."
          : "Title direset ke generated.",
      );
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rename insight</DialogTitle>
          <DialogDescription>
            Title custom muncul di list dan share link. Kosongkan untuk
            kembali ke title yang AI generate.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Misal: W17 — debug GTM bocor 10%"
            maxLength={200}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Saving..." : "Simpan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  open,
  onOpenChange,
  insightId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  insightId: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteInsightAction({ insightId });
      if ("error" in result) {
        toast.error(`Delete gagal: ${result.error}`);
        return;
      }
      toast.success("Insight dihapus.");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
            <AlertTriangle className="size-5" />
            Hapus insight ini?
          </DialogTitle>
          <DialogDescription>
            Aksi ini permanen. Semua feedback (👍/👎) dan drill-down yang
            menempel pada insight ini juga ikut terhapus. Public share
            link (kalau aktif) langsung 404. Tidak bisa di-undo.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            <X className="size-3.5" />
            Batal
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleConfirm}
            disabled={isPending}
            className="bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600"
          >
            <Trash2 className="size-3.5" />
            {isPending ? "Menghapus..." : "Hapus permanen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
