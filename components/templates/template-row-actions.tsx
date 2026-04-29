"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  AlertTriangle,
  Copy,
  MoreVertical,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteTemplateAction,
  duplicateTemplateAction,
  renameTemplateAction,
} from "@/app/(dashboard)/reports/actions";

type Props = {
  templateId: string;
  name: string;
  description: string | null;
};

// Three-action menu on each report card: Rename, Duplicate, Delete.
// Mirror of the InsightActions pattern — dialog-based confirmation
// (not native confirm) for delete because the data loss is heavy
// (entire template + slide layout dropped on cascade).
export function TemplateRowActions({
  templateId,
  name,
  description,
}: Props) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateTemplateAction({ templateId });
      if ("error" in result) {
        toast.error(`Duplicate gagal: ${result.error}`);
        return;
      }
      toast.success("Report duplicated. Membuka editor…");
      router.push(`/reports/${result.templateId}/edit`);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Menu untuk ${name}`}
          disabled={isPending}
          className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-md outline-none disabled:pointer-events-none disabled:opacity-50"
        >
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setRenameOpen(true)}>
            <Pencil className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDuplicate} disabled={isPending}>
            <Copy className="size-4" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            variant="destructive"
          >
            <Trash2 className="size-4" />
            Hapus
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        templateId={templateId}
        currentName={name}
        currentDescription={description}
      />
      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        templateId={templateId}
        name={name}
      />
    </>
  );
}

function RenameDialog({
  open,
  onOpenChange,
  templateId,
  currentName,
  currentDescription,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templateId: string;
  currentName: string;
  currentDescription: string | null;
}) {
  const [name, setName] = useState(currentName);
  const [description, setDescription] = useState(currentDescription ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length === 0) {
      toast.error("Nama tidak boleh kosong.");
      return;
    }
    startTransition(async () => {
      const result = await renameTemplateAction({
        templateId,
        name,
        description,
      });
      if ("error" in result) {
        toast.error(`Rename gagal: ${result.error}`);
        return;
      }
      toast.success("Report diperbarui.");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rename report</DialogTitle>
          <DialogDescription>
            Update nama + deskripsi. Berlaku langsung di list dan tab
            browser saat membuka editor.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rename-name">Nama</Label>
            <Input
              id="rename-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              autoFocus
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rename-description">Deskripsi (opsional)</Label>
            <Input
              id="rename-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder="Misal: laporan weekly untuk management meeting"
            />
          </div>
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
  templateId,
  name,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templateId: string;
  name: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteTemplateAction({ templateId });
      if ("error" in result) {
        toast.error(`Delete gagal: ${result.error}`);
        return;
      }
      toast.success(`Report "${name}" dihapus.`);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
            <AlertTriangle className="size-5" />
            Hapus report ini?
          </DialogTitle>
          <DialogDescription>
            Aksi ini permanen. Semua slide, widget, dan layout report{" "}
            <strong>"{name}"</strong> akan terhapus. Generated .pptx file
            yang sudah ter-download di komputer Anda tetap aman, tapi
            template sumber-nya hilang. Tidak bisa di-undo.
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
