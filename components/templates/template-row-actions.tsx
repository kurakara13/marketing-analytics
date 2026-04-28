"use client";

import { useTransition } from "react";
import { MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteTemplateAction } from "@/app/(dashboard)/reports/templates/actions";

type Props = {
  templateId: string;
  name: string;
};

export function TemplateRowActions({ templateId, name }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const ok = window.confirm(
      `Hapus template "${name}"? Tindakan ini tidak bisa dibatalkan.`,
    );
    if (!ok) return;

    startTransition(async () => {
      const result = await deleteTemplateAction({ templateId });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Template "${name}" dihapus.`);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Menu untuk ${name}`}
        disabled={isPending}
        className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-md outline-none disabled:pointer-events-none disabled:opacity-50"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={handleDelete}
          disabled={isPending}
          variant="destructive"
        >
          <Trash2 className="size-4" />
          Hapus
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
