"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cancelSelectionAction, confirmSelectionAction } from "./actions";

type AccountOption = {
  id: string;
  name: string;
};

type Props = {
  connectorName: string;
  accounts: AccountOption[];
};

export function SelectForm({ connectorName, accounts }: Props) {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === accounts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(accounts.map((a) => a.id)));
    }
  }

  function handleConfirm() {
    if (selected.size === 0) {
      toast.error("Pilih minimal satu akun untuk dihubungkan.");
      return;
    }
    startTransition(async () => {
      const result = await confirmSelectionAction({
        selectedAccountIds: Array.from(selected),
      });
      if (result && "error" in result) {
        toast.error(result.error);
      }
      // success: server action redirected to /data-sources
    });
  }

  function handleCancel() {
    startTransition(async () => {
      await cancelSelectionAction();
    });
  }

  const allSelected = selected.size === accounts.length && accounts.length > 0;
  const someSelected = selected.size > 0 && !allSelected;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        OAuth ke {connectorName} sukses. Pilih akun yang ingin dihubungkan —
        hanya akun yang dicentang yang akan tersinkron datanya.
      </p>

      <div className="rounded-md border">
        <label className="bg-muted/40 flex items-center gap-3 border-b px-4 py-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={allSelected}
            // Native checkbox doesn't have indeterminate via attribute —
            // we reflect via ref or just use a visual hint. Skip indeterminate
            // for simplicity; "select all" toggles either way.
            data-indeterminate={someSelected}
            onChange={toggleAll}
            className="border-input size-4 rounded"
            disabled={isPending}
          />
          <span className="flex-1">Pilih semua</span>
          <span className="text-muted-foreground text-xs font-normal">
            {selected.size}/{accounts.length} dipilih
          </span>
        </label>

        <ul className="divide-y">
          {accounts.map((account) => {
            const checked = selected.has(account.id);
            return (
              <li key={account.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 px-4 py-3 text-sm",
                    "hover:bg-muted/40",
                    checked && "bg-primary/5",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(account.id)}
                    className="border-input size-4 rounded"
                    disabled={isPending}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{account.name}</div>
                    <div className="text-muted-foreground truncate font-mono text-xs">
                      {account.id}
                    </div>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          disabled={isPending}
        >
          Batal
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={isPending || selected.size === 0}
        >
          {isPending
            ? "Menyimpan..."
            : `Connect ${selected.size} akun terpilih`}
        </Button>
      </div>
    </div>
  );
}
